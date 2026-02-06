import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '../entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { ICartItem } from '../../cart/types/types';
import { OrderValidationService } from './order-validation.service';
import { PandascrowEscrowService } from './pandascrow-escrow.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { CartService } from '../../cart/cart.service';

@Injectable()
export class OrderCreationService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly validationService: OrderValidationService,
    private readonly pandascrowEscrow: PandascrowEscrowService,
    private readonly paystack: PaystackService,
    private readonly escrowService: EscrowService,
    private readonly transactions: TransactionsService,
    private readonly deliveryService: DeliveryService,
    private readonly storeService: StoreService,
    private readonly cache: CacheService,
    private readonly cartService: CartService,
  ) {}

  /* ────────────────────────────────────────────────
   CREATE ORDER (PANDASCROW ONE-TIME ESCROW)
──────────────────────────────────────────────── */
  async createPandaEscrowOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, order_items } = data;

    /* BUYER */
    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const { validatedItems } =
      await this.validationService.buildOrderItems(order_items);

    /* GROUP ITEMS BY VENDOR */
    const groups =
      await this.validationService.groupItemsByVendor(validatedItems);

    const orders: Order[] = [];

    for (const vendor_id of Object.keys(groups)) {
      /* VENDOR */
      const vendor = await this.userRepo.findOne({ where: { id: vendor_id } });
      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const items = groups[vendor_id];

      /* CALCULATE SUBTOTAL */
      let subtotal = 0;
      for (const item of items) {
        subtotal += (item.discount_price ?? item.price) * item.quantity;
      }

      /* INIT PANDASCROW ESCROW */
      const escrowResponse = await this.pandascrowEscrow.initializeEscrow({
        title: 'Marketplace Order',
        description: 'Purchase of items via marketplace',
        acceptance_criteria: 'Items delivered as listed',

        currency: 'NGN',
        amount: subtotal,

        inspection_period: '3',
        delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],

        who_pay_fees: 'buyer',
        dispute_window: '2',
        how_dispute_is_handled: 'platform',

        buyer_details: {
          name: `${buyer.first_name} ${buyer.last_name}`,
          email: buyer.email,
          phone: buyer.phone_number ?? 'N/A',
        },
      });

      /* CREATE ORDER */
      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id: buyer.id,
        vendor_id: vendor.id,
        escrow_id: null, // Pandascrow uses numeric ID, not UUID
        subtotal,
        shipping_fee: 0,
        tax: null,
        total: subtotal,
        payment_method: 'panda',
        payment_reference: escrowResponse.data.transaction_ref,
        payment_url: escrowResponse.data.payment_url,
        payment_status: 'pending',
        status: 'pending',
        order_items: items,
        notes: JSON.stringify({
          pandascrow_escrow_id: escrowResponse.data.escrow_id,
          escrow_type: escrowResponse.data.type,
          escrow_status: escrowResponse.data.status,
        }),
      });

      const savedOrder = await this.orderRepo.save(order);
      orders.push(savedOrder);

      /* TRANSACTION: ESCROW HOLD */
      await this.transactions.create({
        order_id: savedOrder.id,
        escrow_id: undefined, // No internal escrow for Panda orders
        user_id: buyer.id,
        vendor_id: vendor.id,
        type: 'escrow_hold',
        amount: subtotal,
        currency: 'NGN',
        reference: escrowResponse.data.transaction_ref,
        status: 'pending',
        description: 'Funds held in Panda escrow',
        metadata: {
          provider: 'pandascrow',
          pandascrow_escrow_id: escrowResponse.data.escrow_id,
          escrow_type: escrowResponse.data.type,
        },
      });
    }

    await this.cache.clearPrefix('svc:order');
    await this.cartService.clearCart(buyer_id);

    return {
      success: true,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
   COMPLETE ORDER (PANDASCROW API)
──────────────────────────────────────────────── */
  async completePandaEscrowOrder(data: { order_id: string; otp: string }) {
    const { order_id, otp } = data;

    const order = await this.orderRepo.findOne({
      where: { id: order_id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment_method !== 'panda') {
      throw new BadRequestException('Order is not a Panda escrow order');
    }

    /* EXTRACT PANDASCROW ESCROW ID FROM NOTES */
    let pandascrowEscrowId: number;
    try {
      const metadata = JSON.parse(order.notes || '{}');
      pandascrowEscrowId = metadata.pandascrow_escrow_id;
      if (!pandascrowEscrowId) {
        throw new Error('Pandascrow escrow ID not found in order metadata');
      }
    } catch (err) {
      throw new BadRequestException(
        'Invalid order metadata or missing Pandascrow escrow ID',
      );
    }

    /* COMPLETE ESCROW ON PANDASCROW */
    await this.pandascrowEscrow.completeEscrow({
      escrow_id: pandascrowEscrowId,
      otp,
    });

    /* UPDATE ORDER */
    await this.orderRepo.update(order.id, {
      status: 'completed',
      payment_status: 'success',
    });

    /* TRANSACTION: PAYOUT */
    await this.transactions.create({
      order_id: order.id,
      escrow_id: undefined,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      type: 'payout',
      amount: order.total,
      currency: 'NGN',
      status: 'success',
      description: 'Panda escrow completed and funds released',
      metadata: {
        provider: 'pandascrow',
        pandascrow_escrow_id: pandascrowEscrowId,
      },
    });

    await this.cache.clearPrefix('svc:order');

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     CREATE OFFLINE ORDER (MULTI-VENDOR)
  ──────────────────────────────────────────────── */
  async createOfflineOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
    tax?: number;
    notes?: string;
  }) {
    const { buyer_id, order_items, tax = 0, notes } = data;

    const { validatedItems } =
      await this.validationService.buildOrderItems(order_items);

    const groups =
      await this.validationService.groupItemsByVendor(validatedItems);

    const orders: Order[] = [];

    for (const vendor_id of Object.keys(groups)) {
      const vendorItems = groups[vendor_id];

      let subtotal = 0;
      for (const i of vendorItems) {
        subtotal += (i.discount_price ?? i.price) * i.quantity;
      }

      const total = subtotal + tax;

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        order_items: vendorItems,
        subtotal,
        tax,
        total,
        payment_method: 'offline',
        payment_status: 'unpaid',
        status: 'pending',
        notes: notes ?? null,
      });

      const saved = await this.orderRepo.save(order);
      orders.push(saved);

      await this.transactions.create({
        order_id: saved.id,
        user_id: buyer_id,
        vendor_id,
        type: 'order_created',
        amount: total,
        currency: 'NGN',
        status: 'pending',
        description: 'Offline order created',
      });

      await this.deliveryService.createDelivery({
        order_id: saved.id,
        buyer_id,
        vendor_id,
      });
    }

    await this.cache.clearPrefix('svc:order');
    await this.cartService.clearCart(buyer_id);

    return {
      success: true,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
   CREATE ONLINE ORDER (PAYSTACK + ESCROW — SINGLE PAYMENT)
──────────────────────────────────────────────── */
  async createOnlineOrder(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, email, order_items } = data;

    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const { validatedItems } =
      await this.validationService.buildOrderItems(order_items);

    /* GROUP ITEMS BY VENDOR */
    const groups =
      await this.validationService.groupItemsByVendor(validatedItems);

    /* VALIDATE VENDORS + CALCULATE GRAND TOTAL IN KOBO */
    let grandTotalKobo = 0;

    for (const vendor_id of Object.keys(groups)) {
      await this.storeService.validateVendorForOnline(vendor_id);

      for (const item of groups[vendor_id]) {
        const priceKobo = Math.round((item.discount_price ?? item.price) * 100);
        grandTotalKobo += priceKobo * item.quantity;
      }
    }

    // Convert to naira for Paystack
    const grandTotalNaira = grandTotalKobo / 100;

    /* INIT SINGLE PAYSTACK PAYMENT */
    const payment = await this.paystack.initializePayment(
      email,
      grandTotalNaira,
    );
    const reference = payment.reference;

    const orders: Order[] = [];

    /* CREATE ORDERS + ESCROWS */
    for (const vendor_id of Object.keys(groups)) {
      const items = groups[vendor_id];

      // Calculate subtotal in kobo
      let subtotalKobo = 0;
      for (const item of items) {
        const priceKobo = Math.round((item.discount_price ?? item.price) * 100);
        subtotalKobo += priceKobo * item.quantity;
      }

      // Convert to naira for storage
      const subtotal = subtotalKobo / 100;

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        order_items: items,
        subtotal,
        total: subtotal,
        payment_method: 'online',
        payment_reference: reference, // 🔥 SAME FOR ALL
        payment_url: payment.authorization_url,
        payment_access_code: payment.access_code,
        payment_status: 'pending',
        status: 'pending',
        notes: JSON.stringify({
          // Store kobo values for verification
          subtotal_kobo: subtotalKobo,
          total_kobo: subtotalKobo,
        }),
      });

      const savedOrder = await this.orderRepo.save(order);
      orders.push(savedOrder);

      /* CREATE ESCROW PER ORDER */
      const escrow = await this.escrowService.createEscrow({
        order_id: savedOrder.id,
        buyer_id,
        vendor_id,
        amount: subtotal,
      });

      await this.orderRepo.update(savedOrder.id, {
        escrow_id: escrow.id,
      });
    }

    await this.cache.clearPrefix('svc:order');
    await this.cartService.clearCart(buyer_id);

    return {
      success: true,
      payment_url: payment.authorization_url,
      reference,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
   CREATE ONLINE ORDER (PAYSTACK — SINGLE PAYMENT)
   Direct payment with 2% platform fee, no escrow
──────────────────────────────────────────────── */
  async createOnlineOrderNoEscrow(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, email, order_items } = data;

    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) throw new NotFoundException('Buyer not found');

    const { validatedItems } =
      await this.validationService.buildOrderItems(order_items);

    /* GROUP BY VENDOR */
    const groups =
      await this.validationService.groupItemsByVendor(validatedItems);

    const vendorIds = Object.keys(groups);

    /* CALCULATE GRAND TOTAL WITH 2% PLATFORM FEE - ALL IN KOBO */
    let subtotalKobo = 0;
    const vendorSubtotals: Record<string, number> = {};

    // First pass: calculate all vendor subtotals
    for (const vendor_id of vendorIds) {
      let vendorSubtotalKobo = 0;
      for (const item of groups[vendor_id]) {
        const priceKobo = Math.round((item.discount_price ?? item.price) * 100);
        vendorSubtotalKobo += priceKobo * item.quantity;
      }
      vendorSubtotals[vendor_id] = vendorSubtotalKobo;
      subtotalKobo += vendorSubtotalKobo;
    }

    // Calculate platform fee ONCE on the grand total
    const platformFeeKobo = Math.round(subtotalKobo * 0.02);
    const grandTotalKobo = subtotalKobo + platformFeeKobo;

    // Convert to naira for Paystack
    const grandTotalNaira = grandTotalKobo / 100;

    /* PREPARE PAYSTACK OPTIONS (SUBACCOUNT) */
    const paystackOptions: any = {};

    // If SINGLE VENDOR, use Split Payment (Subaccount)
    if (vendorIds.length === 1) {
      const vendorId = vendorIds[0];
      const store = await this.storeService.getStoreByUser(vendorId);

      if (store && store.paystack_subaccount_code) {
        paystackOptions.subaccount = store.paystack_subaccount_code;
        paystackOptions.bearer = 'subaccount'; // Store pays Paystack fees
      }
    }

    /* INIT SINGLE PAYSTACK PAYMENT */
    const payment = await this.paystack.initializePayment(
      email,
      grandTotalNaira,
      paystackOptions,
    );
    const reference = payment.reference;

    const orders: Order[] = [];
    let distributedPlatformFeeKobo = 0;

    // Distribute platform fee proportionally across vendors
    for (let i = 0; i < vendorIds.length; i++) {
      const vendor_id = vendorIds[i];
      const items = groups[vendor_id];
      const vendorSubtotalKobo = vendorSubtotals[vendor_id];

      let vendorPlatformFeeKobo: number;

      if (i === vendorIds.length - 1) {
        // Last vendor gets remaining fee to ensure exact match
        vendorPlatformFeeKobo = platformFeeKobo - distributedPlatformFeeKobo;
      } else {
        // Proportional distribution
        vendorPlatformFeeKobo = Math.round(
          (vendorSubtotalKobo / subtotalKobo) * platformFeeKobo,
        );
        distributedPlatformFeeKobo += vendorPlatformFeeKobo;
      }

      const vendorTotalKobo = vendorSubtotalKobo + vendorPlatformFeeKobo;

      // Convert back to naira for storage
      const vendorSubtotal = vendorSubtotalKobo / 100;
      const vendorPlatformFee = vendorPlatformFeeKobo / 100;
      const vendorTotal = vendorTotalKobo / 100;

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        subtotal: vendorSubtotal,
        shipping_fee: vendorPlatformFee, // Store platform fee in shipping_fee field
        total: vendorTotal,
        payment_method: 'online',
        payment_reference: reference, // 🔥 SAME REF
        payment_url: payment.authorization_url,
        payment_access_code: payment.access_code,
        payment_status: 'pending',
        status: 'pending',
        order_items: items,
        escrow_id: null,
        notes: JSON.stringify({
          platform_fee: vendorPlatformFee,
          fee_percentage: 2,
          // Store kobo values for verification
          subtotal_kobo: vendorSubtotalKobo,
          platform_fee_kobo: vendorPlatformFeeKobo,
          total_kobo: vendorTotalKobo,
        }),
      });

      const saved = await this.orderRepo.save(order);
      orders.push(saved);
    }

    await this.cache.clearPrefix('svc:order');
    await this.cartService.clearCart(buyer_id);

    return {
      success: true,
      payment_url: payment.authorization_url,
      reference,
      orders,
    };
  }
}

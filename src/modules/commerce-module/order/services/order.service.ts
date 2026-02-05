import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { DeliveryService } from '../../delivery/delivery.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';
import { ICartItem } from '../../cart/types/types';
import { ProductService } from '../../product/services/product.service';
import { PandascrowEscrowService } from './pandascrow-escrow.service';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';
import { CartService } from '../../cart/cart.service';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly deliveryService: DeliveryService,
    private readonly escrowService: EscrowService,
    private readonly pandascrowEscrow: PandascrowEscrowService,
    private readonly transactions: TransactionsService,
    private readonly storeService: StoreService,
    private readonly paystack: PaystackService,
    private readonly mail: OrderMailService,
    private readonly cache: CacheService,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
  ) {}

  /* ────────────────────────────────────────────────
     VALIDATE & BUILD ORDER ITEMS
  ──────────────────────────────────────────────── */
  private async buildOrderItems(order_items: ICartItem[]) {
    if (!order_items || order_items.length === 0) {
      throw new BadRequestException('Order items are required');
    }

    let subtotal = 0;
    const validated: ICartItem[] = [];

    for (const item of order_items) {
      const { product } = await this.productService.getSingle(item.product_id);

      if (!product) {
        throw new BadRequestException(`Product not found: ${item.product_id}`);
      }

      if (item.quantity < 1 || item.quantity > product.stock) {
        throw new BadRequestException(`Invalid quantity for ${product.name}`);
      }

      // Only use discount_price if product is on_sale
      const price =
        product.on_sale && product.discount_price
          ? product.discount_price
          : product.price;
      subtotal += price * item.quantity;

      validated.push({
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        discount_price: product.on_sale ? product.discount_price : null,
        image: product.image?.url ?? null,
        quantity: item.quantity,
        size: item.size ?? null,
        color: item.color ?? null,
        shipping_cost: product.shipping_cost ?? null,
      });
    }

    return { validatedItems: validated, subtotal };
  }

  async getOrdersByPaymentReference(reference: string) {
    return this.orderRepo.find({
      where: { payment_reference: reference },
      relations: ['buyer', 'vendor'],
    });
  }

  async markPaid(orderId: string) {
    await this.orderRepo.update(orderId, {
      payment_status: 'success',
      status: 'paid',
    });
  }

  async markCompleted(orderId: string) {
    await this.orderRepo.update(orderId, {
      status: 'completed',
    });
  }

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

    const { validatedItems } = await this.buildOrderItems(order_items);

    /* GROUP ITEMS BY VENDOR */
    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);
      if (!groups[product.vendor_id]) {
        groups[product.vendor_id] = [];
      }
      groups[product.vendor_id].push(item);
    }

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

    const { validatedItems } = await this.buildOrderItems(order_items);

    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);

      if (!groups[product!.vendor_id]) {
        groups[product!.vendor_id] = [];
      }
      groups[product!.vendor_id].push(item);
    }

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

      const delivery = await this.deliveryService.createDelivery({
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

    const { validatedItems } = await this.buildOrderItems(order_items);

    /* GROUP ITEMS BY VENDOR */
    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);
      groups[product.vendor_id] ??= [];
      groups[product.vendor_id].push(item);
    }

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

    const { validatedItems } = await this.buildOrderItems(order_items);

    /* GROUP BY VENDOR */
    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);
      groups[product.vendor_id] ??= [];
      groups[product.vendor_id].push(item);
    }

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

    // Convert to naira for Paystack (they expect amount in naira, will convert to kobo internally)
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

  /* ────────────────────────────────────────────────
   VERIFY PAYMENT (MULTI-ORDER, SINGLE REFERENCE)
──────────────────────────────────────────────── */
  /* ────────────────────────────────────────────────
   VERIFY PAYMENT (MULTI-ORDER, SINGLE REFERENCE)
──────────────────────────────────────────────── */
  async verifyPayment(reference: string) {
    /* FETCH ALL ORDERS FOR THIS PAYMENT */
    const orders = await this.orderRepo.find({
      where: { payment_reference: reference },
    });

    if (!orders.length) {
      throw new NotFoundException('Orders not found for this payment');
    }

    /* IDEMPOTENCY CHECK */
    if (orders.every((o) => o.payment_status === 'success')) {
      return {
        success: true,
        idempotent: true,
        orders,
      };
    }

    /* VERIFY PAYSTACK ONCE */
    const verification = await this.paystack.verifyPayment(reference);

    if (verification.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }

    // Paystack returns amount in kobo (smallest denomination)
    const amountPaidKobo = verification.amount;

    // Calculate expected total in kobo for exact comparison
    let expectedTotalKobo = 0;

    for (const order of orders) {
      // Try to get kobo value from notes first (for new orders)
      try {
        const metadata = JSON.parse(order.notes || '{}');
        if (metadata.total_kobo) {
          expectedTotalKobo += metadata.total_kobo;
        } else {
          // Fallback: convert naira to kobo (for old orders)
          expectedTotalKobo += Math.round(Number(order.total) * 100);
        }
      } catch {
        // If notes parsing fails, convert naira to kobo
        expectedTotalKobo += Math.round(Number(order.total) * 100);
      }
    }

    // Exact comparison in kobo (no floating point issues)
    if (amountPaidKobo !== expectedTotalKobo) {
      throw new BadRequestException(
        `Payment amount mismatch. Expected: ₦${(expectedTotalKobo / 100).toFixed(2)} (${expectedTotalKobo} kobo), Paid: ₦${(amountPaidKobo / 100).toFixed(2)} (${amountPaidKobo} kobo), Difference: ${Math.abs(amountPaidKobo - expectedTotalKobo)} kobo`,
      );
    }

    /* PROCESS EACH ORDER IN A TRANSACTION */
    // Using transaction ensures that if any order update fails, they ALL fail.
    // This prevents partial payment states where some orders are paid and others are pending.
    return await this.dataSource.transaction(async (manager) => {
      for (const order of orders) {
        if (order.payment_status === 'success') continue;

        // 1. Update Order Status (Transactional)
        await manager.update(Order, order.id, {
          payment_status: 'success',
          status: 'paid',
        });

        // 2. Fund Escrow (Side Effect)
        /* FUND ESCROW (IF ANY) */
        if (order.escrow_id) {
          await this.escrowService.fundEscrow(order.escrow_id);
        }

        // 3. Create Delivery (Side Effect)
        /* CREATE DELIVERY */
        await this.deliveryService.createDelivery({
          order_id: order.id,
          buyer_id: order.buyer_id,
          vendor_id: order.vendor_id,
        });

        // 4. Record Transaction (Side Effect)
        /* TRANSACTION RECORD */
        await this.transactions.create({
          order_id: order.id,
          escrow_id: order.escrow_id ?? undefined,
          user_id: order.buyer_id,
          vendor_id: order.vendor_id,
          type: 'payment_confirmed',
          amount: order.total,
          currency: 'NGN',
          status: 'success',
          description: 'Payment verified manually',
          metadata: {
            provider: 'paystack',
            reference,
          },
        });
      }

      await this.cache.clearPrefix('svc:order');

      // Return updated state
      // We can just return the original orders marked as success to avoid another fetch
      // or fetch them again if we want the absolute latest state from DB.
      // For performance, we'll map the status update locally for the response.
      const updatedOrders = orders.map((o) => ({
        ...o,
        payment_status: 'success' as PaymentStatus,
        status: 'paid' as OrderStatus,
      }));

      return {
        success: true,
        message: 'Payment verified',
        orders: updatedOrders,
      };
    });
  }

  /* ────────────────────────────────────────────────
     GET ORDERS
  ──────────────────────────────────────────────── */
  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrderForApi(id: string, user_id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['delivery', 'vendor'],
      select: {
        delivery: {
          id: true,
          delivery_status: true,
          tracking_number: true,
          estimated_delivery: true,
          delivered_at: true,
          address: true,
          city: true,
          state: true,
          country: true,
          postal_code: true,
        },
        vendor: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Check if the user is the buyer of this order
    if (order.buyer_id !== user_id) {
      throw new UnauthorizedException(
        'You are not authorized to view this order',
      );
    }

    return {
      status: 'success',
      message: 'Order retrieved successfully',
      data: order,
    };
  }

  async getOrdersByUser(
    buyer_id: string,
    query?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo.createQueryBuilder('order');

    qb.where('order.buyer_id = :buyer_id', { buyer_id });

    if (query?.status && query.status !== 'all') {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    if (query?.search) {
      qb.andWhere(
        '(CAST(order.id AS TEXT) ILIKE :search OR order.payment_reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Optimize selection for card display
    qb.select([
      'order.id',
      'order.total',
      'order.status',
      'order.payment_status',
      'order.payment_reference',
      'order.created_at',
      'order.order_items', // JSONB column, cannot verify fields easily without raw SQL
      'delivery.id',
      'delivery.delivery_status',
      'delivery.tracking_number',
      'delivery.estimated_delivery',
      'delivery.delivered_at',
    ]);

    // Join delivery relation
    qb.leftJoinAndSelect('order.delivery', 'delivery');

    qb.orderBy('order.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return buildPagination(data, total, page, limit);
  }

  async getOrdersByVendor(vendor_id: string) {
    return this.orderRepo.find({ where: { vendor_id } });
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS
  ──────────────────────────────────────────────── */
  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.getOrder(id);

    await this.orderRepo.update(id, { status });

    if (status === 'delivered' && order.payment_method === 'online') {
      await this.escrowService.markDelivered(order.id);
    }

    await this.cache.clearPrefix('svc:order');
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     CANCEL ORDER
  ──────────────────────────────────────────────── */
  async cancelOrder(id: string, requestedBy: string) {
    const order = await this.getOrder(id);

    if (requestedBy !== order.buyer_id && requestedBy !== order.vendor_id) {
      throw new BadRequestException('Unauthorized');
    }

    if (['delivered', 'completed'].includes(order.status)) {
      throw new BadRequestException('Completed orders cannot be canceled');
    }

    await this.orderRepo.update(id, { status: 'canceled' });

    if (order.escrow_id && order.payment_method === 'online') {
      await this.escrowService.refundEscrow(order.escrow_id, requestedBy);
    }

    await this.cache.clearPrefix('svc:order');

    return { success: true };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '../entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { ICartItem } from '../../cart/types/types';
import { OrderValidationService } from './order-validation.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { CartService } from '../../cart/cart.service';
import { StoreDeliveryRateService } from 'src/modules/vendor-module/store/services/store-delivery-rate.service';

@Injectable()
export class OnlineOrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly validationService: OrderValidationService,
    private readonly paystack: PaystackService,
    private readonly escrowService: EscrowService,
    private readonly storeService: StoreService,
    private readonly cache: CacheService,
    private readonly cartService: CartService,
    private readonly deliveryRateService: StoreDeliveryRateService,
  ) {}

  /**
   * Create online order (Paystack + Escrow — SINGLE PAYMENT)
   */
  async createOnlineOrder(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
    delivery_rate_id?: string;
  }) {
    const { buyer_id, email, order_items } = data;

    const lockKey = `lock:order:create:${buyer_id}`;
    const acquired = await this.cache.acquireLock(lockKey, 10);
    if (!acquired) {
      throw new ConflictException(
        'An order is already being processed. Please wait.',
      );
    }

    try {
      const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
      if (!buyer) {
        throw new NotFoundException('Buyer not found');
      }

      const { validatedItems } = await this.validationService.buildOrderItems(
        order_items,
        buyer_id,
      );

      /* GROUP ITEMS BY VENDOR */
      const groups =
        await this.validationService.groupItemsByVendor(validatedItems);

      /* VALIDATE VENDORS + CALCULATE GRAND TOTAL IN KOBO */
      let subtotalKobo = 0;
      let totalShippingKobo = 0;
      const vendorSubtotals: Record<string, number> = {};
      const vendorShippingFees: Record<string, number> = {};

      for (const vendor_id of Object.keys(groups)) {
        await this.storeService.validateVendorForOnline(vendor_id);

        let vendorSubtotalKobo = 0;
        let vendorMaxShippingKobo = 0;

        // Use delivery rate ID if provided and matches vendor
        if (data.delivery_rate_id) {
          const rate = await this.deliveryRateService.getRateById(
            data.delivery_rate_id,
          );
          const store = await this.storeService.getStoreByUser(vendor_id);
          if (rate && rate.store_id === store.id) {
            vendorMaxShippingKobo = Number(rate.fee) * 100; // Convert to Kobo
          }
        }

        for (const item of groups[vendor_id]!) {
          vendorSubtotalKobo += item.unit_price * item.quantity;
        }

        vendorSubtotals[vendor_id] = vendorSubtotalKobo;
        vendorShippingFees[vendor_id] = vendorMaxShippingKobo;
        subtotalKobo += vendorSubtotalKobo;
        totalShippingKobo += vendorMaxShippingKobo;
      }

      /*
       * FEE MODEL v2
       * ─────────────────────────────────────────────────────────────
       * Buyer pays:  subtotal + shipping + 1% buyer-fee (capped ₦2,000). That's it.
       */
      const BUYER_FEE_RATE = 0.01; // 1%
      const BUYER_FEE_CAP_KOBO = 200_000; // ₦2,000 cap

      const rawBuyerFeeKobo = Math.round(subtotalKobo * BUYER_FEE_RATE);
      const buyerPlatformFeeKobo = Math.min(rawBuyerFeeKobo, BUYER_FEE_CAP_KOBO);
      const platformFeeKobo = buyerPlatformFeeKobo;
      const grandTotalKobo =
        subtotalKobo + totalShippingKobo + buyerPlatformFeeKobo;

      /* PREPARE PAYSTACK METADATA */
      const paystackMetadata = {
        cart_items: validatedItems.map((item) => ({
          id: item.product_id,
          name: item.name,
          vendor: item.vendor_id,
          qty: item.quantity,
          price: item.unit_price,
        })),
        vendors: Object.keys(groups).map((vId) => ({
          vendor_id: vId,
          subtotal: vendorSubtotals[vId],
          shipping: vendorShippingFees[vId],
        })),
        platform_fee: platformFeeKobo,
        order_type: 'escrow_order',
      };

      /* INIT SINGLE PAYSTACK PAYMENT */
      const payment = await this.paystack.initializePayment(
        email,
        grandTotalKobo,
        { metadata: paystackMetadata },
      );
      const reference = payment.reference;

      const orders: Order[] = [];
      let distributedPlatformFeeKobo = 0;

      /* CREATE ORDERS + ESCROWS */
      const vendorIds = Object.keys(groups);
      for (let i = 0; i < vendorIds.length; i++) {
        const vendor_id = vendorIds[i]!;
        const items = groups[vendor_id]!;
        const vendorSubtotalKobo = vendorSubtotals[vendor_id]!;
        const vendorShippingFeeKobo = vendorShippingFees[vendor_id]!;

        let vendorPlatformFeeKobo: number;
        if (i === vendorIds.length - 1) {
          vendorPlatformFeeKobo = platformFeeKobo - distributedPlatformFeeKobo;
        } else {
          vendorPlatformFeeKobo = Math.round(
            (vendorSubtotalKobo / (subtotalKobo || 1)) * platformFeeKobo,
          );
          distributedPlatformFeeKobo += vendorPlatformFeeKobo;
        }

        const vendorTotalKobo =
          vendorSubtotalKobo + vendorShippingFeeKobo + vendorPlatformFeeKobo;

        const order = this.orderRepo.create({
          id: uuidv4(),
          buyer_id,
          vendor_id,
          order_items: items,
          subtotal: vendorSubtotalKobo,
          shipping_fee: vendorShippingFeeKobo,
          platform_fee: vendorPlatformFeeKobo,
          total: vendorTotalKobo,
          payment_method: 'online',
          payment_reference: reference,
          payment_url: payment.authorization_url,
          payment_access_code: payment.access_code,
          payment_status: 'pending',
          status: 'pending',
          notes: JSON.stringify({
            subtotal_kobo: vendorSubtotalKobo,
            shipping_fee_kobo: vendorShippingFeeKobo,
            platform_fee_kobo: vendorPlatformFeeKobo,
            total_kobo: vendorTotalKobo,
          }),
        });

        const savedOrder = await this.orderRepo.save(order);
        orders.push(savedOrder);

        /* CREATE ESCROW PER ORDER */
        const escrow = await this.escrowService.createEscrow({
          order_id: savedOrder.id,
          buyer_id,
          vendor_id,
          amount: vendorSubtotalKobo,
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
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  /**
   * Create online order without escrow (Direct payment with 1.5% platform split)
   */
  async createOnlineOrderNoEscrow(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
    delivery_rate_id?: string;
  }) {
    const { buyer_id, email, order_items } = data;

    const lockKey = `lock:order:create:${buyer_id}`;
    const acquired = await this.cache.acquireLock(lockKey, 10);
    if (!acquired) {
      throw new ConflictException(
        'An order is already being processed. Please wait.',
      );
    }

    try {
      const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
      if (!buyer) throw new NotFoundException('Buyer not found');

      const { validatedItems } = await this.validationService.buildOrderItems(
        order_items,
        buyer_id,
      );

      /* GROUP BY VENDOR */
      const groups =
        await this.validationService.groupItemsByVendor(validatedItems);

      const vendorIds = Object.keys(groups);

      /* CALCULATE GRAND TOTAL */
      let subtotalKobo = 0;
      let totalShippingKobo = 0;
      const vendorSubtotals: Record<string, number> = {};
      const vendorShippingFees: Record<string, number> = {};

      for (const vendor_id of vendorIds) {
        let vendorSubtotalKobo = 0;
        let vendorMaxShippingKobo = 0;

        if (data.delivery_rate_id) {
          const rate = await this.deliveryRateService.getRateById(
            data.delivery_rate_id,
          );
          const store = await this.storeService.getStoreByUser(vendor_id);
          if (rate && rate.store_id === store.id) {
            vendorMaxShippingKobo = Number(rate.fee) * 100;
          }
        }

        for (const item of groups[vendor_id]!) {
          vendorSubtotalKobo += item.unit_price * item.quantity;
        }

        vendorSubtotals[vendor_id] = vendorSubtotalKobo;
        vendorShippingFees[vendor_id] = vendorMaxShippingKobo;
        subtotalKobo += vendorSubtotalKobo;
        totalShippingKobo += vendorMaxShippingKobo;
      }

      const BUYER_FEE_RATE = 0.01;
      const BUYER_FEE_CAP_KOBO = 200_000;
      const VENDOR_FEE_RATE = 0.015;

      const rawBuyerFeeKobo = Math.round(subtotalKobo * BUYER_FEE_RATE);
      const buyerPlatformFeeKobo = Math.min(rawBuyerFeeKobo, BUYER_FEE_CAP_KOBO);
      const platformFeeKobo = buyerPlatformFeeKobo;
      const grandTotalKobo =
        subtotalKobo + totalShippingKobo + buyerPlatformFeeKobo;
      const reference = `ref_${uuidv4().replace(/-/g, '')}`;

      /* PAYSTACK OPTIONS */
      const paystackOptions: any = {
        metadata: {
          cart_items: validatedItems.map((item) => ({
            id: item.product_id,
            name: item.name,
            vendor: item.vendor_id,
            qty: item.quantity,
            price: item.unit_price,
          })),
          vendors: vendorIds.map((vId) => ({
            vendor_id: vId,
            subtotal: vendorSubtotals[vId],
            shipping: vendorShippingFees[vId],
          })),
          platform_fee: platformFeeKobo,
          order_type: 'direct_order',
        },
      };

      if (vendorIds.length === 1) {
        const vendorId = vendorIds[0]!;
        const store = await this.storeService.getStoreByUser(vendorId);
        if (!store || !store.paystack_subaccount_code) {
          throw new BadRequestException(
            'Vendor not verified for online payments',
          );
        }

        const vendorGross =
          vendorSubtotals[vendorId]! + vendorShippingFees[vendorId]!;
        const vendorShare = Math.floor(vendorGross * (1 - VENDOR_FEE_RATE));

        const splitPayload = {
          name: `Marketplace Split - ${reference}`,
          type: 'flat',
          currency: 'NGN',
          subaccounts: [
            {
              subaccount: store.paystack_subaccount_code,
              share: vendorShare,
            },
          ],
          bearer_type: 'subaccount',
          bearer_subaccount: store.paystack_subaccount_code,
        };

        const splitData = await this.paystack.createSplit(splitPayload as any);
        paystackOptions.split_code = splitData.split_code;
      } else {
        // Multi-vendor split
        const paystackFeeKobo = Math.min(
          Math.ceil(grandTotalKobo * 0.015) + 10_000,
          200_000,
        );

        const splitSubaccounts: { subaccount: string; share: number }[] = [];
        const totalGross = subtotalKobo + totalShippingKobo;

        for (const vId of vendorIds) {
          const store = await this.storeService.getStoreByUser(vId);
          if (!store || !store.paystack_subaccount_code) {
            throw new BadRequestException(
              'One or more vendors not verified for online payments',
            );
          }

          const vendorGross = vendorSubtotals[vId]! + vendorShippingFees[vId]!;
          const vendorPaystackFeeShare = Math.round(
            (vendorGross / (totalGross || 1)) * paystackFeeKobo,
          );
          const vendorPlatformCut = Math.round(vendorGross * VENDOR_FEE_RATE);
          const vendorShare = Math.floor(
            vendorGross - vendorPlatformCut - vendorPaystackFeeShare,
          );

          splitSubaccounts.push({
            subaccount: store.paystack_subaccount_code,
            share: Math.max(vendorShare, 0),
          });
        }

        const totalAllocated = splitSubaccounts.reduce((s, v) => s + v.share, 0);
        const diff =
          grandTotalKobo - platformFeeKobo - paystackFeeKobo - totalAllocated;
        if (diff !== 0 && splitSubaccounts.length > 0) {
          splitSubaccounts[splitSubaccounts.length - 1]!.share += diff;
        }

        if (splitSubaccounts.length > 0) {
          const splitPayload = {
            name: `Marketplace Split - ${reference}`,
            type: 'flat' as const,
            currency: 'NGN',
            subaccounts: splitSubaccounts,
            bearer_type: 'account' as const,
          };
          const splitData = await this.paystack.createSplit(splitPayload);
          paystackOptions.split_code = splitData.split_code;
        }
      }

      /* INIT PAYMENT */
      const payment = await this.paystack.initializePayment(
        email,
        grandTotalKobo,
        { ...paystackOptions, reference },
      );

      const orders: Order[] = [];
      let distributedPlatformFeeKobo = 0;

      for (let i = 0; i < vendorIds.length; i++) {
        const vendor_id = vendorIds[i]!;
        const items = groups[vendor_id]!;
        const vendorSubtotalKobo = vendorSubtotals[vendor_id]!;
        const vendorShippingFeeKobo = vendorShippingFees[vendor_id]!;

        let vendorPlatformFeeKobo: number;
        if (i === vendorIds.length - 1) {
          vendorPlatformFeeKobo = platformFeeKobo - distributedPlatformFeeKobo;
        } else {
          vendorPlatformFeeKobo = Math.round(
            (vendorSubtotalKobo / (subtotalKobo || 1)) * platformFeeKobo,
          );
          distributedPlatformFeeKobo += vendorPlatformFeeKobo;
        }

        const vendorTotalKobo =
          vendorSubtotalKobo + vendorShippingFeeKobo + vendorPlatformFeeKobo;

        const order = this.orderRepo.create({
          id: uuidv4(),
          buyer_id,
          vendor_id,
          subtotal: vendorSubtotalKobo,
          shipping_fee: vendorShippingFeeKobo,
          platform_fee: vendorPlatformFeeKobo,
          total: vendorTotalKobo,
          payment_method: 'online',
          payment_reference: reference,
          payment_url: payment.authorization_url,
          payment_access_code: payment.access_code,
          payment_status: 'pending',
          status: 'pending',
          order_items: items,
          notes: JSON.stringify({
            platform_fee_kobo: vendorPlatformFeeKobo,
            shipping_fee_kobo: vendorShippingFeeKobo,
            buyer_platform_fee_kobo: buyerPlatformFeeKobo,
            vendor_fee_rate: VENDOR_FEE_RATE,
            buyer_fee_rate: BUYER_FEE_RATE,
            subtotal_kobo: vendorSubtotalKobo,
            total_kobo: vendorTotalKobo,
          }),
        });

        const saved = await this.orderRepo.save(order);
        orders.push(saved);
      }

      await this.cache.clearPrefix('svc:order');
      await this.cartService.removeSpecificItems(buyer_id, validatedItems);

      return {
        success: true,
        payment_url: payment.authorization_url,
        reference,
        orders,
      };
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }
}

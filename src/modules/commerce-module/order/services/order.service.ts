import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ICartItem } from '../../cart/types/types';
import { OrderStatus } from '../entities/order.entity';
import { OnlineOrderService } from './online-order.service';
import { OfflineOrderService } from './offline-order.service';
import { PandaOrderService } from './panda-order.service';
import { OrderSummaryService } from './order-summary.service';
import { OrderQueryService } from './order-query.service';
import { OrderManagementService } from './order-management.service';
import { OrderPaymentVerificationService } from './order-payment-verification.service';
import { ReceiptService } from './receipt.service';

/**
 * Main Order Service - Orchestrates and delegates to specialized services
 * This service acts as a facade, maintaining backward compatibility with existing controllers
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly onlineOrderService: OnlineOrderService,
    private readonly offlineOrderService: OfflineOrderService,
    private readonly pandaOrderService: PandaOrderService,
    private readonly summaryService: OrderSummaryService,
    private readonly queryService: OrderQueryService,
    private readonly managementService: OrderManagementService,
    private readonly paymentVerificationService: OrderPaymentVerificationService,
    private readonly receiptService: ReceiptService,
  ) {}

  /* ────────────────────────────────────────────────
     ORDER CREATION METHODS
  ──────────────────────────────────────────────── */

  /**
   * Create order with Pandascrow escrow
   */
  async createPandaEscrowOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
  }) {
    return this.pandaOrderService.createPandaEscrowOrder(data);
  }

  /**
   * Get checkout summary for multi-vendor split
   */
  async getCheckoutSummary(data: {
    buyer_id: string;
    order_items: ICartItem[];
  }) {
    return this.summaryService.getCheckoutSummary(data);
  }

  /**
   * Complete Pandascrow escrow order
   */
  async completePandaEscrowOrder(data: { order_id: string; otp: string }) {
    return this.pandaOrderService.completePandaEscrowOrder(data);
  }

  /**
   * Create offline order (for checkout by buyer)
   */
  async createOfflineOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
    tax?: number;
    notes?: string;
  }) {
    return this.offlineOrderService.createOfflineOrder(data);
  }

  /**
   * Record Vendor Offline Sale (for manual vendor sales)
   */
  async recordVendorOfflineSale(data: {
    vendor_id: string;
    items: { product_id: string; variant_id?: string; quantity: number }[];
    customer_name?: string;
    customer_email?: string;
    notes?: string;
  }) {
    return this.offlineOrderService.recordVendorOfflineSale(data);
  }

  /**
   * Create online order with escrow
   */
  async createOnlineOrder(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
    delivery_rate_id?: string;
  }) {
    return this.onlineOrderService.createOnlineOrder(data);
  }

  /**
   * Create online order without escrow (direct payment with 2% platform fee)
   */
  async createOnlineOrderNoEscrow(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
    delivery_rate_id?: string;
  }) {
    return this.onlineOrderService.createOnlineOrderNoEscrow(data);
  }

  /* ────────────────────────────────────────────────
     PAYMENT VERIFICATION
  ──────────────────────────────────────────────── */

  /**
   * Verify payment for multi-order, single reference
   */
  async verifyPayment(reference: string) {
    return this.paymentVerificationService.verifyPayment(reference);
  }

  /* ────────────────────────────────────────────────
     ORDER QUERY METHODS
  ──────────────────────────────────────────────── */

  /**
   * Get orders by payment reference
   */
  async getOrdersByPaymentReference(reference: string) {
    return this.queryService.getOrdersByPaymentReference(reference);
  }

  /**
   * Get single order by ID
   */
  async getOrder(id: string) {
    return this.queryService.getOrder(id);
  }

  /**
   * Get order receipt as PDF buffer
   */
  async getOrderReceiptPdf(id: string, userId: string) {
    const order = await this.queryService.getOrderForReceipt(id);

    // Verify ownership
    if (order.buyer_id !== userId && order.vendor_id !== userId) {
      throw new Error('Unauthorized');
    }

    return this.receiptService.generateReceiptPdf(order);
  }

  /**
   * Get order for API with relations
   */
  async getOrderForApi(id: string, user_id: string) {
    return this.queryService.getOrderForApi(id, user_id);
  }

  /**
   * Get orders by user (buyer)
   */
  async getOrdersByUser(
    buyer_id: string,
    query?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.queryService.getOrdersByUser(buyer_id, query);
  }

  /**
   * Get orders by vendor
   */
  async getOrdersByVendor(
    vendor_id: string,
    query?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.queryService.getOrdersByVendor(vendor_id, query);
  }

  /* ────────────────────────────────────────────────
     ORDER MANAGEMENT METHODS
  ──────────────────────────────────────────────── */

  /**
   * Mark order as paid
   */
  async markPaid(orderId: string) {
    return this.managementService.markPaid(orderId);
  }

  /**
   * Mark order as completed
   */
  async markCompleted(orderId: string) {
    return this.managementService.markCompleted(orderId);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, status: OrderStatus) {
    return this.managementService.updateOrderStatus(id, status);
  }

  /**
   * Cancel order
   */
  async cancelOrder(id: string, requestedBy: string) {
    return this.managementService.cancelOrder(id, requestedBy);
  }
}

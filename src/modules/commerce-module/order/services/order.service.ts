import { Injectable } from '@nestjs/common';
import { ICartItem } from '../../cart/types/types';
import { OrderStatus } from '../entities/order.entity';
import { OrderCreationService } from './order-creation.service';
import { OrderQueryService } from './order-query.service';
import { OrderManagementService } from './order-management.service';
import { OrderPaymentVerificationService } from './order-payment-verification.service';

/**
 * Main Order Service - Orchestrates and delegates to specialized services
 * This service acts as a facade, maintaining backward compatibility with existing controllers
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly creationService: OrderCreationService,
    private readonly queryService: OrderQueryService,
    private readonly managementService: OrderManagementService,
    private readonly paymentVerificationService: OrderPaymentVerificationService,
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
    return this.creationService.createPandaEscrowOrder(data);
  }

  /**
   * Complete Pandascrow escrow order
   */
  async completePandaEscrowOrder(data: { order_id: string; otp: string }) {
    return this.creationService.completePandaEscrowOrder(data);
  }

  /**
   * Create offline order
   */
  async createOfflineOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
    tax?: number;
    notes?: string;
  }) {
    return this.creationService.createOfflineOrder(data);
  }

  /**
   * Create online order with escrow
   */
  async createOnlineOrder(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    return this.creationService.createOnlineOrder(data);
  }

  /**
   * Create online order without escrow (direct payment with 2% platform fee)
   */
  async createOnlineOrderNoEscrow(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    return this.creationService.createOnlineOrderNoEscrow(data);
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

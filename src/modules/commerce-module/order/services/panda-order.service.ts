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
import { PandascrowEscrowService } from './pandascrow-escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { CartService } from '../../cart/cart.service';

@Injectable()
export class PandaOrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly validationService: OrderValidationService,
    private readonly pandascrowEscrow: PandascrowEscrowService,
    private readonly transactions: TransactionsService,
    private readonly cache: CacheService,
    private readonly cartService: CartService,
  ) {}

  /**
   * Create order (PandaEscrow one-time escrow)
   */
  async createPandaEscrowOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, order_items } = data;

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

      const groups =
        await this.validationService.groupItemsByStore(validatedItems);

      const orders: Order[] = [];

      for (const group of groups) {
        const { store_id, vendor_id } = group;
        const vendor = await this.userRepo.findOne({
          where: { id: vendor_id },
        });
        if (!vendor) throw new NotFoundException('Vendor not found');

        const items = group.items;
        let subtotalKobo = 0;
        for (const item of items) {
          subtotalKobo += item.unit_price * item.quantity;
        }

        const escrowResponse = await this.pandascrowEscrow.initializeEscrow({
          title: 'Marketplace Order',
          description: 'Purchase of items via marketplace',
          acceptance_criteria: 'Items delivered as listed',
          currency: 'NGN',
          amount: subtotalKobo / 100,
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

        const order = this.orderRepo.create({
          id: uuidv4(),
          buyer_id: buyer.id,
          vendor_id: vendor.id,
          store_id: store_id,
          escrow_id: null,
          subtotal: subtotalKobo,
          shipping_fee: 0,
          total: subtotalKobo,
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
            subtotal_kobo: subtotalKobo,
          }),
        });

        const savedOrder = await this.orderRepo.save(order);
        orders.push(savedOrder);

        await this.transactions.create({
          order_id: savedOrder.id,
          user_id: buyer.id,
          vendor_id: vendor.id,
          type: 'escrow_hold',
          amount: subtotalKobo,
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

      return { success: true, orders };
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  /**
   * Complete Panda escrow order
   */
  async completePandaEscrowOrder(data: { order_id: string; otp: string }) {
    const { order_id, otp } = data;
    const order = await this.orderRepo.findOne({ where: { id: order_id } });

    if (!order) throw new NotFoundException('Order not found');
    if (order.payment_method !== 'panda') {
      throw new BadRequestException('Order is not a Panda escrow order');
    }

    let pandascrowEscrowId = 0;
    try {
      const metadata = JSON.parse(order.notes || '{}') as {
        pandascrow_escrow_id?: number;
      };
      pandascrowEscrowId = metadata.pandascrow_escrow_id ?? 0;
      if (!pandascrowEscrowId) throw new Error('ID not found');
    } catch {
      throw new BadRequestException('Invalid order metadata');
    }

    await this.pandascrowEscrow.completeEscrow({
      escrow_id: pandascrowEscrowId,
      otp,
    });

    await this.orderRepo.update(order.id, {
      status: 'completed',
      payment_status: 'success',
    });

    await this.transactions.create({
      order_id: order.id,
      user_id: order.buyer_id!,
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
}

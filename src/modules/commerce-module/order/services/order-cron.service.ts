import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';

@Injectable()
export class OrderCronService {
  private readonly logger = new Logger(OrderCronService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly orderMailService: OrderMailService,
  ) {}

  /**
   * Automatically fails orders that are unpaid and older than 24 hours.
   * Runs daily at 2:00 AM.
   */
  @Cron('0 2 * * *')
  async handleStaleOrders() {
    this.logger.log('Starting stale orders cleanup task...');

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 1. Find stale orders (unpaid and > 24h old)
    const staleOrders = await this.orderRepo.find({
      where: {
        status: 'pending',
        payment_status: In(['pending', 'unpaid']),
        created_at: LessThan(twentyFourHoursAgo),
      },
      relations: ['buyer', 'vendor', 'vendor.stores'],
    });

    if (staleOrders.length === 0) {
      this.logger.log('No stale orders found.');
      return;
    }

    this.logger.log(`Found ${staleOrders.length} stale orders to process.`);

    for (const order of staleOrders) {
      try {
        // 2. Update status to failed
        await this.orderRepo.update(order.id, {
          status: 'failed',
          payment_status: 'failed',
        });

        // 3. Notify Buyer via OrderMailService
        if (order.buyer?.email) {
          await this.orderMailService.sendOrderFailedPaymentTimeout({
            email: order.buyer.email,
            name: order.buyer.first_name || 'Customer',
            order: {
              id: order.id,
              status: 'failed',
              total: Number(order.total) / 100,
            },
          });
        }

        // 4. Notify Vendor via OrderMailService
        if (order.vendor?.email) {
          await this.orderMailService.sendVendorOrderFailedPaymentTimeout({
            email: order.vendor.email,
            name: order.vendor.first_name || 'Vendor',
            vendorName: order.vendor.first_name || 'Vendor',
            storeName: order.vendor.stores?.[0]?.store_name || 'your store',
            order: {
              id: order.id,
              status: 'failed',
              total: Number(order.total) / 100,
            },
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to process stale order ${order.id}:`,
          error.message,
        );
      }
    }

    this.logger.log(
      `Successfully processed ${staleOrders.length} stale orders.`,
    );
  }
}

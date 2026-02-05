import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { UploadService } from 'src/common/services/upload.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { DeliveryMailService } from 'src/modules/shared-module/email/services/delivery-mail.service';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly escrowService: EscrowService,
    private readonly upload: UploadService,
    private readonly cache: CacheService,
    private readonly mail: DeliveryMailService,
  ) {}

  private async getVendorEmailAndStoreName(vendorId: string) {
    return this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.store', 's')
      .select(['u.email', 'u.first_name', 's.store_name'])
      .where('u.id = :id', { id: vendorId })
      .getOne();
  }

  /* ────────────────────────────────────────────────
     1️⃣ CREATE DELIVERY (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async createDelivery(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    courier_id?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    tracking_number?: string | null;
    estimated_delivery?: Date | null;
  }) {
    const { order_id, buyer_id, vendor_id } = data;

    if (!order_id || !buyer_id || !vendor_id) {
      throw new BadRequestException('Missing required delivery fields');
    }

    const cacheKey = `delivery:order:${order_id}`;
    const cached = await this.cache.get<Delivery>(cacheKey);
    if (cached) return cached;

    const existing = await this.deliveryRepo.findOne({ where: { order_id } });
    if (existing) {
      await this.cache.set(cacheKey, existing);
      return existing;
    }

    const order = await this.orderRepo.findOne({ where: { id: order_id } });
    if (!order) throw new NotFoundException('Order not found');

    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) throw new BadRequestException('Buyer not found');

    const vendor = await this.getVendorEmailAndStoreName(vendor_id);

    const addr = buyer.address ?? {};

    const delivery = this.deliveryRepo.create({
      order_id,
      buyer_id,
      vendor_id,
      courier_id: data.courier_id ?? null,
      order_items: order.order_items,

      address: data.address ?? addr.street ?? null,
      city: data.city ?? addr.city ?? null,
      state: data.state ?? addr.state ?? null,
      country: data.country ?? addr.country ?? null,
      postal_code: data.postal_code ?? addr.postal_code ?? null,

      tracking_number: data.tracking_number ?? null,
      estimated_delivery: data.estimated_delivery ?? null,

      delivery_status: 'pending',
    });

    const saved = await this.deliveryRepo.save(delivery);
    await this.cache.set(cacheKey, saved);

    // 📧 Notifications
    const buyerEmail = buyer.email;
    const buyerName = buyer.first_name ?? 'Customer';

    const vendorEmail = vendor?.email;
    const vendorName =
      vendor?.store?.store_name ?? vendor?.first_name ?? 'Vendor';

    // 📧 Send notifications (non-blocking)
    if (buyerEmail) {
      try {
        await this.mail.sendDeliveryCreatedBuyer({
          email: buyerEmail,
          name: buyerName,
          order_id,
        });
      } catch (error) {
        console.error('Failed to send delivery email to buyer:', error);
      }
    }

    if (vendorEmail) {
      try {
        await this.mail.sendDeliveryCreatedVendor({
          email: vendorEmail,
          name: vendorName,
          order_id,
        });
      } catch (error) {
        console.error('Failed to send delivery email to vendor:', error);
      }
    }

    return saved;
  }

  /* ────────────────────────────────────────────────
     2️⃣ GET DELIVERY (CACHED)
  ──────────────────────────────────────────────── */
  async getDelivery(id: string) {
    const key = `delivery:${id}`;
    const cached = await this.cache.get<Delivery>(key);
    if (cached) return cached;

    const delivery = await this.deliveryRepo.findOne({
      where: { id },
    });

    if (!delivery) throw new NotFoundException('Delivery not found');

    await this.cache.set(key, delivery);
    return delivery;
  }

  /* ────────────────────────────────────────────────
   7️⃣ CONFIRM OFFLINE DELIVERY (NO ESCROW)
──────────────────────────────────────────────── */
  async confirmOfflineDelivery(order_id: string) {
    const delivery = await this.deliveryRepo.findOne({
      where: { order_id },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    if (delivery.delivery_status === 'confirmed') {
      return {
        success: true,
        idempotent: true,
        message: 'Delivery already confirmed',
      };
    }

    delivery.delivery_status = 'confirmed';
    delivery.delivered_at = new Date();

    await this.deliveryRepo.save(delivery);
    await this.cache.clearPrefix('delivery');

    const buyer = await this.userRepo.findOne({
      where: { id: delivery.buyer_id },
    });

    const vendor = await this.getVendorEmailAndStoreName(delivery.vendor_id);

    const vendorName =
      vendor?.store?.store_name ?? vendor?.first_name ?? 'Vendor';

    // 📧 Notifications
    // 📧 Send notifications (non-blocking)
    if (buyer?.email) {
      try {
        await this.mail.sendDeliveryConfirmedBuyer({
          email: buyer.email,
          name: buyer.first_name ?? 'Customer',
          order_id,
        });
      } catch (error) {
        console.error('Failed to send confirmation email to buyer:', error);
      }
    }

    if (vendor?.email) {
      try {
        await this.mail.sendDeliveryConfirmedVendor({
          email: vendor.email,
          name: vendorName,
          order_id,
        });
      } catch (error) {
        console.error('Failed to send confirmation email to vendor:', error);
      }
    }

    return {
      success: true,
      message: 'Offline delivery confirmed successfully',
    };
  }

  /* ────────────────────────────────────────────────
     3️⃣ ASSIGN COURIER
  ──────────────────────────────────────────────── */
  async assignCourier(delivery_id: string, courier_id: string) {
    const delivery = await this.getDelivery(delivery_id);

    if (delivery.courier_id === courier_id) return delivery;

    delivery.courier_id = courier_id;
    delivery.delivery_status = 'assigned';

    const updated = await this.deliveryRepo.save(delivery);
    await this.cache.clearPrefix('delivery');

    const order = await this.orderRepo.findOne({
      where: { id: delivery.order_id! },
    });

    const buyer = await this.userRepo.findOne({
      where: { id: delivery.buyer_id },
    });

    const vendor = await this.getVendorEmailAndStoreName(delivery.vendor_id);

    const vendorName =
      vendor?.store?.store_name ?? vendor?.first_name ?? 'Vendor';

    // 📧 Send notifications (non-blocking)
    if (buyer?.email) {
      try {
        await this.mail.sendCourierAssignedBuyer({
          email: buyer.email,
          name: buyer.first_name ?? 'Customer',
          order_id: delivery.order_id!,
          courier_id,
        });
      } catch (error) {
        console.error(
          'Failed to send courier assignment email to buyer:',
          error,
        );
      }
    }

    if (vendor?.email) {
      try {
        await this.mail.sendCourierAssignedVendor({
          email: vendor.email,
          name: vendorName,
          order_id: delivery.order_id!,
          courier_id,
        });
      } catch (error) {
        console.error(
          'Failed to send courier assignment email to vendor:',
          error,
        );
      }
    }

    return updated;
  }

  /* ────────────────────────────────────────────────
     4️⃣ UPDATE DELIVERY STATUS
  ──────────────────────────────────────────────── */
  async updateStatus(
    delivery_id: string,
    status: DeliveryStatus,
    userId: string,
    role: string,
  ) {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: delivery_id },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    if (delivery.vendor_id !== userId && role !== 'admin') {
      throw new BadRequestException(
        'Only vendor or admin can update delivery status',
      );
    }

    const FLOW: DeliveryStatus[] = [
      'pending',
      'assigned',
      'in_transit',
      'delivered',
      'confirmed',
      'failed',
      'returned',
    ];

    const currentIndex = FLOW.indexOf(delivery.delivery_status);
    const nextIndex = FLOW.indexOf(status);

    if (status === 'confirmed') {
      throw new BadRequestException(
        'Confirmed status requires delivery confirmation flow',
      );
    }

    if (nextIndex < currentIndex && !['failed', 'returned'].includes(status)) {
      throw new BadRequestException(
        `Invalid status transition ${delivery.delivery_status} → ${status}`,
      );
    }

    if (delivery.delivery_status === status) {
      return { success: true, idempotent: true };
    }

    delivery.delivery_status = status;

    if (status === 'delivered') {
      delivery.delivered_at = new Date();
    }

    await this.deliveryRepo.save(delivery);
    await this.cache.clearPrefix('delivery');

    const order = await this.orderRepo.findOne({
      where: { id: delivery.order_id! },
      relations: ['escrow'],
    });

    const buyer = await this.userRepo.findOne({
      where: { id: delivery.buyer_id },
    });

    const vendor = await this.getVendorEmailAndStoreName(delivery.vendor_id);

    const vendorName =
      vendor?.store?.store_name ?? vendor?.first_name ?? 'Vendor';

    // 📧 Send notifications (non-blocking)
    if (buyer?.email) {
      try {
        await this.mail.sendDeliveryStatusUpdateBuyer({
          email: buyer.email,
          name: buyer.first_name ?? 'Customer',
          order_id: delivery.order_id!,
          status,
        });
      } catch (error) {
        console.error('Failed to send status update email to buyer:', error);
      }
    }

    if (vendor?.email) {
      try {
        await this.mail.sendDeliveryStatusUpdateVendor({
          email: vendor.email,
          name: vendorName,
          order_id: delivery.order_id!,
          status,
        });
      } catch (error) {
        console.error('Failed to send status update email to vendor:', error);
      }
    }

    // 🔐 Escrow logic (online orders only)
    if (status === 'delivered' && order?.payment_method === 'online') {
      await this.escrowService.markDelivered(delivery.order_id!);

      if (buyer?.email && order.escrow?.release_code) {
        try {
          await this.mail.sendReleaseCodeToBuyer({
            email: buyer.email,
            name: buyer.first_name ?? 'Customer',
            order_id: delivery.order_id!,
            release_code: order.escrow.release_code,
          });
        } catch (error) {
          console.error('Failed to send release code email to buyer:', error);
        }
      }
    }

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     5️⃣ CONFIRM DELIVERY (RELEASE ESCROW)
  ──────────────────────────────────────────────── */
  async confirmDelivery(order_id: string, code: string, vendor_id: string) {
    const delivery = await this.deliveryRepo.findOne({
      where: { order_id },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    if (delivery.vendor_id !== vendor_id) {
      throw new BadRequestException('Only vendor can confirm delivery');
    }

    if (delivery.delivery_status === 'confirmed') {
      return {
        success: true,
        idempotent: true,
        message: 'Delivery already confirmed',
      };
    }

    delivery.delivery_status = 'confirmed';
    delivery.delivered_at = new Date();

    await this.deliveryRepo.save(delivery);
    await this.cache.clearPrefix('delivery');

    const buyer = await this.userRepo.findOne({
      where: { id: delivery.buyer_id },
    });

    const vendor = await this.getVendorEmailAndStoreName(delivery.vendor_id);

    const vendorName =
      vendor?.store?.store_name ?? vendor?.first_name ?? 'Vendor';

    // 📧 Send notifications (non-blocking)
    if (buyer?.email) {
      try {
        await this.mail.sendDeliveryConfirmedBuyer({
          email: buyer.email,
          name: buyer.first_name ?? 'Customer',
          order_id,
        });
      } catch (error) {
        console.error(
          'Failed to send delivery confirmed email to buyer:',
          error,
        );
      }
    }

    if (vendor?.email) {
      try {
        await this.mail.sendDeliveryConfirmedVendor({
          email: vendor.email,
          name: vendorName,
          order_id,
        });
      } catch (error) {
        console.error(
          'Failed to send delivery confirmed email to vendor:',
          error,
        );
      }
    }

    return this.escrowService.releaseEscrow(order_id, code);
  }

  /* ────────────────────────────────────────────────
     6️⃣ UPLOAD PROOF OF DELIVERY
  ──────────────────────────────────────────────── */
  async uploadProof(delivery_id: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Proof image is required');
    }

    const delivery = await this.deliveryRepo.findOne({
      where: { id: delivery_id },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    const uploaded = await this.upload.uploadSingle(
      file,
      'easystore/delivery-proofs',
    );

    if (delivery.proof_of_delivery_url_public_id) {
      await this.upload.deleteSingle(delivery.proof_of_delivery_url_public_id);
    }

    delivery.proof_of_delivery_url = uploaded.url;
    delivery.proof_of_delivery_url_public_id = uploaded.public_id;

    const updated = await this.deliveryRepo.save(delivery);
    await this.cache.clearPrefix('delivery');

    const buyer = await this.userRepo.findOne({
      where: { id: delivery.buyer_id },
    });

    // 📧 Send notification (non-blocking)
    if (buyer?.email) {
      try {
        await this.mail.sendProofUploadedBuyer({
          email: buyer.email,
          name: buyer.first_name ?? 'Customer',
          order_id: delivery.order_id!,
        });
      } catch (error) {
        console.error('Failed to send proof uploaded email to buyer:', error);
      }
    }

    return {
      message: 'Proof of delivery uploaded successfully',
      delivery: updated,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { ICartItem } from '../../cart/types/types';
import { OrderValidationService } from './order-validation.service';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';
import { StoreDeliveryRateService } from 'src/modules/vendor-module/store/services/store-delivery-rate.service';
import { StoreDeliveryRate } from 'src/modules/vendor-module/store/entities/store-delivery-rate.entity';

@Injectable()
export class OrderSummaryService {
  constructor(
    private readonly validationService: OrderValidationService,
    private readonly storeService: StoreService,
    private readonly deliveryRateService: StoreDeliveryRateService,
  ) {}

  /**
   * Get checkout summary for multi-vendor preview
   */
  async getCheckoutSummary(data: {
    buyer_id: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, order_items } = data;

    const { validatedItems } = await this.validationService.buildOrderItems(
      order_items,
      buyer_id,
    );

    const groups =
      await this.validationService.groupItemsByStore(validatedItems);

    const summary: {
      store_id: string | null;
      vendor_id: string;
      store_name: string;
      items: ICartItem[];
      subtotal: number;
      delivery_options: StoreDeliveryRate[];
      escrow_enabled: boolean;
    }[] = [];

    for (const group of groups) {
      const { store_id, vendor_id, items } = group;
      // ⭐ Resolve the exact store the items belong to — never an arbitrary
      // store per vendor (a vendor may own multiple stores).
      const store = await this.storeService.getStoreByUser(
        vendor_id,
        store_id ?? undefined,
      );
      const rates = await this.deliveryRateService.getRatesByStore(store.id);

      let subtotal = 0;
      for (const item of items) {
        subtotal += item.unit_price * item.quantity;
      }

      summary.push({
        store_id: store.id,
        vendor_id,
        store_name: store.store_name,
        items,
        subtotal,
        delivery_options: rates,
        escrow_enabled: store.escrow_enabled ?? false,
      });
    }

    return {
      success: true,
      data: summary,
    };
  }
}

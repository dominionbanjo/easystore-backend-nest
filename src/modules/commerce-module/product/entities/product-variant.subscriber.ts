import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';

@EventSubscriber()
export class ProductVariantSubscriber implements EntitySubscriberInterface<ProductVariant> {
  listenTo() {
    return ProductVariant;
  }

  async afterInsert(event: InsertEvent<ProductVariant>) {
    await this.recalculateProductStock(event);
  }

  async afterUpdate(event: UpdateEvent<ProductVariant>) {
    await this.recalculateProductStock(event);
  }

  async afterRemove(event: RemoveEvent<ProductVariant>) {
    await this.recalculateProductStock(event);
  }

  private async recalculateProductStock(
    event:
      | InsertEvent<ProductVariant>
      | UpdateEvent<ProductVariant>
      | RemoveEvent<ProductVariant>,
  ) {
    const productId =
      (event.entity as ProductVariant)?.product_id ||
      ('databaseEntity' in event
        ? (event.databaseEntity as ProductVariant)?.product_id
        : undefined);

    if (!productId) return;

    const result = await event.manager
      .createQueryBuilder()
      .select('COALESCE(SUM(stock), 0)', 'total')
      .from(ProductVariant, 'variant')
      .where('variant.product_id = :productId', { productId })
      .getRawOne();

    const totalStock = Number(result.total);

    await event.manager
      .createQueryBuilder()
      .update(Product)
      .set({ stock: totalStock })
      .where('id = :productId', { productId })
      .execute();
  }
}

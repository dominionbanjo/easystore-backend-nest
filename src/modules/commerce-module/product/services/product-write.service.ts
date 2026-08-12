import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In, Not } from 'typeorm';
import slugify from 'slugify';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { SaveProductDraftDto } from '../dto/save-product-draft.dto';
import { ProductVariantDto } from '../dto/product-variants.dto';
import { INSTALLMENT_DEFAULT_PRESETS } from 'src/modules/finance-module/installment/installment.constants';
import { UploadService } from 'src/common/services/upload.service';
import { WishlistService } from '../../wishlist/wishlist.service';
import { CartService } from '../../cart/cart.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { ProductHelperService } from './product-helper.service';

type FormattedVariant = Omit<ProductVariantDto, 'sku' | 'discount_price'> & {
  price: number;
  discount_price: number | null;
  stock: number;
  sku: string | null;
};

@Injectable()
export class ProductWriteService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    private readonly upload: UploadService,
    private readonly wishlistService: WishlistService,
    private readonly cartService: CartService,
    private readonly cache: CacheService,
    private readonly helpers: ProductHelperService,
  ) {}

  private async handleOutOfStock(productId: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Product) : this.productRepo;

    const product = await repo.findOne({
      where: { id: productId },
    });
    if (!product) {
      return;
    }

    // Remove from carts and get affected users
    const userIds =
      await this.cartService.removeProductFromAllCartsAndReturnUserIds(
        productId,
        manager,
      );

    // Add to wishlist for each user
    for (const userId of userIds) {
      await this.wishlistService.addToWishlist(
        userId,
        {
          product_id: product.id,
          name: product.name,
          image: product.image?.url ?? null,
          price: Number(product.price),
        },
        manager,
      );
    }
  }

  private resolveRootPriceAndStock(dto: {
    price?: number;
    stock?: number;
    variants?: { price?: number; stock?: number }[];
  }) {
    const variants = dto.variants || [];
    let price = dto.price;
    let stock = dto.stock;

    if (variants.length > 0) {
      price = Math.min(...variants.map((v) => Number(v.price) || 0));
      stock = variants.reduce(
        (sum: number, v) => sum + (Number(v.stock) || 0),
        0,
      );
    }

    return {
      price: price || 0,
      stock: stock || 0,
    };
  }

  /**
   * Explicitly recalculate the product's aggregate stock from its variants.
   * This is required because TypeORM subscribers do NOT fire on raw
   * QueryBuilder .update() / .insert() calls – only on .save().
   * We call this manually after every variant upsert in update flows.
   */
  private async recalculateStockFromVariants(
    productId: string,
    manager: EntityManager,
  ) {
    const result = await manager
      .createQueryBuilder()
      .select('COALESCE(SUM(v.stock), 0)', 'total')
      .from(ProductVariant, 'v')
      .where('v.product_id = :productId', { productId })
      .getRawOne<{ total: string }>();

    const totalStock = Number(result?.total ?? 0);

    await manager
      .createQueryBuilder()
      .update(Product)
      .set({ stock: totalStock })
      .where('id = :productId', { productId })
      .execute();

    return totalStock;
  }

  private formatVariants(variants: ProductVariantDto[]): FormattedVariant[] {
    return variants.map((v) => ({
      ...v,
      price: Math.round(Number(v.price) * 100),
      discount_price: v.discount_price
        ? Math.round(Number(v.discount_price) * 100)
        : null,
      stock: Number(v.stock) || 0,
      sku: v.sku || null,
    }));
  }

  async create(
    user: { sub: string; store_id: string | null },
    dto: CreateProductDto,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    await this.helpers.ensureCategoryExists(dto.category_id);

    const slug = slugify(dto.name, { lower: true, strict: true });

    const exists = await this.productRepo.exist({ where: { slug } });
    if (exists) {
      throw new BadRequestException('Product with same name exists');
    }

    if (dto.barcode) {
      const barcodeExists = await this.productRepo.exist({
        where: { barcode: dto.barcode },
      });
      if (barcodeExists) {
        throw new BadRequestException(
          'Barcode already in use by another product',
        );
      }
    }

    const { price, stock } = this.resolveRootPriceAndStock(dto);

    const product = this.productRepo.create({
      ...dto,
      price: Math.round(Number(price) * 100),
      stock,
      discount_price: dto.discount_price
        ? Math.round(Number(dto.discount_price) * 100)
        : null,
      vendor_id: user.sub,
      store_id: user.store_id,
      slug,
      image: dto.image ?? null,
      gallery: dto.gallery ?? null,
      status: ProductStatus.ACTIVE,
      options: dto.options ?? null,
      variants: dto.variants ? this.formatVariants(dto.variants) : [],
    });

    const saved = await this.productRepo.save(product);

    return {
      message: 'Product created successfully',
      success: true,
      id: saved.id,
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    return this.productRepo.manager.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id },
        relations: ['variants'],
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const { price: rootPrice, stock: rootStock } =
        this.resolveRootPriceAndStock({
          ...dto,
          variants: dto.variants ?? [],
        });

      const updateData: Record<string, unknown> = {
        price: Math.round(Number(rootPrice) * 100),
        updated_at: new Date(),
      };

      // ONLY manually set stock if there are NO variants provided.
      // If variants exist, the subscriber handles Product.stock synchronization.
      if (!dto.variants || dto.variants.length === 0) {
        updateData.stock = Number(rootStock);
      }

      if (dto.category_id && dto.category_id !== product.category_id) {
        await this.helpers.ensureCategoryExists(dto.category_id);
        updateData.category_id = dto.category_id;
      }
      if (dto.name && dto.name !== product.name) {
        updateData.name = dto.name;
        updateData.slug = slugify(dto.name, { lower: true, strict: true });
      }

      if (dto.image !== undefined) updateData.image = dto.image;
      if (dto.gallery !== undefined) updateData.gallery = dto.gallery;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.discount_price !== undefined) {
        updateData.discount_price = dto.discount_price
          ? Math.round(Number(dto.discount_price) * 100)
          : null;
      }
      updateData.shipping_note = dto.shipping_note ?? product.shipping_note;
      updateData.returns_note = dto.returns_note ?? product.returns_note;
      updateData.options = dto.options ?? product.options;
      updateData.tags = dto.tags ?? product.tags;
      updateData.highlights = dto.highlights ?? product.highlights;
      updateData.specs = dto.specs ?? product.specs;
      if (dto.installment_enabled !== undefined)
        updateData.installment_enabled = dto.installment_enabled;
      if (dto.installment_presets !== undefined)
        updateData.installment_presets = dto.installment_presets;
      // An enabled product always offers at least the default preset.
      const enabled = dto.installment_enabled ?? product.installment_enabled;
      const presets = dto.installment_presets ?? product.installment_presets;
      if (enabled && (!presets || presets.length === 0)) {
        updateData.installment_presets = INSTALLMENT_DEFAULT_PRESETS;
      }

      // 1. Update root product
      await manager.update(Product, id, updateData);

      // 2. Sync variants manually
      if (dto.variants) {
        const formatted = this.formatVariants(dto.variants);
        const incomingIds = formatted
          .map((v) => v.id)
          .filter((v): v is string => Boolean(v));

        if (incomingIds.length > 0) {
          await manager.delete(ProductVariant, {
            product_id: id,
            id: Not(In(incomingIds)),
          });
        } else {
          await manager.delete(ProductVariant, { product_id: id });
        }

        // Upsert variants individually
        for (const v of formatted) {
          const { id: vId, ...rest } = v;
          if (vId) {
            await manager.update(ProductVariant, vId, rest);
          } else {
            await manager.insert(ProductVariant, {
              ...rest,
              product_id: id,
            });
          }
        }

        // Subscribers do NOT fire on QueryBuilder calls. Recalculate explicitly.
        if (formatted.length > 0) {
          await this.recalculateStockFromVariants(id, manager);
        }
      } else if (dto.variants === null) {
        await manager.delete(ProductVariant, { product_id: id });
      }

      const updatedStock = await manager.findOne(Product, {
        where: { id },
        select: ['id', 'stock'],
      });

      if (updatedStock && updatedStock.stock <= 0) {
        await this.handleOutOfStock(id, manager);
      }

      return {
        message: 'Product updated successfully',
        success: true,
        id,
      };
    });
  }

  async updateStatus(productId: string, status: ProductStatus) {
    if (!Object.values(ProductStatus).includes(status)) {
      throw new BadRequestException('Invalid product status');
    }

    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: ['id', 'status'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status === status) {
      return {
        message: `Product already ${status}`,
        status,
      };
    }

    product.status = status;
    await this.productRepo.save(product);

    return {
      message:
        status === ProductStatus.ACTIVE
          ? 'Product activated successfully'
          : 'Product deactivated successfully',
      status,
    };
  }

  async updateOnSale(productId: string, onSale: boolean) {
    if (typeof onSale !== 'boolean') {
      throw new BadRequestException('Invalid on_sale value');
    }

    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: ['id', 'on_sale', 'discount_price'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (onSale === true && product.discount_price == null) {
      throw new BadRequestException(
        'Cannot mark product as on sale without a discount price',
      );
    }

    if (product.on_sale === onSale) {
      return {
        message: `Product already ${onSale ? 'on sale' : 'not on sale'}`,
        on_sale: onSale,
      };
    }

    product.on_sale = onSale;
    await this.productRepo.save(product);

    return {
      message: onSale
        ? 'Product marked as on sale successfully'
        : 'Product removed from sale successfully',
      on_sale: onSale,
    };
  }

  /* ────────────────────────────────────────────────
     🗒️ DRAFT METHODS (backend-controlled save-as-draft)
  ──────────────────────────────────────────────── */

  private buildDraftUpdateData(
    dto: SaveProductDraftDto,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category_id !== undefined) data.category_id = dto.category_id;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) {
      data.price =
        dto.price !== null ? Math.round(Number(dto.price) * 100) : null;
    }
    if (dto.discount_price !== undefined) {
      data.discount_price =
        dto.discount_price !== null
          ? Math.round(Number(dto.discount_price) * 100)
          : null;
    }
    if (dto.stock !== undefined) data.stock = dto.stock ?? 0;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.highlights !== undefined) data.highlights = dto.highlights;
    if (dto.specs !== undefined) data.specs = dto.specs;
    if (dto.options !== undefined) data.options = dto.options;
    if (dto.shipping_note !== undefined) data.shipping_note = dto.shipping_note;
    if (dto.returns_note !== undefined) data.returns_note = dto.returns_note;
    if (dto.installment_enabled !== undefined)
      data.installment_enabled = dto.installment_enabled;
    if (dto.installment_presets !== undefined)
      data.installment_presets = dto.installment_presets;
    const enabledFlag = dto.installment_enabled ?? (data.installment_enabled as boolean | undefined);
    const presetsArr = (data.installment_presets as string[] | undefined) ?? [];
    if (enabledFlag && presetsArr.length === 0) {
      data.installment_presets = INSTALLMENT_DEFAULT_PRESETS;
    }
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.gallery !== undefined) data.gallery = dto.gallery;

    return data;
  }

  /**
   * Persist variant rows for a draft. Drafts may contain incomplete variant
   * rows (missing price/stock/combinations), so only complete rows are saved
   * and incomplete ones are left untouched until the draft is published.
   */
  private async syncDraftVariants(
    manager: EntityManager,
    productId: string,
    variants?: SaveProductDraftDto['variants'] | null,
  ) {
    if (variants === undefined || variants === null) return;

    const complete = variants.filter(
      (v) =>
        v.combinations &&
        typeof v.combinations === 'object' &&
        v.price !== undefined &&
        v.price !== null &&
        v.stock !== undefined &&
        v.stock !== null,
    );

    if (variants.length > 0 && complete.length === 0) return;

    const formatted = complete.map((v) => ({
      ...v,
      price: Math.round(Number(v.price) * 100),
      discount_price:
        v.discount_price !== undefined && v.discount_price !== null
          ? Math.round(Number(v.discount_price) * 100)
          : null,
      stock: Number(v.stock) || 0,
      sku: v.sku || null,
    }));

    const incomingIds = formatted
      .map((v) => v.id)
      .filter((v): v is string => Boolean(v));

    if (incomingIds.length > 0) {
      await manager.delete(ProductVariant, {
        product_id: productId,
        id: Not(In(incomingIds)),
      });
    } else {
      await manager.delete(ProductVariant, { product_id: productId });
    }

    for (const v of formatted) {
      const { id: vId, ...rest } = v;
      if (vId) {
        await manager.update(ProductVariant, vId, rest);
      } else {
        await manager.insert(ProductVariant, {
          ...rest,
          product_id: productId,
        });
      }
    }
  }

  async saveDraft(
    user: { sub: string; store_id: string | null },
    dto: SaveProductDraftDto,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    const draftData = this.buildDraftUpdateData(dto);

    if (dto.id) {
      return this.productRepo.manager.transaction(async (manager) => {
        const existing = await manager.findOne(Product, {
          where: {
            id: dto.id!,
            store_id: user.store_id!,
          },
          select: ['id', 'status'],
        });

        if (!existing) {
          throw new NotFoundException('Draft not found in your store');
        }

        if (
          Object.keys(draftData).length > 0 ||
          existing.status !== ProductStatus.DRAFT
        ) {
          await manager.update(Product, dto.id!, {
            ...draftData,
            // Never demote a live product to DRAFT while it is being edited —
            // it would vanish from the public storefront. New rows stay DRAFT.
            status: existing.status,
            updated_at: new Date(),
          });
        }

        await this.syncDraftVariants(manager, dto.id!, dto.variants);

        if (dto.variants && dto.variants.length > 0) {
          const { price: rootPrice, stock: rootStock } =
            this.resolveRootPriceAndStock({
              ...dto,
              variants: dto.variants,
            });
          await manager.update(Product, dto.id!, {
            price: Math.round(Number(rootPrice) * 100),
            stock: rootStock,
          });
        } else {
          await this.recalculateStockFromVariants(dto.id!, manager);
        }

        return {
          message: 'Draft saved successfully',
          success: true,
          id: dto.id!,
        };
      });
    }

    return this.productRepo.manager.transaction(async (manager) => {
      let slug: string | null = null;
      if (dto.name) {
        const baseSlug = slugify(dto.name, { lower: true, strict: true });
        slug = baseSlug;
        let counter = 1;
        while (await manager.exists(Product, { where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const product = manager.create(Product, {
        ...draftData,
        vendor_id: user.sub,
        store_id: user.store_id,
        status: ProductStatus.DRAFT,
        stock: dto.stock ?? 0,
        slug: slug ?? undefined,
      });

      const saved = await manager.save(Product, product);

      await this.syncDraftVariants(manager, saved.id, dto.variants);

      if (dto.variants && dto.variants.length > 0) {
        const { price: rootPrice, stock: rootStock } =
          this.resolveRootPriceAndStock({
            ...dto,
            variants: dto.variants,
          });
        await manager.update(Product, saved.id, {
          price: Math.round(Number(rootPrice) * 100),
          stock: rootStock,
        });
      } else {
        await this.recalculateStockFromVariants(saved.id, manager);
      }

      return {
        message: 'Draft saved successfully',
        success: true,
        id: saved.id,
      };
    });
  }

  async publishDraft(
    user: { sub: string; store_id: string | null },
    draftId: string,
    dto: CreateProductDto,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    return this.productRepo.manager.transaction(async (manager) => {
      // The publish endpoint doubles as the edit-update endpoint, so it must
      // accept both DRAFT rows (create/resume flow) and ACTIVE products
      // (edit flow). Ownership is enforced via store_id.
      const draft = await manager.findOne(Product, {
        where: {
          id: draftId,
          store_id: user.store_id!,
        },
        select: ['id', 'status'],
      });

      if (!draft) {
        throw new NotFoundException('Draft not found in your store');
      }

      if (!dto.name || !dto.category_id) {
        throw new BadRequestException(
          'A product name and category are required to publish a draft',
        );
      }

      await this.helpers.ensureCategoryExists(dto.category_id);

      const slug = slugify(dto.name, { lower: true, strict: true });
      const slugExists = await manager.exists(Product, {
        where: { slug, id: Not(draftId) },
      });
      if (slugExists) {
        throw new BadRequestException('Product with same name exists');
      }

      if (dto.barcode) {
        const barcodeExists = await manager.exists(Product, {
          where: { barcode: dto.barcode, id: Not(draftId) },
        });
        if (barcodeExists) {
          throw new BadRequestException(
            'Barcode already in use by another product',
          );
        }
      }

      const { price, stock } = this.resolveRootPriceAndStock(dto);

      const updateData: Record<string, unknown> = {
        ...this.buildDraftUpdateData(dto as unknown as SaveProductDraftDto),
        name: dto.name,
        category_id: dto.category_id,
        slug,
        price: Math.round(Number(price) * 100),
        discount_price:
          dto.discount_price !== undefined && dto.discount_price !== null
            ? Math.round(Number(dto.discount_price) * 100)
            : null,
        stock,
        image: dto.image ?? null,
        gallery: dto.gallery ?? null,
        status: ProductStatus.ACTIVE,
        updated_at: new Date(),
      };

      await manager.update(Product, draftId, updateData);

      if (dto.variants) {
        const formatted = this.formatVariants(dto.variants);
        const incomingIds = formatted
          .map((v) => v.id)
          .filter((v): v is string => Boolean(v));

        if (incomingIds.length > 0) {
          await manager.delete(ProductVariant, {
            product_id: draftId,
            id: Not(In(incomingIds)),
          });
        } else {
          await manager.delete(ProductVariant, { product_id: draftId });
        }

        for (const v of formatted) {
          const { id: vId, ...rest } = v;
          if (vId) {
            await manager.update(ProductVariant, vId, rest);
          } else {
            await manager.insert(ProductVariant, {
              ...rest,
              product_id: draftId,
            });
          }
        }

        if (formatted.length > 0) {
          await this.recalculateStockFromVariants(draftId, manager);
        }
      } else if (dto.variants === null) {
        await manager.delete(ProductVariant, { product_id: draftId });
      }

      const published = await manager.findOne(Product, {
        where: { id: draftId },
        select: ['id', 'stock'],
      });

      if (published && published.stock <= 0) {
        await this.handleOutOfStock(draftId, manager);
      }

      return {
        message: 'Product published successfully',
        success: true,
        id: draftId,
      };
    });
  }

  async discardDraft(
    user: { sub: string; store_id: string | null },
    draftId: string,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    const draft = await this.productRepo.findOne({
      where: {
        id: draftId,
        store_id: user.store_id,
        status: ProductStatus.DRAFT,
      },
      select: ['id', 'image', 'gallery'],
    });

    if (!draft) {
      throw new NotFoundException('Draft not found in your store');
    }

    if (draft.image?.public_id) {
      await this.upload.deleteSingle(draft.image.public_id);
    }

    if (draft.gallery?.length) {
      await this.upload.deleteMultiple(draft.gallery);
    }

    await this.productRepo.delete(draftId);

    return {
      message: 'Draft discarded successfully',
      success: true,
    };
  }

  async remove(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      select: ['id', 'image', 'gallery'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.cartService.removeProductFromAllCartsAndReturnUserIds(id);
    await this.wishlistService.removeProductFromAllWishlists(id);

    if (product.image?.public_id) {
      await this.upload.deleteSingle(product.image.public_id);
    }

    if (product.gallery?.length) {
      await this.upload.deleteMultiple(product.gallery);
    }

    await this.productRepo.delete(id);

    return {
      message: 'Product and images deleted successfully',
    };
  }

  async adjustStock(
    productId: string,
    adjustment: number,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Product) : this.productRepo;

    if (adjustment > 0) {
      await repo.increment({ id: productId }, 'stock', adjustment);
      await repo.decrement({ id: productId }, 'total_sold', adjustment);
    } else if (adjustment < 0) {
      await repo
        .createQueryBuilder()
        .update(Product)
        .set({
          stock: () => `GREATEST(0, stock - ${Math.abs(adjustment)})`,
          total_sold: () => `total_sold + ${Math.abs(adjustment)}`,
        })
        .where('id = :productId', { productId })
        .execute();

      // Check if stock is now 0 or less
      const p = await repo.findOne({
        where: { id: productId },
        select: ['stock'],
      });
      if (p && p.stock <= 0) {
        await this.handleOutOfStock(productId, manager);
      }
    }

    await this.cache.clearPrefix('svc:product');
  }

  /**
   * Adjust stock for a specific product variant.
   * Also adjusts the parent product's stock to keep aggregate in sync.
   * Pass a positive adjustment to restore stock, negative to deduct.
   */
  async adjustVariantStock(
    variantId: string,
    adjustment: number,
    manager?: EntityManager,
  ) {
    const variantRepo = manager
      ? manager.getRepository(ProductVariant)
      : this.variantRepo;
    const productRepo = manager
      ? manager.getRepository(Product)
      : this.productRepo;

    const variant = await variantRepo.findOne({ where: { id: variantId } });
    if (!variant) return; // Variant may have been deleted; skip gracefully

    const abs = Math.abs(adjustment);

    if (adjustment > 0) {
      await variantRepo.increment({ id: variantId }, 'stock', abs);
      await productRepo.decrement(
        { id: variant.product_id },
        'total_sold',
        abs,
      );
    } else if (adjustment < 0) {
      await variantRepo
        .createQueryBuilder()
        .update(ProductVariant)
        .set({
          stock: () => `GREATEST(0, stock - ${abs})`,
        })
        .where('id = :variantId', { variantId })
        .execute();

      await productRepo
        .createQueryBuilder()
        .update(Product)
        .set({
          stock: () => `GREATEST(0, stock - ${abs})`,
          total_sold: () => `total_sold + ${abs}`,
        })
        .where('id = :productId', { productId: variant.product_id })
        .execute();

      // Check if parent stock reached zero
      const p = await productRepo.findOne({
        where: { id: variant.product_id },
        select: ['stock'],
      });
      if (p && p.stock <= 0) {
        await this.handleOutOfStock(variant.product_id, manager);
      }
    }

    await this.cache.clearPrefix('svc:product');
  }

  /**
   * Reserve stock for an installment plan (plan quantity leaves the market
   * until the plan completes or is defaulted/canceled).
   * Throws if the requested quantity exceeds available stock (stock - reserved).
   */
  async reserveStock(
    productId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Product) : this.productRepo;

    const product = await repo.findOne({
      where: { id: productId },
      select: ['stock', 'reserved_stock'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const available = product.stock - product.reserved_stock;
    if (quantity > available) {
      throw new BadRequestException(
        `Only ${Math.max(available, 0)} unit(s) available for this product`,
      );
    }

    await repo.increment({ id: productId }, 'reserved_stock', quantity);
    await this.cache.clearPrefix('svc:product');
  }

  /** Release a reservation (default/cancel/refund) back to the market. */
  async releaseReservation(
    productId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Product) : this.productRepo;
    await repo
      .createQueryBuilder()
      .update(Product)
      .set({
        reserved_stock: () => `GREATEST(0, reserved_stock - ${quantity})`,
      })
      .where('id = :productId', { productId })
      .execute();
    await this.cache.clearPrefix('svc:product');
  }

  /** Variant-aware reserve — also keeps the parent product aggregate in sync. */
  async reserveVariantStock(
    variantId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<void> {
    const variantRepo = manager
      ? manager.getRepository(ProductVariant)
      : this.variantRepo;
    const productRepo = manager
      ? manager.getRepository(Product)
      : this.productRepo;

    const variant = await variantRepo.findOne({ where: { id: variantId } });
    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const available = variant.stock - variant.reserved_stock;
    if (quantity > available) {
      throw new BadRequestException(
        `Only ${Math.max(available, 0)} unit(s) available for this variant`,
      );
    }

    await variantRepo.increment({ id: variantId }, 'reserved_stock', quantity);
    await productRepo.increment(
      { id: variant.product_id },
      'reserved_stock',
      quantity,
    );
    await this.cache.clearPrefix('svc:product');
  }

  /** Variant-aware release. */
  async releaseVariantReservation(
    variantId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<void> {
    const variantRepo = manager
      ? manager.getRepository(ProductVariant)
      : this.variantRepo;
    const productRepo = manager
      ? manager.getRepository(Product)
      : this.productRepo;

    const variant = await variantRepo.findOne({
      where: { id: variantId },
      select: ['product_id'],
    });
    if (!variant) return;

    await variantRepo
      .createQueryBuilder()
      .update(ProductVariant)
      .set({
        reserved_stock: () => `GREATEST(0, reserved_stock - ${quantity})`,
      })
      .where('id = :variantId', { variantId })
      .execute();

    await productRepo
      .createQueryBuilder()
      .update(Product)
      .set({
        reserved_stock: () => `GREATEST(0, reserved_stock - ${quantity})`,
      })
      .where('id = :productId', { productId: variant.product_id })
      .execute();

    await this.cache.clearPrefix('svc:product');
  }
}

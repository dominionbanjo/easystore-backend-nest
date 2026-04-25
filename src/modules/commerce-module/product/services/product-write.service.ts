import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In, Not } from 'typeorm';
import slugify from 'slugify';
import {
  Product,
  ProductStatus,
  ProductImage,
  ProductGalleryItem,
} from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { CreateProductCloudinaryDto } from '../dto/create-product-cloudinary.dto';
import { UpdateProductCloudinaryDto } from '../dto/update-product-cloudinary.dto';
import { UploadService } from 'src/common/services/upload.service';
import { WishlistService } from '../../wishlist/wishlist.service';
import { CartService } from '../../cart/cart.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { ProductHelperService } from './product-helper.service';

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

  private resolveRootPriceAndStock(dto: any) {
    const variants = dto.variants || [];
    let price = dto.price;
    let stock = dto.stock;

    if (variants.length > 0) {
      // Force recalculation from variants if they exist
      price = Math.min(...variants.map((v: any) => Number(v.price) || 0));
      stock = variants.reduce(
        (sum: number, v: any) => sum + (Number(v.stock) || 0),
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
      .getRawOne();

    const totalStock = Number(result?.total ?? 0);

    await manager
      .createQueryBuilder()
      .update(Product)
      .set({ stock: totalStock })
      .where('id = :productId', { productId })
      .execute();

    return totalStock;
  }

  private formatVariants(variants: any[]): any[] {
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
    files?: {
      image?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    },
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    if (!dto.name || typeof dto.name !== 'string') {
      throw new BadRequestException('Product name is required');
    }

    await this.helpers.ensureCategoryExists(dto.category_id);

    const slug = slugify(dto.name, { lower: true, strict: true });

    const exists = await this.productRepo.exists({ where: { slug } });
    if (exists) {
      throw new BadRequestException('Product with same name exists');
    }

    let image: ProductImage | null = null;
    if (files?.image?.[0]) {
      image = await this.upload.uploadSingle(
        files.image[0],
        'easystore/products/main',
      );
    }

    let gallery: ProductGalleryItem[] | null = null;
    if (files?.gallery?.length) {
      gallery = await this.upload.uploadMultiple(
        files.gallery,
        'easystore/products/gallery',
      );
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
      image,
      gallery,
      options: dto.options ?? null,
      variants: dto.variants ? this.formatVariants(dto.variants) : [],
    });

    const saved = await this.productRepo.save(product);
    return {
      message: 'Product created successfully',
      product: saved,
    };
  }

  async createWithCloudinary(
    user: { sub: string; store_id: string | null },
    dto: CreateProductCloudinaryDto,
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
      product: saved,
    };
  }

  async createMany(
    user: { sub: string; store_id: string | null },
    dtos: CreateProductDto[],
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    if (!dtos.length) {
      throw new BadRequestException('No products provided');
    }

    const slugs = dtos.map((dto) =>
      slugify(dto.name, { lower: true, strict: true }),
    );

    const duplicateSlugs = slugs.filter(
      (slug, index) => slugs.indexOf(slug) !== index,
    );

    if (duplicateSlugs.length) {
      throw new BadRequestException(
        `Duplicate product names in request: ${duplicateSlugs.join(', ')}`,
      );
    }

    const existing = await this.productRepo
      .createQueryBuilder('product')
      .where('product.slug IN (:...slugs)', { slugs })
      .select(['product.slug'])
      .getMany();

    if (existing.length) {
      throw new BadRequestException(
        `Products already exist: ${existing.map((p) => p.slug).join(', ')}`,
      );
    }

    const products = this.productRepo.create(
      dtos.map((dto) => {
        const { price, stock } = this.resolveRootPriceAndStock(dto);
        return {
          ...dto,
          price: Math.round(Number(price) * 100),
          stock,
          discount_price: dto.discount_price
            ? Math.round(Number(dto.discount_price) * 100)
            : null,
          vendor_id: user.sub,
          store_id: user.store_id,
          slug: slugify(dto.name, { lower: true, strict: true }),
          options: dto.options ?? null,
          variants: dto.variants ? this.formatVariants(dto.variants) : [],
        };
      }),
    );

    const saved = await this.productRepo.save(products);

    return {
      message: 'Products created successfully',
      count: saved.length,
      products: saved,
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

      // Prepare explicit update object for the root product
      const updateData: any = {
        price: Math.round(Number(rootPrice) * 100),
        updated_at: new Date(),
      };

      // ONLY manually set stock if there are NO variants provided.
      // If variants exist, the subscriber handles Product.stock synchronization.
      if (!dto.variants || dto.variants.length === 0) {
        updateData.stock = Number(rootStock);
      }

      if (dto.name && dto.name !== product.name) {
        updateData.name = dto.name;
        updateData.slug = slugify(dto.name, { lower: true, strict: true });
      }
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.category_id !== undefined)
        updateData.category_id = dto.category_id;
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

      // 1. Update root product (Directly to bypass cascade stalls)
      await manager.update(Product, id, updateData);

      // 2. Sync variants manually
      if (dto.variants) {
        const formatted = this.formatVariants(dto.variants);
        const incomingIds = formatted.map((v) => v.id).filter(Boolean);

        // Delete orphans
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
          if (v.id) {
            const { id: _vId, created_at, updated_at, ...rest } = v;
            await manager.update(ProductVariant, v.id, rest);
          } else {
            const { id: _vId, created_at, updated_at, ...rest } = v;
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

      const updated = await manager.findOne(Product, {
        where: { id },
        relations: ['variants'],
      });

      if (updated && updated.stock <= 0) {
        await this.handleOutOfStock(id, manager);
      }

      return {
        message: 'Product updated successfully',
        product: updated,
      };
    });
  }

  async updateWithCloudinary(id: string, dto: UpdateProductCloudinaryDto) {
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

      const updateData: any = {
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

      // 1. Update root product
      await manager.update(Product, id, updateData);

      // 2. Sync variants manually
      if (dto.variants) {
        const formatted = this.formatVariants(dto.variants);
        const incomingIds = formatted.map((v) => v.id).filter(Boolean);

        if (incomingIds.length > 0) {
          await manager.delete(ProductVariant, {
            product_id: id,
            id: Not(In(incomingIds)),
          });
        } else {
          await manager.delete(ProductVariant, { product_id: id });
        }

        for (const v of formatted) {
          if (v.id) {
            const { id: _vId, created_at, updated_at, ...rest } = v;
            await manager.update(ProductVariant, v.id, rest);
          } else {
            const { id: _vId, created_at, updated_at, ...rest } = v;
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

      const updated = await manager.findOne(Product, {
        where: { id },
        relations: ['variants'],
      });

      if (updated && updated.stock <= 0) {
        await this.handleOutOfStock(id, manager);
      }

      return {
        message: 'Product updated successfully',
        product: updated,
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

  async adjustStock(productId: string, adjustment: number, manager?: any) {
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
          total_sold: () => `total_sold + ${abs}`,
        })
        .where('id = :productId', { productId: variant.product_id })
        .execute();

      // Handle product-level out-of-stock
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
}

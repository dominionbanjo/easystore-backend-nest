import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
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
import { UpdateProductCloudinaryDto } from '../dto/update-product=coudinary.dto';
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
    let { price, stock } = dto;
    const variants = dto.variants || [];

    if (variants.length > 0) {
      if (price === undefined || price === null) {
        // Find minimum variant price
        price = Math.min(...variants.map((v: any) => v.price || 0));
      }
      if (stock === undefined || stock === null) {
        // Sum variant stocks
        stock = variants.reduce(
          (sum: number, v: any) => sum + (v.stock || 0),
          0,
        );
      }
    }

    return {
      price: price || 0,
      stock: stock || 0,
    };
  }

  private formatVariants(variants?: any[]) {
    if (!variants) return variants;
    return variants.map((v) => ({
      ...v,
      price: Math.round(Number(v.price) * 100),
      discount_price: v.discount_price
        ? Math.round(Number(v.discount_price) * 100)
        : null,
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
      shipping_cost: dto.shipping_cost
        ? Math.round(Number(dto.shipping_cost) * 100)
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
      shipping_cost: dto.shipping_cost
        ? Math.round(Number(dto.shipping_cost) * 100)
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
          shipping_cost: dto.shipping_cost
            ? Math.round(Number(dto.shipping_cost) * 100)
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
    const product = await this.productRepo.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.name && dto.name !== product.name) {
      product.slug = slugify(dto.name, { lower: true, strict: true });
    }

    const { price, stock } = this.resolveRootPriceAndStock({
      ...dto,
      price: dto.price !== undefined ? dto.price : product.price / 100,
      stock: dto.stock !== undefined ? dto.stock : product.stock,
      variants: dto.variants !== undefined ? dto.variants : product.variants,
    });

    Object.assign(product, {
      ...dto,
      price: Math.round(Number(price) * 100),
      discount_price:
        dto.discount_price !== undefined
          ? dto.discount_price
            ? Math.round(Number(dto.discount_price) * 100)
            : null
          : product.discount_price,
      shipping_cost:
        dto.shipping_cost !== undefined
          ? dto.shipping_cost
            ? Math.round(Number(dto.shipping_cost) * 100)
            : null
          : product.shipping_cost,
      stock,
      options: dto.options !== undefined ? dto.options : product.options,
      variants:
        dto.variants !== undefined
          ? this.formatVariants(dto.variants)
          : product.variants,
    });

    // To ensure TypeORM doesn't just attempt to update orphaned variants we can clear existing and rebuild
    if (dto.variants) {
      const existingVariants = await this.productRepo.manager.query(
        'DELETE FROM product_variants WHERE product_id = $1 RETURNING id',
        [product.id],
      );
    }

    const updated = await this.productRepo.save(product);

    if (updated.stock <= 0) {
      await this.handleOutOfStock(updated.id);
    }

    return {
      message: 'Product updated successfully',
      product: updated,
    };
  }

  async updateWithCloudinary(id: string, dto: UpdateProductCloudinaryDto) {
    const product = await this.productRepo.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.category_id && dto.category_id !== product.category_id) {
      await this.helpers.ensureCategoryExists(dto.category_id);
    }

    if (dto.name && dto.name !== product.name) {
      product.slug = slugify(dto.name, { lower: true, strict: true });
    }

    if (dto.image !== undefined) {
      product.image = dto.image;
    }

    if (dto.gallery !== undefined) {
      product.gallery = dto.gallery;
    }

    const { price, stock } = this.resolveRootPriceAndStock({
      ...dto,
      price: dto.price !== undefined ? dto.price : product.price / 100,
      stock: dto.stock !== undefined ? dto.stock : product.stock,
      variants: dto.variants !== undefined ? dto.variants : product.variants,
    });

    Object.assign(product, {
      ...dto,
      price: Math.round(Number(price) * 100),
      discount_price:
        dto.discount_price !== undefined
          ? dto.discount_price
            ? Math.round(Number(dto.discount_price) * 100)
            : null
          : product.discount_price,
      shipping_cost:
        dto.shipping_cost !== undefined
          ? dto.shipping_cost
            ? Math.round(Number(dto.shipping_cost) * 100)
            : null
          : product.shipping_cost,
      stock,
      image: product.image,
      gallery: product.gallery,
      options: dto.options !== undefined ? dto.options : product.options,
      variants:
        dto.variants !== undefined
          ? this.formatVariants(dto.variants)
          : product.variants,
    });

    if (dto.variants) {
      await this.productRepo.manager.query(
        'DELETE FROM product_variants WHERE product_id = $1',
        [product.id],
      );
    }

    const updated = await this.productRepo.save(product);

    if (updated.stock <= 0) {
      await this.handleOutOfStock(updated.id);
    }

    return {
      message: 'Product updated successfully',
      product: updated,
    };
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
      await repo.decrement({ id: productId }, 'stock', Math.abs(adjustment));
      await repo.increment(
        { id: productId },
        'total_sold',
        Math.abs(adjustment),
      );

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
      await productRepo.increment({ id: variant.product_id }, 'stock', abs);
      await productRepo.decrement(
        { id: variant.product_id },
        'total_sold',
        abs,
      );
    } else if (adjustment < 0) {
      await variantRepo.decrement({ id: variantId }, 'stock', abs);
      await productRepo.decrement({ id: variant.product_id }, 'stock', abs);
      await productRepo.increment(
        { id: variant.product_id },
        'total_sold',
        abs,
      );

      // Handle product-level out-of-stock (checks aggregate product stock)
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

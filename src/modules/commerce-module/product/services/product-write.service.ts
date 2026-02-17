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

    const processVariants = (dto: any) => {
      if (dto.variants && dto.variants.length > 0) {
        let minPrice = Infinity;
        let totalStock = 0;
        const processedVariants = dto.variants.map((v) => {
          const price = Math.round(Number(v.price) * 100);
          const discountPrice = v.discount_price
            ? Math.round(Number(v.discount_price) * 100)
            : undefined;

          // Use discount price for min price calculation if available and on sale?
          // Usually "from" price is base price. Let's stick to base price for minPrice or check business logic.
          // User said "show the price of the first size".
          // Let's just calculate min base price for the main 'price' column.
          if (price < minPrice) minPrice = price;
          totalStock += Number(v.stock);

          return { ...v, price, discount_price: discountPrice };
        });

        return {
          variants: processedVariants,
          price:
            minPrice !== Infinity
              ? minPrice
              : Math.round(Number(dto.price) * 100),
          stock: totalStock,
        };
      }
      return {
        variants: null,
        price: Math.round(Number(dto.price) * 100),
        stock: Number(dto.stock),
      };
    };

    const { variants, price, stock } = processVariants(dto);

    const product = this.productRepo.create({
      ...dto,
      price,
      stock,
      variants,
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

    const processVariants = (dto: any) => {
      if (dto.variants && dto.variants.length > 0) {
        let minPrice = Infinity;
        let totalStock = 0;
        const processedVariants = dto.variants.map((v) => {
          const price = Math.round(Number(v.price) * 100);
          const discountPrice = v.discount_price
            ? Math.round(Number(v.discount_price) * 100)
            : undefined;

          if (price < minPrice) minPrice = price;
          totalStock += Number(v.stock);

          return { ...v, price, discount_price: discountPrice };
        });

        return {
          variants: processedVariants,
          price:
            minPrice !== Infinity
              ? minPrice
              : Math.round(Number(dto.price) * 100),
          stock: totalStock,
        };
      }
      return {
        variants: null,
        price: Math.round(Number(dto.price) * 100),
        stock: Number(dto.stock),
      };
    };

    const { variants, price, stock } = processVariants(dto);

    const product = this.productRepo.create({
      ...dto,
      price,
      stock,
      variants,
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
        let price = Math.round(Number(dto.price) * 100);
        let stock = Number(dto.stock);
        let variants = null;

        if (dto.variants && dto.variants.length > 0) {
          let minPrice = Infinity;
          let totalStock = 0;
          const processedVariants = dto.variants.map((v) => {
            const vPrice = Math.round(Number(v.price) * 100);
            const vDiscountPrice = v.discount_price
              ? Math.round(Number(v.discount_price) * 100)
              : undefined;

            if (vPrice < minPrice) minPrice = vPrice;
            totalStock += Number(v.stock);

            return { ...v, price: vPrice, discount_price: vDiscountPrice };
          });
          variants = processedVariants as any; // Cast to any to avoid TS error
          price = minPrice;
          stock = totalStock;
        }

        return {
          ...dto,
          price,
          stock,
          variants,
          discount_price: dto.discount_price
            ? Math.round(Number(dto.discount_price) * 100)
            : null,
          shipping_cost: dto.shipping_cost
            ? Math.round(Number(dto.shipping_cost) * 100)
            : null,
          vendor_id: user.sub,
          store_id: user.store_id,
          slug: slugify(dto.name, { lower: true, strict: true }),
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

    let price = product.price;
    let stock = product.stock;
    let variants = product.variants;

    if (dto.variants && dto.variants.length > 0) {
      let minPrice = Infinity;
      let totalStock = 0;
      const processedVariants = dto.variants.map((v) => {
        const vPrice = Math.round(Number(v.price) * 100);
        const vDiscountPrice = v.discount_price
          ? Math.round(Number(v.discount_price) * 100)
          : undefined;

        if (vPrice < minPrice) minPrice = vPrice;
        totalStock += Number(v.stock);

        return { ...v, price: vPrice, discount_price: vDiscountPrice };
      });
      variants = processedVariants;
      price = minPrice;
      stock = totalStock;
    } else if (dto.variants === null && dto.price) {
      // If explicitly clearing variants, revert to normal price/stock logic?
      // Or just update price/stock if provided
      price = Math.round(Number(dto.price) * 100);
      stock = dto.stock !== undefined ? dto.stock : stock;
      variants = null;
    } else {
      // No new variants provided
      if (dto.price !== undefined) price = Math.round(Number(dto.price) * 100);
      if (dto.stock !== undefined) stock = dto.stock;
    }

    Object.assign(product, {
      ...dto,
      price,
      stock,
      variants,
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
    });

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

    let price = product.price;
    let stock = product.stock;
    let variants = product.variants;

    if (dto.variants && dto.variants.length > 0) {
      let minPrice = Infinity;
      let totalStock = 0;
      const processedVariants = dto.variants.map((v) => {
        const vPrice = Math.round(Number(v.price) * 100);
        const vDiscountPrice = v.discount_price
          ? Math.round(Number(v.discount_price) * 100)
          : undefined;

        if (vPrice < minPrice) minPrice = vPrice;
        totalStock += Number(v.stock);

        return { ...v, price: vPrice, discount_price: vDiscountPrice };
      });
      variants = processedVariants;
      price = minPrice;
      stock = totalStock;
    } else if (dto.variants === null && dto.price) {
      price = Math.round(Number(dto.price) * 100);
      stock = dto.stock !== undefined ? dto.stock : stock;
      variants = null;
    } else {
      if (dto.price !== undefined) price = Math.round(Number(dto.price) * 100);
      if (dto.stock !== undefined) stock = dto.stock;
    }

    Object.assign(product, {
      ...dto,
      price,
      stock,
      variants,
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
      image: product.image,
      gallery: product.gallery,
    });

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
}

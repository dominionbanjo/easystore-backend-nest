import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wishlist } from './entities/wishlist.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly cache: CacheService,
  ) {}

  async removeProductFromAllWishlists(productId: string) {
    await this.wishlistRepo.delete({ product_id: productId });
  }

  async getWishlistProductIds(userId: string): Promise<Set<string>> {
    if (!userId) return new Set();

    const cacheKey = `wishlist:ids:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const rows = await this.wishlistRepo.find({
      where: { user_id: userId },
      select: ['product_id'],
    });

    const ids = rows.map((r) => r.product_id);
    await this.cache.set(cacheKey, ids);

    return new Set(ids);
  }

  /* ────────────────────────────────────────────────
     📄 GET WISHLIST (CACHED)
  ──────────────────────────────────────────────── */
  async getWishlist(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const cacheKey = `wishlist:user:${userId}`;
    const cached = await this.cache.get<{
      message: string;
      wishlist: Wishlist[];
    }>(cacheKey);

    if (cached) return cached;

    const wishlist = await this.wishlistRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    const response = {
      message: 'Wishlist retrieved successfully',
      wishlist,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  /* ────────────────────────────────────────────────
     ➕ ADD TO WISHLIST
  ──────────────────────────────────────────────── */
  async addToWishlist(
    userId: string,
    product: {
      product_id: string;
      name: string;
      image?: string | null;
      price: number;
    },
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!product?.product_id) {
      throw new BadRequestException('Product ID is required');
    }

    const exists = await this.productRepo.findOne({
      where: { id: product.product_id },
    });

    if (!exists) {
      throw new BadRequestException(
        'Product does not exist, cannot be added to wishlist',
      );
    }

    const existing = await this.wishlistRepo.findOne({
      where: {
        user_id: userId,
        product_id: product.product_id,
      },
    });

    if (existing) {
      return {
        message: 'Product already in wishlist',
        wishlist: existing,
      };
    }

    const wishlistItem = this.wishlistRepo.create({
      user_id: userId,
      product_id: product.product_id,
      name: product.name,
      image: product.image ?? null,
      price: product.price,
    });

    const saved = await this.wishlistRepo.save(wishlistItem);

    await this.cache.clearPrefix('wishlist');

    return {
      message: 'Added to wishlist',
      wishlist: saved,
    };
  }

  /* ────────────────────────────────────────────────
     🗑️ REMOVE FROM WISHLIST
  ──────────────────────────────────────────────── */
  async removeFromWishlist(userId: string, productId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!productId) {
      throw new BadRequestException('Product ID is required');
    }

    const existing = await this.wishlistRepo.findOne({
      where: {
        user_id: userId,
        product_id: productId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Product not found in wishlist');
    }

    await this.wishlistRepo.delete(existing.id);

    await this.cache.clearPrefix('wishlist');

    return {
      message: 'Product removed from wishlist',
    };
  }

  /* ────────────────────────────────────────────────
     ❌ CLEAR WISHLIST
  ──────────────────────────────────────────────── */
  async clearWishlist(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const result = await this.wishlistRepo.delete({
      user_id: userId,
    });

    await this.cache.clearPrefix('wishlist');

    return {
      message: `Wishlist cleared (${result.affected ?? 0} item${
        result.affected === 1 ? '' : 's'
      } removed)`,
    };
  }
}

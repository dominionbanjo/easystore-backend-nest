import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductReview } from './entities/review.entity';
import { StoreReview } from './entities/store-review.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { Product } from '../product/entities/product.entity';
import { ProductCustomer } from '../product/entities/product-customer.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';

@Injectable()
export class ProductReviewService {
  constructor(
    @InjectRepository(ProductReview)
    private readonly reviewRepo: Repository<ProductReview>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductCustomer)
    private readonly productCustomerRepo: Repository<ProductCustomer>,

    @InjectRepository(StoreReview)
    private readonly storeReviewRepo: Repository<StoreReview>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly cache: CacheService,
  ) {}

  /* ────────────────────────────────────────────────
     ➕ ADD PRODUCT REVIEW
  ──────────────────────────────────────────────── */
  async addReview(data: {
    product_id: string;
    user_id: string;
    rating: number;
    comment?: string;
  }) {
    const { product_id, user_id, rating, comment } = data;

    if (!product_id || !user_id) {
      throw new BadRequestException('Product ID and User ID are required');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const product = await this.productRepo.findOne({
      where: { id: product_id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendor_id === user_id) {
      throw new BadRequestException('You cannot review your own product');
    }

    // Verify user actually purchased the product
    const verifiedPurchase = await this.productCustomerRepo.findOne({
      where: { product_id, user_id },
    });

    if (!verifiedPurchase) {
      throw new BadRequestException(
        'You must have a verified purchase of this product to leave a review.',
      );
    }

    const existing = await this.reviewRepo.findOne({
      where: { product_id, user_id },
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this product');
    }

    const review = this.reviewRepo.create({
      product_id,
      user_id,
      rating,
      comment: comment,
    });

    const saved = await this.reviewRepo.save(review);

    await this.updateProductRatings(product_id);

    await this.cache.clearPrefix('review');
    await this.cache.clearPrefix('product');

    return { success: true, id: saved.id, message: 'Review added successfully' };
  }

  /* ────────────────────────────────────────────────
     🧮 UPDATE PRODUCT RATING STATS
  ──────────────────────────────────────────────── */
  async updateProductRatings(productId: string) {
    const reviews = await this.reviewRepo.find({
      where: { product_id: productId },
      select: ['rating'],
    });

    const reviewCount = reviews.length;
    const average =
      reviewCount > 0
        ? Number(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            ).toFixed(2),
          )
        : 0;

    await this.productRepo.update(productId, {
      rating_average: average,
      rating_count: reviewCount,
      review_count: reviewCount,
    });

    await this.cache.clearPrefix('product');

    return {
      rating_average: average,
      rating_count: reviewCount,
    };
  }

  /* ────────────────────────────────────────────────
     🧾 GET PRODUCT REVIEWS (CACHED)
  ──────────────────────────────────────────────── */
  async getReviews(productId: string): Promise<ProductReview[]> {
    if (!productId) {
      throw new BadRequestException('Product ID is required');
    }

    const cacheKey = `review:list:${productId}`;
    const cached = await this.cache.get<ProductReview[]>(cacheKey);
    if (cached) return cached;

    const reviews = await this.reviewRepo.find({
      where: { product_id: productId },
      select: {
        id: true,
        rating: true,
        comment: true,
        created_at: true,
        user: {
          id: true,
          first_name: true,
          last_name: true,
          avatar: true,
        },
      },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });

    await this.cache.set(cacheKey, reviews);

    return reviews;
  }

  /* ────────────────────────────────────────────────
     ❌ DELETE REVIEW
  ──────────────────────────────────────────────── */
  async deleteReview(reviewId: string, userId?: string) {
    if (!reviewId) {
      throw new BadRequestException('Review ID is required');
    }

    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      select: { id: true, product_id: true, user_id: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (userId && review.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.reviewRepo.delete(reviewId);

    await this.updateProductRatings(review.product_id);

    await this.cache.clearPrefix('review');
    await this.cache.clearPrefix('product');

    return {
      success: true,
      message: 'Review deleted successfully',
    };
  }

  // ------------------------------------------------------------------
  // STORE REVIEW (vendor platform review)
  // ------------------------------------------------------------------
  async submitStoreReview(vendorId: string, rating: number, comment?: string) {
    const existing = await this.storeReviewRepo.findOne({ where: { vendor_id: vendorId } });
    if (existing) {
      throw new BadRequestException('You have already submitted a review');
    }

    const review = this.storeReviewRepo.create({ vendor_id: vendorId, rating, comment: comment ?? null });
    await this.storeReviewRepo.save(review);
    await this.userRepo.update(vendorId, { has_submitted_review: true });
    await this.cache.clearPrefix('review');
    return { success: true, message: 'Review submitted successfully' };
  }

  async getStoreReviewMeta(vendorId: string) {
    const review = await this.storeReviewRepo.findOne({ where: { vendor_id: vendorId } });
    const user = await this.userRepo.findOne({
      where: { id: vendorId },
      select: { has_submitted_review: true, last_review_prompt_at: true, created_at: true },
    });
    return {
      hasReviewed: !!review,
      lastReviewPromptAt: user?.last_review_prompt_at ?? null,
      createdAt: user?.created_at ?? null,
    };
  }

  async dismissReviewPrompt(vendorId: string) {
    await this.userRepo.update(vendorId, { last_review_prompt_at: new Date() });
    return { success: true };
  }
}

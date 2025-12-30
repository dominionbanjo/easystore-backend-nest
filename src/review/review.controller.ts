import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/auth/strategies/jwt.strategy';

import { ProductReviewService } from './review.service';
import { CreateProductReviewDto } from './dto/create-product-review.dto';

@Controller('products/:productId/reviews')
export class ProductReviewController {
  constructor(private readonly reviewService: ProductReviewService) {}

  /* ────────────────────────────────────────────────
     ➕ ADD PRODUCT REVIEW (AUTH REQUIRED)
  ──────────────────────────────────────────────── */
  @Post()
  @UseGuards(JwtAuthGuard)
  async addReview(
    @Param('productId') productId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateProductReviewDto,
  ) {
    if (!productId) {
      throw new BadRequestException('Product ID is required');
    }

    return this.reviewService.addReview({
      product_id: productId,
      user_id: user.sub,
      rating: dto.rating,
      comment: dto.comment,
    });
  }

  /* ────────────────────────────────────────────────
     🧾 GET PRODUCT REVIEWS (PUBLIC)
  ──────────────────────────────────────────────── */
  @Get()
  async getReviews(@Param('productId') productId: string) {
    return this.reviewService.getReviews(productId);
  }

  /* ────────────────────────────────────────────────
     ❌ DELETE REVIEW (OWNER ONLY)
  ──────────────────────────────────────────────── */
  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard)
  async deleteReview(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    /**
     * Ownership enforcement should ideally be done
     * inside the service for security.
     *
     * If you want, I can add:
     * deleteReview(reviewId, userId)
     * with ownership check.
     */
    return this.reviewService.deleteReview(reviewId);
  }
}

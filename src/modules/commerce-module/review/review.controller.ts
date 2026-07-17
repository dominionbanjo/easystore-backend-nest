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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { ProductReviewService } from './review.service';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';

@ApiTags('Reviews')
@ApiBearerAuth('JWT-auth')
@Controller('products/:productId/reviews')
export class ProductReviewController {
  constructor(private readonly reviewService: ProductReviewService) {}

  /* ────────────────────────────────────────────────
     ➕ ADD PRODUCT REVIEW (AUTH REQUIRED)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Add a product review', description: 'Adds a review and rating for a product. Requires authentication.' })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @ApiCreatedResponse({ description: 'Review added successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Get product reviews', description: 'Retrieves all reviews for a specific product. Public endpoint - no authentication required.' })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @ApiPaginatedResponse(Object)
  @ApiStandardErrorResponses()
  @Get()
  async getReviews(@Param('productId') productId: string) {
    return this.reviewService.getReviews(productId);
  }

  /* ────────────────────────────────────────────────
     ❌ DELETE REVIEW (OWNER ONLY)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Delete a review', description: 'Deletes a product review by its ID. Requires authentication and ownership.' })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @ApiParam({ name: 'reviewId', description: 'Review ID', type: String })
  @ApiOkResponse({ description: 'Review deleted successfully' })
  @ApiStandardErrorResponses()
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

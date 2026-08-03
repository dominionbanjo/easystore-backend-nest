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
  ApiBody,
} from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import {
  SuccessResponseDto,
  SuccessWithIdDto,
} from 'src/common/dto/api-response.dto';

@ApiTags('Wishlist')
@ApiBearerAuth('JWT-auth')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /* ────────────────────────────────────────────────
     📄 GET MY WISHLIST
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Get wishlist',
    description: 'Retrieves the wishlist for the authenticated user.',
  })
  @ApiOkResponse({ description: 'Wishlist retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get()
  async getMyWishlist(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.wishlistService.getWishlist(user.sub);
  }

  /* ────────────────────────────────────────────────
     ➕ ADD TO WISHLIST
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Add to wishlist',
    description: 'Adds a product to the authenticated user wishlist.',
  })
  @ApiBody({
    description: 'Product to add to wishlist',
    type: CreateWishlistDto,
  })
  @ApiCreatedResponse({
    type: SuccessWithIdDto,
    description: 'Item added to wishlist successfully',
  })
  @ApiStandardErrorResponses()
  @Post()
  async addToWishlist(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body()
    body: {
      product_id: string;
      name: string;
      image?: string | null;
      price: number;
    },
  ) {
    if (!body.product_id || !body.name || body.price == null) {
      throw new BadRequestException('product_id, name and price are required');
    }

    return this.wishlistService.addToWishlist(user.sub, {
      product_id: body.product_id,
      name: body.name,
      image: body.image ?? null,
      price: body.price,
    });
  }

  /* ────────────────────────────────────────────────
     🗑️ REMOVE FROM WISHLIST
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Remove from wishlist',
    description:
      'Removes a specific product from the authenticated user wishlist.',
  })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Item removed from wishlist successfully',
  })
  @ApiStandardErrorResponses()
  @Delete(':productId')
  async removeFromWishlist(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('productId') productId: string,
  ) {
    if (!productId) {
      throw new BadRequestException('Product ID is required');
    }

    return this.wishlistService.removeFromWishlist(user.sub, productId);
  }

  /* ────────────────────────────────────────────────
     ❌ CLEAR WISHLIST
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Clear wishlist',
    description: 'Removes all items from the authenticated user wishlist.',
  })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Wishlist cleared successfully',
  })
  @ApiStandardErrorResponses()
  @Delete()
  async clearWishlist(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.wishlistService.clearWishlist(user.sub);
  }

  /* ────────────────────────────────────────────────
     🛒 MOVE TO CART
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Move wishlist items to cart',
    description:
      'Moves all items from the authenticated user wishlist to the cart.',
  })
  @ApiCreatedResponse({
    type: SuccessResponseDto,
    description: 'Wishlist items moved to cart successfully',
  })
  @ApiStandardErrorResponses()
  @Post('move-to-cart')
  async moveToCart(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.wishlistService.moveToCart(user.sub);
  }
}

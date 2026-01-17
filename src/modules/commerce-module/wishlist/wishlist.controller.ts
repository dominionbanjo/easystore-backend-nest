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
import { WishlistService } from './wishlist.service';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /* ────────────────────────────────────────────────
     📄 GET MY WISHLIST
  ──────────────────────────────────────────────── */
  @Get()
  async getMyWishlist(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.wishlistService.getWishlist(user.sub);
  }

  /* ────────────────────────────────────────────────
     ➕ ADD TO WISHLIST
  ──────────────────────────────────────────────── */
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
  @Delete()
  async clearWishlist(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.wishlistService.clearWishlist(user.sub);
  }
}

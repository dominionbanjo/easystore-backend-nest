import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /* ────────────────────────────────────────────────
     GET CART
  ──────────────────────────────────────────────── */

  /**
   * GET /cart
   * Returns the authenticated user's cart
   */
  @Get()
  getCart(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.cartService.getCart(user.sub);
  }

  /* ────────────────────────────────────────────────
     ADD ITEM
  ──────────────────────────────────────────────── */

  /**
   * POST /cart/items
   */
  @Post('items')
  addItem(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body()
    body: CreateCartDto,
  ) {
    return this.cartService.addItem(user.sub, body);
  }

  /* ────────────────────────────────────────────────
     UPDATE ITEM
  ──────────────────────────────────────────────── */

  /**
   * PATCH /cart/items/:productId
   */
  @Patch('items/:productId')
  updateItem(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('productId') productId: string,
    @Body()
    body: UpdateCartDto,
  ) {
    return this.cartService.updateItem(user.sub, productId, body);
  }

  /* ────────────────────────────────────────────────
     REMOVE ITEM
  ──────────────────────────────────────────────── */

  /**
   * DELETE /cart/items/:productId
   */
  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('productId') productId: string,
    @Query('size') size?: string,
    @Query('color') color?: string,
    @Query('variant_id') variantId?: string,
  ) {
    return this.cartService.removeItem(
      user.sub,
      productId,
      size,
      color,
      variantId,
    );
  }

  /* ────────────────────────────────────────────────
     CLEAR CART
  ──────────────────────────────────────────────── */

  /**
   * DELETE /cart
   */
  @Delete()
  clearCart(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.cartService.clearCart(user.sub);
  }
}

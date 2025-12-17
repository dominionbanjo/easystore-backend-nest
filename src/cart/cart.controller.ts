import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';

import { CartService } from './cart.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/auth/strategies/jwt.strategy';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

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
  ) {
    return this.cartService.removeItem(user.sub, productId);
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

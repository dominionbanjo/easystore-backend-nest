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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { SuccessResponseDto } from 'src/common/dto/api-response.dto';

@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
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
  @ApiOperation({ summary: 'Get cart', description: 'Retrieves the current cart for the authenticated user.' })
  @ApiOkResponse({ description: 'Cart retrieved successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Add item to cart', description: 'Adds a product to the authenticated user cart.' })
  @ApiCreatedResponse({ type: SuccessResponseDto, description: 'Item added to cart successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Update cart item', description: 'Updates the quantity or details of a product in the authenticated user cart.' })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Cart item updated successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Remove item from cart', description: 'Removes a specific product from the authenticated user cart. Supports optional variant filtering.' })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @ApiQuery({ name: 'size', required: false, type: String, description: 'Product size variant to remove' })
  @ApiQuery({ name: 'color', required: false, type: String, description: 'Product color variant to remove' })
  @ApiQuery({ name: 'variant_id', required: false, type: String, description: 'Specific variant ID to remove' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Item removed from cart successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Clear cart', description: 'Removes all items from the authenticated user cart.' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Cart cleared successfully' })
  @ApiStandardErrorResponses()
  @Delete()
  clearCart(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.cartService.clearCart(user.sub);
  }
}

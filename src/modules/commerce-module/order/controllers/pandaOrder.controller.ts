import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';

import { OrderService } from '../services/order.service';

@Controller('panda-order')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  /* ────────────────────────────────────────────────
     🛒 BUYER: CREATE ORDER (PANDASCROW ESCROW)
     POST /orders/panda
  ──────────────────────────────────────────────── */
  @Post('panda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'vendor')
  createPandaOrder(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body()
    body: {
      order_items: any[];
    },
  ) {
    if (!body.order_items || body.order_items.length === 0) {
      throw new BadRequestException('Order items are required');
    }

    return this.orders.createPandaEscrowOrder({
      buyer_id: user.sub,
      order_items: body.order_items,
    });
  }

  /* ────────────────────────────────────────────────
     ✅ BUYER: COMPLETE ORDER (PANDASCROW OTP)
     PATCH /orders/panda/:orderId/complete
  ──────────────────────────────────────────────── */
  @Patch('panda/:orderId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  completePandaOrder(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('orderId') orderId: string,
    @Body()
    body: {
      otp: string;
    },
  ) {
    if (!body.otp) {
      throw new BadRequestException('OTP is required');
    }

    return this.orders.completePandaEscrowOrder({
      order_id: orderId,
      otp: body.otp,
    });
  }
}

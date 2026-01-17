import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { OrderService } from '../services/order.service';
import { CreateOfflineOrderDto } from '../dto/create-offline-order.dto';
import { CreateOnlineOrderDto } from '../dto/create-online-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { ICartItem } from '../../cart/types/types';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /* ────────────────────────────────────────────────
     CREATE OFFLINE ORDER
  ──────────────────────────────────────────────── */
  @Post('offline')
  async createOfflineOrder(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateOfflineOrderDto,
  ) {
    return this.orderService.createOfflineOrder({
      buyer_id: user.sub,
      order_items: dto.order_items as ICartItem[],
      tax: dto.tax,
      notes: dto.notes,
    });
  }

  /* ────────────────────────────────────────────────
     CREATE ONLINE ORDER (PAYSTACK)
  ──────────────────────────────────────────────── */
  @Post('online')
  async createOnlineOrder(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateOnlineOrderDto,
  ) {
    return this.orderService.createOnlineOrder({
      buyer_id: user.sub,
      email: dto.email,
      order_items: dto.order_items as ICartItem[],
    });
  }

  /* ────────────────────────────────────────────────
     VERIFY PAYMENT (PAYSTACK CALLBACK)
  ──────────────────────────────────────────────── */
  @Post('verify/:reference')
  async verifyPayment(@Param('reference') reference: string) {
    if (!reference) {
      throw new BadRequestException('Payment reference is required');
    }

    return this.orderService.verifyPayment(reference);
  }

  /* ────────────────────────────────────────────────
     GET SINGLE ORDER
  ──────────────────────────────────────────────── */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.orderService.getOrder(id);
  }

  /* ────────────────────────────────────────────────
     GET ORDERS — CURRENT USER (BUYER)
  ──────────────────────────────────────────────── */
  @Get()
  async getMyOrders(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.orderService.getOrdersByUser(user.sub);
  }

  /* ────────────────────────────────────────────────
     GET ORDERS — VENDOR
  ──────────────────────────────────────────────── */
  @Get('vendor/me')
  @UseGuards(RolesGuard)
  @Roles('seller')
  async getVendorOrders(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.orderService.getOrdersByVendor(user.sub);
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS (VENDOR / ADMIN)
  ──────────────────────────────────────────────── */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('seller', 'admin')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto.status);
  }

  /* ────────────────────────────────────────────────
     CANCEL ORDER (BUYER OR VENDOR)
  ──────────────────────────────────────────────── */
  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.cancelOrder(id, user.sub);
  }
}

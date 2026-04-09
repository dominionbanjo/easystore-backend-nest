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
import { RecordVendorOfflineSaleDto } from '../dto/record-offline-sale.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { ICartItem } from '../../cart/types/types';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class PandaOrderController {
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
     CREATE ONLINE ORDER WITHOUT ESCROW (DIRECT PAYSTACK)
     NOTE: This endpoint is for direct payment with 2% platform fee
     No escrow protection - immediate payment to vendor
  ──────────────────────────────────────────────── */
  @Post('online/direct')
  async createOnlineOrderNoEscrow(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateOnlineOrderDto,
  ) {
    return this.orderService.createOnlineOrderNoEscrow({
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
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.getOrderForApi(id, user.sub);
  }

  /* ────────────────────────────────────────────────
     GET ORDERS — CURRENT USER (BUYER)
  ──────────────────────────────────────────────── */
  @Get()
  async getMyOrders(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.orderService.getOrdersByUser(user.sub, {
      search,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  /* ────────────────────────────────────────────────
     GET ORDERS — VENDOR
  ──────────────────────────────────────────────── */
  @Get('vendor/me')
  @UseGuards(RolesGuard, StoreOwnerGuard)
  @Roles('vendor')
  async getVendorOrders(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Store not found for this vendor');
    }
    return this.orderService.getOrdersByVendor(user.sub, {
      search,
      status,
      page,
      limit,
    });
  }

  /* ────────────────────────────────────────────────
     RECORD OFFLINE SALE (VENDOR)
  ──────────────────────────────────────────────── */
  @Post('vendor/offline-sale')
  @UseGuards(RolesGuard, StoreOwnerGuard)
  @Roles('vendor')
  async recordVendorOfflineSale(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: RecordVendorOfflineSaleDto,
  ) {
    return this.orderService.recordVendorOfflineSale({
      vendor_id: user.sub,
      items: dto.items,
      customer_name: dto.customer_name,
      customer_email: dto.customer_email,
      notes: dto.notes,
    });
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

  /* ────────────────────────────────────────────────
     DOWNLOAD RECEIPT
  ──────────────────────────────────────────────── */
  @Get(':id/receipt')
  async downloadReceipt(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const pdfBuffer = await this.orderService.getOrderReceiptPdf(id, user.sub);
    
    return {
      status: 'success',
      data: pdfBuffer.toString('base64'),
      filename: `receipt-${id.split('-')[0].toUpperCase()}.pdf`,
    };
  }
}

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';

import { StoreAnalyticsService } from './store-analytics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { StoreOwnerGuard } from 'src/store/guards/store-owner.guard';
import { ICartItem } from 'src/cart/types/types';

@Controller('store-analytics')
@UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
export class StoreAnalyticsController {
  constructor(private readonly analytics: StoreAnalyticsService) {}

  /* ────────────────────────────────────────────────
     GET FULL ANALYTICS SNAPSHOT
  ──────────────────────────────────────────────── */
  @Get(':storeId')
  @Roles('vendor', 'admin')
  getAnalytics(@Param('storeId') storeId: string) {
    return this.analytics.getAnalytics(storeId);
  }

  /* ────────────────────────────────────────────────
     RECORD ORDER → UPDATE ANALYTICS
  ──────────────────────────────────────────────── */
  @Post(':storeId/event/order')
  @Roles('vendor', 'admin')
  updateFromOrder(
    @Param('storeId') storeId: string,
    @Body()
    body: {
      amount: number;
      customerId: string;
      items: ICartItem[];
    },
  ) {
    return this.analytics.updateFromOrder(
      storeId,
      body.amount,
      body.customerId,
      body.items,
    );
  }

  /* ────────────────────────────────────────────────
     TOP PRODUCTS (FROM ANALYTICS TABLE)
  ──────────────────────────────────────────────── */
  @Get(':storeId/top-products')
  @Roles('vendor', 'admin')
  async getTopProducts(@Param('storeId') storeId: string) {
    const data = await this.analytics.getAnalytics(storeId);
    return data;
  }
}

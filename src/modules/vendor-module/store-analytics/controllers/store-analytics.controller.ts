import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../../common/decorators/api-standard-errors.decorator';
import { SuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { StoreAnalyticsService } from '../services/store-analytics.service';
import { ICartItem } from 'src/modules/commerce-module/cart/types/types';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { StoreOwnerGuard } from '../../store/guards/store-owner.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../../../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../../../common/permissions/permissions.decorator';
import { Permission } from '../../../../common/permissions/permissions';

@ApiTags('Store Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('store-analytics')
@UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
export class StoreAnalyticsController {
  constructor(private readonly analytics: StoreAnalyticsService) {}

  @ApiOperation({ summary: 'Get my store analytics', description: 'Retrieve analytics data for the authenticated user\'s store' })
  @ApiOkResponse({ description: 'Store analytics data' })
  @ApiStandardErrorResponses()
  @Get('me')
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  @Roles('vendor', 'admin')
  async getMyStoreAnalytics(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    if (!user.store_id) {
      throw new NotFoundException('No store associated with this account');
    }

    return this.analytics.getAnalytics(user.store_id);
  }

  /* ────────────────────────────────────────────────
     GET FULL ANALYTICS SNAPSHOT
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get store analytics by ID', description: 'Retrieve analytics data for a specific store' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiOkResponse({ description: 'Store analytics data' })
  @ApiStandardErrorResponses()
  @Get(':storeId')
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  @Roles('vendor', 'admin')
  getAnalytics(@Param('storeId') storeId: string) {
    return this.analytics.getAnalytics(storeId);
  }

  /* ────────────────────────────────────────────────
     RECORD ORDER → UPDATE ANALYTICS
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Record order and update analytics', description: 'Record an order event and update the store analytics data' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiBody({ description: 'Order event data', type: Object })
  @ApiCreatedResponse({ type: SuccessResponseDto, description: 'Analytics updated successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Get top products from analytics', description: 'Retrieve the top-selling products from analytics data for a store' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiOkResponse({ description: 'Top products data' })
  @ApiStandardErrorResponses()
  @Get(':storeId/top-products')
  @Roles('vendor', 'admin')
  async getTopProducts(@Param('storeId') storeId: string) {
    const data = await this.analytics.getAnalytics(storeId);
    return data;
  }

  /* 🔐 ADMIN ONLY */
  @ApiOperation({ summary: 'Initialize store analytics', description: 'Initialize analytics data for a store (admin only)' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiCreatedResponse({ type: SuccessResponseDto, description: 'Analytics initialized successfully' })
  @ApiStandardErrorResponses()
  @Post(':storeId/initialize')
  @Roles('admin')
  initializeStoreAnalytics(@Param('storeId') storeId: string) {
    return this.analytics.initializeAnalyticsForStore(storeId);
  }
}

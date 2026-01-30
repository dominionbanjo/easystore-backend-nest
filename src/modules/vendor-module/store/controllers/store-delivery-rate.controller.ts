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

import { SetProductDeliveryRateDto } from '../dto/store-delivery-rate.dto';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { StoreDeliveryRateService } from '../services/store-delivery-rate.service';

@Controller('store-delivery-rates')
export class StoreDeliveryRateController {
  constructor(private readonly deliveryRateService: StoreDeliveryRateService) {}

  /* ────────────────────────────────────────────────
     🌍 PUBLIC: GET DELIVERY RATES FOR A STORE
     GET /store-delivery-rates/store/:storeId
  ──────────────────────────────────────────────── */
  @Get('store/:storeId')
  getRatesByStore(@Param('storeId') storeId: string) {
    return this.deliveryRateService.getRatesByStore(storeId);
  }

  /* ────────────────────────────────────────────────
     ➕ STORE OWNER: ADD DELIVERY RATE
     POST /store-delivery-rates/store/:storeId
  ──────────────────────────────────────────────── */
  @Post('store/:storeId')
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('vendor', 'admin')
  createRate(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('storeId') storeId: string,
    @Body() dto: SetProductDeliveryRateDto,
  ) {
    return this.deliveryRateService.createRate(user.sub, storeId, dto);
  }

  /* ────────────────────────────────────────────────
     ✏️ STORE OWNER: UPDATE DELIVERY RATE
     PATCH /store-delivery-rates/:rateId
  ──────────────────────────────────────────────── */
  @Patch(':rateId')
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('vendor', 'admin')
  updateRate(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('rateId') rateId: string,
    @Body() dto: Partial<SetProductDeliveryRateDto>,
  ) {
    return this.deliveryRateService.updateRate(user.sub, rateId, dto);
  }

  /* ────────────────────────────────────────────────
     🗑️ STORE OWNER: DELETE DELIVERY RATE
     DELETE /store-delivery-rates/:rateId
  ──────────────────────────────────────────────── */
  @Delete(':rateId')
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('vendor', 'admin')
  deleteRate(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('rateId') rateId: string,
  ) {
    return this.deliveryRateService.deleteRate(user.sub, rateId);
  }
}

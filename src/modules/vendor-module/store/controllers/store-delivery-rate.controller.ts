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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../../common/decorators/api-standard-errors.decorator';
import { SuccessResponseDto, SuccessWithIdDto } from '../../../../common/dto/api-response.dto';

import { SetProductDeliveryRateDto } from '../dto/store-delivery-rate.dto';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { StoreDeliveryRateService } from '../services/store-delivery-rate.service';

@ApiTags('Store Delivery Rates')
@ApiBearerAuth('JWT-auth')
@Controller('store-delivery-rates')
export class StoreDeliveryRateController {
  constructor(private readonly deliveryRateService: StoreDeliveryRateService) {}

  @ApiOperation({ summary: 'Get delivery rates for a store', description: 'Retrieve all delivery rates configured for a store (public)' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiOkResponse({ description: 'List of delivery rates for the store' })
  @ApiStandardErrorResponses()
  @Get('store/:storeId')
  getRatesByStore(@Param('storeId') storeId: string) {
    return this.deliveryRateService.getRatesByStore(storeId);
  }

  @ApiOperation({ summary: 'Add delivery rate', description: 'Create a new delivery rate for a store (store owner only)' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiCreatedResponse({ type: SuccessWithIdDto, description: 'Delivery rate created successfully' })
  @ApiStandardErrorResponses()
  @Post('store/:storeId')
  @RequirePermissions(Permission.MANAGE_STORE)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  createRate(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('storeId') storeId: string,
    @Body() dto: SetProductDeliveryRateDto,
  ) {
    return this.deliveryRateService.createRate(user.sub, storeId, dto);
  }

  @ApiOperation({ summary: 'Update delivery rate', description: 'Update an existing delivery rate for a store (store owner only)' })
  @ApiParam({ name: 'rateId', description: 'Delivery rate ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Delivery rate updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':rateId')
  @RequirePermissions(Permission.MANAGE_STORE)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  updateRate(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('rateId') rateId: string,
    @Body() dto: Partial<SetProductDeliveryRateDto>,
  ) {
    return this.deliveryRateService.updateRate(user.sub, rateId, dto);
  }

  @ApiOperation({ summary: 'Delete delivery rate', description: 'Delete a delivery rate from a store (store owner only)' })
  @ApiParam({ name: 'rateId', description: 'Delivery rate ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Delivery rate deleted successfully' })
  @ApiStandardErrorResponses()
  @Delete(':rateId')
  @RequirePermissions(Permission.MANAGE_STORE)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  deleteRate(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('rateId') rateId: string,
  ) {
    return this.deliveryRateService.deleteRate(user.sub, rateId);
  }
}

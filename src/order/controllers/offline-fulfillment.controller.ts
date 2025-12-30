import { Controller, Patch, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/auth/strategies/jwt.strategy';
import { OfflineFulfillmentService } from '../services/offline-fulfillment.service';

@Controller('orders/offline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
export class OfflineFulfillmentController {
  constructor(private readonly fulfillment: OfflineFulfillmentService) {}

  @Patch(':id/fulfill')
  async fulfillOfflineOrder(
    @Param('id') orderId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.fulfillment.fulfill(orderId, user.sub);
  }
}

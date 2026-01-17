import { Controller, Patch, Param, UseGuards } from '@nestjs/common';
import { OfflineFulfillmentService } from '../services/offline-fulfillment.service';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';

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

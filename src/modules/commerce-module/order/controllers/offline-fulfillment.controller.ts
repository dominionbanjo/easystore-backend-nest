import { Controller, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { OfflineFulfillmentService } from '../services/offline-fulfillment.service';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders/offline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
export class OfflineFulfillmentController {
  constructor(private readonly fulfillment: OfflineFulfillmentService) {}

  @ApiOperation({ summary: 'Fulfill an offline order', description: 'Marks an offline order as fulfilled by the seller.' })
  @ApiParam({ name: 'id', description: 'Offline order ID', type: String })
  @ApiOkResponse({ description: 'Offline order fulfilled successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/fulfill')
  async fulfillOfflineOrder(
    @Param('id') orderId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.fulfillment.fulfill(orderId, user.sub);
  }
}

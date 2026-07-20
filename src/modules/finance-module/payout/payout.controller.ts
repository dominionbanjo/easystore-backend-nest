import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { PayoutListItemDto } from '../../../common/dto/response/transaction-response.dto';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../../common/permissions/permissions.decorator';
import { Permission } from '../../../common/permissions/permissions';

import { PayoutQueryDto } from './dto/payout-query.dto';

@ApiTags('Payouts')
@ApiBearerAuth('JWT-auth')
@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get('vendor/me')
  @RequirePermissions(Permission.VIEW_TRANSACTIONS)
  @UseGuards(PermissionsGuard, RolesGuard)
  @Roles('vendor')
  @ApiOperation({ summary: 'Get vendor payouts', description: 'Retrieves paginated payouts for the currently authenticated vendor.' })
  @ApiPaginatedResponse(PayoutListItemDto)
  @ApiStandardErrorResponses()
  async getMyPayouts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: PayoutQueryDto,
  ) {
    return this.payoutService.getVendorPayouts(user.sub, query);
  }
}

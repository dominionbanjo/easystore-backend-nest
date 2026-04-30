import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

import { PayoutQueryDto } from './dto/payout-query.dto';

@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  /**
   * GET /payouts/vendor/me
   * Retrieve payouts for the currently authenticated vendor.
   */
  @Get('vendor/me')
  @UseGuards(RolesGuard)
  @Roles('vendor')
  async getMyPayouts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: PayoutQueryDto,
  ) {
    return this.payoutService.getVendorPayouts(user.sub, query);
  }
}

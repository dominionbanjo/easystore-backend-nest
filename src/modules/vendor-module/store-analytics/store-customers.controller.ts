import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StoreCustomersService } from './store-customers.service';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import type { JwtAuthUser } from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('store-customers')
@UseGuards(JwtAuthGuard)
export class StoreCustomersController {
  constructor(private readonly customersService: StoreCustomersService) {}

  @Get()
  getCustomers(
    @CurrentUser() user: JwtAuthUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    if (!user.store_id) {
      // This shouldn't happen for vendors, but just in case
      return {
        message: 'No store associated with this user',
        data: { items: [], pagination: {} },
      };
    }

    return this.customersService.getStoreCustomers(user.store_id, {
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      sort,
      order,
    });
  }
}

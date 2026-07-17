import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../../common/decorators/api-paginated-response.decorator';
import { StoreCustomersService } from '../services/store-customers.service';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import type { JwtAuthUser } from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@ApiTags('Store Customers')
@ApiBearerAuth('JWT-auth')
@Controller('store-customers')
@UseGuards(JwtAuthGuard)
export class StoreCustomersController {
  constructor(private readonly customersService: StoreCustomersService) {}

  @ApiOperation({ summary: 'Get store customers', description: 'Retrieve paginated list of customers for the authenticated user\'s store' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort field' })
  @ApiQuery({ name: 'order', required: false, type: String, description: 'Sort order (ASC or DESC)' })
  @ApiPaginatedResponse(Object)
  @ApiStandardErrorResponses()
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

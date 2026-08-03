import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../../common/decorators/api-paginated-response.decorator';
import { StoreAdminListItemDto } from '../../../../common/dto/response/store-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { StoreService } from '../services/store.service';

@ApiTags('Store Admin')
@ApiBearerAuth('JWT-auth')
@Controller('store-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StoreAdminController {
  constructor(private readonly storeService: StoreService) {}

  @ApiOperation({
    summary: 'Get all stores admin view',
    description: 'Retrieve paginated list of all stores for admin management',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiPaginatedResponse(StoreAdminListItemDto)
  @ApiStandardErrorResponses()
  @Get()
  getAll(@Query() pagination: PaginationQueryDto) {
    return this.storeService.getAllStoresAdmin(pagination);
  }
}

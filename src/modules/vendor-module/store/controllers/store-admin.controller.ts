import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { StoreService } from '../services/store.service';

@Controller('store-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StoreAdminController {
  constructor(private readonly storeService: StoreService) {}

  // GET /store/admin
  @Get()
  getAll(@Query() pagination: PaginationQueryDto) {
    return this.storeService.getAllStoresAdmin(pagination);
  }
}

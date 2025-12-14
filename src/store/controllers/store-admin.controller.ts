import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StoreService } from '../store.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

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

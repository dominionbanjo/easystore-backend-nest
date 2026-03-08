import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from '../services/admin-users.service';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  // GET /admin/users  — all users (with optional filters)
  @Get()
  getAllUsers(@Query() query: any) {
    return this.adminUsersService.getAllUsers(query);
  }

  // GET /admin/users/vendors — vendor-only list
  @Get('vendors')
  getAllVendors(@Query() query: any) {
    return this.adminUsersService.getAllVendors(query);
  }

  // GET /admin/users/:id — single user detail
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.adminUsersService.getOne(id);
  }

  // PATCH /admin/users/:id/status
  @Patch(':id/status')
  updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminUsersService.updateUserStatus(id, status as any);
  }
}

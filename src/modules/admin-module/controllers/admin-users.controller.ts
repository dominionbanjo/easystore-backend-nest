import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { UserListItemDto, VendorListItemDto } from '../../../common/dto/response/user-response.dto';
import { SuccessResponseDto } from '../../../common/dto/api-response.dto';
import { AdminUsersService } from '../services/admin-users.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@ApiTags('Admin Users')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @ApiOperation({ summary: 'Get all users', description: 'Retrieve paginated list of all users with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by user status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by user type' })
  @ApiPaginatedResponse(UserListItemDto)
  @ApiStandardErrorResponses()
  @Get()
  getAllUsers(@Query() query: PaginationQueryDto & { status?: string; search?: string; type?: string }) {
    return this.adminUsersService.getAllUsers(query);
  }

  @ApiOperation({ summary: 'Get all vendors', description: 'Retrieve paginated list of all vendor accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by vendor status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiPaginatedResponse(VendorListItemDto)
  @ApiStandardErrorResponses()
  @Get('vendors')
  getAllVendors(@Query() query: PaginationQueryDto & { status?: string; search?: string }) {
    return this.adminUsersService.getAllVendors(query);
  }

  @ApiOperation({ summary: 'Get user by ID', description: 'Retrieve a single user by their ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiOkResponse({ description: 'User details' })
  @ApiStandardErrorResponses()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.adminUsersService.getOne(id);
  }

  @ApiOperation({ summary: 'Update user status', description: 'Activate or deactivate a user account' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiBody({ description: 'New status', type: Object })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'User status updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/status')
  updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminUsersService.updateUserStatus(id, status as any);
  }

  @ApiOperation({ summary: 'Update vendor store status', description: 'Activate or deactivate a vendor store' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiBody({ description: 'New status', type: Object })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Vendor store status updated successfully' })
  @ApiStandardErrorResponses()
  @Patch('vendor/:storeId/status')
  updateVendorStatus(
    @Param('storeId') storeId: string,
    @Body('status') status: string,
  ) {
    return this.adminUsersService.updateStoreStatus(storeId, status as any);
  }
}

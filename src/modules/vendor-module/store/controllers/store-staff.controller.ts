import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { SuccessResponseDto, SuccessWithIdDto } from 'src/common/dto/api-response.dto';
import { StoreStaffService } from '../services/store-staff.service';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@ApiTags('Staff Management')
@ApiBearerAuth('JWT-auth')
@Controller('store/staff')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StoreStaffController {
  constructor(private readonly staffService: StoreStaffService) {}

  @Post('invite')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Invite a new staff member', description: 'Creates a staff account and sends invite email with temporary password' })
  @ApiCreatedResponse({ type: SuccessWithIdDto, description: 'Staff invited successfully' })
  @ApiBody({ description: 'Staff details', schema: { properties: { email: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' } } } })
  @ApiStandardErrorResponses()
  async inviteStaff(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: { email: string; first_name: string; last_name: string; password?: string },
  ) {
    return this.staffService.inviteStaff(user.store_id!, body);
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'List all staff', description: 'Get paginated list of staff members for the vendor store' })
  @ApiOkResponse({ description: 'Paginated list of staff' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiStandardErrorResponses()
  async listStaff(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.staffService.listStaff(user.store_id!, { page: Number(page) || 1, limit: Number(limit) || 20, status, search });
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Get staff details' })
  @ApiOkResponse({ description: 'Staff details' })
  @ApiParam({ name: 'id', type: String })
  @ApiStandardErrorResponses()
  async getStaff(@CurrentUser() user: jwtStrategy.JwtAuthUser, @Param('id') id: string) {
    return this.staffService.getStaff(id, user.store_id!);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Update staff profile', description: 'Update staff first name or last name' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Staff updated successfully' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ description: 'Fields to update', schema: { properties: { first_name: { type: 'string' }, last_name: { type: 'string' } } } })
  @ApiStandardErrorResponses()
  async updateStaff(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
    @Body() body: { first_name?: string; last_name?: string },
  ) {
    return this.staffService.updateStaff(id, user.store_id!, body);
  }

  @Patch(':id/permissions')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Update staff permissions', description: 'Set additional permissions for a staff member (e.g. product:create)' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Permissions updated' })
  @ApiBody({ schema: { properties: { permissions: { type: 'array', items: { type: 'string' } } } } })
  @ApiStandardErrorResponses()
  async updatePermissions(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.staffService.updateStaffPermissions(id, user.store_id!, body.permissions);
  }

  @Patch(':id/suspend')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Suspend a staff member' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Staff suspended' })
  @ApiParam({ name: 'id', type: String })
  @ApiStandardErrorResponses()
  async suspendStaff(@CurrentUser() user: jwtStrategy.JwtAuthUser, @Param('id') id: string) {
    return this.staffService.suspendStaff(id, user.store_id!);
  }

  @Patch(':id/unsuspend')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Unsuspend a staff member' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Staff unsuspended' })
  @ApiParam({ name: 'id', type: String })
  @ApiStandardErrorResponses()
  async unsuspendStaff(@CurrentUser() user: jwtStrategy.JwtAuthUser, @Param('id') id: string) {
    return this.staffService.unsuspendStaff(id, user.store_id!);
  }

  @Post(':id/reset-password')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Reset staff password', description: 'Generates new temporary password and sends via email' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Password reset successful' })
  @ApiParam({ name: 'id', type: String })
  @ApiStandardErrorResponses()
  async resetStaffPassword(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
    @Body() body?: { password?: string },
  ) {
    return this.staffService.resetPassword(id, user.store_id!, body?.password);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_STORE)
  @ApiOperation({ summary: 'Remove staff member', description: 'Remove staff from the store' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Staff removed' })
  @ApiParam({ name: 'id', type: String })
  @ApiStandardErrorResponses()
  async removeStaff(@CurrentUser() user: jwtStrategy.JwtAuthUser, @Param('id') id: string) {
    return this.staffService.removeStaff(id, user.store_id!);
  }
}

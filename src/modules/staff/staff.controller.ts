import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { SuccessResponseDto } from 'src/common/dto/api-response.dto';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@ApiTags('Staff')
@ApiBearerAuth('JWT-auth')
@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get staff profile' })
  @ApiOkResponse({ description: 'Staff profile returned' })
  @ApiStandardErrorResponses()
  async getProfile(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.staffService.getProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update staff profile', description: 'Update name, phone, avatar (NOT store info)' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Profile updated' })
  @ApiBody({ description: 'Profile fields', schema: { properties: { first_name: { type: 'string' }, last_name: { type: 'string' }, phone_number: { type: 'string' } } } })
  @ApiStandardErrorResponses()
  async updateProfile(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: { first_name?: string; last_name?: string; phone_number?: string },
  ) {
    return this.staffService.updateProfile(user.sub, body);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change own password' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Password changed' })
  @ApiBody({ description: 'Current and new password', schema: { properties: { current_password: { type: 'string' }, new_password: { type: 'string' } } } })
  @ApiStandardErrorResponses()
  async changePassword(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: { current_password: string; new_password: string },
  ) {
    return this.staffService.changePassword(user.sub, body.current_password, body.new_password);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get staff dashboard summary stats' })
  @ApiOkResponse({ description: 'Staff summary stats' })
  @ApiStandardErrorResponses()
  async getSummary(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.staffService.getStaffSummary(user.sub);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get effective permissions for current staff' })
  @ApiOkResponse({ description: 'Staff permissions returned' })
  @ApiStandardErrorResponses()
  async getPermissions(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.staffService.getEffectivePermissions(user.sub);
  }
}

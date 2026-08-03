import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import {
  SuccessResponseDto,
  SuccessWithIdDto,
} from '../../../common/dto/api-response.dto';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { NotificationService } from './notification.service';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Notification } from './entities/notification.entity';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('admin/notifications/automated')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'List automated notifications',
    description:
      'Returns a list of automated notifications, optionally filtered by type, status, or search term.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by notification type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by notification status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiPaginatedResponse(Object)
  @ApiStandardErrorResponses()
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.notificationService.findAll({ type, status, search });
  }

  @Post()
  @ApiOperation({
    summary: 'Create automated notification',
    description: 'Creates a new automated notification template.',
  })
  @ApiBody({ description: 'Notification data', type: Object })
  @ApiCreatedResponse({
    type: SuccessWithIdDto,
    description: 'Notification created successfully',
  })
  @ApiStandardErrorResponses()
  create(@Body() data: Partial<Notification>) {
    return this.notificationService.create(data);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update automated notification',
    description: 'Updates an existing automated notification template.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  @ApiBody({ description: 'Updated notification data', type: Object })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Notification updated successfully',
  })
  @ApiStandardErrorResponses()
  update(@Param('id') id: string, @Body() data: Partial<Notification>) {
    return this.notificationService.update(id, data);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a specific automated notification as read.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Notification marked as read',
  })
  @ApiStandardErrorResponses()
  markAsRead(@Param('id') id: string) {
    return this.notificationService.update(id, { status: 'read' });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete automated notification',
    description: 'Deletes an automated notification template.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Notification deleted successfully',
  })
  @ApiStandardErrorResponses()
  remove(@Param('id') id: string) {
    return this.notificationService.delete(id);
  }
}

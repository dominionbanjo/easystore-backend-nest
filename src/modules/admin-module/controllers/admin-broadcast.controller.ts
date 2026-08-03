import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { AdminBroadcastService } from '../services/admin-broadcast.service';
import {
  SuccessResponseDto,
  SuccessWithIdDto,
} from '../../../common/dto/api-response.dto';
import { CreateBroadcastDto } from '../dto/create-broadcast.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@ApiTags('Admin Broadcasts')
@ApiBearerAuth('JWT-auth')
@Controller('admin/broadcasts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminBroadcastController {
  constructor(private readonly broadcastService: AdminBroadcastService) {}

  @ApiOperation({
    summary: 'Create a broadcast',
    description: 'Create a new broadcast message to be sent to users',
  })
  @ApiCreatedResponse({
    type: SuccessWithIdDto,
    description: 'Broadcast created successfully',
  })
  @ApiStandardErrorResponses()
  @Post()
  create(@Body() dto: CreateBroadcastDto) {
    return this.broadcastService.createBroadcast(dto);
  }

  @ApiOperation({
    summary: 'Get all broadcasts',
    description: 'Retrieve list of all broadcast messages',
  })
  @ApiOkResponse({ description: 'List of broadcasts' })
  @ApiStandardErrorResponses()
  @Get()
  findAll() {
    return this.broadcastService.findAll();
  }

  @ApiOperation({
    summary: 'Update a broadcast',
    description: 'Update an existing broadcast message',
  })
  @ApiParam({ name: 'id', description: 'Broadcast ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Broadcast updated successfully',
  })
  @ApiStandardErrorResponses()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateBroadcastDto>) {
    return this.broadcastService.updateBroadcast(id, dto);
  }

  @ApiOperation({
    summary: 'Delete a broadcast',
    description: 'Delete a broadcast message by its ID',
  })
  @ApiParam({ name: 'id', description: 'Broadcast ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Broadcast deleted successfully',
  })
  @ApiStandardErrorResponses()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.broadcastService.deleteBroadcast(id);
  }
}

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
import { AdminBroadcastService } from '../services/admin-broadcast.service';
import { CreateBroadcastDto } from '../dto/create-broadcast.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@Controller('admin/broadcasts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminBroadcastController {
  constructor(private readonly broadcastService: AdminBroadcastService) {}

  @Post()
  create(@Body() dto: CreateBroadcastDto) {
    return this.broadcastService.createBroadcast(dto);
  }

  @Get()
  findAll() {
    return this.broadcastService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.broadcastService.updateBroadcast(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.broadcastService.deleteBroadcast(id);
  }
}

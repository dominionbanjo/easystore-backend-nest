import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { OrderService } from 'src/modules/commerce-module/order/services/order.service';
import * as orderEntity from 'src/modules/commerce-module/order/entities/order.entity';
import { AdminOrderService } from '../services/admin-order.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminOrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly adminOrderService: AdminOrderService,
  ) {}

  /* ────────────────────────────────────────────────
     GET ALL ORDERS (ADMIN)
  ──────────────────────────────────────────────── */
  @Get()
  async getAllOrders(
    @Query() query: PaginationQueryDto & { status?: string; search?: string },
  ) {
    return this.adminOrderService.getAllOrders(query);
  }

  /* ────────────────────────────────────────────────
     GET SINGLE ORDER (ADMIN)
  ──────────────────────────────────────────────── */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.adminOrderService.getOne(id);
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS (ADMIN OVERRIDE)
  ──────────────────────────────────────────────── */
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: orderEntity.OrderStatus,
  ) {
    return this.orderService.updateOrderStatus(id, status);
  }
}

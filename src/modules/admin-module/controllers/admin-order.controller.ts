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
import { OrderListItemDto } from '../../../common/dto/response/order-response.dto';
import { SuccessResponseDto } from '../../../common/dto/api-response.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { OrderService } from 'src/modules/commerce-module/order/services/order.service';
import * as orderEntity from 'src/modules/commerce-module/order/entities/order.entity';
import { AdminOrderService } from '../services/admin-order.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@ApiTags('Admin Orders')
@ApiBearerAuth('JWT-auth')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminOrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly adminOrderService: AdminOrderService,
  ) {}

  @ApiOperation({ summary: 'Get all orders', description: 'Retrieve paginated list of all orders with optional status and search filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by order status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiPaginatedResponse(OrderListItemDto)
  @ApiStandardErrorResponses()
  @Get()
  async getAllOrders(
    @Query() query: PaginationQueryDto & { status?: string; search?: string },
  ) {
    return this.adminOrderService.getAllOrders(query);
  }

  @ApiOperation({ summary: 'Get order by ID', description: 'Retrieve a single order by its ID' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ description: 'Order details' })
  @ApiStandardErrorResponses()
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.adminOrderService.getOne(id);
  }

  @ApiOperation({ summary: 'Update order status', description: 'Override the status of an order (admin only)' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiBody({ description: 'New status', type: Object })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Order status updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: orderEntity.OrderStatus,
  ) {
    return this.orderService.updateOrderStatus(id, status);
  }
}

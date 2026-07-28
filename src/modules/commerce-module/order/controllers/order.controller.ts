import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiPaginatedResponse } from '../../../../common/decorators/api-paginated-response.decorator';
import { OrderListItemDto } from '../../../../common/dto/response/order-response.dto';
import { OrderService } from '../services/order.service';
import { CreateOfflineOrderDto } from '../dto/create-offline-order.dto';
import { CreateOnlineOrderDto } from '../dto/create-online-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { RecordVendorOfflineSaleDto } from '../dto/record-offline-sale.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { ICartItem } from '../../cart/types/types';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { SuccessResponseDto } from 'src/common/dto/api-response.dto';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PandaOrderController {
  constructor(
    private readonly orderService: OrderService,
    @InjectRepository(StoreStaff)
    private readonly storeStaffRepo: Repository<StoreStaff>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  private async resolveVendorId(user: jwtStrategy.JwtAuthUser): Promise<string> {
    if (user.role !== 'staff') return user.sub;

    const staff = await this.storeStaffRepo.findOne({
      where: { user_id: user.sub, status: 'active' },
      select: { store_id: true },
    });
    if (!staff) throw new NotFoundException('Staff record not found or inactive');

    const store = await this.storeRepo.findOne({
      where: { id: staff.store_id },
      select: { user_id: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    return store.user_id;
  }

  /* ────────────────────────────────────────────────
     CREATE OFFLINE ORDER
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Create an offline order', description: 'Creates a new order processed outside of online payment (e.g. cash on delivery).' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { success: { type: 'boolean' }, order_id: { type: 'string' }, payment_url: { type: 'string', nullable: true } } }, description: 'Offline order created successfully' })
  @ApiStandardErrorResponses()
  @Post('offline')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  async createOfflineOrder(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateOfflineOrderDto,
  ) {
    return this.orderService.createOfflineOrder({
      buyer_id: user.sub,
      order_items: dto.order_items as ICartItem[],
      tax: dto.tax,
      notes: dto.notes,
      delivery_address_id: dto.delivery_address_id,
    });
  }

  /* ────────────────────────────────────────────────
     GET CHECKOUT SUMMARY
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get checkout summary', description: 'Calculates and returns a summary of the order including totals, taxes, and delivery fees before placing the order.' })
  @ApiOkResponse({ description: 'Checkout summary calculated successfully' })
  @ApiStandardErrorResponses()
  @Post('summary')
  @RequirePermissions(Permission.VIEW_ORDERS)
  async getCheckoutSummary(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body('order_items') order_items: ICartItem[],
  ) {
    return this.orderService.getCheckoutSummary({
      buyer_id: user.sub,
      order_items,
    });
  }

  /* ────────────────────────────────────────────────
     CREATE ONLINE ORDER (PAYSTACK)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Create an online order', description: 'Creates an order with Paystack escrow payment. Funds are held in escrow until delivery is confirmed.' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { success: { type: 'boolean' }, order_id: { type: 'string' }, payment_url: { type: 'string', nullable: true } } }, description: 'Online order created successfully. Returns payment authorization URL.' })
  @ApiStandardErrorResponses()
  @Post('online')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  async createOnlineOrder(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateOnlineOrderDto,
  ) {
    return this.orderService.createOnlineOrder({
      buyer_id: user.sub,
      email: dto.email,
      order_items: dto.order_items as ICartItem[],
      delivery_rate_id: dto.delivery_rate_id,
      delivery_address_id: dto.delivery_address_id,
    });
  }

  /* ────────────────────────────────────────────────
     CREATE ONLINE ORDER WITHOUT ESCROW (DIRECT PAYSTACK)
     NOTE: This endpoint is for direct payment with 2% platform fee
     No escrow protection - immediate payment to vendor
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Create a direct online order (no escrow)', description: 'Creates an order with direct Paystack payment. Funds go directly to vendor with a 2% platform fee. No escrow protection.' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { success: { type: 'boolean' }, order_id: { type: 'string' }, payment_url: { type: 'string', nullable: true } } }, description: 'Direct online order created successfully. Returns payment authorization URL.' })
  @ApiStandardErrorResponses()
  @Post('online/direct')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  async createOnlineOrderNoEscrow(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateOnlineOrderDto,
  ) {
    return this.orderService.createOnlineOrderNoEscrow({
      buyer_id: user.sub,
      email: dto.email,
      order_items: dto.order_items as ICartItem[],
      delivery_rate_id: dto.delivery_rate_id,
      delivery_address_id: dto.delivery_address_id,
    });
  }

  /* ────────────────────────────────────────────────
     VERIFY PAYMENT (PAYSTACK CALLBACK)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Verify a payment', description: 'Verifies a Paystack payment using the payment reference returned after checkout.' })
  @ApiParam({ name: 'reference', description: 'Paystack payment reference', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Payment verification result' })
  @ApiStandardErrorResponses()
  @Post('verify/:reference')
  async verifyPayment(@Param('reference') reference: string) {
    if (!reference) {
      throw new BadRequestException('Payment reference is required');
    }

    return this.orderService.verifyPayment(reference);
  }

  /* ────────────────────────────────────────────────
     RETRY PAYMENT (BACKEND-DRIVEN)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Retry a failed payment', description: 'Generates a new Paystack payment link for an order that previously failed payment.' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'New payment authorization URL generated' })
  @ApiStandardErrorResponses()
  @Post(':id/retry-payment')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  async retryPayment(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.retryOrderPayment(id, user.sub);
  }

  /* ────────────────────────────────────────────────
     GET SINGLE ORDER
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get order by ID', description: 'Retrieves the details of a specific order by its ID for the authenticated user.' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ description: 'Order details retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get(':id')
  @RequirePermissions(Permission.VIEW_ORDERS)
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.getOrderForApi(id, user.sub);
  }

  /* ────────────────────────────────────────────────
     GET ORDERS — CURRENT USER (BUYER)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get my orders', description: 'Retrieves all orders placed by the currently authenticated user (buyer). Supports search, status filter, and pagination.' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term to filter orders' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by order status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiPaginatedResponse(OrderListItemDto)
  @ApiStandardErrorResponses()
  @Get()
  @RequirePermissions(Permission.VIEW_ORDERS)
  async getMyOrders(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.orderService.getOrdersByUser(user.sub, {
      search,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  /* ────────────────────────────────────────────────
     GET ORDERS — VENDOR
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get vendor orders', description: 'Retrieves all orders belonging to the currently authenticated vendor store. Supports search, status filter, and pagination.' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term to filter orders' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by order status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiPaginatedResponse(OrderListItemDto)
  @ApiStandardErrorResponses()
  @Get('vendor/me')
  @RequirePermissions(Permission.VIEW_ORDERS)
  @UseGuards(RolesGuard, StoreOwnerGuard)
  @Roles('vendor')
  async getVendorOrders(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Store not found for this vendor');
    }
    return this.orderService.getOrdersByVendor(user.sub, user.store_id ?? undefined, {
      search,
      status,
      page,
      limit,
    });
  }

  /* ────────────────────────────────────────────────
     RECORD OFFLINE SALE (VENDOR)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Record an offline sale', description: 'Allows a vendor to manually record a sale that was processed outside the platform (e.g. in-person payment).' })
  @ApiCreatedResponse({ description: 'Offline sale recorded successfully' })
  @ApiStandardErrorResponses()
  @Post('vendor/offline-sale')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  @UseGuards(StoreOwnerGuard)
  async recordVendorOfflineSale(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: RecordVendorOfflineSaleDto,
  ) {
    const vendorId = await this.resolveVendorId(user);
    return this.orderService.recordVendorOfflineSale({
      vendor_id: vendorId,
      store_id: user.store_id,
      items: dto.items,
      customer_name: dto.customer_name,
      customer_email: dto.customer_email,
      notes: dto.notes,
      payment_method: dto.payment_method,
      recorded_by: user.sub,
    });
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS (VENDOR / ADMIN)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Update order status', description: 'Updates the status of an order (e.g. processing, shipped, delivered). Restricted to sellers and admins.' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Order status updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/status')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  @UseGuards(RolesGuard)
  @Roles('vendor', 'admin', 'staff')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.updateOrderStatus(id, dto.status, user.store_id ?? undefined);
  }

  /* ────────────────────────────────────────────────
     CANCEL ORDER (BUYER OR VENDOR)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Cancel an order', description: 'Cancels an order by its ID. Can be performed by the buyer who placed it or the vendor fulfilling it.' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Order cancelled successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/cancel')
  @RequirePermissions(Permission.MANAGE_ORDERS)
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.cancelOrder(id, user.sub, user.store_id ?? undefined);
  }

  /* ────────────────────────────────────────────────
     SALES HISTORY (VENDOR / STAFF)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get sales history', description: 'Paginated offline sales history with staff attribution, date range, and search filters' })
  @ApiOkResponse({ description: 'Sales history retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'staffId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiStandardErrorResponses()
  @Get('vendor/sales-history')
  @RequirePermissions(Permission.VIEW_ORDERS)
  async getSalesHistory(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('staffId') staffId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const vendorId = await this.resolveVendorId(user);
    return this.orderService.getSalesHistory(vendorId, user.store_id ?? undefined, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      staffId,
      dateFrom,
      dateTo,
      search,
    });
  }

  /* ────────────────────────────────────────────────
     GET RECEIPT DATA (FOR PRINTING)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get receipt data for printing', description: 'Returns formatted receipt data for thermal printer' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ description: 'Receipt data retrieved' })
  @ApiStandardErrorResponses()
  @Get(':id/receipt-data')
  @RequirePermissions(Permission.VIEW_ORDERS)
  @UseGuards(RolesGuard)
  @Roles('vendor', 'staff')
  async getReceiptData(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.orderService.getReceiptData(id, user.sub);
  }

  /* ────────────────────────────────────────────────
     DOWNLOAD RECEIPT
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Download order receipt', description: 'Generates and returns a PDF receipt for the specified order as a base64-encoded string.' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiOkResponse({ description: 'Receipt PDF generated successfully as base64' })
  @ApiStandardErrorResponses()
  @Get(':id/receipt')
  @RequirePermissions(Permission.VIEW_ORDERS)
  async downloadReceipt(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const pdfBuffer = await this.orderService.getOrderReceiptPdf(id, user.sub);
    
    return {
      status: 'success',
      data: pdfBuffer.toString('base64'),
      filename: `receipt-${id.split('-')[0].toUpperCase()}.pdf`,
    };
  }
}

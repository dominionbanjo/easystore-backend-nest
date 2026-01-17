import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateDeliveryDto,
  AssignCourierDto,
  UpdateDeliveryStatusDto,
  ConfirmDeliveryDto,
} from './dto/index';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { DeliveryService } from './delivery.service';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ------------------------------------------------------------------
  // CREATE DELIVERY (INTERNAL / ORDER FLOW)
  // ------------------------------------------------------------------
  @Post()
  async createDelivery(@Body() dto: CreateDeliveryDto) {
    return this.deliveryService.createDelivery(dto);
  }

  // ------------------------------------------------------------------
  // GET DELIVERY BY ID
  // ------------------------------------------------------------------
  @Get(':id')
  async getDelivery(@Param('id') id: string) {
    return this.deliveryService.getDelivery(id);
  }

  // ------------------------------------------------------------------
  // ASSIGN COURIER (VENDOR / ADMIN)
  // ------------------------------------------------------------------
  @Patch(':id/assign-courier')
  async assignCourier(
    @Param('id') delivery_id: string,
    @Body() dto: AssignCourierDto,
  ) {
    return this.deliveryService.assignCourier(delivery_id, dto.courier_id);
  }

  // ------------------------------------------------------------------
  // UPDATE DELIVERY STATUS
  // ------------------------------------------------------------------
  @Patch(':id/status')
  async updateStatus(
    @Param('id') delivery_id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Req() req: any,
  ) {
    return this.deliveryService.updateStatus(
      delivery_id,
      dto.status,
      req.user.sub,
      req.user.role,
    );
  }

  // ------------------------------------------------------------------
  // CONFIRM DELIVERY (VENDOR → RELEASE ESCROW)
  // ------------------------------------------------------------------
  @Post('confirm')
  async confirmDelivery(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: ConfirmDeliveryDto,
  ) {
    return this.deliveryService.confirmDelivery(
      dto.order_id,
      dto.code,
      user.sub,
    );
  }

  // ------------------------------------------------------------------
  // UPLOAD PROOF OF DELIVERY
  // ------------------------------------------------------------------
  @Post(':id/proof')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProof(
    @Param('id') delivery_id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Proof image file is required');
    }

    return this.deliveryService.uploadProof(delivery_id, file);
  }
}

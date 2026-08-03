import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
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
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import {
  SuccessResponseDto,
  SuccessWithIdDto,
} from 'src/common/dto/api-response.dto';

@ApiTags('Delivery')
@ApiBearerAuth('JWT-auth')
@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ------------------------------------------------------------------
  // CREATE DELIVERY (INTERNAL / ORDER FLOW)
  // ------------------------------------------------------------------
  @ApiOperation({
    summary: 'Create a delivery',
    description: 'Creates a new delivery record for an order.',
  })
  @ApiCreatedResponse({
    type: SuccessWithIdDto,
    description: 'Delivery created successfully',
  })
  @ApiStandardErrorResponses()
  @Post()
  async createDelivery(@Body() dto: CreateDeliveryDto) {
    return this.deliveryService.createDelivery(dto);
  }

  // ------------------------------------------------------------------
  // GET DELIVERY BY ID
  // ------------------------------------------------------------------
  @ApiOperation({
    summary: 'Get delivery by ID',
    description: 'Retrieves delivery details by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID', type: String })
  @ApiOkResponse({ description: 'Delivery details retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get(':id')
  async getDelivery(@Param('id') id: string) {
    return this.deliveryService.getDelivery(id);
  }

  // ------------------------------------------------------------------
  // ASSIGN COURIER (VENDOR / ADMIN)
  // ------------------------------------------------------------------
  @ApiOperation({
    summary: 'Assign courier to delivery',
    description: 'Assigns a courier to handle a specific delivery.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Courier assigned successfully',
  })
  @ApiStandardErrorResponses()
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
  @ApiOperation({
    summary: 'Update delivery status',
    description:
      'Updates the status of a delivery (e.g. in-transit, delivered).',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Delivery status updated successfully',
  })
  @ApiStandardErrorResponses()
  @Patch(':id/status')
  async updateStatus(
    @Param('id') delivery_id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.deliveryService.updateStatus(
      delivery_id,
      dto.status,
      user.sub,
      user.role,
      user.store_id ?? undefined,
    );
  }

  // ------------------------------------------------------------------
  // CONFIRM DELIVERY (VENDOR → RELEASE ESCROW)
  // ------------------------------------------------------------------
  @ApiOperation({
    summary: 'Confirm delivery',
    description:
      'Confirms delivery completion using a verification code, releasing escrow payment to the vendor.',
  })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Delivery confirmed successfully',
  })
  @ApiStandardErrorResponses()
  @Post('confirm')
  async confirmDelivery(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: ConfirmDeliveryDto,
  ) {
    return this.deliveryService.confirmDelivery(
      dto.order_id,
      dto.code,
      user.sub,
      user.store_id ?? undefined,
    );
  }

  // ------------------------------------------------------------------
  // UPLOAD PROOF OF DELIVERY
  // ------------------------------------------------------------------
  @ApiOperation({
    summary: 'Upload proof of delivery',
    description:
      'Uploads an image file as proof that a delivery has been completed.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID', type: String })
  @ApiCreatedResponse({
    type: SuccessResponseDto,
    description: 'Proof of delivery uploaded successfully',
  })
  @ApiStandardErrorResponses()
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

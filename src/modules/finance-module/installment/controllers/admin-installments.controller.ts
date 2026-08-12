import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { InstallmentService } from '../services/installment.service';
import {
  ListInstallmentsDto,
  AdminInstallmentActionDto,
} from '../dto/installment.dto';
import {
  InstallmentPlanDetailDto,
  InstallmentPlanListItemDto,
  InstallmentSimpleResponseDto,
} from '../dto/installment-response.dto';

@ApiTags('Admin Installments')
@ApiBearerAuth('JWT-auth')
@Controller('admin/installments')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Roles('admin')
export class AdminInstallmentsController {
  constructor(private readonly installments: InstallmentService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_INSTALLMENTS)
  @ApiOperation({
    summary: 'List all installment plans (admin)',
    description:
      'Paginated list of every installment plan on the platform. Optionally filtered by status.',
  })
  @ApiPaginatedResponse(InstallmentPlanListItemDto)
  @ApiStandardErrorResponses()
  listAll(@Query() query: ListInstallmentsDto) {
    return this.installments.listAllPlans(
      query.status ? { status: query.status as never } : {},
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_INSTALLMENTS)
  @ApiOperation({
    summary: 'Get one installment plan (admin)',
    description:
      'Full plan detail including buyer, vendor, order and every installment payment.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiOkResponse({ type: InstallmentPlanDetailDto })
  @ApiStandardErrorResponses()
  getOne(@Param('id') id: string) {
    return this.installments.getPlanForAdmin(id);
  }

  @Post(':id/force-complete')
  @RequirePermissions(Permission.MANAGE_INSTALLMENTS)
  @ApiOperation({
    summary: 'Force-complete a plan (buyer paid outside the system)',
    description:
      'Marks an active plan fully paid, releases the reservation, funds the escrow, creates the delivery and notifies both parties. Only for cases where the buyer paid outside the platform.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiOkResponse({
    type: InstallmentSimpleResponseDto,
    description: 'Plan force-completed.',
  })
  @ApiStandardErrorResponses()
  forceComplete(
    @Param('id') id: string,
    @Body() dto: AdminInstallmentActionDto,
  ) {
    return this.installments.forceComplete(id, dto.admin_note);
  }

  @Post(':id/force-cancel')
  @RequirePermissions(Permission.MANAGE_INSTALLMENTS)
  @ApiOperation({
    summary: 'Force-cancel a plan and refund all payments',
    description:
      'Cancels an active plan, refunds every paid installment to the buyer’s original payment method, releases reserved stock and cancels the order.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiOkResponse({
    type: InstallmentSimpleResponseDto,
    description: 'Plan canceled and refunds initiated.',
  })
  @ApiStandardErrorResponses()
  forceCancel(@Param('id') id: string, @Body() dto: AdminInstallmentActionDto) {
    return this.installments.forceCancelRefund(id, dto.admin_note);
  }
}

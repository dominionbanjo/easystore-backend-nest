import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { InstallmentService } from '../services/installment.service';
import { ListInstallmentsDto } from '../dto/installment.dto';
import { InstallmentPlanListItemDto } from '../dto/installment-response.dto';

@ApiTags('Vendor Installments')
@ApiBearerAuth('JWT-auth')
@Controller('admin/vendor/installments')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Roles('vendor')
export class VendorInstallmentsController {
  constructor(private readonly installments: InstallmentService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_INSTALLMENTS)
  @ApiOperation({
    summary: 'List installment plans for my store',
    description:
      'Paginated list of installment plans for the authenticated vendor’s orders, including progress, next due date and status.',
  })
  @ApiPaginatedResponse(InstallmentPlanListItemDto)
  @ApiStandardErrorResponses()
  listVendorPlans(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ListInstallmentsDto,
  ) {
    return this.installments.listVendorPlans(user.sub, query.page, query.limit);
  }
}

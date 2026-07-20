import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { PayoutListItemDto, EscrowListItemDto } from '../../../common/dto/response/transaction-response.dto';
import { SuccessResponseDto } from '../../../common/dto/api-response.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { AdminEscrowService } from '../services/admin-escrow.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@ApiTags('Admin Escrow')
@ApiBearerAuth('JWT-auth')
@Controller('admin/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminEscrowController {
  constructor(private readonly adminEscrowService: AdminEscrowService) {}

  /* ────────────────────────────────────────────────
     GET PENDING MANUAL PAYOUTS
     Returns list of escrow payouts awaiting manual
     bank transfer, with vendor bank details.
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get pending manual payouts', description: 'Retrieve list of escrow payouts awaiting manual bank transfer, with vendor bank details' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(PayoutListItemDto)
  @ApiStandardErrorResponses()
  @Get('escrow')
  async getPendingManualPayouts(@Query() query: PaginationQueryDto) {
    return this.adminEscrowService.getPendingManualPayouts(
      query.page ? Number(query.page) : 1,
      query.limit ? Number(query.limit) : 20,
    );
  }

  /* ────────────────────────────────────────────────
     GET ALL PAYOUTS (any status)
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get all payouts', description: 'Retrieve paginated list of all payouts with optional status and search filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by payout status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiPaginatedResponse(PayoutListItemDto)
  @ApiStandardErrorResponses()
  @Get()
  async getAllPayouts(
    @Query() query: PaginationQueryDto & { status?: string; search?: string },
  ) {
    return this.adminEscrowService.getAllPayouts(
      query.page ? Number(query.page) : 1,
      query.limit ? Number(query.limit) : 20,
      query.status,
      query.search || query.q,
    );
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT AS MANUALLY TRANSFERRED
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Mark payout as manually transferred', description: 'Mark an escrow payout as manually transferred to the vendor' })
  @ApiParam({ name: 'id', description: 'Escrow payout ID', type: String })
  @ApiBody({ description: 'Admin note', type: Object })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Payout marked as transferred' })
  @ApiStandardErrorResponses()
  @Patch('escrow/:id/mark-transferred')
  async markAsTransferred(
    @Param('id') id: string,
    @Body('admin_note') admin_note?: string,
  ) {
    return this.adminEscrowService.markAsTransferred(id, admin_note);
  }

  /* ────────────────────────────────────────────────
     GET ALL ESCROWS
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get all escrows', description: 'Retrieve paginated list of all escrow records with optional status and search filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by escrow status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiPaginatedResponse(EscrowListItemDto)
  @ApiStandardErrorResponses()
  @Get('escrow/all-escrows')
  async getAllEscrows(
    @Query() query: PaginationQueryDto & { status?: string; search?: string },
  ) {
    return this.adminEscrowService.getAllEscrows(
      query.page ? Number(query.page) : 1,
      query.limit ? Number(query.limit) : 20,
      query.status,
      query.search || query.q,
    );
  }
}

import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { AdminEscrowService } from '../services/admin-escrow.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

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

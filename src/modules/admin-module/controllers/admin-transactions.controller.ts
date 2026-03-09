import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { AdminTransactionsService } from '../services/admin-transactions.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminTransactionsController {
  constructor(
    private readonly adminTransactionsService: AdminTransactionsService,
  ) {}

  @Get()
  async getAllTransactions(
    @Query()
    query: PaginationQueryDto & {
      status?: string;
      type?: string;
      search?: string;
    },
  ) {
    return this.adminTransactionsService.getAllTransactions(query);
  }

  @Get(':id')
  async getTransaction(@Param('id') id: string) {
    return this.adminTransactionsService.getOne(id);
  }

  @Patch(':id/flag')
  async flagTransaction(@Param('id') id: string) {
    return this.adminTransactionsService.flagTransaction(id);
  }
}

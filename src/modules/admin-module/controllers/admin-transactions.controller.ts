import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { TransactionListItemDto } from '../../../common/dto/response/transaction-response.dto';
import { SuccessResponseDto } from '../../../common/dto/api-response.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { AdminTransactionsService } from '../services/admin-transactions.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@ApiTags('Admin Transactions')
@ApiBearerAuth('JWT-auth')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminTransactionsController {
  constructor(
    private readonly adminTransactionsService: AdminTransactionsService,
  ) {}

  @ApiOperation({
    summary: 'Get all transactions',
    description:
      'Retrieve paginated list of all transactions with optional status, type, and search filters',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by transaction status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiPaginatedResponse(TransactionListItemDto)
  @ApiStandardErrorResponses()
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

  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieve a single transaction by its ID',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiOkResponse({ description: 'Transaction details' })
  @ApiStandardErrorResponses()
  @Get(':id')
  async getTransaction(@Param('id') id: string) {
    return this.adminTransactionsService.getOne(id);
  }

  @ApiOperation({
    summary: 'Flag a transaction',
    description: 'Flag a transaction for manual review',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Transaction flagged successfully',
  })
  @ApiStandardErrorResponses()
  @Patch(':id/flag')
  async flagTransaction(@Param('id') id: string) {
    return this.adminTransactionsService.flagTransaction(id);
  }
}

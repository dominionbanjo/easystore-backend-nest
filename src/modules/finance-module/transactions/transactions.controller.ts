import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { TransactionListItemDto } from '../../../common/dto/response/transaction-response.dto';
import { SuccessResponseDto, SuccessWithIdDto } from '../../../common/dto/api-response.dto';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';
import { JwtAuthGuard } from '../../identity-module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../../common/permissions/permissions.decorator';
import { Permission } from '../../../common/permissions/permissions';

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  @RequirePermissions(Permission.MANAGE_PAYOUTS)
  @ApiOperation({ summary: 'Create a transaction', description: 'Creates a new transaction record.' })
  @ApiCreatedResponse({ type: SuccessWithIdDto, description: 'Transaction created successfully' })
  @ApiStandardErrorResponses()
  create(@Body() dto: CreateTransactionDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.VIEW_TRANSACTIONS)
  @ApiOperation({ summary: 'List transactions', description: 'Returns a paginated list of transactions.' })
  @ApiPaginatedResponse(TransactionListItemDto)
  @ApiStandardErrorResponses()
  list(@Query() query: ListTransactionsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_TRANSACTIONS)
  @ApiOperation({ summary: 'Get transaction by ID', description: 'Returns a single transaction by its ID.' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiOkResponse({ description: 'Transaction details returned' })
  @ApiStandardErrorResponses()
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post(':id/reverse')
  @RequirePermissions(Permission.MANAGE_PAYOUTS)
  @ApiOperation({ summary: 'Reverse a transaction', description: 'Reverses a transaction by its ID with a reason.' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiCreatedResponse({ type: SuccessResponseDto, description: 'Transaction reversed successfully' })
  @ApiStandardErrorResponses()
  reverse(@Param('id') id: string, @Body() dto: ReverseTransactionDto) {
    return this.service.reverse(id, dto.reason);
  }
}

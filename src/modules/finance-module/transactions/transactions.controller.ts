import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';

import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() query: ListTransactionsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseTransactionDto) {
    return this.service.reverse(id, dto.reason);
  }
}

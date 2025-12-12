import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { UpdateEscrowDto } from './dto/update-escrow.dto';

@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  create(@Body() createEscrowDto: CreateEscrowDto) {
    return this.escrowService.create(createEscrowDto);
  }

  @Get()
  findAll() {
    return this.escrowService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.escrowService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEscrowDto: UpdateEscrowDto) {
    return this.escrowService.update(+id, updateEscrowDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.escrowService.remove(+id);
  }
}

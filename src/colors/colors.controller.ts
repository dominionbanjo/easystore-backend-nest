import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  /* ────────────────────────────────────────────────
     CREATE
  ──────────────────────────────────────────────── */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateColorDto) {
    return this.colorsService.create(dto);
  }

  /* ────────────────────────────────────────────────
     READ ALL
  ──────────────────────────────────────────────── */
  @Get()
  findAll() {
    return this.colorsService.findAll();
  }

  /* ────────────────────────────────────────────────
     READ ONE
  ──────────────────────────────────────────────── */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.colorsService.findOne(id);
  }

  /* ────────────────────────────────────────────────
     UPDATE
  ──────────────────────────────────────────────── */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateColorDto) {
    return this.colorsService.update(id, dto);
  }

  /* ────────────────────────────────────────────────
     DELETE
  ──────────────────────────────────────────────── */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.colorsService.remove(id);
  }
}

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
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  /* ────────────────────────────────────────────────
     CREATE
  ──────────────────────────────────────────────── */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'vendor')
  create(
    @Body() dto: CreateColorDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const vendorId = user.role === 'admin' ? undefined : (user.store_id ?? undefined);
    return this.colorsService.create(dto, vendorId);
  }

  /* ────────────────────────────────────────────────
     READ ALL
  ──────────────────────────────────────────────── */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@CurrentUser() user?: jwtStrategy.JwtAuthUser) {
    return this.colorsService.findAll(user?.store_id ?? undefined);
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

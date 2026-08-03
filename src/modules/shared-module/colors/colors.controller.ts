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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@ApiTags('Colors')
@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  /* ────────────────────────────────────────────────
     CREATE
  ──────────────────────────────────────────────── */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'vendor')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new color' })
  @ApiCreatedResponse({ description: 'Color created successfully' })
  @ApiStandardErrorResponses()
  create(
    @Body() dto: CreateColorDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const vendorId =
      user.role === 'admin' ? undefined : (user.store_id ?? undefined);
    return this.colorsService.create(dto, vendorId);
  }

  /* ────────────────────────────────────────────────
     READ ALL
  ──────────────────────────────────────────────── */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get all colors',
    description:
      'Retrieve all product colors, optionally scoped to vendor store',
  })
  @ApiOkResponse({ description: 'Colors retrieved successfully' })
  @ApiStandardErrorResponses()
  findAll(@CurrentUser() user?: jwtStrategy.JwtAuthUser) {
    return this.colorsService.findAll(user?.store_id ?? undefined);
  }

  /* ────────────────────────────────────────────────
     READ ONE
  ──────────────────────────────────────────────── */
  @Get(':id')
  @ApiOperation({ summary: 'Get color by ID' })
  @ApiParam({ name: 'id', description: 'Color ID', type: String })
  @ApiOkResponse({ description: 'Color retrieved successfully' })
  @ApiStandardErrorResponses()
  findOne(@Param('id') id: string) {
    return this.colorsService.findOne(id);
  }

  /* ────────────────────────────────────────────────
     UPDATE
  ──────────────────────────────────────────────── */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a color' })
  @ApiParam({ name: 'id', description: 'Color ID', type: String })
  @ApiOkResponse({ description: 'Color updated successfully' })
  @ApiStandardErrorResponses()
  update(@Param('id') id: string, @Body() dto: UpdateColorDto) {
    return this.colorsService.update(id, dto);
  }

  /* ────────────────────────────────────────────────
     DELETE
  ──────────────────────────────────────────────── */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a color' })
  @ApiParam({ name: 'id', description: 'Color ID', type: String })
  @ApiOkResponse({ description: 'Color deleted successfully' })
  @ApiStandardErrorResponses()
  remove(@Param('id') id: string) {
    return this.colorsService.remove(id);
  }
}

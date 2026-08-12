import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { ProductService } from '../services/product.service';
import { SaveProductDraftDto } from '../dto/save-product-draft.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductSearchDto } from '../dto/product-search.dto';

import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { Permission } from 'src/common/permissions/permissions';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';

@ApiTags('Vendor Product Drafts')
@ApiBearerAuth('JWT-auth')
@Controller('vendor/products/drafts')
export class VendorProductDraftController {
  constructor(private readonly productService: ProductService) {}

  /* ────────────────────────────────────────────────
     💾 VENDOR: SAVE PRODUCT DRAFT
     POST /vendor/products/drafts
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Save a product draft',
    description:
      'Creates or updates a backend-controlled product draft for the vendor store. All fields are optional so incomplete products can be saved and continued on any device.',
  })
  @ApiBody({ type: SaveProductDraftDto })
  @ApiOkResponse({
    description: 'Draft saved successfully',
    schema: {
      properties: {
        message: { type: 'string' },
        success: { type: 'boolean' },
        id: { type: 'string' },
      },
    },
  })
  @ApiStandardErrorResponses()
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.CREATE_PRODUCT)
  saveDraft(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: SaveProductDraftDto,
  ) {
    return this.productService.saveDraft(user, dto);
  }

  /* ────────────────────────────────────────────────
     🚀 VENDOR: PUBLISH A PRODUCT DRAFT
     POST /vendor/products/drafts/:id/publish
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Publish a product draft',
    description:
      'Converts an existing draft into a live (active) product for the vendor store. Requires the usual product completeness (name, category, price/stock where applicable).',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiOkResponse({
    description: 'Product published successfully',
    schema: {
      properties: {
        message: { type: 'string' },
        success: { type: 'boolean' },
        id: { type: 'string' },
      },
    },
  })
  @ApiStandardErrorResponses()
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.UPDATE_PRODUCT)
  publishDraft(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') draftId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productService.publishDraft(user, draftId, dto);
  }

  /* ────────────────────────────────────────────────
     📋 VENDOR: LIST MY DRAFTS
     GET /vendor/products/drafts
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Get vendor product drafts',
    description:
      'Paginated list of the authenticated vendor store drafts, most recently updated first.',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Drafts retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getDrafts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ProductSearchDto,
  ) {
    return this.productService.getVendorDrafts(user.store_id!, query);
  }

  /* ────────────────────────────────────────────────
     🔎 VENDOR: GET A SINGLE DRAFT
     GET /vendor/products/drafts/:id
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Get a single product draft',
    description: 'Retrieves a draft by id for resuming on another device.',
  })
  @ApiOkResponse({ description: 'Draft retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getDraft(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.productService.getVendorDraft(user.store_id!, id);
  }

  /* ────────────────────────────────────────────────
     🗑️ VENDOR: DISCARD A PRODUCT DRAFT
     DELETE /vendor/products/drafts/:id
  ──────────────────────────────────────────────── */
  @ApiOperation({
    summary: 'Discard a product draft',
    description:
      'Permanently removes a draft and its Cloudinary uploads from the vendor store.',
  })
  @ApiOkResponse({ description: 'Draft discarded successfully' })
  @ApiStandardErrorResponses()
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.DELETE_PRODUCT)
  discardDraft(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') draftId: string,
  ) {
    return this.productService.discardDraft(user, draftId);
  }
}

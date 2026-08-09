import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { ProductCardResponseDto } from 'src/common/dto/response/product-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { SavePreferencesDto } from '../dto/save-preferences.dto';
import { RecommendationService } from '../services/recommendation.service';

@ApiTags('Recommendations')
@ApiBearerAuth('JWT-auth')
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @ApiOperation({
    summary: 'Personalized recommendations for the shopper',
    description:
      'Combines explicit preferences, purchase history, wishlist, cart and collaborative signals. Guests and signal-less users fall back to trending.',
  })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @Get('for-you')
  @UseGuards(OptionalJwtAuthGuard)
  getForYou(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.recommendationService.getForYou(query, user?.sub);
  }

  @ApiOperation({
    summary: 'Trending products (popularity rail / guest fallback)',
  })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @Get('trending')
  @UseGuards(OptionalJwtAuthGuard)
  getTrending(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.recommendationService.getTrending(query, user?.sub);
  }

  @ApiOperation({
    summary: 'Deals of the day (deepest discounts first)',
  })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @Get('deals')
  @UseGuards(OptionalJwtAuthGuard)
  getDeals(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.recommendationService.getDeals(query, user?.sub);
  }

  @ApiOperation({
    summary: 'Get the current user shopping preferences',
  })
  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  getUserPreferences(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.recommendationService.getUserPreferences(user.sub);
  }

  @ApiOperation({
    summary: 'Save the current user shopping preferences (category interests)',
  })
  @Post('preferences')
  @UseGuards(JwtAuthGuard)
  savePreferences(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: SavePreferencesDto,
  ) {
    return this.recommendationService.savePreferences(user.sub, dto);
  }
}

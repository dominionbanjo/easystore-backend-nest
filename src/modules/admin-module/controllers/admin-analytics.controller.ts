import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@ApiTags('Admin Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @ApiOperation({
    summary: 'Get overview KPIs',
    description:
      'Retrieve top-level key performance indicators for the admin dashboard',
  })
  @ApiOkResponse({ description: 'Overview KPI data' })
  @ApiStandardErrorResponses()
  @Get('overview')
  getOverview() {
    return this.analyticsService.getOverviewStats();
  }

  @ApiOperation({
    summary: 'Get monthly growth chart',
    description:
      'Retrieve monthly growth data for the specified number of months',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to include',
  })
  @ApiOkResponse({ description: 'Monthly growth chart data' })
  @ApiStandardErrorResponses()
  @Get('growth')
  getGrowthChart(@Query('months') months?: string) {
    return this.analyticsService.getGrowthChart(
      months ? parseInt(months, 10) : 12,
    );
  }

  @ApiOperation({
    summary: 'Get user distribution',
    description: 'Retrieve user distribution data for pie chart visualization',
  })
  @ApiOkResponse({ description: 'User distribution data' })
  @ApiStandardErrorResponses()
  @Get('user-distribution')
  getUserDistribution() {
    return this.analyticsService.getUserDistribution();
  }

  @ApiOperation({
    summary: 'Get transaction breakdown',
    description:
      'Retrieve transaction breakdown data for bar chart visualization',
  })
  @ApiOkResponse({ description: 'Transaction breakdown data' })
  @ApiStandardErrorResponses()
  @Get('transaction-breakdown')
  getTransactionBreakdown() {
    return this.analyticsService.getTransactionTypeBreakdown();
  }

  @ApiOperation({
    summary: 'Get recent signups',
    description: 'Retrieve the most recent user signups',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of recent signups to retrieve',
  })
  @ApiOkResponse({ description: 'Recent signups list' })
  @ApiStandardErrorResponses()
  @Get('recent-signups')
  getRecentSignups(@Query('limit') limit?: string) {
    return this.analyticsService.getRecentSignups(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @ApiOperation({
    summary: 'Get top stores',
    description: 'Retrieve the top-performing stores',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top stores to retrieve',
  })
  @ApiOkResponse({ description: 'Top stores list' })
  @ApiStandardErrorResponses()
  @Get('top-stores')
  getTopStores(@Query('limit') limit?: string) {
    return this.analyticsService.getTopStores(limit ? parseInt(limit, 10) : 10);
  }

  @ApiOperation({
    summary: 'Get order breakdown',
    description:
      'Retrieve order status breakdown for pie or bar chart visualization',
  })
  @ApiOkResponse({ description: 'Order breakdown data' })
  @ApiStandardErrorResponses()
  @Get('order-breakdown')
  getOrderBreakdown() {
    return this.analyticsService.getOrderStatusBreakdown();
  }

  @ApiOperation({
    summary: 'Get revenue by month',
    description: 'Retrieve monthly revenue data for revenue line chart',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to include',
  })
  @ApiOkResponse({ description: 'Revenue data' })
  @ApiStandardErrorResponses()
  @Get('revenue')
  getRevenue(@Query('months') months?: string) {
    return this.analyticsService.getRevenueByMonth(
      months ? parseInt(months, 10) : 12,
    );
  }

  @ApiOperation({
    summary: 'Get signup methods',
    description: 'Retrieve signup method distribution data',
  })
  @ApiOkResponse({ description: 'Signup methods distribution data' })
  @ApiStandardErrorResponses()
  @Get('signup-methods')
  getSignupMethods() {
    return this.analyticsService.getSignupMethods();
  }
}

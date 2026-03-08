import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  // GET /admin/analytics/overview — top-level KPIs
  @Get('overview')
  getOverview() {
    return this.analyticsService.getOverviewStats();
  }

  // GET /admin/analytics/growth?months=12 — monthly growth chart
  @Get('growth')
  getGrowthChart(@Query('months') months?: string) {
    return this.analyticsService.getGrowthChart(
      months ? parseInt(months, 10) : 12,
    );
  }

  // GET /admin/analytics/user-distribution — pie chart data
  @Get('user-distribution')
  getUserDistribution() {
    return this.analyticsService.getUserDistribution();
  }

  // GET /admin/analytics/transaction-breakdown — bar chart
  @Get('transaction-breakdown')
  getTransactionBreakdown() {
    return this.analyticsService.getTransactionTypeBreakdown();
  }

  // GET /admin/analytics/recent-signups?limit=10
  @Get('recent-signups')
  getRecentSignups(@Query('limit') limit?: string) {
    return this.analyticsService.getRecentSignups(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // GET /admin/analytics/top-stores?limit=10
  @Get('top-stores')
  getTopStores(@Query('limit') limit?: string) {
    return this.analyticsService.getTopStores(limit ? parseInt(limit, 10) : 10);
  }

  // GET /admin/analytics/order-breakdown — order status pie/bar
  @Get('order-breakdown')
  getOrderBreakdown() {
    return this.analyticsService.getOrderStatusBreakdown();
  }

  // GET /admin/analytics/revenue?months=12 — revenue line chart
  @Get('revenue')
  getRevenue(@Query('months') months?: string) {
    return this.analyticsService.getRevenueByMonth(
      months ? parseInt(months, 10) : 12,
    );
  }

  // GET /admin/analytics/signup-methods — signup medium distribution
  @Get('signup-methods')
  getSignupMethods() {
    return this.analyticsService.getSignupMethods();
  }
}

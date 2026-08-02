import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { SchoolZoneService } from '../services/school-zone.service';
import { SchoolZoneMemberService } from '../services/school-zone-member.service';
import { ZoneAdminGuard } from '../guards/zone-admin.guard';
import {
  CreateSchoolZoneDto,
  UpdateSchoolZoneDto,
  ApplyToZoneDto,
  ZoneMemberDecisionDto,
  ZoneApprovalDecisionDto,
} from '../dto/school-zone.dto';

@ApiTags('School Zones')
@Controller('school-zones')
export class SchoolZoneController {
  constructor(
    private readonly zoneService: SchoolZoneService,
    private readonly memberService: SchoolZoneMemberService,
  ) {}

  /* ───────────────────────── PUBLIC ───────────────────────── */

  @Get()
  @ApiOperation({ summary: 'List active school zones (paginated)' })
  async list(@Query() pagination: PaginationQueryDto) {
    return this.zoneService.list(pagination);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search active school zones' })
  async search(@Query() pagination: PaginationQueryDto) {
    return this.zoneService.list(pagination);
  }

  @Get('me/memberships')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'My school zone memberships (vendor)' })
  async myMemberships(@Req() req: RequestWithUser) {
    return this.zoneService.getMyMemberships(req.user.store_id!);
  }

  @Get('admin/mine')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_ZONE)
  @ApiOperation({ summary: 'Zones where the user is a school rep' })
  async myZones(@Req() req: RequestWithUser) {
    return this.zoneService.getZonesWhereAdmin(req.user.sub);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'List all school zones (admin, all statuses)' })
  async listAll(@Query() pagination: PaginationQueryDto) {
    return this.zoneService.listAll(pagination);
  }

  @Get(':identifier')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get school zone by slug, id or subdomain (rep can see own pending zone)',
  })
  async getByIdentifier(
    @Param('identifier') identifier: string,
    @Req() req: RequestWithUser | undefined,
  ) {
    const user = (req as RequestWithUser | undefined)?.user;
    const isAdmin = user?.role === 'admin';
    return this.zoneService.getForUser(
      identifier,
      user?.sub,
      isAdmin,
    );
  }

  @Get(':identifier/stores')
  @ApiOperation({ summary: 'Stores in a school zone (paginated)' })
  async zoneStores(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    const zone = await this.zoneService.getByIdentifier(identifier);
    return this.zoneService.getZoneStores(zone.id, pagination);
  }

  @Get(':identifier/products')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Products in a school zone (paginated)' })
  async zoneProducts(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationQueryDto,
    @Req() req: RequestWithUser | undefined,
  ) {
    const zone = await this.zoneService.getByIdentifier(identifier);
    const user = (req as RequestWithUser | undefined)?.user;
    return this.zoneService.getZoneProducts(
      zone.id,
      pagination,
      user?.sub,
    );
  }

  /* ───────────────────────── AUTH (ANY USER / VENDOR) ───────────────────────── */

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Apply to create a school zone (school rep)' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateSchoolZoneDto,
  ) {
    return this.zoneService.create(req.user.sub, dto);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Vendor applies to join a school zone' })
  async apply(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: ApplyToZoneDto,
  ) {
    return this.memberService.apply(id, req.user.store_id!, dto);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Vendor leaves a school zone' })
  async leave(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.memberService.leave(id, req.user.store_id!);
  }

  /* ───────────────────────── ZONE REP / ADMIN ───────────────────────── */

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ZoneAdminGuard)
  @RequirePermissions(Permission.MANAGE_ZONE)
  @ApiOperation({ summary: 'Update school zone (rep or admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolZoneDto,
  ) {
    return this.zoneService.update(id, dto);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ZoneAdminGuard)
  @RequirePermissions(Permission.MANAGE_ZONE)
  @ApiOperation({ summary: 'List zone member applications (rep or admin)' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'active', 'rejected'] })
  async members(
    @Param('id') id: string,
    @Query('status') status?: 'pending' | 'active' | 'rejected',
    @Query() pagination: PaginationQueryDto = {},
  ) {
    return this.memberService.listMembers(id, status, pagination);
  }

  @Post(':id/members/:memberId/decision')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ZoneAdminGuard)
  @RequirePermissions(Permission.MANAGE_ZONE)
  @ApiOperation({ summary: 'Approve or reject a vendor application (rep or admin)' })
  async memberDecision(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req: RequestWithUser,
    @Body() dto: ZoneMemberDecisionDto,
  ) {
    return this.memberService.decision(
      id,
      memberId,
      dto.decision,
      req.user.sub,
      dto.reason,
    );
  }

  /* ───────────────────────── PLATFORM ADMIN ───────────────────────── */

  @Post('admin/:id/approval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Approve or reject a school zone creation request' })
  async zoneApproval(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: ZoneApprovalDecisionDto,
  ) {
    return this.zoneService.approvalDecision(
      id,
      dto.decision,
      req.user.sub,
      dto.reason,
    );
  }
}

interface RequestWithUser {
  user: {
    sub: string;
    store_id?: string;
    role: string;
  };
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { StoreDeliveryRate } from 'src/modules/vendor-module/store/entities/store-delivery-rate.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import { SchoolZone } from '../entities/school-zone.entity';
import { SchoolZoneMember } from '../entities/school-zone-member.entity';
import { SchoolZoneMemberStatus } from '../entities/school-zone-member.entity';
import { ApplyToZoneDto } from '../dto/school-zone.dto';

const MAX_SCHOOL_ZONES_PER_STORE = 5;

@Injectable()
export class SchoolZoneMemberService {
  constructor(
    private readonly cache: CacheService,

    @InjectRepository(SchoolZoneMember)
    private readonly memberRepo: Repository<SchoolZoneMember>,

    @InjectRepository(SchoolZone)
    private readonly zoneRepo: Repository<SchoolZone>,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(StoreDeliveryRate)
    private readonly rateRepo: Repository<StoreDeliveryRate>,
  ) {}

  /* ────────────────────────────────────────────────
     APPLY TO JOIN (vendor submits verification + fee)
  ──────────────────────────────────────────────── */
  async apply(zoneId: string, storeId: string, dto: ApplyToZoneDto) {
    const zone = await this.zoneRepo.findOne({
      where: { id: zoneId },
      select: ['id', 'status'],
    });
    if (!zone || zone.status !== 'active') {
      throw new BadRequestException('School zone not found or is not active');
    }

    const existing = await this.memberRepo.findOne({
      where: { school_zone_id: zoneId, store_id: storeId },
      select: ['id', 'status'],
    });

    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException(
          'Your store is already in this school zone',
        );
      }
      if (existing.status === 'pending') {
        throw new BadRequestException(
          'Your application is still awaiting approval',
        );
      }
      // Rejected -> allow re-application
      await this.memberRepo.update(existing.id, {
        department: dto.department,
        course: dto.course,
        student_id_number: dto.student_id_number,
        school_id_image: dto.school_id_image,
        school_id_public_id: null,
        delivery_fee: dto.delivery_fee,
        status: 'pending',
        rejection_reason: null,
        approved_by: null,
        approved_at: null,
      });
      return { success: true, message: 'Application resubmitted for approval' };
    }

    // Per-store limit: a store can belong to at most 5 school zones
    const activeCount = await this.memberRepo.count({
      where: {
        store_id: storeId,
        status: In(['pending', 'active', 'suspended']),
      },
    });
    if (activeCount >= MAX_SCHOOL_ZONES_PER_STORE) {
      throw new BadRequestException(
        `You can belong to a maximum of ${MAX_SCHOOL_ZONES_PER_STORE} school zones. Please contact support to request more.`,
      );
    }

    const member = this.memberRepo.create({
      school_zone_id: zoneId,
      store_id: storeId,
      department: dto.department,
      course: dto.course,
      student_id_number: dto.student_id_number,
      school_id_image: dto.school_id_image,
      delivery_fee: dto.delivery_fee,
      status: 'pending',
    });

    await this.memberRepo.save(member);
    return { success: true, message: 'Application submitted for approval' };
  }

  /* ────────────────────────────────────────────────
     DECISION (school rep / admin)
     Approve -> member active + school delivery rate inserted
  ──────────────────────────────────────────────── */
  async decision(
    zoneId: string,
    memberId: string,
    decision: 'approve' | 'reject',
    approverId: string,
    reason?: string,
  ) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, school_zone_id: zoneId },
      select: ['id', 'status', 'store_id', 'delivery_fee'],
    });
    if (!member) throw new NotFoundException('Application not found');

    if (member.status === 'active') {
      throw new BadRequestException('This application is already approved');
    }
    if (decision === 'reject' && member.status === 'rejected') {
      throw new BadRequestException('This application is already rejected');
    }

    if (decision === 'approve') {
      await this.memberRepo.update(memberId, {
        status: 'active',
        approved_by: approverId,
        approved_at: new Date(),
        rejection_reason: null,
      });

      // Insert the school's delivery location into the vendor's rates (linked to the zone)
      const zone = await this.zoneRepo.findOne({
        where: { id: zoneId },
        select: ['id', 'name', 'state', 'location'],
      });
      if (
        zone &&
        member.delivery_fee !== null &&
        member.delivery_fee !== undefined
      ) {
        const rateExists = await this.rateRepo.exist({
          where: {
            store_id: member.store_id,
            school_zone_id: zoneId,
          },
        });
        if (!rateExists) {
          // School-qualified location so the rate is clearly tied to the school
          const schoolLocation = `${zone.name}, ${zone.location}`.slice(0, 250);
          await this.rateRepo.save(
            this.rateRepo.create({
              store_id: member.store_id,
              state: zone.state,
              location: schoolLocation,
              fee: member.delivery_fee,
              school_zone_id: zoneId,
              notes: `Delivery to ${schoolLocation} (school zone)`,
            }),
          );
        }
      }

      await this.cache.clearPrefix(`svc:school-zone:`);
      return {
        success: true,
        message: 'Application approved. Vendor added to the school zone.',
      };
    }

    await this.memberRepo.update(memberId, {
      status: 'rejected',
      rejection_reason: reason ?? 'Application rejected',
      approved_by: approverId,
    });

    return { success: true, message: 'Application rejected' };
  }

  /* ────────────────────────────────────────────────
     LEAVE ZONE (vendor removes themselves)
  ──────────────────────────────────────────────── */
  async leave(zoneId: string, storeId: string) {
    const member = await this.memberRepo.findOne({
      where: { school_zone_id: zoneId, store_id: storeId },
      select: ['id'],
    });
    if (!member) throw new NotFoundException('Membership not found');

    await this.memberRepo.delete(member.id);

    // Remove ONLY the school-linked delivery rate (never a vendor's own rate)
    await this.rateRepo.delete({
      store_id: storeId,
      school_zone_id: zoneId,
    });

    await this.cache.clearPrefix(`svc:school-zone:`);
    return { success: true, message: 'Left school zone successfully' };
  }

  /* ────────────────────────────────────────────────
     MEMBERS LIST (school rep dashboard)
  ──────────────────────────────────────────────── */
  async listMembers(
    zoneId: string,
    status?: SchoolZoneMemberStatus,
    pagination: PaginationDto = { page: 1, limit: 20 },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.memberRepo
      .createQueryBuilder('member')
      .select([
        'member.id',
        'member.store_id',
        'member.status',
        'member.department',
        'member.course',
        'member.student_id_number',
        'member.school_id_image',
        'member.delivery_fee',
        'member.rejection_reason',
        'member.requested_at',
        'member.approved_at',
      ])
      .innerJoin(Store, 'store', 'store.id = member.store_id')
      .addSelect('store.store_name', 'member_store_name')
      .addSelect('store.slug', 'member_store_slug')
      .addSelect('store.logo', 'member_store_logo')
      .addSelect('store.status', 'member_store_status')
      .addSelect('store.user_id', 'member_store_user_id')
      .where('member.school_zone_id = :zoneId', { zoneId });

    if (status) {
      qb.andWhere('member.status = :status', { status });
    }

    const search = pagination.q?.trim();
    if (search) {
      qb.andWhere('store.store_name ILIKE :q', { q: `%${search}%` });
    }

    qb.orderBy('member.requested_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const { raw, entities } = await qb.getRawAndEntities<ZoneMemberRow>();

    const countQb = this.memberRepo
      .createQueryBuilder('member')
      .innerJoin(Store, 'store', 'store.id = member.store_id')
      .where('member.school_zone_id = :zoneId', { zoneId });
    if (status) {
      countQb.andWhere('member.status = :status', { status });
    }
    if (search) {
      countQb.andWhere('store.store_name ILIKE :q', { q: `%${search}%` });
    }
    const total = await countQb.getCount();

    const items = entities.map((member, index) => ({
      id: member.id,
      store_id: member.store_id,
      user_id: raw[index].member_store_user_id ?? null,
      store_name: raw[index].member_store_name,
      store_slug: raw[index].member_store_slug,
      store_logo: raw[index].member_store_logo ?? null,
      store_status: raw[index].member_store_status,
      status: member.status,
      department: member.department,
      course: member.course,
      student_id_number: member.student_id_number,
      school_id_image: member.school_id_image,
      delivery_fee:
        member.delivery_fee !== null ? Number(member.delivery_fee) : null,
      rejection_reason: member.rejection_reason,
      requested_at: member.requested_at,
      approved_at: member.approved_at,
    }));

    const result = buildPagination(items, total, page, limit);
    return {
      message: 'Members retrieved successfully',
      data: result,
    };
  }

  /* ────────────────────────────────────────────────
     SUSPEND MEMBER (admin removes from public zone lists)
  ──────────────────────────────────────────────── */
  async suspend(zoneId: string, memberId: string, adminId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, school_zone_id: zoneId },
      select: ['id', 'status'],
    });
    if (!member) throw new NotFoundException('Membership not found');
    if (member.status !== 'active') {
      throw new BadRequestException('Only active members can be suspended');
    }

    await this.memberRepo.update(memberId, {
      status: 'suspended',
      approved_by: adminId,
      rejection_reason: null,
    });

    await this.cache.clearPrefix(`svc:school-zone:`);
    return { success: true, message: 'Vendor suspended from the school zone' };
  }

  /* ────────────────────────────────────────────────
     UNSUSPEND MEMBER (restore active zone visibility)
  ──────────────────────────────────────────────── */
  async unsuspend(zoneId: string, memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, school_zone_id: zoneId },
      select: ['id', 'status'],
    });
    if (!member) throw new NotFoundException('Membership not found');
    if (member.status !== 'suspended') {
      throw new BadRequestException('Only suspended members can be restored');
    }

    await this.memberRepo.update(memberId, { status: 'active' });

    await this.cache.clearPrefix(`svc:school-zone:`);
    return { success: true, message: 'Vendor restored to the school zone' };
  }

  /* ────────────────────────────────────────────────
     REMOVE FROM ZONE (admin removes member + zone rate)
  ──────────────────────────────────────────────── */
  async removeFromZone(zoneId: string, memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, school_zone_id: zoneId },
      select: ['id', 'store_id'],
    });
    if (!member) throw new NotFoundException('Membership not found');

    await this.memberRepo.delete(member.id);

    // Remove ONLY the school-linked delivery rate (never a vendor's own rate)
    await this.rateRepo.delete({
      store_id: member.store_id,
      school_zone_id: zoneId,
    });

    await this.cache.clearPrefix(`svc:school-zone:`);
    return { success: true, message: 'Vendor removed from the school zone' };
  }
}

interface ZoneMemberRow {
  member_store_user_id: string | null;
  member_store_name: string;
  member_store_slug: string;
  member_store_logo: string | null;
  member_store_status: string;
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import slugify from 'slugify';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { StoreHelperService } from 'src/modules/vendor-module/store/services/store-helper.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import {
  addProductCardSelects,
  mapToProductCardData,
} from 'src/modules/commerce-module/product/utils/product-card.util';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { SchoolZone } from '../entities/school-zone.entity';
import { SchoolZoneAdmin } from '../entities/school-zone-admin.entity';
import { SchoolZoneMember } from '../entities/school-zone-member.entity';
import {
  CreateSchoolZoneDto,
  UpdateSchoolZoneDto,
} from '../dto/school-zone.dto';

const RESERVED_SUBDOMAINS = [
  'www',
  'admin',
  'vendor',
  'api',
  'easystore',
  'store',
  'lookup',
  'assets',
  'public',
  'dashboard',
  'account',
  'categories',
  'products',
  'auth',
  'zones',
  'school',
];

@Injectable()
export class SchoolZoneService {
  constructor(
    private readonly cache: CacheService,
    private readonly helpers: StoreHelperService,

    @InjectRepository(SchoolZone)
    private readonly zoneRepo: Repository<SchoolZone>,

    @InjectRepository(SchoolZoneAdmin)
    private readonly adminRepo: Repository<SchoolZoneAdmin>,

    @InjectRepository(SchoolZoneMember)
    private readonly memberRepo: Repository<SchoolZoneMember>,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
  ) {}

  /* ────────────────────────────────────────────────
     SUBDOMAIN AVAILABILITY (shared namespace with stores)
  ──────────────────────────────────────────────── */
  async checkSubdomainAvailability(subdomain: string, zoneId?: string) {
    const clean = subdomain.trim().toLowerCase();

    if (RESERVED_SUBDOMAINS.includes(clean)) {
      throw new BadRequestException(
        'This subdomain name is reserved and cannot be used',
      );
    }

    const regex = /^[a-z0-9-]+$/;
    if (!regex.test(clean)) {
      throw new BadRequestException(
        'Subdomain can only contain lowercase letters, numbers, and dashes',
      );
    }

    const zoneQb = this.zoneRepo
      .createQueryBuilder('zone')
      .where(
        '(LOWER(zone.subdomain) = :subdomain OR LOWER(zone.slug) = :subdomain)',
        { subdomain: clean },
      );
    if (zoneId) zoneQb.andWhere('zone.id != :zoneId', { zoneId });
    const zoneExists = await zoneQb.select(['zone.id']).getOne();

    if (zoneExists) {
      throw new BadRequestException('This subdomain is already in use by a school zone');
    }

    const storeQb = this.storeRepo
      .createQueryBuilder('store')
      .where(
        '(LOWER(store.subdomain) = :subdomain OR (store.subdomain IS NULL AND LOWER(store.slug) = :subdomain))',
        { subdomain: clean },
      );
    const storeExists = await storeQb.select(['store.id']).getOne();

    if (storeExists) {
      throw new BadRequestException(
        'This subdomain is already taken or clashes with an existing store',
      );
    }

    return { available: true, message: 'Subdomain is available' };
  }

  /* ────────────────────────────────────────────────
     CREATE (school rep applies — status pending)
  ──────────────────────────────────────────────── */
  async create(userId: string, dto: CreateSchoolZoneDto) {
    await this.checkSubdomainAvailability(dto.subdomain);

    const baseSlug = slugify(dto.name, { lower: true, strict: true }) || 'school-zone';
    let slug = baseSlug;
    let counter = 1;
    while (await this.zoneRepo.exist({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const zone = this.zoneRepo.create({
      name: dto.name,
      slug,
      subdomain: dto.subdomain.trim().toLowerCase(),
      tagline: dto.tagline ?? null,
      description: dto.description ?? null,
      state: dto.state,
      location: dto.location,
      contact_email: dto.contact_email ?? null,
      contact_phone: dto.contact_phone ?? null,
      logo: dto.logo ?? null,
      cover_image: dto.cover_image ?? null,
      created_by: userId,
      status: 'pending',
    });

    const saved = await this.zoneRepo.save(zone);
    return { success: true, id: saved.id, status: saved.status };
  }

  /* ────────────────────────────────────────────────
     UPDATE (zone rep / admin)
  ──────────────────────────────────────────────── */
  async update(zoneId: string, dto: UpdateSchoolZoneDto) {
    const zone = await this.zoneRepo.findOne({
      where: { id: zoneId },
      select: ['id'],
    });
    if (!zone) throw new NotFoundException('School zone not found');

    await this.zoneRepo.update(zoneId, {
      ...dto,
      name: dto.name ?? undefined,
      tagline: dto.tagline ?? null,
      description: dto.description ?? null,
      state: dto.state ?? undefined,
      location: dto.location ?? undefined,
      contact_email: dto.contact_email ?? null,
      contact_phone: dto.contact_phone ?? null,
      logo: dto.logo ?? null,
      cover_image: dto.cover_image ?? null,
    });

    await this.cache.clearPrefix(`svc:school-zone:`);
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     GET BY IDENTIFIER (slug | id | subdomain)
  ──────────────────────────────────────────────── */
  async getByIdentifier(identifier: string, allowPending = false) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const zone = await this.zoneRepo.findOne({
      where: isUUID
        ? { id: identifier }
        : [{ subdomain: identifier }, { slug: identifier }],
    });

    if (!zone) throw new NotFoundException('School zone not found');
    if (!allowPending && zone.status !== 'active') {
      throw new NotFoundException('School zone not found or is inactive');
    }

    const activeMembers = await this.memberRepo.count({
      where: { school_zone_id: zone.id, status: 'active' },
    });

    return {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      subdomain: zone.subdomain,
      tagline: zone.tagline,
      description: zone.description,
      logo: zone.logo,
      cover_image: zone.cover_image,
      state: zone.state,
      location: zone.location,
      contact_email: zone.contact_email,
      contact_phone: zone.contact_phone,
      status: zone.status,
      member_count: activeMembers,
      created_at: zone.created_at,
    };
  }

  /* ────────────────────────────────────────────────
     ZONES WHERE USER IS REP (school rep dashboard)
  ──────────────────────────────────────────────── */
  async getZonesWhereAdmin(userId: string) {
    const adminRows = await this.adminRepo.find({
      where: { user_id: userId },
      select: ['school_zone_id'],
    });
    if (adminRows.length === 0) {
      return { message: 'No zones found', data: [] };
    }

    const zoneIds = adminRows.map((r) => r.school_zone_id);
    const zones = await this.zoneRepo
      .createQueryBuilder('zone')
      .select([
        'zone.id',
        'zone.name',
        'zone.slug',
        'zone.subdomain',
        'zone.tagline',
        'zone.logo',
        'zone.cover_image',
        'zone.state',
        'zone.location',
        'zone.status',
        'zone.rejection_reason',
        'zone.created_at',
      ])
      .where('zone.id IN (:...zoneIds)', { zoneIds })
      .orderBy('zone.created_at', 'DESC')
      .getMany();

    const memberCounts = await this.memberRepo
      .createQueryBuilder('member')
      .select('member.school_zone_id', 'school_zone_id')
      .addSelect('COUNT(member.id)', 'count')
      .where('member.school_zone_id IN (:...zoneIds)', { zoneIds })
      .andWhere('member.status = :status', { status: 'active' })
      .groupBy('member.school_zone_id')
      .getRawMany<{ school_zone_id: string; count: string }>();

    const countMap = new Map(
      memberCounts.map((row) => [row.school_zone_id, Number(row.count)]),
    );

    const items = zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      subdomain: zone.subdomain,
      tagline: zone.tagline,
      logo: zone.logo,
      cover_image: zone.cover_image,
      state: zone.state,
      location: zone.location,
      status: zone.status,
      rejection_reason: zone.rejection_reason,
      member_count: countMap.get(zone.id) ?? 0,
      created_at: zone.created_at,
    }));

    return { message: 'Zones retrieved successfully', data: items };
  }

  /* ────────────────────────────────────────────────
     GET FOR AUTHENTICATED USER (rep can see own pending zone)
  ──────────────────────────────────────────────── */  async getForUser(identifier: string, userId?: string, isAdmin = false) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const zone = await this.zoneRepo.findOne({
      where: isUUID
        ? { id: identifier }
        : [{ subdomain: identifier }, { slug: identifier }],
    });

    if (!zone) throw new NotFoundException('School zone not found');
    if (zone.status !== 'active') {
      const canSee = isAdmin || (userId ? await this.isZoneAdmin(zone.id, userId) : false);
      if (!canSee) {
        throw new NotFoundException('School zone not found or is inactive');
      }
    }

    const activeMembers = await this.memberRepo.count({
      where: { school_zone_id: zone.id, status: 'active' },
    });

    return {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      subdomain: zone.subdomain,
      tagline: zone.tagline,
      description: zone.description,
      logo: zone.logo,
      cover_image: zone.cover_image,
      state: zone.state,
      location: zone.location,
      contact_email: zone.contact_email,
      contact_phone: zone.contact_phone,
      status: zone.status,
      member_count: activeMembers,
      created_at: zone.created_at,
    };
  }

  /* ────────────────────────────────────────────────
     LIST (public — active zones only)
  ──────────────────────────────────────────────── */
  async list(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const cacheKey = `svc:school-zone:list:${page}:${limit}:${pagination.state ?? ''}:${pagination.q ?? ''}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const qb = this.zoneRepo
      .createQueryBuilder('zone')
      .select([
        'zone.id',
        'zone.name',
        'zone.slug',
        'zone.subdomain',
        'zone.tagline',
        'zone.description',
        'zone.logo',
        'zone.cover_image',
        'zone.state',
        'zone.location',
        'zone.created_at',
      ])
      .where('zone.status = :status', { status: 'active' });

    if (pagination.state) {
      qb.andWhere('zone.state = :state', { state: pagination.state });
    }
    if (pagination.q?.trim()) {
      qb.andWhere('zone.name ILIKE :q', { q: `%${pagination.q.trim()}%` });
    }

    qb.orderBy('zone.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [zones, total] = await qb.getManyAndCount();

    const zoneIds = zones.map((z) => z.id);
    const memberCounts =
      zoneIds.length > 0
        ? await this.memberRepo
            .createQueryBuilder('member')
            .select('member.school_zone_id', 'school_zone_id')
            .addSelect('COUNT(member.id)', 'count')
            .where('member.school_zone_id IN (:...zoneIds)', { zoneIds })
            .andWhere('member.status = :status', { status: 'active' })
            .groupBy('member.school_zone_id')
            .getRawMany<{ school_zone_id: string; count: string }>()
        : [];

    const countMap = new Map(
      memberCounts.map((row) => [row.school_zone_id, Number(row.count)]),
    );

    const items = zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      subdomain: zone.subdomain,
      tagline: zone.tagline,
      description: zone.description,
      logo: zone.logo,
      cover_image: zone.cover_image,
      state: zone.state,
      location: zone.location,
      member_count: countMap.get(zone.id) ?? 0,
      created_at: zone.created_at,
    }));

    const result = buildPagination(items, total, page, limit);
    const response = {
      message: 'School zones retrieved successfully',
      data: result,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  /* ────────────────────────────────────────────────
     LIST ALL (admin view — all statuses)
  ──────────────────────────────────────────────── */
  async listAll(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.zoneRepo
      .createQueryBuilder('zone')
      .select([
        'zone.id',
        'zone.name',
        'zone.slug',
        'zone.subdomain',
        'zone.state',
        'zone.location',
        'zone.status',
        'zone.created_by',
        'zone.rejection_reason',
        'zone.created_at',
      ])
      .orderBy('zone.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [zones, total] = await qb.getManyAndCount();

    const items = zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      subdomain: zone.subdomain,
      state: zone.state,
      location: zone.location,
      status: zone.status,
      created_by: zone.created_by,
      rejection_reason: zone.rejection_reason,
      created_at: zone.created_at,
    }));

    const result = buildPagination(items, total, page, limit);
    return {
      message: 'School zones retrieved successfully',
      data: result,
    };
  }

  /* ────────────────────────────────────────────────
     ZONE APPROVAL (platform admin)
  ──────────────────────────────────────────────── */
  async approvalDecision(
    zoneId: string,
    decision: 'approve' | 'reject',
    adminId: string,
    reason?: string,
  ) {
    const zone = await this.zoneRepo.findOne({
      where: { id: zoneId },
      select: ['id', 'status', 'created_by'],
    });
    if (!zone) throw new NotFoundException('School zone not found');

    if (decision === 'approve') {
      await this.zoneRepo.update(zoneId, {
        status: 'active',
        approved_by: adminId,
        approved_at: new Date(),
        rejection_reason: null,
      });

      // Zone creator becomes the school rep
      if (zone.created_by) {
        const alreadyAdmin = await this.adminRepo.exist({
          where: {
            school_zone_id: zoneId,
            user_id: zone.created_by,
          },
        });
        if (!alreadyAdmin) {
          await this.adminRepo.save(
            this.adminRepo.create({
              school_zone_id: zoneId,
              user_id: zone.created_by,
            }),
          );
        }
      }

      await this.cache.clearPrefix(`svc:school-zone:`);
      return { success: true, message: 'School zone approved and is now live' };
    }

    await this.zoneRepo.update(zoneId, {
      status: 'rejected',
      rejection_reason: reason ?? 'Request rejected',
      approved_by: adminId,
    });

    return { success: true, message: 'School zone request rejected' };
  }

  /* ────────────────────────────────────────────────
     IS ZONE ADMIN (rep or platform admin)
  ──────────────────────────────────────────────── */
  async isZoneAdmin(zoneId: string, userId: string): Promise<boolean> {
    return this.adminRepo.exist({
      where: { school_zone_id: zoneId, user_id: userId },
    });
  }

  /* ────────────────────────────────────────────────
     ZONE STORES (public — active members only)
  ──────────────────────────────────────────────── */
  async getZoneStores(
    zoneId: string,
    pagination: PaginationDto = { page: 1, limit: 20 },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const zone = await this.zoneRepo.findOne({
      where: { id: zoneId },
      select: ['id', 'status'],
    });
    if (!zone || zone.status !== 'active') {
      throw new NotFoundException('School zone not found or is inactive');
    }

    const qb = this.storeRepo
      .createQueryBuilder('store')
      .innerJoin(
        SchoolZoneMember,
        'member',
        'member.school_zone_id = :zoneId AND member.status = :memberStatus AND member.store_id = store.id',
        { zoneId, memberStatus: 'active' },
      )
      .innerJoin(
        'users',
        'user',
        'user.id = store.user_id AND user.account_status = :userStatus',
        { userStatus: 'active' },
      )
      .leftJoin(
        Product,
        'product',
        'product.vendor_id = store.user_id AND product.status = :productStatus',
        { productStatus: ProductStatus.ACTIVE },
      )
      .select([
        'store.id',
        'store.store_name',
        'store.slug',
        'store.subdomain',
        'store.category',
        'store.description',
        'store.logo',
        'store.cover_image',
        'store.rating_average',
        'store.address_city',
        'store.address_state',
        'store.address_country',
      ])
      .addSelect('COUNT(product.id)', 'total_products')
      .where('store.status = :storeStatus', { storeStatus: 'active' })
      .groupBy('store.id')
      .orderBy('store.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (pagination.q?.trim()) {
      qb.andWhere('store.store_name ILIKE :q', { q: `%${pagination.q.trim()}%` });
    }

    const { raw, entities } = await qb.getRawAndEntities();

    const items = entities.map((store, index) => ({
      id: store.id,
      store_name: store.store_name,
      slug: store.slug,
      subdomain: store.subdomain,
      category: store.category,
      description: store.description,
      logo: store.logo,
      cover_image: store.cover_image,
      rating_average: store.rating_average,
      address: {
        city: store.address_city ?? null,
        state: store.address_state ?? null,
        country: store.address_country ?? null,
      },
      total_products: Number(raw[index].total_products),
    }));

    const result = buildPagination(items, items.length, page, limit);
    return {
      message: 'Zone stores retrieved successfully',
      data: result,
    };
  }

  /* ────────────────────────────────────────────────
     ZONE PRODUCTS (public — active members only)
  ──────────────────────────────────────────────── */
  async getZoneProducts(
    zoneId: string,
    pagination: PaginationDto = { page: 1, limit: 20 },
    userId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const zone = await this.zoneRepo.findOne({
      where: { id: zoneId },
      select: ['id', 'status'],
    });
    if (!zone || zone.status !== 'active') {
      throw new NotFoundException('School zone not found or is inactive');
    }

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .innerJoin(
        SchoolZoneMember,
        'member',
        'member.school_zone_id = :zoneId AND member.status = :memberStatus AND member.store_id = product.store_id',
        { zoneId, memberStatus: 'active' },
      )
      .innerJoin(
        'product.vendor',
        'user',
        'user.account_status = :userStatus',
        { userStatus: 'active' },
      )
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    const q = pagination.q?.trim();
    if (q) {
      qb.addSelect(
        `
        (
          ts_rank(product.search_vector, websearch_to_tsquery(:q)) * 0.7
          + similarity(product.name, :q) * 0.5
          + similarity(category.name, :q) * 0.3
        )
      `,
        'rank',
      );
      qb.andWhere(
        `(
          product.search_vector @@ websearch_to_tsquery(:q)
          OR similarity(product.name, :q) > 0.25
          OR similarity(category.name, :q) > 0.25
        )`,
        { q },
      );
      qb.orderBy('rank', 'DESC');
    } else {
      qb.orderBy('product.created_at', 'DESC');
    }

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    let wishlistedIds = new Set<string>();
    if (userId && products.length > 0) {
      const wishlisted = await this.wishlistRepo.find({
        where: {
          user_id: userId,
          product_id: In(products.map((p) => p.id)),
        },
        select: ['product_id'],
      });
      wishlistedIds = new Set(wishlisted.map((w) => w.product_id));
    }

    const items = products.map((p) =>
      mapToProductCardData(p, { wishlistSet: wishlistedIds }),
    );

    const enriched = await this.helpers.resolveColorsForList(items);
    const data = buildPagination(enriched, total, page, limit);

    return {
      message: 'Zone products retrieved successfully',
      data,
    };
  }

  /* ────────────────────────────────────────────────
     MY MEMBERSHIPS (vendor dashboard)
  ──────────────────────────────────────────────── */
  async getMyMemberships(storeId: string) {
    const memberships = await this.memberRepo.find({
      where: { store_id: storeId },
      select: {
        id: true,
        school_zone_id: true,
        status: true,
        department: true,
        course: true,
        student_id_number: true,
        delivery_fee: true,
        rejection_reason: true,
        requested_at: true,
        school_zone: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
          logo: true,
          cover_image: true,
          state: true,
          location: true,
          status: true,
        },
      },
      relations: ['school_zone'],
      order: { requested_at: 'DESC' },
    });

    return memberships.map((m) => ({
      id: m.id,
      school_zone_id: m.school_zone_id,
      status: m.status,
      department: m.department,
      course: m.course,
      student_id_number: m.student_id_number,
      delivery_fee: m.delivery_fee !== null ? Number(m.delivery_fee) : null,
      rejection_reason: m.rejection_reason,
      requested_at: m.requested_at,
      zone: m.school_zone
        ? {
            id: m.school_zone.id,
            name: m.school_zone.name,
            slug: m.school_zone.slug,
            subdomain: m.school_zone.subdomain,
            logo: m.school_zone.logo,
            cover_image: m.school_zone.cover_image,
            state: m.school_zone.state,
            location: m.school_zone.location,
            status: m.school_zone.status,
          }
        : null,
    }));
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// import { Store } from 'src/modules/commerce-module/store/entities/store.entity';
// import { StoreDeliveryRate } from '../entities/store-delivery-rate.entity';
import { SetProductDeliveryRateDto } from '../dto/store-delivery-rate.dto';
import { StoreDeliveryRate } from '../entities/store-delivery-rate.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';

@Injectable()
export class StoreDeliveryRateService {
  constructor(
    @InjectRepository(StoreDeliveryRate)
    private readonly rateRepo: Repository<StoreDeliveryRate>,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE DELIVERY RATE (STORE OWNER)
  ──────────────────────────────────────────────── */
  async createRate(
    userId: string,
    storeId: string,
    dto: SetProductDeliveryRateDto,
  ) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, user_id: userId },
      select: ['id'],
    });

    if (!store) {
      throw new BadRequestException('Store not found or unauthorized');
    }

    const rate = this.rateRepo.create({
      store_id: store.id,
      state: dto.state,
      location: dto.location,
      fee: dto.fee,
      duration: dto.duration ?? null,
      notes: dto.notes ?? null,
    });

    const saved = await this.rateRepo.save(rate);
    return { success: true, id: saved.id };
  }

  /* ────────────────────────────────────────────────
     BULK CREATE (USED DURING STORE SETUP)
  ──────────────────────────────────────────────── */
  async createMany(storeId: string, rates?: SetProductDeliveryRateDto[]) {
    if (!rates?.length) return;

    const entities = rates.map((r) =>
      this.rateRepo.create({
        store_id: storeId,
        state: r.state,
        location: r.location,
        fee: r.fee,
        duration: r.duration ?? null,
        notes: r.notes ?? null,
      }),
    );

    await this.rateRepo.save(entities);
  }

  /* ────────────────────────────────────────────────
     GET DELIVERY RATES (PUBLIC)
  ──────────────────────────────────────────────── */
  async getRatesByStore(storeId: string) {
    const exists = await this.storeRepo.exist({
      where: { id: storeId },
    });

    if (!exists) {
      throw new NotFoundException('Store not found');
    }

    return this.rateRepo.find({
      where: { store_id: storeId },
      select: {
        id: true,
        state: true,
        location: true,
        fee: true,
        duration: true,
        notes: true,
      },
      order: {
        state: 'ASC',
        location: 'ASC',
        fee: 'ASC',
      },
    });
  }

  /* ────────────────────────────────────────────────
     GET SINGLE RATE
  ──────────────────────────────────────────────── */
  async getRateById(id: string) {
    return this.rateRepo.findOne({
      where: { id },
      select: {
        id: true,
        store_id: true,
        state: true,
        location: true,
        fee: true,
        duration: true,
        notes: true,
      },
    });
  }

  /* ────────────────────────────────────────────────
     UPDATE DELIVERY RATE (STORE OWNER)
  ──────────────────────────────────────────────── */
  async updateRate(
    userId: string,
    rateId: string,
    dto: Partial<SetProductDeliveryRateDto>,
  ) {
    const rate = await this.rateRepo
      .createQueryBuilder('rate')
      .innerJoin(Store, 'store', 'store.id = rate.store_id')
      .where('rate.id = :rateId', { rateId })
      .andWhere('store.user_id = :userId', { userId })
      .select(['rate.id'])
      .getOne();

    if (!rate) {
      throw new NotFoundException('Delivery rate not found or unauthorized');
    }

    await this.rateRepo.update(rateId, {
      ...dto,
      duration: dto.duration ?? null,
      notes: dto.notes ?? null,
    });

    return { message: 'Delivery rate updated successfully' };
  }

  /* ────────────────────────────────────────────────
     DELETE DELIVERY RATE (STORE OWNER)
  ──────────────────────────────────────────────── */
  async deleteRate(userId: string, rateId: string) {
    const rate = await this.rateRepo
      .createQueryBuilder('rate')
      .innerJoin(Store, 'store', 'store.id = rate.store_id')
      .where('rate.id = :rateId', { rateId })
      .andWhere('store.user_id = :userId', { userId })
      .select(['rate.id'])
      .getOne();

    if (!rate) {
      throw new NotFoundException('Delivery rate not found or unauthorized');
    }

    await this.rateRepo.delete(rateId);

    return { message: 'Delivery rate deleted successfully' };
  }
}

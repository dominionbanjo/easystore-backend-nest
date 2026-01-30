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
      country: dto.country,
      state: dto.state ?? null,
      city: dto.city ?? null,
      price: dto.price,
      estimated_days: dto.estimated_days ?? null,
    });

    return this.rateRepo.save(rate);
  }

  /* ────────────────────────────────────────────────
     BULK CREATE (USED DURING STORE SETUP)
  ──────────────────────────────────────────────── */
  async createMany(storeId: string, rates?: SetProductDeliveryRateDto[]) {
    if (!rates?.length) return;

    const entities = rates.map((r) =>
      this.rateRepo.create({
        store_id: storeId,
        country: r.country,
        state: r.state ?? null,
        city: r.city ?? null,
        price: r.price,
        estimated_days: r.estimated_days ?? null,
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
      order: {
        country: 'ASC',
        state: 'ASC',
        city: 'ASC',
        price: 'ASC',
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
      state: dto.state ?? null,
      city: dto.city ?? null,
      estimated_days: dto.estimated_days ?? null,
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

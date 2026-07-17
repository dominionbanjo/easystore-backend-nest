import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthUser } from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { StoreService } from '../services/store.service';
import { StoreStaff } from '../entities/store-staff.entity';

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(
    private readonly storeService: StoreService,
    @InjectRepository(StoreStaff)
    private readonly staffRepo: Repository<StoreStaff>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const user = req.user as JwtAuthUser;

    if (!user || !user.sub) {
      throw new BadRequestException('Invalid authentication context');
    }

    // ✅ Resolve storeId from route OR JWT
    const storeId: string | null = req.params?.storeId ?? user.store_id ?? null;

    // ✅ Admin bypass
    if (user.role === 'admin') {
      return true;
    }

    if (!storeId) {
      throw new BadRequestException('Store ID is required');
    }

    // ✅ Owner check
    const isOwner = await this.storeService.isStoreOwner(storeId, user.sub);
    if (isOwner) return true;

    // ✅ Staff check: active staff of this store can access
    const isStaff = await this.staffRepo.exists({
      where: { store_id: storeId, user_id: user.sub, status: 'active' },
    });
    if (isStaff) {
      // Attach the resolved store_id to the user for downstream use
      req.user.store_id = storeId;
      return true;
    }

    throw new ForbiddenException('You do not own this store');
  }
}

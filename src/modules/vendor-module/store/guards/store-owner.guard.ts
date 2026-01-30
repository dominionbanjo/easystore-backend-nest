import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthUser } from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { StoreService } from '../services/store.service';

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(private readonly storeService: StoreService) {}

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

    const isOwner = await this.storeService.isStoreOwner(storeId, user.sub);

    if (!isOwner) {
      throw new ForbiddenException('You do not own this store');
    }

    return true;
  }
}

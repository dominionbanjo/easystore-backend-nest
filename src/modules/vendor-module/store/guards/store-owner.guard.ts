import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StoreService } from '../store.service';

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(private readonly storeService: StoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub: string; role: string };
    const storeId = req.params.id;

    // Admin can access anything
    if (user.role === 'admin') return true;

    const isOwner = await this.storeService.isStoreOwner(storeId, user.sub);

    if (!isOwner) {
      throw new ForbiddenException('You do not own this store');
    }

    return true;
  }
}

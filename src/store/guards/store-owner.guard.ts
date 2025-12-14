import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from 'src/store/entities/store.entity';

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub: string; role: string };
    const storeId = req.params.id;

    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    // Admin can access anything
    if (user.role === 'admin') return true;

    // Vendor must own the store
    if (store.user_id !== user.sub) {
      throw new ForbiddenException('You do not own this store');
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthUser } from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Injectable()
export class StoreGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtAuthUser;

    if (!user?.store_id) {
      throw new NotFoundException('Store not found');
    }

    return true;
  }
}

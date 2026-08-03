import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthUser } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) return true; // no roles required → allow

    const req = context.switchToHttp().getRequest<{ user?: JwtAuthUser }>();
    const user: JwtAuthUser | undefined = req.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: [${requiredRoles.join(', ')}]. User Role: ${user?.role || 'none'}`,
      );
    }

    return true;
  }
}

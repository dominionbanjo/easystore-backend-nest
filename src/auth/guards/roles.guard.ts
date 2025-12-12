import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!allowedRoles) return true; // No roles required

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Not authorized to access this route');
    }

    return true;
  }
}

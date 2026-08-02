import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SchoolZoneService } from '../services/school-zone.service';

/**
 * Grants access when the authenticated user is a school rep for the
 * zone referenced by `req.params.id`, or when the user is a platform admin.
 */
@Injectable()
export class ZoneAdminGuard implements CanActivate {
  constructor(private readonly zoneService: SchoolZoneService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    if (user.role === 'admin') return true;

    const zoneId = request.params.id as string | undefined;
    if (!zoneId) {
      throw new ForbiddenException('Missing school zone identifier');
    }

    const isAdmin = await this.zoneService.isZoneAdmin(zoneId, user.sub);
    if (!isAdmin) {
      throw new ForbiddenException(
        'You are not a school rep for this zone',
      );
    }
    return true;
  }
}

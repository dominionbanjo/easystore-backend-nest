import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const PERMISSIONS_KEY = 'permissions';
/**
 * Decorator to require specific permissions for a route.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

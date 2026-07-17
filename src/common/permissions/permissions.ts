/**
 * Industry standard permissions-based system.
 * Each permission is a specific action a user can perform.
 */
export enum Permission {
  // Products
  CREATE_PRODUCT = 'product:create',
  UPDATE_PRODUCT = 'product:update',
  DELETE_PRODUCT = 'product:delete',
  VIEW_PRODUCT = 'product:view',

  // Categories
  MANAGE_CATEGORIES = 'category:manage',

  // Orders
  VIEW_ORDERS = 'order:view',
  MANAGE_ORDERS = 'order:manage', // Update status, etc.
  CANCEL_ORDER = 'order:cancel',

  // Store
  MANAGE_STORE = 'store:manage',
  VIEW_ANALYTICS = 'analytics:view',

  // Users
  VIEW_USERS = 'user:view',
  MANAGE_USERS = 'user:manage',

  // Finance
  VIEW_TRANSACTIONS = 'transaction:view',
  MANAGE_PAYOUTS = 'payout:manage',

  // System
  MANAGE_SETTINGS = 'system:settings',
}

/**
 * Mapping of Roles (AccountType) to Permissions.
 * This is the "Industry Standard" RBAC mapping.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(Permission), // Admin has all permissions

  vendor: [
    Permission.CREATE_PRODUCT,
    Permission.UPDATE_PRODUCT,
    Permission.DELETE_PRODUCT,
    Permission.VIEW_PRODUCT,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
    Permission.MANAGE_STORE,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_TRANSACTIONS,
  ],

  staff: [
    Permission.VIEW_PRODUCT,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
  ],

  user: [
    Permission.VIEW_PRODUCT,
    Permission.VIEW_ORDERS,
    Permission.CANCEL_ORDER,
  ],
};

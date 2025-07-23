export interface Permission {
  label: string;
  value: string;
  description: string;
}

export interface RoleConfig {
  roleName: string;
  displayName: string;
  description: string;
  permissions: string[];
}

export class RolesConfig {
  /**
   * Default permission sets for each admin role
   */
  private static readonly DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    admin: [
      // Full access to everything
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'users.roles',
      'users.activity',
      'teams.read',
      'teams.create',
      'teams.update',
      'teams.delete',
      'teams.members',
      'teams.finances',
      'athletes.read',
      'athletes.create',
      'athletes.update',
      'athletes.delete',
      'athletes.eligibility',
      'athletes.analytics',
      'content.read',
      'content.create',
      'content.update',
      'content.delete',
      'content.publish',
      'content.moderate',
      'system.logs',
      'system.settings',
      'system.database',
      'system.server',
      'system.security',
      'system.backup',
      'finances.read',
      'finances.payments',
      'finances.subscriptions',
      'finances.invoices',
      'finances.taxes',
      'finances.refunds',
      'communication.read',
      'communication.send',
      'communication.broadcast',
      'communication.notifications',
      'communication.email',
      'communication.sms',
      'support.read',
      'support.create',
      'support.update',
      'support.close',
      'support.assign',
      'support.analytics',
      'api.read',
      'api.create',
      'api.update',
      'api.delete',
      'api.analytics',
      'api.limits',
      'analytics.read',
      'analytics.create',
      'analytics.export',
      'analytics.users',
      'analytics.performance',
      'analytics.business',
    ],

    developer: [
      // Technical access with limited user management
      'users.read',
      'users.activity',
      'teams.read',
      'teams.update',
      'athletes.read',
      'athletes.update',
      'athletes.analytics',
      'content.read',
      'content.create',
      'content.update',
      'content.publish',
      'system.logs',
      'system.settings',
      'system.database',
      'system.backup',
      'api.read',
      'api.create',
      'api.update',
      'api.analytics',
      'api.limits',
      'analytics.read',
      'analytics.create',
      'analytics.export',
      'analytics.performance',
    ],

    support: [
      // Support and customer service focused
      'users.read',
      'teams.read',
      'athletes.read',
      'content.read',
      'communication.read',
      'communication.send',
      'communication.notifications',
      'support.read',
      'support.create',
      'support.update',
      'support.close',
      'support.analytics',
      'analytics.read',
    ],

    scout: [
      // Athlete evaluation and team assessment focused
      'users.read',
      'teams.read',
      'athletes.read',
      'athletes.update',
      'athletes.eligibility',
      'athletes.analytics',
      'content.read',
      'content.create',
      'content.update',
      'communication.read',
      'communication.send',
      'support.read',
      'support.create',
      'analytics.read',
      'analytics.users',
    ],
  };

  /**
   * Role definitions with metadata
   */
  private static readonly ROLE_DEFINITIONS: Record<string, RoleConfig> = {
    admin: {
      roleName: 'admin',
      displayName: 'Administrator',
      description: 'Full system access with all administrative privileges',
      permissions: RolesConfig.DEFAULT_ROLE_PERMISSIONS.admin,
    },

    developer: {
      roleName: 'developer',
      displayName: 'Developer',
      description: 'Technical access for system development and maintenance',
      permissions: RolesConfig.DEFAULT_ROLE_PERMISSIONS.developer,
    },

    support: {
      roleName: 'support',
      displayName: 'Support Agent',
      description: 'Customer support and user assistance focused access',
      permissions: RolesConfig.DEFAULT_ROLE_PERMISSIONS.support,
    },

    scout: {
      roleName: 'scout',
      displayName: 'Scout',
      description: 'Athlete evaluation and recruitment focused access',
      permissions: RolesConfig.DEFAULT_ROLE_PERMISSIONS.scout,
    },
  };

  /**
   * Get default permissions for a specific role
   * @param role - The role name (admin, developer, support, scout)
   * @returns Array of permission strings
   */
  static getDefaultPermissionsForRole(role: string): string[] {
    const normalizedRole = role.toLowerCase();
    return this.DEFAULT_ROLE_PERMISSIONS[normalizedRole] || [];
  }

  /**
   * Get permissions for multiple roles (combines permissions from all roles)
   * @param roles - Array of role names
   * @returns Combined array of unique permission strings
   */
  static getDefaultPermissionsForRoles(roles: string[]): string[] {
    const allPermissions = new Set<string>();

    roles.forEach((role) => {
      const rolePermissions = this.getDefaultPermissionsForRole(role);
      rolePermissions.forEach((permission) => allPermissions.add(permission));
    });

    return Array.from(allPermissions);
  }

  /**
   * Get role configuration including metadata
   * @param role - The role name
   * @returns Role configuration object
   */
  static getRoleConfig(role: string): RoleConfig | null {
    const normalizedRole = role.toLowerCase();
    return this.ROLE_DEFINITIONS[normalizedRole] || null;
  }

  /**
   * Get all available role configurations
   * @returns Array of all role configurations
   */
  static getAllRoleConfigs(): RoleConfig[] {
    return Object.values(this.ROLE_DEFINITIONS);
  }

  /**
   * Get all available role names
   * @returns Array of role names
   */
  static getAvailableRoles(): string[] {
    return Object.keys(this.ROLE_DEFINITIONS);
  }

  /**
   * Check if a role is valid
   * @param role - The role name to check
   * @returns True if role exists
   */
  static isValidRole(role: string): boolean {
    return Object.keys(this.ROLE_DEFINITIONS).includes(role.toLowerCase());
  }

  /**
   * Get role hierarchy level (higher number = more permissions)
   * @param role - The role name
   * @returns Numeric level for role hierarchy
   */
  static getRoleLevel(role: string): number {
    const roleLevels: Record<string, number> = {
      admin: 4,
      developer: 3,
      scout: 2,
      support: 1,
    };

    return roleLevels[role.toLowerCase()] || 0;
  }

  /**
   * Check if one role has higher permissions than another
   * @param role1 - First role
   * @param role2 - Second role
   * @returns True if role1 has higher level than role2
   */
  static hasHigherPermissions(role1: string, role2: string): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }

  /**
   * Get the highest role from an array of roles
   * @param roles - Array of role names
   * @returns The role with highest permissions
   */
  static getHighestRole(roles: string[]): string | null {
    if (!roles.length) return null;

    return roles.reduce((highest, current) => {
      return this.hasHigherPermissions(current, highest) ? current : highest;
    });
  }

  /**
   * Validate that a user has permission to assign certain roles
   * @param userRoles - Current user's roles
   * @param rolesToAssign - Roles they want to assign
   * @returns True if user can assign these roles
   */
  static canAssignRoles(userRoles: string[], rolesToAssign: string[]): boolean {
    const userHighestLevel = Math.max(...userRoles.map((role) => this.getRoleLevel(role)));
    const maxRoleToAssign = Math.max(...rolesToAssign.map((role) => this.getRoleLevel(role)));

    // Users can only assign roles at their level or below
    return userHighestLevel >= maxRoleToAssign;
  }
}

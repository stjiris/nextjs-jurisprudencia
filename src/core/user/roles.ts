// Single source of truth for roles and feature permissions.
// To add a new role: extend the ROLES tuple (least → most privileged).
// To restrict a feature: add it to FEATURE_MIN_ROLE with the minimum required role.

export const ROLES = ['editor', 'admin'] as const;
export type Role = typeof ROLES[number];

// Minimum role required to access each restricted feature.
export const FEATURE_MIN_ROLE = {
    filters: 'admin',
    importExport: 'admin',
    manageUsers: 'admin',
} as const satisfies Record<string, Role>;

export type Feature = keyof typeof FEATURE_MIN_ROLE;

/**
 * Returns true if userRole meets or exceeds the minimum role required for the feature.
 * Role order is defined by the ROLES tuple (index 0 = least privileged).
 */
export function roleCanAccess(userRole: Role, feature: Feature): boolean {
    const required = FEATURE_MIN_ROLE[feature];
    return ROLES.indexOf(userRole) >= ROLES.indexOf(required);
}

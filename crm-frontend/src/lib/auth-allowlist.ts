/**
 * Strict Auth Allowlist for Lentone CRM.
 * Only authorized users can sign in or create accounts.
 */

export interface AllowedUserConfig {
  email: string;
  role: 'developer' | 'owner' | 'admin' | string;
  name?: string;
  active?: boolean;
}

/**
 * Hardcoded baseline allowlist.
 * Ensures developer, owner, and admin always have access even offline.
 */
export const DEFAULT_ALLOWED_USERS: Record<string, AllowedUserConfig> = {
  'aathishpirate@gmail.com': {
    email: 'aathishpirate@gmail.com',
    role: 'developer',
    name: 'Aathish (Developer)',
    active: true,
  },
  'tagverse.iio@gmail.com': {
    email: 'tagverse.iio@gmail.com',
    role: 'owner',
    name: 'Tagverse (Owner / Admin)',
    active: true,
  },
  'lentonecp@gmail.com': {
    email: 'lentonecp@gmail.com',
    role: 'admin',
    name: 'Lentone (Admin)',
    active: true,
  },
};

export function normalizeEmail(email: string | undefined | null): string {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Checks if an email is authorized to login or signup.
 * @param email The user email to check
 * @param dynamicAllowed Optional map or list of allowed users from Firebase RTDB (/allowedUsers)
 */
export function isEmailAllowed(
  email: string | undefined | null,
  dynamicAllowed?: Record<string, AllowedUserConfig | any> | null
): boolean {
  const norm = normalizeEmail(email);
  if (!norm) return false;

  // Check hardcoded defaults
  if (DEFAULT_ALLOWED_USERS[norm] && DEFAULT_ALLOWED_USERS[norm].active !== false) {
    return true;
  }

  // Check dynamic users from Firebase
  if (dynamicAllowed && typeof dynamicAllowed === 'object') {
    for (const val of Object.values(dynamicAllowed)) {
      if (!val) continue;
      const valEmail = typeof val === 'string' ? val : val.email;
      const isActive = typeof val === 'object' && val.active !== undefined ? val.active : true;
      if (normalizeEmail(valEmail) === norm && isActive) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves the role for an authorized user.
 */
export function getUserRole(
  email: string | undefined | null,
  dynamicAllowed?: Record<string, AllowedUserConfig | any> | null
): string {
  const norm = normalizeEmail(email);
  if (!norm) return 'viewer';

  // Check dynamic from Firebase first (allows owner to update roles dynamically)
  if (dynamicAllowed && typeof dynamicAllowed === 'object') {
    for (const val of Object.values(dynamicAllowed)) {
      if (!val) continue;
      const valEmail = typeof val === 'string' ? val : val.email;
      if (normalizeEmail(valEmail) === norm && val.role) {
        return val.role;
      }
    }
  }

  // Fallback to hardcoded default
  if (DEFAULT_ALLOWED_USERS[norm]) {
    return DEFAULT_ALLOWED_USERS[norm].role;
  }

  return 'viewer';
}

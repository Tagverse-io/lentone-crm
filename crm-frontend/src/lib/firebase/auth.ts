import { auth } from './config';

/**
 * Get the current user's ID
 */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

/**
 * Get the current user's email
 */
export function getCurrentUserEmail(): string | null {
  return auth.currentUser?.email || null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}

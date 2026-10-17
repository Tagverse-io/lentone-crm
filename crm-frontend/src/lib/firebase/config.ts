import { getFirebaseDatabase, getFirebaseAuth } from '@/lib/firebase';

export const database = typeof window !== 'undefined' ? getFirebaseDatabase() : (null as any);
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : (null as any);

export function getAuthInstance() {
  return getFirebaseAuth();
}
export function getDbInstance() {
  return getFirebaseDatabase();
}

import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  equalTo,
  onValue,
  off
} from 'firebase/database';
import { database as db } from '@/lib/firebase/config';
import { Contact } from '../types';
import { emitEvent } from '../events';
import { getCurrentUserId } from '@/lib/firebase/auth';

// ===== Collection Reference =====
function contactsRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/contacts`);
}

function contactRef(workspaceId: string, contactId: string) {
  return ref(db, `orgs/${workspaceId}/contacts/${contactId}`);
}

// ===== CRUD Operations =====

/**
 * Create a new contact
 */
export async function createContact(
  workspaceId: string,
  data: Omit<Contact, 'contact_id' | 'created_at' | 'updated_at'>
): Promise<Contact> {
  const newRef = push(contactsRef(workspaceId));
  const contactId = newRef.key!;
  
  const now = new Date().toISOString();
  const contact: Contact = {
    ...data,
    contact_id: contactId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, contact);
  
  emitEvent('contact:created', contact);
  
  return contact;
}

/**
 * Get a contact by ID
 */
export async function getContact(
  workspaceId: string, 
  contactId: string
): Promise<Contact | null> {
  const snapshot = await get(contactRef(workspaceId, contactId));
  if (snapshot.exists()) {
    return snapshot.val() as Contact;
  }
  return null;
}

/**
 * Get all contacts in a workspace
 */
export async function getContacts(workspaceId: string): Promise<Contact[]> {
  const snapshot = await get(contactsRef(workspaceId));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Contact[];
  }
  return [];
}

/**
 * Get all contacts for a company
 */
export async function getCompanyContacts(
  workspaceId: string, 
  companyId: string
): Promise<Contact[]> {
  const q = query(contactsRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Contact[];
  }
  return [];
}

/**
 * Update a contact
 */
export async function updateContact(
  workspaceId: string,
  contactId: string,
  data: Partial<Omit<Contact, 'contact_id' | 'created_at'>>
): Promise<void> {
  const now = new Date().toISOString();
  await update(contactRef(workspaceId, contactId), {
    ...data,
    updated_at: now,
  });
  
  const updated = await getContact(workspaceId, contactId);
  if (updated) {
    emitEvent('contact:updated', updated);
  }
}

/**
 * Delete a contact
 */
export async function deleteContact(
  workspaceId: string, 
  contactId: string
): Promise<void> {
  const contact = await getContact(workspaceId, contactId);
  await remove(contactRef(workspaceId, contactId));
  
  if (contact) {
    emitEvent('contact:deleted', contact);
  }
}

// ===== Query Operations =====

/**
 * Find contacts by email
 */
export async function findContactsByEmail(
  workspaceId: string, 
  email: string
): Promise<Contact[]> {
  const q = query(contactsRef(workspaceId), orderByChild('email'), equalTo(email));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Contact[];
  }
  return [];
}

/**
 * Find contacts by phone
 */
export async function findContactsByPhone(
  workspaceId: string, 
  phone: string
): Promise<Contact[]> {
  const q = query(contactsRef(workspaceId), orderByChild('phone'), equalTo(phone));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Contact[];
  }
  return [];
}

/**
 * Search contacts by name (partial match)
 */
export async function searchContacts(
  workspaceId: string, 
  searchTerm: string
): Promise<Contact[]> {
  const contacts = await getContacts(workspaceId);
  const lowerSearch = searchTerm.toLowerCase();
  
  return contacts.filter(contact => 
    contact.name.toLowerCase().includes(lowerSearch) ||
    contact.email.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Get primary contact for a company
 */
export async function getPrimaryContact(
  workspaceId: string, 
  companyId: string
): Promise<Contact | null> {
  const contacts = await getCompanyContacts(workspaceId, companyId);
  return contacts.find(c => c.is_primary) || contacts[0] || null;
}

// ===== Real-time Subscriptions =====

/**
 * Subscribe to contacts changes
 */
export function subscribeToContacts(
  workspaceId: string,
  callback: (contacts: Contact[]) => void
): () => void {
  const q = contactsRef(workspaceId);
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as Contact[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

/**
 * Subscribe to company contacts changes
 */
export function subscribeToCompanyContacts(
  workspaceId: string,
  companyId: string,
  callback: (contacts: Contact[]) => void
): () => void {
  const q = query(contactsRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as Contact[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

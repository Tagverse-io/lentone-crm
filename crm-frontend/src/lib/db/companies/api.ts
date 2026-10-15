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
import { Company, AutoFillDefaults } from '../types';
import { emitEvent } from '../events';
import { getCurrentUserId } from '@/lib/firebase/auth';

// ===== Collection Reference =====
function companiesRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/companies`);
}

function companyRef(workspaceId: string, companyId: string) {
  return ref(db, `orgs/${workspaceId}/companies/${companyId}`);
}

// ===== CRUD Operations =====

/**
 * Create a new company
 */
export async function createCompany(
  workspaceId: string,
  data: Omit<Company, 'company_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by'>
): Promise<Company> {
  const newRef = push(companiesRef(workspaceId));
  const companyId = newRef.key!;
  
  const now = new Date().toISOString();
  const company: Company = {
    ...data,
    company_id: companyId,
    workspace_id: workspaceId,
    created_at: now,
    updated_at: now,
    created_by: getCurrentUserId() || '',
  };
  
  await set(newRef, company);
  
  emitEvent('company:created', company);
  
  return company;
}

/**
 * Get a company by ID
 */
export async function getCompany(
  workspaceId: string, 
  companyId: string
): Promise<Company | null> {
  const snapshot = await get(companyRef(workspaceId, companyId));
  if (snapshot.exists()) {
    return snapshot.val() as Company;
  }
  return null;
}

/**
 * Get all companies in a workspace
 */
export async function getCompanies(workspaceId: string): Promise<Company[]> {
  const snapshot = await get(companiesRef(workspaceId));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Company[];
  }
  return [];
}

/**
 * Update a company
 */
export async function updateCompany(
  workspaceId: string,
  companyId: string,
  data: Partial<Omit<Company, 'company_id' | 'workspace_id' | 'created_at' | 'created_by'>>
): Promise<void> {
  const now = new Date().toISOString();
  await update(companyRef(workspaceId, companyId), {
    ...data,
    updated_at: now,
  });
  
  const updated = await getCompany(workspaceId, companyId);
  if (updated) {
    emitEvent('company:updated', updated);
  }
}

/**
 * Delete a company
 */
export async function deleteCompany(
  workspaceId: string, 
  companyId: string
): Promise<void> {
  const company = await getCompany(workspaceId, companyId);
  await remove(companyRef(workspaceId, companyId));
  
  if (company) {
    emitEvent('company:deleted', company);
  }
}

// ===== Query Operations =====

/**
 * Find company by name (exact match)
 */
export async function findCompanyByName(
  workspaceId: string, 
  name: string
): Promise<Company | null> {
  const q = query(companiesRef(workspaceId), orderByChild('name'), equalTo(name));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    const firstKey = Object.keys(data)[0];
    return data[firstKey] as Company;
  }
  return null;
}

/**
 * Search companies by name (partial match)
 */
export async function searchCompanies(
  workspaceId: string, 
  searchTerm: string
): Promise<Company[]> {
  const companies = await getCompanies(workspaceId);
  const lowerSearch = searchTerm.toLowerCase();
  
  return companies.filter(company => 
    company.name.toLowerCase().includes(lowerSearch) ||
    (company.legal_name && company.legal_name.toLowerCase().includes(lowerSearch))
  );
}

// ===== Real-time Subscriptions =====

/**
 * Subscribe to companies changes
 */
export function subscribeToCompanies(
  workspaceId: string,
  callback: (companies: Company[]) => void
): () => void {
  const q = companiesRef(workspaceId);
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as Company[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

// ===== Auto-Fill Functions =====

/**
 * Get auto-fill defaults from a company
 */
export function getCompanyDefaults(company: Company): AutoFillDefaults {
  return {
    currency: company.currency || 'INR',
    timezone: company.timezone || 'Asia/Kolkata',
    gst_number: company.gst_number || '',
    pan_number: company.pan_number || '',
    vat_number: company.vat_number || '',
    bank_name: company.bank_name || '',
    account_number: company.account_number || '',
    ifsc: company.ifsc || '',
    swift: company.swift || '',
    upi: company.upi || '',
    logo_url: company.logo_url || '',
    footer_text: company.footer_text || '',
    address: company.address || '',
    city: company.city || '',
    state: company.state || '',
    country: company.country || '',
    pincode: company.pincode || '',
  };
}

/**
 * Calculate company statistics by querying related entities
 */
export async function getCompanyStats(
  workspaceId: string, 
  companyId: string
): Promise<{
  contact_count: number;
  deal_count: number;
  quote_count: number;
  invoice_count: number;
  total_revenue: number;
}> {
  try {
    const [contactsSnap, dealsSnap, quotesSnap, invoicesSnap] = await Promise.all([
      get(query(ref(db, `orgs/${workspaceId}/contacts`), orderByChild('company_id'), equalTo(companyId))),
      get(query(ref(db, `orgs/${workspaceId}/deals`), orderByChild('company_id'), equalTo(companyId))),
      get(query(ref(db, `orgs/${workspaceId}/quotes`), orderByChild('company_id'), equalTo(companyId))),
      get(query(ref(db, `orgs/${workspaceId}/invoices`), orderByChild('company_id'), equalTo(companyId))),
    ]);

    const contacts = contactsSnap.val() || {};
    const deals = dealsSnap.val() || {};
    const quotes = quotesSnap.val() || {};
    const invoices = invoicesSnap.val() || {};

    let totalRevenue = 0;
    for (const inv of Object.values(invoices) as any[]) {
      if (inv.status === 'paid' && inv.amount) {
        totalRevenue += Number(inv.amount) || 0;
      }
    }

    return {
      contact_count: Object.keys(contacts).length,
      deal_count: Object.keys(deals).length,
      quote_count: Object.keys(quotes).length,
      invoice_count: Object.keys(invoices).length,
      total_revenue: totalRevenue,
    };
  } catch (error) {
    console.error('getCompanyStats error:', error);
    return {
      contact_count: 0,
      deal_count: 0,
      quote_count: 0,
      invoice_count: 0,
      total_revenue: 0,
    };
  }
}

import { createItem, getItem, getCollection, updateItem, removeItem, logHistory } from '@/lib/db';
import type { Lead, Invoice, Quotation, Contract } from '@/lib/db/types';

export async function getLeads(workspaceId?: string): Promise<Lead[]> {
  try {
    const list = await getCollection<Lead>('leads');
    return list;
  } catch {
    return [];
  }
}

export async function getInvoices(workspaceId?: string): Promise<Invoice[]> {
  try {
    return await getCollection<Invoice>('invoices');
  } catch {
    return [];
  }
}

export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  try {
    return await getItem<Invoice>('invoices', invoiceId);
  } catch {
    return null;
  }
}

export async function createInvoice(invoice: any): Promise<string> {
  const id = await createItem('invoices', {
    ...invoice,
    createdAt: invoice.created_at || invoice.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

export async function updateInvoice(invoiceId: string, updates: any): Promise<boolean> {
  await updateItem('invoices', invoiceId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function getQuotations(workspaceId?: string): Promise<Quotation[]> {
  try {
    return await getCollection<Quotation>('quotations');
  } catch {
    return [];
  }
}

export async function getQuotation(quotationId: string): Promise<Quotation | null> {
  try {
    return await getItem<Quotation>('quotations', quotationId);
  } catch {
    return null;
  }
}

export async function createQuotation(quotation: any): Promise<string> {
  const id = await createItem('quotations', {
    ...quotation,
    createdAt: quotation.created_at || quotation.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

export async function updateQuotation(quotationId: string, updates: any): Promise<boolean> {
  await updateItem('quotations', quotationId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function getContracts(workspaceId?: string): Promise<Contract[]> {
  try {
    return await getCollection<Contract>('contracts');
  } catch {
    return [];
  }
}

export async function getContract(contractId: string): Promise<Contract | null> {
  try {
    return await getItem<Contract>('contracts', contractId);
  } catch {
    return null;
  }
}

export async function createContract(contract: any): Promise<string | null> {
  try {
    const id = await createItem('contracts', {
      ...contract,
      createdAt: contract.created_at || contract.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return id;
  } catch (err) {
    console.error('Error creating contract:', err);
    return null;
  }
}

export async function updateContract(contractId: string, updates: any): Promise<boolean> {
  try {
    await updateItem('contracts', contractId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Error updating contract:', err);
    return false;
  }
}

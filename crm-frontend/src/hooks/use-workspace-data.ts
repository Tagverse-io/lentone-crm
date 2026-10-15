'use client';

import { useWorkspace } from '@/lib/settings/workspace-context';
import { useAuth } from '@/lib/firebase/auth-context';
import { AutoFillDefaults, QuoteItem, InvoiceItem } from '@/lib/db/types';
import { getWorkspaceAutoFillDefaults, applyQuoteDefaults, applyInvoiceDefaults } from '@/lib/db/auto-fill';

/**
 * Hook to get workspace-specific data and auto-fill defaults
 * 
 * Usage:
 * ```tsx
 * const { workspaceId, currency, companyName, getQuoteDefaults, getInvoiceDefaults } = useWorkspaceData();
 * 
 * // Get defaults for a new quote
 * const defaults = getQuoteDefaults();
 * // { currency: 'INR', tax_rate: 18, ... }
 * ```
 */
export function useWorkspaceData() {
  const { workspace } = useAuth();
  const workspaceCtx = useWorkspace();
  
  const workspaceId = workspace?.id || '';
  
  // Get auto-fill defaults from workspace settings
  const getAutoFillDefaults = (): AutoFillDefaults => {
    return getWorkspaceAutoFillDefaults(workspaceCtx.settings.general, workspaceCtx.settings.branding);
  };
  
  // Get quote defaults with items
  const getQuoteDefaults = (overrides?: Partial<{
    currency: string;
    notes: string;
    terms_and_conditions: string;
  }>) => {
    const defaults = getAutoFillDefaults();
    return applyQuoteDefaults(defaults, overrides);
  };
  
  // Get invoice defaults with items
  const getInvoiceDefaults = (overrides?: Partial<{
    currency: string;
    notes: string;
    terms_and_conditions: string;
  }>) => {
    const defaults = getAutoFillDefaults();
    return applyInvoiceDefaults(defaults, overrides);
  };
  
  return {
    // Workspace info
    workspaceId,
    companyName: workspaceCtx.companyName,
    currency: workspaceCtx.currency,
    currencySymbol: workspaceCtx.currencySymbol,
    timezone: workspaceCtx.timezone,
    dateFormat: workspaceCtx.dateFormat,
    gstNumber: workspaceCtx.gstNumber,
    panNumber: workspaceCtx.panNumber,
    bankName: workspaceCtx.bankName,
    footerText: workspaceCtx.footerText,
    templateStyle: workspaceCtx.templateStyle,
    
    // Auto-fill functions
    getAutoFillDefaults,
    getQuoteDefaults,
    getInvoiceDefaults,
    
    // Raw settings access
    settings: workspaceCtx.settings,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { 
  subscribeToActivities,
  getCompanyActivities,
  getActivities
} from '@/lib/db/activities/api';
import { 
  NormalizedActivity,
  NormalizedLead,
  Deal,
  NormalizedQuote,
  NormalizedInvoice,
  NormalizedPayment
} from '@/lib/db/types';
import { onValue, ref, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { database } from '@/lib/firebase/config';

// ===== Dashboard Metrics =====

export interface DashboardMetrics {
  // Leads
  totalLeads: number;
  newLeadsThisWeek: number;
  hotLeads: number;
  avgLeadScore: number;
  
  // Deals
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalDealValue: number;
  wonDealValue: number;
  
  // Quotes
  totalQuotes: number;
  pendingQuotes: number;
  acceptedQuotes: number;
  totalQuoteValue: number;
  
  // Invoices
  totalInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  paidInvoices: number;
  totalInvoiceValue: number;
  totalPaidValue: number;
  totalOutstanding: number;
  
  // Payments
  totalPayments: number;
  totalPaymentValue: number;
  
  // Activities
  recentActivities: NormalizedActivity[];
  activitiesThisWeek: number;
}

const defaultMetrics: DashboardMetrics = {
  totalLeads: 0,
  newLeadsThisWeek: 0,
  hotLeads: 0,
  avgLeadScore: 0,
  totalDeals: 0,
  openDeals: 0,
  wonDeals: 0,
  lostDeals: 0,
  totalDealValue: 0,
  wonDealValue: 0,
  totalQuotes: 0,
  pendingQuotes: 0,
  acceptedQuotes: 0,
  totalQuoteValue: 0,
  totalInvoices: 0,
  pendingInvoices: 0,
  overdueInvoices: 0,
  paidInvoices: 0,
  totalInvoiceValue: 0,
  totalPaidValue: 0,
  totalOutstanding: 0,
  totalPayments: 0,
  totalPaymentValue: 0,
  recentActivities: [],
  activitiesThisWeek: 0,
};

/**
 * Hook to fetch real-time dashboard metrics
 */
export function useDashboardMetrics() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id || '';
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        leadsSnapshot,
        dealsSnapshot,
        quotesSnapshot,
        invoicesSnapshot,
        paymentsSnapshot,
        activitiesSnapshot
      ] = await Promise.all([
        // Leads
        new Promise<any>((resolve) => {
          const leadsRef = ref(database, `workspaces/${workspaceId}/leads`);
          onValue(leadsRef, (snap) => resolve(snap.val() || {}));
        }),
        // Deals
        new Promise<any>((resolve) => {
          const dealsRef = ref(database, `workspaces/${workspaceId}/deals`);
          onValue(dealsRef, (snap) => resolve(snap.val() || {}));
        }),
        // Quotes
        new Promise<any>((resolve) => {
          const quotesRef = ref(database, `workspaces/${workspaceId}/quotes`);
          onValue(quotesRef, (snap) => resolve(snap.val() || {}));
        }),
        // Invoices
        new Promise<any>((resolve) => {
          const invoicesRef = ref(database, `workspaces/${workspaceId}/invoices`);
          onValue(invoicesRef, (snap) => resolve(snap.val() || {}));
        }),
        // Payments
        new Promise<any>((resolve) => {
          const paymentsRef = ref(database, `workspaces/${workspaceId}/payments`);
          onValue(paymentsRef, (snap) => resolve(snap.val() || {}));
        }),
        // Activities
        getActivities(workspaceId, 10)
      ]);

      // Parse data
      const leads: NormalizedLead[] = Object.values(leadsSnapshot) as NormalizedLead[];
      const deals: Deal[] = Object.values(dealsSnapshot) as Deal[];
      const quotes: NormalizedQuote[] = Object.values(quotesSnapshot) as NormalizedQuote[];
      const invoices: NormalizedInvoice[] = Object.values(invoicesSnapshot) as NormalizedInvoice[];
      const payments: NormalizedPayment[] = Object.values(paymentsSnapshot) as NormalizedPayment[];
      const activities: NormalizedActivity[] = activitiesSnapshot as NormalizedActivity[];

      // Calculate metrics
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Leads metrics
      const newLeadsThisWeek = leads.filter(l => 
        new Date(l.created_at) > weekAgo
      ).length;
      const hotLeads = leads.filter(l => l.lead_score >= 80).length;
      const avgLeadScore = leads.length > 0 
        ? Math.round(leads.reduce((sum, l) => sum + l.lead_score, 0) / leads.length)
        : 0;

      // Deals metrics
      const openDeals = deals.filter(d => d.status === 'open').length;
      const wonDeals = deals.filter(d => d.status === 'won').length;
      const lostDeals = deals.filter(d => d.status === 'lost').length;
      const totalDealValue = deals.reduce((sum, d) => sum + d.value, 0);
      const wonDealValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.value, 0);

      // Quotes metrics
      const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent').length;
      const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
      const totalQuoteValue = quotes.reduce((sum, q) => sum + q.total, 0);

      // Invoices metrics
      const pendingInvoices = invoices.filter(i => i.status === 'pending').length;
      const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
      const paidInvoices = invoices.filter(i => i.status === 'paid').length;
      const totalInvoiceValue = invoices.reduce((sum, i) => sum + i.total, 0);
      const totalPaidValue = invoices.reduce((sum, i) => sum + i.amount_paid, 0);
      const totalOutstanding = totalInvoiceValue - totalPaidValue;

      // Payments metrics
      const totalPaymentValue = payments.reduce((sum, p) => sum + p.amount, 0);

      // Activities metrics
      const activitiesThisWeek = activities.filter(a => 
        new Date(a.created_at) > weekAgo
      ).length;

      setMetrics({
        totalLeads: leads.length,
        newLeadsThisWeek,
        hotLeads,
        avgLeadScore,
        totalDeals: deals.length,
        openDeals,
        wonDeals,
        lostDeals,
        totalDealValue,
        wonDealValue,
        totalQuotes: quotes.length,
        pendingQuotes,
        acceptedQuotes,
        totalQuoteValue,
        totalInvoices: invoices.length,
        pendingInvoices,
        overdueInvoices,
        paidInvoices,
        totalInvoiceValue,
        totalPaidValue,
        totalOutstanding,
        totalPayments: payments.length,
        totalPaymentValue,
        recentActivities: activities,
        activitiesThisWeek,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchMetrics,
  };
}

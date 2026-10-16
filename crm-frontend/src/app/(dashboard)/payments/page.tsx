// @ts-nocheck
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, Plus, Search, 
  Wallet, Receipt, TrendingUp, AlertCircle, CheckCircle2,
  Clock, X, ArrowUpRight, Banknote, Smartphone,
  MoreHorizontal, Eye, Pencil, Trash
} from 'lucide-react';
import { createPayment, updatePayment, deletePayment, subscribeToPayments } from '@/lib/db/payments/api';
import { clientsService, creditNotesService } from '@/lib/backend-crud';
import type { CreditNote } from '@/lib/types';
import { subscribeToContacts } from '@/lib/db/contacts/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { NormalizedPayment, PaymentMethod, PaymentStatus } from '@/lib/db/types';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { backend } from '@/lib/backend-client';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataPagination } from '@/components/ui/data-pagination';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useFmt } from '@/lib/format';

export default function PaymentsPage() {
  const PAGE_SIZE = 25;
  const { workspace, user } = useAuth();
  const isPrivileged = user?.role === 'admin' || (workspace as { owner_id?: string })?.owner_id === user?.id;
  const { currency } = useWorkspace();
  const fmt = useFmt();
  const workspaceId = workspace?.id || '';
  const [payments, setPayments] = useState<NormalizedPayment[]>([]);
  const [creditNoteOptions, setCreditNoteOptions] = useState<CreditNote[]>([]);
  const [entityMap, setEntityMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'All' | PaymentMethod>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | PaymentStatus>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [viewingPayment, setViewingPayment] = useState<NormalizedPayment | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!workspaceId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribePayments = subscribeToPayments(workspaceId, (data) => {
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(data);
      setLoading(false);
    });
    
    const unsubscribeClients = clientsService.subscribe(workspaceId, (clients) => {
      setEntityMap(prev => {
        const newMap = { ...prev };
        clients.forEach(c => { newMap[c.id] = c.name; });
        return newMap;
      });
    });

    const unsubscribeContacts = subscribeToContacts(workspaceId, (contacts) => {
      setEntityMap(prev => {
        const newMap = { ...prev };
        contacts.forEach(c => newMap[c.contact_id] = c.name);
        return newMap;
      });
    });

    const unsubscribeCreditNotes = creditNotesService.subscribe(workspaceId, (notes) => {
      setCreditNoteOptions(notes);
    });

    return () => {
      unsubscribePayments();
      unsubscribeClients();
      unsubscribeContacts();
      unsubscribeCreditNotes();
    };
  }, [workspaceId]);

  useEffect(() => { setPage(1); }, [search, methodFilter, statusFilter]);

  // Form State
  const [form, setForm] = useState<{
    client: string;
    invoiceId: string;
    amount: string;
    method: PaymentMethod;
    status: PaymentStatus;
    payment_type: 'income' | 'expense';
    reference: string;
    notes: string;
    creditNoteId: string;
  }>({
    client: '',
    invoiceId: '',
    amount: '',
    method: 'upi',
    status: 'completed',
    payment_type: 'income',
    reference: '',
    notes: '',
    creditNoteId: '',
  });

  // Derived state
  const totalIncome = useMemo(() => payments.filter(p => p.status === 'completed' && (!p.payment_type || p.payment_type === 'income')).reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);
  const totalExpense = useMemo(() => payments.filter(p => p.status === 'completed' && p.payment_type === 'expense').reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);
  const netCollection = totalIncome - totalExpense;

  const pendingCollection = useMemo(() => payments.filter(p => p.status === 'pending').reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);
  const pendingCount = useMemo(() => payments.filter(p => p.status === 'pending').length, [payments]);
  const failedCount = useMemo(() => payments.filter(p => p.status === 'failed' || p.status === 'refunded').length, [payments]);
  
  const upiCollected = useMemo(() => payments.filter(p => p.method === 'upi' && p.status === 'completed' && (!p.payment_type || p.payment_type === 'income')).reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);
  const neftCollected = useMemo(() => payments.filter(p => p.method === 'bank_transfer' && p.status === 'completed' && (!p.payment_type || p.payment_type === 'income')).reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);
  const chequeCollected = useMemo(() => payments.filter(p => p.method === 'cheque' && p.status === 'completed' && (!p.payment_type || p.payment_type === 'income')).reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);

  // Max value for progress bars to be relative to collected
  const maxCollected = Math.max(upiCollected, neftCollected, chequeCollected) || 1;

  const recentActivity = useMemo(() => {
    return payments.slice(0, 4);
  }, [payments]);

  const pendingFollowUps = useMemo(() => {
    return payments.filter(p => p.status === 'failed' || p.status === 'pending');
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (methodFilter !== 'All' && p.method !== methodFilter) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (p.client_id || '').toLowerCase().includes(query) ||
               (p.company_id || '').toLowerCase().includes(query) ||
               (p.contact_id || '').toLowerCase().includes(query) ||
               (p.invoice_id || '').toLowerCase().includes(query);
      }
      return true;
    });
  }, [payments, search, methodFilter, statusFilter]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPayments.slice(start, start + PAGE_SIZE);
  }, [filteredPayments, page]);

  const formatAmount = (val: number) => {
    return fmt.money(val);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount) {
      toast.error('Amount is required');
      return;
    }
    if (!form.client) {
      toast.info('No customer linked — saving as unallocated (legacy). Link a customer when known.');
    }

    try {
      if (!workspaceId) throw new Error("No workspace found");
      const paymentData = {
        client_id: form.client,
        invoice_id: form.invoiceId.trim(),
        amount: parseFloat(form.amount),
        method: form.method,
        status: form.status,
        date: new Date().toISOString(),
        currency: currency,
        payment_type: form.payment_type,
        contact_id: '',
        quote_id: '',
        deal_id: '',
        reference: form.reference.trim(),
        notes: form.notes.trim(),
        credit_note_id: form.creditNoteId || undefined
      };

      if (editingPaymentId) {
        await updatePayment(workspaceId, editingPaymentId, paymentData);
        toast.success('Payment updated successfully');
      } else {
        const created = await createPayment(workspaceId, paymentData);
        toast.success('Payment recorded successfully');
        // Event-driven automation: update invoice totals/status (idempotent).
        // Skip when unallocated (no invoice).
        if (created.invoice_id) {
          try {
            await backend.paymentReceived(workspaceId, created.payment_id);
          } catch {
            toast.error('Payment saved, but invoice automation failed');
          }
        }
      }
      setModalOpen(false);
      setEditingPaymentId(null);
      setForm({ client: '', invoiceId: '', amount: '', method: 'upi', status: 'completed', payment_type: 'income', reference: '', notes: '', creditNoteId: '' });
    } catch (error) {
      toast.error('Failed to save payment');
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !workspaceId) return;
    if (!isPrivileged) {
      toast.error('Only owners/admins can delete payments');
      setDeleting(null);
      return;
    }
    try {
      await deletePayment(workspaceId, deleting);
      toast.success('Payment deleted successfully');
    } catch (error) {
      toast.error('Failed to delete payment');
    } finally {
      setDeleting(null);
    }
  };

  const handleDelete = (id: string) => {
    setDeleting(id);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {loading && <div className="flex justify-center p-8"><p className="text-muted-foreground">Loading payments...</p></div>}
      {/* A. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="text-amber-500 w-6 h-6" />
            Payments
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Collections, transaction history, and pending follow-ups.</p>
        </div>
        <button 
          onClick={() => {
            setEditingPaymentId(null);
            setForm({ client: '', invoiceId: '', amount: '', method: 'upi', status: 'completed', payment_type: 'income', reference: '', notes: '', creditNoteId: '' });
            setModalOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* B. KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Income</h3>
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-2">{formatAmount(totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>
        
        <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-400">Total Expenses</h3>
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-rose-700 dark:text-rose-400 mt-2">{formatAmount(totalExpense)}</p>
          <p className="text-xs text-muted-foreground mt-1">Operation Bills</p>
        </div>

        <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400">Net Balance</h3>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400 mt-2">{formatAmount(netCollection)}</p>
          <p className="text-xs text-muted-foreground mt-1">Income - Expenses</p>
        </div>

        <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-400">Failed / Returned</h3>
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-rose-700 dark:text-rose-400 mt-2">{failedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Needs follow-up</p>
        </div>
      </div>

      {/* C. Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Column: Recent Activity */}
        <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map(txn => (
              <div key={txn.payment_id} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  txn.status === 'completed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' :
                  txn.status === 'failed' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' :
                  'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                }`}>
                  {txn.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                   txn.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                   <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-foreground truncate">{entityMap[txn.client_id || txn.company_id || txn.contact_id] || txn.client_id || txn.company_id || txn.contact_id}</p>
                    <span className={`text-sm font-bold ${
                      txn.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                      txn.status === 'failed' ? 'text-rose-600 dark:text-rose-400' :
                      'text-amber-600 dark:text-amber-400'
                    }`}>
                      {formatAmount(txn.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{txn.invoice_id} &bull; {txn.method}</span>
                    <span>{fmt.date(txn.date)}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
            )}
          </div>
        </div>

        {/* Right Column: Collection by Method & Pending Follow-ups */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Collection by Method</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> UPI</span>
                  <span className="font-medium">{formatAmount(upiCollected)}</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(upiCollected / maxCollected) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5" /> NEFT</span>
                  <span className="font-medium">{formatAmount(neftCollected)}</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${(neftCollected / maxCollected) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Cheque</span>
                  <span className="font-medium">{formatAmount(chequeCollected)}</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${(chequeCollected / maxCollected) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border p-0 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Pending Follow-ups</h3>
            </div>
            <div className="overflow-auto flex-1 max-h-48">
              <table className="w-full text-sm text-left min-w-[300px]">
                <tbody>
                  {pendingFollowUps.map((p, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-3 py-2 font-medium">{entityMap[p.client_id || p.company_id || p.contact_id] || p.client_id || p.company_id || p.contact_id}</td>
                      <td className="p-3 py-2 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'failed' 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {pendingFollowUps.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-muted-foreground text-sm">No pending follow-ups.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* D. Filters Section */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value as 'All' | PaymentMethod)}
        >
          <option value="All">All Methods</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">NEFT/Bank Transfer</option>
          <option value="cheque">Cheque</option>
          <option value="cash">Cash</option>
          <option value="credit_card">Credit Card</option>
          <option value="debit_card">Debit Card</option>
          <option value="other">Other</option>
        </select>
        <select 
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | PaymentStatus)}
        >
          <option value="All">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* E. Transactions Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap hidden md:table-cell">ID</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Client / Vendor</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap hidden lg:table-cell">Ref (Invoice/Bill)</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Type</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap hidden md:table-cell">Method</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedPayments.map(txn => (
                <tr key={txn.payment_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">PAY-{txn.payment_id.slice(-6).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium">
                    {txn.client_id ? (entityMap[txn.client_id] || txn.client_id) :
                     txn.company_id ? (entityMap[txn.company_id] || txn.company_id) :
                      txn.contact_id ? (entityMap[txn.contact_id] || txn.contact_id) :
                      '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 hidden lg:table-cell">{txn.invoice_id ? txn.invoice_id : <span className="text-muted-foreground italic">unallocated</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      (!txn.payment_type || txn.payment_type === 'income') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {(!txn.payment_type || txn.payment_type === 'income') ? 'Income' : 'Operation Bill'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{formatAmount(txn.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap hidden sm:table-cell">{fmt.date(txn.date)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border">
                      {txn.method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                      txn.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' :
                      txn.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800' :
                      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingPayment(txn)}>
                            <Eye size={14} className="mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingPaymentId(txn.payment_id);
                            setForm({
                              client: txn.client_id || txn.company_id || txn.contact_id || '',
                              invoiceId: txn.invoice_id || '',
                              amount: txn.amount.toString(),
                              method: txn.method,
                              status: txn.status,
                              payment_type: txn.payment_type || 'income',
                              reference: (txn as { reference?: string }).reference || '',
                              notes: txn.notes || '',
                              creditNoteId: txn.credit_note_id || ''
                            });
                            setModalOpen(true);
                          }}>
                            <Pencil size={14} className="mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isPrivileged ? (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(txn.payment_id)}
                              disabled={deleting === txn.payment_id}
                            >
                              <Trash size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </td>
                </tr>
              ))}
              {paginatedPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPayments.length > PAGE_SIZE && (
        <DataPagination
          page={page}
          totalItems={filteredPayments.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* F. Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
                  setModalOpen(false);
                  setEditingPaymentId(null);
                  setForm({ client: '', invoiceId: '', amount: '', method: 'upi', status: 'completed', payment_type: 'income', reference: '', notes: '', creditNoteId: '' });
                }}></div>
          <div className="bg-background rounded-xl border shadow-lg w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">{editingPaymentId ? "Edit Payment" : "Record Payment"}</h3>
              <button onClick={() => {
                  setModalOpen(false);
                  setEditingPaymentId(null);
                  setForm({ client: '', invoiceId: '', amount: '', method: 'upi', status: 'completed', payment_type: 'income', reference: '', notes: '', creditNoteId: '' });
                }} className="text-muted-foreground hover:bg-muted p-1 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Client</label>
                <input
                  type="text"
                  placeholder="e.g. Arka Systems"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                  value={form.client}
                  onChange={(e) => setForm({...form, client: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Invoice ID <span className="normal-case font-medium">(optional — blank = unallocated)</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. INV-2091 — leave blank for unallocated" 
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                  value={form.invoiceId}
                  onChange={(e) => setForm({...form, invoiceId: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Amount ({fmt.fs.symbol})</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  step="0.01"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Method</label>
                  <select 
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    value={form.method}
                    onChange={(e) => setForm({...form, method: e.target.value as PaymentMethod})}
                  >
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">NEFT/Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Status</label>
                  <select 
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value as PaymentStatus})}
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Type</label>
                  <select 
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    value={form.payment_type}
                    onChange={(e) => setForm({...form, payment_type: e.target.value as 'income' | 'expense'})}
                  >
                    <option value="income">Income (Client Payment)</option>
                    <option value="expense">Operation Bill (Expense)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR / cheque no."
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Notes</label>
                  <textarea
                    placeholder="Payment notes…"
                    rows={2}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Linked credit note (optional)</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    value={form.creditNoteId}
                    onChange={(e) => setForm({ ...form, creditNoteId: e.target.value })}
                  >
                    <option value="">None</option>
                    {creditNoteOptions.map((cn) => (
                      <option key={cn.id} value={cn.id}>{cn.number} · {cn.status}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">A refund linked to an applied note never reduces the invoice twice.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                  setModalOpen(false);
                  setEditingPaymentId(null);
                  setForm({ client: '', invoiceId: '', amount: '', method: 'upi', status: 'completed', payment_type: 'income', reference: '', notes: '', creditNoteId: '' });
                }}
                  className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* View Payment Modal */}
      {viewingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingPayment(null)}></div>
          <div className="bg-background rounded-xl border shadow-lg w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">Payment Details</h3>
              <button onClick={() => setViewingPayment(null)} className="text-muted-foreground hover:bg-muted p-1 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-sm">PAY-{viewingPayment.payment_id.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-muted-foreground">Client / Vendor</span>
                <span className="font-medium">
                  {viewingPayment.client_id ? (entityMap[viewingPayment.client_id] || viewingPayment.client_id) :
                   viewingPayment.company_id ? (entityMap[viewingPayment.company_id] || viewingPayment.company_id) :
                    viewingPayment.contact_id ? (entityMap[viewingPayment.contact_id] || viewingPayment.contact_id) :
                    '—'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Date</p>
                  <p className="font-medium">{fmt.date(viewingPayment.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Invoice ID</p>
                  <p className="font-medium text-blue-600 dark:text-blue-400">{viewingPayment.invoice_id ? viewingPayment.invoice_id : <span className="text-muted-foreground italic">unallocated</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Amount</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatAmount(viewingPayment.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Method</p>
                  <p className="font-medium capitalize">{viewingPayment.method.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <p className="font-medium capitalize">{viewingPayment.payment_type || 'Income'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    viewingPayment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    viewingPayment.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {viewingPayment.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reference</p>
                  <p className="font-medium">{(viewingPayment as { reference?: string }).reference || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{viewingPayment.notes || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Linked credit note</p>
                  <p className="font-medium">{viewingPayment.credit_note_id || '—'}</p>
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex justify-end">
              <button onClick={() => setViewingPayment(null)} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete Payment"
        description="Are you sure you want to permanently delete this payment? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

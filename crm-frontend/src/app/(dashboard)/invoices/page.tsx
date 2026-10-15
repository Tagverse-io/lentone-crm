'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Download, Eye, MoreHorizontal, Pencil, Trash2, Receipt, Loader2, CreditCard } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { getInvoices, deleteInvoice } from '@/lib/firebase/database';
import { useAuth } from '@/lib/firebase/auth-context';
import { useWorkspace } from '@/lib/settings/workspace-context';
import type { Invoice } from '@/lib/db/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataPagination } from '@/components/ui/data-pagination';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { generateInvoicePdf, downloadPdf, openPdfPreview } from '@/lib/pdf-engine/generator';
import { getCompanySettings, preloadLogo } from '@/lib/pdf-engine/helpers';

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  overdue: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

const PAGE_SIZE = 25;

export default function InvoicesPage() {
  const router = useRouter();
  const { workspace, user } = useAuth();
  const { currency } = useWorkspace();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; loading?: boolean }>({ open: false });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getInvoices(workspace?.id);
    setInvoices(data);
    setLoading(false);
    // Preload logo in background so PDF generation is instant
    getCompanySettings(workspace?.id || user?.company_id || '').then(s => { if (s.logo_url) preloadLogo(s.logo_url); });
  }, [workspace?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(s) ||
        (inv.description || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  async function handleDelete(inv: Invoice) {
    setConfirmState({ open: true, id: inv.id });
  }

  async function onDeleteConfirm() {
    if (!confirmState.id) return;
    try {
      await deleteInvoice(confirmState.id);
      toast.success('Invoice deleted');
      load();
      setConfirmState({ open: false });
    } catch {
      toast.error('Failed to delete invoice');
      setConfirmState({ open: false });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">Manage and track customer invoices</p>
        </div>
        <Button onClick={() => router.push('/invoices/new')} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" />
          New Invoice
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={paginatedData}
              keyExtractor={(inv) => inv.id}
              mobileCardTitle={(inv) => inv.invoice_number}
              columns={[
                {
                  key: 'number',
                  header: 'Invoice #',
                  render: (inv) => <span className="text-sm font-medium">{inv.invoice_number}</span>,
                },
                {
                  key: 'description',
                  header: 'Description',
                  hideOnMobile: true,
                  render: (inv) => <span className="text-sm">{inv.description || '—'}</span>,
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (inv) => <span className="text-sm font-medium">{formatCurrency(inv.amount, currency)}</span>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (inv) => (
                    <Badge variant="secondary" className={statusStyles[inv.status] || ''}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </Badge>
                  ),
                },
                {
                  key: 'due',
                  header: 'Due Date',
                  hideOnMobile: true,
                  render: (inv) => <span className="text-sm text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</span>,
                },
                {
                  key: 'date',
                  header: 'Date',
                  hideOnMobile: true,
                  render: (inv) => <span className="text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</span>,
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'w-24',
                  render: (inv) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Invoice actions">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                          <Pencil size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        {inv.status !== 'paid' && (
                          <DropdownMenuItem onClick={async () => {
                            const id = toast.loading('Redirecting to checkout…');
                            try {
                              const res = await fetch('/api/payments/checkout', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  invoiceId: inv.id,
                                  amount: inv.amount,
                                  currency: inv.currency,
                                  description: inv.invoice_number,
                                  workspaceId: inv.workspace_id
                                })
                              });
                              const data = await res.json();
                              if (data.url) {
                                window.location.href = data.url;
                              } else {
                                throw new Error(data.error);
                              }
                            } catch (e: any) {
                              toast.error(e.message || 'Failed to checkout', { id });
                            }
                          }}>
                            <CreditCard size={14} className="mr-2" /> Pay with Stripe
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={async () => {
                          const id = toast.loading('Generating PDF…');
                          try {
                            const pdf = await generateInvoicePdf(workspace?.id || user?.company_id || '', inv, null, null);
                            await downloadPdf(pdf, `Invoice-${inv.invoice_number}.pdf`);
                            toast.success('Invoice downloaded', { id });
                          } catch { toast.error('Failed to generate PDF', { id }); }
                        }}>
                          <Download size={14} className="mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          const id = toast.loading('Generating preview…');
                          try {
                            const pdf = await generateInvoicePdf(workspace?.id || user?.company_id || '', inv, null, null);
                            const url = await openPdfPreview(pdf);
                            window.open(url, '_blank');
                            toast.dismiss(id);
                          } catch { toast.error('Failed to generate preview', { id }); }
                        }}>
                          <Eye size={14} className="mr-2" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(inv)}>
                          <Trash2 size={14} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <Receipt size={48} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ open })}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        onConfirm={onDeleteConfirm}
      />

      {filtered.length > PAGE_SIZE && (
        <DataPagination
          page={page}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Download, Eye, MoreHorizontal, Pencil, Trash2, FileText } from 'lucide-react';
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
import { getQuotations, deleteQuotation, convertQuotationToInvoice } from '@/lib/firebase/database';
import type { Quotation } from '@/lib/db/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { generateQuotationPdf, downloadPdf, openPdfPreview } from '@/lib/pdf-engine/generator';
import { getCompanySettings, preloadLogo } from '@/lib/pdf-engine/helpers';
import { useAuth } from '@/lib/firebase/auth-context';
import { DataPagination } from '@/components/ui/data-pagination';

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  accepted: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  expired: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
};

const PAGE_SIZE = 25;

export default function QuotesPage() {
  const router = useRouter();
  const { workspace, user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; loading?: boolean }>({ open: false });
  const [page, setPage] = useState(1);

  async function load() {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getQuotations(workspace?.id);
      setQuotations(data);
      // Preload logo in background so PDF generation is instant
      getCompanySettings(workspace?.id || user?.company_id || '').then(s => { if (s.logo_url) preloadLogo(s.logo_url); });
    } catch {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [workspace?.id]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const filtered = quotations.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        q.quotation_number.toLowerCase().includes(s) ||
        (q.client_name || '').toLowerCase().includes(s) ||
        (q.client_company || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  async function handleConvertToInvoice(q: Quotation) {
    const toastId = toast.loading('Converting quote to invoice...');
    try {
      const invoiceId = await convertQuotationToInvoice(q);
      if (invoiceId) {
        toast.success('Quote converted to invoice successfully', { id: toastId });
        router.push(`/invoices/${invoiceId}`);
      } else {
        toast.error('Failed to convert quote to invoice', { id: toastId });
      }
    } catch {
      toast.error('Failed to convert quote to invoice', { id: toastId });
    }
  }

  async function handleDelete(q: Quotation) {
    setConfirmState({ open: true, id: q.id });
  }

  async function onDeleteConfirm() {
    if (!confirmState.id) return;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      await deleteQuotation(confirmState.id);
      toast.success('Quote deleted');
      load();
    } catch {
      toast.error('Failed to delete quote');
    } finally {
      setConfirmState({ open: false });
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading quotes...</p></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Quotes</h2>
          <p className="text-sm text-muted-foreground">Create and manage customer quotes</p>
        </div>
        <Button onClick={() => router.push('/quotes/new')} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" />
          New Quote
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search quotes..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={paginatedData}
              keyExtractor={(q) => q.id}
              mobileCardTitle={(q) => q.quotation_number}
              columns={[
                {
                  key: 'id',
                  header: 'Quote ID',
                  render: (q) => <span className="text-sm font-medium">{q.quotation_number}</span>,
                },
                {
                  key: 'client',
                  header: 'Client',
                  render: (q) => <span className="text-sm">{q.client_name || q.client_company || '—'}</span>,
                },
                {
                  key: 'value',
                  header: 'Value',
                  render: (q) => <span className="text-sm font-medium">{formatCurrency(q.amount)}</span>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (q) => (
                    <Badge variant="secondary" className={statusStyles[q.status] || ''}>
                      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                    </Badge>
                  ),
                },
                {
                  key: 'date',
                  header: 'Date',
                  hideOnMobile: true,
                  render: (q) => <span className="text-sm text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</span>,
                },
                {
                  key: 'valid',
                  header: 'Valid Until',
                  hideOnMobile: true,
                  render: (q) => <span className="text-sm text-muted-foreground">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</span>,
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'w-24',
                  render: (q) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Quote actions">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => router.push(`/quotes/${q.id}`)}>
                          <Pencil size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          const id = toast.loading('Generating PDF…');
                          try {
                            const pdf = await generateQuotationPdf(workspace?.id || user?.company_id || '', q, null);
                            await downloadPdf(pdf, `${q.quotation_number}.pdf`);
                            toast.success('Quote downloaded', { id });
                          } catch { toast.error('Failed to generate PDF', { id }); }
                        }}>
                          <Download size={14} className="mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          const id = toast.loading('Generating preview…');
                          try {
                            const pdf = await generateQuotationPdf(workspace?.id || user?.company_id || '', q, null);
                            const url = await openPdfPreview(pdf);
                            window.open(url, '_blank');
                            toast.dismiss(id);
                          } catch { toast.error('Failed to generate preview', { id }); }
                        }}>
                          <Eye size={14} className="mr-2" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleConvertToInvoice(q)}>
                          <FileText size={14} className="mr-2" /> Convert to Invoice
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(q)}>
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
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No quotes yet</p></CardContent></Card>
      )}

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ open })}
        title="Delete Quote"
        description="Are you sure you want to delete this quote? This action cannot be undone."
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

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Users, UserPlus, Building2, Search, X, Eye, Pencil, Trash2,
  MoreHorizontal, Mail, Phone, Calendar, Star,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataPagination } from '@/components/ui/data-pagination';
import { getContacts, deleteContact } from '@/lib/db/contacts/api';
import type { Contact } from '@/lib/db/types';
import { ContactDialog } from '@/components/dialogs/contact-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { useAuth } from '@/lib/firebase/auth-context';
import { toast } from 'sonner';

function isRecentlyAdded(contact: Contact): boolean {
  if (!contact.created_at) return false;
  const d = new Date(contact.created_at);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return d >= sevenDaysAgo;
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const PAGE_SIZE = 25;

export default function ContactsPage() {
  const { user, workspace } = useAuth();
  const companyId = workspace?.id || workspace?.id || '';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'cards'>('table');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; loading?: boolean }>({ open: false });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!companyId) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getContacts(companyId);
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) &&
            !c.email.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [contacts, search]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const hasActiveFilters = !!search;

  function clearFilters() {
    setSearch('');
  }

  const kpis = useMemo(() => {
    const total = contacts.length;
    const recently = contacts.filter(isRecentlyAdded).length;
    const primary = contacts.filter((c) => c.is_primary).length;
    return { total, recently, primary };
  }, [contacts]);

  function handleDelete(contact: Contact) {
    setConfirmState({ open: true, id: contact.contact_id });
  }

  async function onDeleteConfirm() {
    if (!confirmState.id || !companyId) return;
    setDeleting(confirmState.id);
    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      await deleteContact(companyId, confirmState.id);
      toast.success('Contact deleted successfully');
      load();
      setConfirmState({ open: false, loading: false });
    } catch {
      toast.error('Failed to delete contact');
      setConfirmState({ open: false, loading: false });
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading contacts...</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Contacts</h2>
          <p className="text-sm text-muted-foreground">Manage your contact relationships</p>
        </div>
        <Button onClick={() => { setEditingContact(null); setDialogOpen(true); }} disabled={!companyId} className="w-full sm:w-auto">
          <UserPlus size={16} className="mr-2" />
          Add Contact
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          title="Total Contacts"
          value={kpis.total.toLocaleString()}
          change={`${kpis.total > 0 ? 'All' : 'No'} contacts`}
          trend="neutral"
          icon={Users}
          description="in database"
        />
        <KpiCard
          title="Recently Added"
          value={kpis.recently.toLocaleString()}
          change="Last 7 days"
          trend={kpis.recently > 0 ? 'up' : 'neutral'}
          icon={UserPlus}
          description="new contacts"
        />
        <KpiCard
          title="Primary Contacts"
          value={kpis.primary.toLocaleString()}
          change="Decision makers"
          trend={kpis.primary > 0 ? 'up' : 'neutral'}
          icon={Star}
          description="tagged as primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X size={14} />
                Clear
              </Button>
            )}
          </div>
        </div>
        {/* View toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
              className="h-7 px-2 text-xs"
            >
              Table
            </Button>
            <Button
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('cards')}
              className="h-7 px-2 text-xs"
            >
              Cards
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filtered.length > 0 ? (
        view === 'table' ? (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Designation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((contact) => {
                  return (
                    <TableRow key={contact.contact_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              {contact.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{contact.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{contact.email}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{contact.phone || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{contact.designation || '—'}</TableCell>
                      <TableCell>
                        {contact.is_primary ? (
                          <Badge variant="default" className="text-[10px]">Primary</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(contact.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Contact actions">
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingContact(contact)}>
                              <Eye size={14} className="mr-2" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingContact(contact); setDialogOpen(true); }}>
                              <Pencil size={14} className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(contact)}
                              disabled={deleting === contact.contact_id}
                            >
                              <Trash2 size={14} className="mr-2" /> {deleting === contact.contact_id ? 'Deleting...' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {paginatedData.map((contact) => {
              return (
                <Card key={contact.contact_id} className="hover:shadow-sm transition-all duration-200 group">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {contact.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.designation || 'Contact'}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Contact actions">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingContact(contact)}>
                            <Eye size={14} className="mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditingContact(contact); setDialogOpen(true); }}>
                            <Pencil size={14} className="mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(contact)}
                            disabled={deleting === contact.contact_id}
                          >
                            <Trash2 size={14} className="mr-2" /> {deleting === contact.contact_id ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail size={14} />
                        <span className="truncate">{contact.email}</span>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone size={14} />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      {contact.is_primary && (
                        <div className="flex items-center gap-2 text-primary">
                          <Star size={14} />
                          <span>Primary Contact</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">{hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}</p></CardContent></Card>
      )}

      {filtered.length > PAGE_SIZE && (
        <DataPagination
          page={page}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* View Modal */}
      <ViewContactDialog contact={viewingContact} onClose={() => setViewingContact(null)} />

      {/* Edit / Create Dialog */}
      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        contact={editingContact}
        companyId={companyId}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ open })}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        onConfirm={onDeleteConfirm}
        loading={confirmState.loading}
      />
    </div>
  );
}

function ViewContactDialog({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  if (!contact) return null;

  return (
    <Dialog open={!!contact} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {contact.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            {contact.name}
            {contact.is_primary && <Badge variant="default" className="ml-2 text-[10px]">Primary</Badge>}
          </DialogTitle>
          <DialogDescription>{contact.designation || 'Contact details'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Phone size={15} className="text-muted-foreground shrink-0" />
            <span>{contact.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={15} className="text-muted-foreground shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={15} className="text-muted-foreground shrink-0" />
            <span>Added {formatDate(contact.created_at)}</span>
          </div>
          {contact.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
              <p className="text-sm">{contact.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

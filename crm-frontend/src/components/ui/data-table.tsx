'use client';

import { useMemo, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, Eye, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { POLL_SLOW_MS } from '@/lib/realtime';
import type { FetchRowsArgs, FetchRowsResult, PageCursor } from '@/lib/db';
import { EmptyState, ErrorState } from '@/components/ui/states';

export interface DataColumn<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => ReactNode;
}

export interface FilterDef {
  field: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T extends { id: string; legacy?: boolean }> {
  title: string;
  queryKey: string;
  fetchRows: (args: FetchRowsArgs) => Promise<FetchRowsResult<T>>;
  searchPlaceholder?: string;
  searchable?: boolean;
  filters?: FilterDef[];
  columns: DataColumn<T>[];
  pollMs?: number;
  defaultPageSize?: number;
  addLabel?: string;
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onPreview?: (row: T) => void;
  extraActions?: (row: T) => ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  legacyToggle?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function DataTable<T extends { id: string; legacy?: boolean }>({
  title,
  queryKey,
  fetchRows,
  searchPlaceholder = 'Search…',
  searchable = true,
  filters = [],
  columns,
  pollMs = POLL_SLOW_MS,
  defaultPageSize = 25,
  addLabel,
  onAdd,
  onEdit,
  onDelete,
  onPreview,
  extraActions,
  emptyTitle = 'No records',
  emptyHint,
  legacyToggle = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursorStack, setCursorStack] = useState<(PageCursor | null)[]>([null]);
  const [includeLegacy, setIncludeLegacy] = useState(false);

  const activeFilters = useMemo(
    () => Object.entries(filterVals).filter(([, v]) => v && v !== 'all') as [string, string][],
    [filterVals],
  );
  const filteredMode = search.trim() !== '' || activeFilters.length > 0;
  const cursor = filteredMode ? null : (cursorStack[pageIndex] ?? null);

  const key = useMemo(
    () =>
      JSON.stringify({
        queryKey,
        pageSize,
        search: search.trim().toLowerCase(),
        filters: activeFilters,
        cursor,
        pageIndex: filteredMode ? pageIndex : 0,
        includeLegacy,
      }),
    [queryKey, pageSize, search, activeFilters, cursor, pageIndex, filteredMode, includeLegacy],
  );

  const fetcher = async (): Promise<FetchRowsResult<T>> => {
    const k = JSON.parse(key) as {
      pageSize: number;
      search: string;
      filters: [string, string][];
      cursor: PageCursor | null;
      pageIndex: number;
      includeLegacy: boolean;
    };
    return fetchRows({
      pageSize: k.pageSize,
      cursor: k.cursor,
      pageIndex: k.pageIndex,
      search: k.search,
      filters: k.filters,
      includeLegacy: k.includeLegacy,
    });
  };

  const { data, error, isLoading, mutate } = useSWR<FetchRowsResult<T>, Error>(key, fetcher, {
    refreshInterval: pollMs,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    dedupingInterval: 5_000,
    keepPreviousData: true,
  });

  const resetPaging = () => {
    setPageIndex(0);
    setCursorStack([null]);
  };

  const goNext = () => {
    if (!data?.hasMore) return;
    if (filteredMode) {
      setPageIndex((i) => i + 1);
    } else {
      setCursorStack((s) => [...s.slice(0, pageIndex + 1), data.next]);
      setPageIndex((i) => i + 1);
    }
  };
  const goPrev = () => {
    if (pageIndex === 0) return;
    setPageIndex((i) => i - 1);
  };

  const hasActions = Boolean(onEdit || onDelete || onPreview || extraActions);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          {title}
          {typeof data?.total === 'number' && (
            <span className="text-sm font-normal text-muted-foreground">· {data.total} total</span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => mutate()} title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} />
          </Button>
          {onAdd && (
            <Button onClick={onAdd}>
              <Plus size={16} className="mr-2" />
              {addLabel ?? 'Add'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {searchable && (
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPaging();
                }}
                className="pl-9"
              />
            </div>
          )}
          {filters.map((f) => (
            <Select
              key={f.field}
              value={filterVals[f.field] ?? 'all'}
              onValueChange={(v) => {
                setFilterVals((p) => ({ ...p, [f.field]: v }));
                resetPaging();
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {f.label}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {legacyToggle && (
            <Button
              variant={includeLegacy ? 'secondary' : 'outline'}
              size="sm"
              className="sm:self-center"
              onClick={() => {
                setIncludeLegacy((v) => !v);
                resetPaging();
              }}
              title="Migrated old records live in Previous records sections; toggle to include them here"
            >
              Previous {includeLegacy ? 'on' : 'off'}
            </Button>
          )}
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyHint} />
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.className}>
                      {c.header}
                    </TableHead>
                  ))}
                  {hasActions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 items-center">
                          {row.legacy && <Badge variant="outline">Previous</Badge>}
                          {onPreview && (
                            <Button variant="ghost" size="icon" onClick={() => onPreview(row)} title="Preview" aria-label="Preview">
                              <Eye size={16} />
                            </Button>
                          )}
                          {extraActions?.(row)}
                          {onEdit && (
                            <Button variant="ghost" size="icon" onClick={() => onEdit(row)} title="Edit" aria-label="Edit">
                              <Pencil size={16} />
                            </Button>
                          )}
                          {onDelete && (
                            <Button variant="ghost" size="icon" onClick={() => onDelete(row)} title="Delete" aria-label="Delete">
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                resetPaging();
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>Page {pageIndex + 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={pageIndex === 0}>
              <ChevronLeft size={16} className="mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} disabled={!data?.hasMore}>
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

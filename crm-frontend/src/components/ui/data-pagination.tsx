'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useMemo } from 'react';

interface DataPaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function DataPagination({ page, totalItems, pageSize, onPageChange }: DataPaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft size={16} />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </Button>
        {pageNumbers.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="px-1 text-muted-foreground">...</span>
          ) : (
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => onPageChange(p as number)}>
              {p}
            </Button>
          )
        )}
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight size={16} />
        </Button>
      </div>
    </div>
  );
}

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  cellClassName?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  mobileCardTitle?: (item: T) => string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  mobileCardTitle,
  emptyMessage = 'No data found',
  className,
  onRowClick,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const visibleColumns = columns.filter((c) => !c.hideOnMobile);

  return (
    <>
      {/* Desktop table */}
      <div className={cn('hidden sm:block overflow-x-auto', className)}>
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-3 whitespace-nowrap',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr 
                key={keyExtractor(item)} 
                className={cn("border-b last:border-0 hover:bg-muted/50 transition-colors", onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(item)}
              >
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-3 text-sm whitespace-nowrap',
                      col.cellClassName
                    )}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className={cn('sm:hidden space-y-3', className)}>
        {data.map((item) => (
          <div 
            key={keyExtractor(item)} 
            className={cn("rounded-lg border bg-card p-4 space-y-3", onRowClick && "cursor-pointer")}
            onClick={() => onRowClick?.(item)}
          >
            {mobileCardTitle && (
              <div className="text-sm font-semibold text-foreground">
                {mobileCardTitle(item)}
              </div>
            )}
            {visibleColumns.map((col) => (
              <div key={col.key} className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {col.header}
                </span>
                <span className="text-sm text-right truncate">
                  {col.render(item)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  /** Unique per page, e.g. "clients-detail". */
  page: string;
  /** Panel id, e.g. "info". State is remembered in localStorage. */
  panelId: string;
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

function storageKey(page: string, panelId: string): string {
  return `lentone:collapsed:${page}:${panelId}`;
}

export function CollapsibleCard({ page, panelId, title, defaultOpen = true, children, className }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(page, panelId));
      if (raw !== null) setOpen(raw === '1');
    } catch {
      // storage unavailable — keep default
    }
    setReady(true);
  }, [page, panelId]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey(page, panelId), next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={open ? 'Minimize panel' : 'Expand panel'} title={open ? 'Minimize' : 'Expand'}>
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </Button>
      </CardHeader>
      {(!ready || open) && <CardContent className={cn(!open && 'hidden')}>{children}</CardContent>}
    </Card>
  );
}

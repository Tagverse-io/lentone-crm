'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  description?: string;
}

export function KpiCard({ title, value, change, trend, icon: Icon, description }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-5 hover:shadow-sm transition-all duration-200 animate-fadeIn">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
                trend === 'up' && 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
                trend === 'down' && 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
                trend === 'neutral' && 'text-muted-foreground bg-muted'
              )}
            >
              {trend === 'up' && <TrendingUp size={12} />}
              {trend === 'down' && <TrendingDown size={12} />}
              {change}
            </span>
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
      </div>
    </div>
  );
}

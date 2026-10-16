'use client';

// shadcn/ui-style chart primitives backed by recharts (kept in the same
// theme: card background, muted grid, primary bars).
import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface MonthlyPoint {
  month: string;
  invoiced: number;
  collected: number;
  outstanding: number;
}

function moneyShort(n: number): string {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

export function MonthlyFinanceChart({
  data,
  title = 'Monthly revenue',
  description,
  className,
}: {
  data: MonthlyPoint[];
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No finance data yet.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={moneyShort} tickLine={false} axisLine={false} className="text-xs" width={64} />
                <Tooltip
                  formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
                <Bar dataKey="invoiced" name="Invoiced" fill="var(--brand-primary, #4f46e5)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis };

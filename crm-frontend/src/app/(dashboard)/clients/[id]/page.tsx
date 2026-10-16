'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  getCollection,
  invoicesForClient,
  type Client,
  type Invoice,
} from '@/lib/db';
import { LoadingState } from '@/components/ui/states';

function money(n: number): string {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [clients, invoices] = await Promise.all([
          getCollection<Client>('clients'),
          getCollection<Invoice>('invoices'),
        ]);
        const found = clients.find((c) => c.id === id) ?? null;
        setClient(found);
        setHistory(found ? invoicesForClient(invoices, found.id) : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingState label="Loading client…" />;
  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild><Link href="/clients"><ArrowLeft size={16} className="mr-2" />Clients</Link></Button>
        <p className="text-sm text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  const total = history.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-4">
      <Button variant="outline" asChild><Link href="/clients"><ArrowLeft size={16} className="mr-2" />Clients</Link></Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            {client.name}
            <Badge variant="secondary">{client.category}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Phone: </span>{client.phone || '—'}</div>
          <div><span className="text-muted-foreground">Email: </span>{client.email || '—'}</div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Address: </span>{client.address || '—'}</div>
          {client.mapsUrl && (
            <div className="sm:col-span-2">
              <a href={client.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View location
              </a>
            </div>
          )}
          {client.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes: </span>{client.notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase history <span className="text-sm font-normal text-muted-foreground">· {history.length} invoices · {money(total)}</span></CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No purchases yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.number}</TableCell>
                      <TableCell>{i.createdAt.slice(0, 10)}</TableCell>
                      <TableCell><Badge variant={i.status === 'Paid' ? 'default' : 'secondary'}>{i.status}</Badge></TableCell>
                      <TableCell className="text-right">{money(i.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

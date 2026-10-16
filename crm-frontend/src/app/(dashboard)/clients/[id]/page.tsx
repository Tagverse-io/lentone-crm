'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  filterEqual,
  fmtMoney,
  getItem,
  splitLegacy,
  type Client,
  type Delivery,
  type Invoice,
  type Order,
} from '@/lib/db';
import { POLL_SLOW_MS, useAppSettings } from '@/lib/realtime';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { HistoryTimeline } from '@/components/history-timeline';
import { CustomFieldsView } from '@/components/custom-fields';
import { LoadingState } from '@/components/ui/states';

function PrevSection({ rows, render }: { rows: { id: string }[]; render: (rows: never[]) => React.ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <CollapsibleCard page="client-detail" panelId={`prev-${rows[0]?.id ?? 'x'}`} title={<span className="flex items-center gap-2">Previous records <Badge variant="secondary">{rows.length}</Badge></span>} defaultOpen={false}>
      {render(rows as never[])}
    </CollapsibleCard>
  );
}

function SimpleTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            {head.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const customDefs = settings?.customFields?.clients ?? [];

  const { data: client, isLoading: loadingClient } = useSWR(`client:${id}`, () => getItem<Client>('clients', id), {
    refreshInterval: POLL_SLOW_MS,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
  });
  const { data: orders = [] } = useSWR(`client-orders:${id}`, () => filterEqual<Order>('orders', 'clientId', id), {
    refreshInterval: POLL_SLOW_MS,
    refreshWhenHidden: false,
  });
  const { data: invoices = [] } = useSWR(`client-invoices:${id}`, () => filterEqual<Invoice>('invoices', 'clientId', id), {
    refreshInterval: POLL_SLOW_MS,
    refreshWhenHidden: false,
  });
  const { data: deliveries = [] } = useSWR(`client-deliveries:${id}`, () => filterEqual<Delivery>('deliveries', 'clientId', id), {
    refreshInterval: POLL_SLOW_MS,
    refreshWhenHidden: false,
  });

  if (loadingClient) return <LoadingState label="Loading client…" />;
  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/clients">
            <ArrowLeft size={16} className="mr-2" />
            Clients
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  const ord = splitLegacy(orders);
  const inv = splitLegacy(invoices);
  const del = splitLegacy(deliveries);
  const purchased = inv.current.reduce((s, i) => s + (i.total || 0), 0);

  const orderRows = (rows: Order[]) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-6">No orders.</p>
    ) : (
      <SimpleTable head={['Number', 'Status', 'Total']}>
        {rows.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-medium">{o.number}</TableCell>
            <TableCell>
              <Badge variant="secondary">{o.status}</Badge>
            </TableCell>
            <TableCell>{fmtMoney(o.total, currency)}</TableCell>
          </TableRow>
        ))}
      </SimpleTable>
    );

  const invoiceRows = (rows: Invoice[]) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-6">No invoices.</p>
    ) : (
      <SimpleTable head={['Number', 'Status', 'Paid', 'Total']}>
        {rows.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="font-medium">{i.number}</TableCell>
            <TableCell>
              <Badge variant={i.status === 'Paid' ? 'default' : 'secondary'}>{i.status}</Badge>
            </TableCell>
            <TableCell>{fmtMoney(i.amountPaid, currency)}</TableCell>
            <TableCell>{fmtMoney(i.total, currency)}</TableCell>
          </TableRow>
        ))}
      </SimpleTable>
    );

  const deliveryRows = (rows: Delivery[]) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-6">No deliveries.</p>
    ) : (
      <SimpleTable head={['Status', 'Worker', 'Map']}>
        {rows.map((d) => (
          <TableRow key={d.id}>
            <TableCell>
              <Badge variant={d.status === 'Delivered' ? 'default' : 'secondary'}>{d.status}</Badge>
            </TableCell>
            <TableCell>{d.workerName || '—'}</TableCell>
            <TableCell>
              {d.mapsUrl ? (
                <a href={d.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                  Open map <ExternalLink size={14} />
                </a>
              ) : (
                '—'
              )}
            </TableCell>
          </TableRow>
        ))}
      </SimpleTable>
    );

  return (
    <div className="space-y-4">
      <Button variant="outline" asChild>
        <Link href="/clients">
          <ArrowLeft size={16} className="mr-2" />
          Clients
        </Link>
      </Button>

      <Card>
        <CardContent className="pt-4">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            {client.name || '(blank name)'}
            <Badge variant="secondary">{client.category || '—'}</Badge>
            {client.legacy && <Badge variant="outline">Previous</Badge>}
          </h1>
        </CardContent>
      </Card>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="orders">Orders ({ord.current.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({inv.current.length})</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries ({del.current.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-3">
          <CollapsibleCard page="client-detail" panelId="info" title="Client info">
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Contact: </span>{client.contactPerson || '—'}</div>
              <div><span className="text-muted-foreground">Phone: </span>{client.phone || '—'}</div>
              <div><span className="text-muted-foreground">Email: </span>{client.email || '—'}</div>
              <div><span className="text-muted-foreground">GSTIN: </span>{client.gstin || '—'}</div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Address: </span>{client.address || '—'}</div>
              <div className="sm:col-span-2">
                {client.mapsUrl ? (
                  <a href={client.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Open map <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Map link: —</span>
                )}
              </div>
              {client.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes: </span>{client.notes}</div>}
              <CustomFieldsView defs={customDefs} values={client.custom} />
            </div>
          </CollapsibleCard>
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-3">
          <CollapsibleCard page="client-detail" panelId="orders" title={`Orders · ${ord.current.length}`}>
            {orderRows(ord.current)}
          </CollapsibleCard>
          {ord.previous.length > 0 && <PrevSection rows={ord.previous} render={(r) => orderRows(r as Order[])} />}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-3">
          <CollapsibleCard page="client-detail" panelId="invoices" title={`Purchase history · ${inv.current.length} invoices · ${fmtMoney(purchased, currency)}`}>
            {invoiceRows(inv.current)}
          </CollapsibleCard>
          {inv.previous.length > 0 && <PrevSection rows={inv.previous} render={(r) => invoiceRows(r as Invoice[])} />}
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4 space-y-3">
          <CollapsibleCard page="client-detail" panelId="deliveries" title={`Deliveries · ${del.current.length}`}>
            {deliveryRows(del.current)}
          </CollapsibleCard>
          {del.previous.length > 0 && <PrevSection rows={del.previous} render={(r) => deliveryRows(r as Delivery[])} />}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          <CollapsibleCard page="client-detail" panelId="history" title="History timeline">
            <HistoryTimeline entity="clients" id={id} />
          </CollapsibleCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

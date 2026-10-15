'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { DocumentMeta } from './types';

interface DocumentHeaderProps {
  meta: DocumentMeta;
  onMetaChange: (meta: Partial<DocumentMeta>) => void;
  docType: 'quote' | 'invoice';
  statusColor?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-orange-100 text-orange-700',
  converted: 'bg-green-100 text-green-700',
};

export function DocumentHeader({
  meta,
  onMetaChange,
  docType,
  statusColor,
}: DocumentHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{docType === 'quote' ? 'Quotation Details' : 'Invoice Details'}</h2>
          <p className="text-sm text-muted-foreground">Configure the document number and dates.</p>
        </div>
        {meta.status && (
          <Badge className={statusColor || STATUS_COLORS[meta.status] || 'bg-gray-100 text-gray-700'}>
            {meta.status.replace('_', ' ').toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Document Number</Label>
          <Input
            value={meta.document_number}
            onChange={(e) => onMetaChange({ document_number: e.target.value })}
            placeholder="QTE-2024-001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{docType === 'quote' ? 'Issue Date' : 'Invoice Date'}</Label>
          <Input
            type="date"
            value={meta.issue_date}
            onChange={(e) => onMetaChange({ issue_date: e.target.value })}
          />
        </div>
        {docType === 'quote' ? (
          <div className="space-y-2">
            <Label>Valid Until</Label>
            <Input
              type="date"
              value={meta.valid_until || ''}
              onChange={(e) => onMetaChange({ valid_until: e.target.value })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={meta.due_date || ''}
              onChange={(e) => onMetaChange({ due_date: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={meta.status} onValueChange={(v) => onMetaChange({ status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {docType === 'quote' ? (
                <>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={meta.currency} onValueChange={(v) => onMetaChange({ currency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR (₹)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
              <SelectItem value="AED">AED (د.إ)</SelectItem>
              <SelectItem value="SGD">SGD (S$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

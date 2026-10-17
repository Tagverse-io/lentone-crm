'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { DocumentNotes } from './types';

interface NotesSectionProps {
  notes: DocumentNotes;
  onNotesChange: (notes: Partial<DocumentNotes>) => void;
  docType: 'quote' | 'invoice';
}

export function NotesSection({ notes, onNotesChange, docType }: NotesSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Notes & Terms</h2>
        <p className="text-sm text-muted-foreground">
          Add {docType === 'quote' ? 'proposal notes' : 'invoice notes'} and terms & conditions.
        </p>
      </div>

      <div className="space-y-2">
        <Label>{docType === 'quote' ? 'Proposal Notes' : 'Invoice Notes'}</Label>
        <Textarea
          value={notes.notes}
          onChange={(e) => onNotesChange({ notes: e.target.value })}
          placeholder={
            docType === 'quote'
              ? 'Thank you for considering our proposal. We look forward to working with you.'
              : 'Payment is due within the specified terms. Thank you for your business.'
          }
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Terms & Conditions</Label>
        <Textarea
          value={notes.terms}
          onChange={(e) => onNotesChange({ terms: e.target.value })}
          placeholder="1. This quote is valid for 30 days from the date of issue.&#10;2. Prices are exclusive of applicable taxes.&#10;3. Payment terms as specified above."
          rows={5}
        />
      </div>

      {docType === 'quote' && (
        <div className="space-y-2">
          <Label>Delivery Timeline</Label>
          <Textarea
            value={notes.delivery_timeline || ''}
            onChange={(e) => onNotesChange({ delivery_timeline: e.target.value })}
            placeholder="Estimated delivery: 2-3 weeks from order confirmation."
            rows={2}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Internal Notes (not visible on document)</Label>
        <Textarea
          value={notes.internal_notes || ''}
          onChange={(e) => onNotesChange({ internal_notes: e.target.value })}
          placeholder="Private notes for your team..."
          rows={2}
          className="bg-muted/50"
        />
      </div>
    </div>
  );
}

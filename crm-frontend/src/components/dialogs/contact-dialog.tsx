import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { createContact, updateContact } from '@/lib/db/contacts/api';
import type { Contact } from '@/lib/db/types';

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  contact?: Contact | null;
  companyId: string;
}

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  designation: string;
  is_primary: boolean;
  notes: string;
}

const defaultForm: ContactForm = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  is_primary: false,
  notes: '',
};

function contactToForm(c: Contact): ContactForm {
  return {
    name: c.name,
    email: c.email,
    phone: c.phone || '',
    designation: c.designation || '',
    is_primary: c.is_primary || false,
    notes: c.notes || '',
  };
}

export function ContactDialog({ open, onOpenChange, onSaved, contact, companyId }: ContactDialogProps) {
  const [form, setForm] = useState<ContactForm>({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setForm(contactToForm(contact));
    } else {
      setForm({ ...defaultForm });
    }
  }, [contact, open]);

  function set<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      toast.error('Workspace is still loading');
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        workspace_id: companyId,
        phone: form.phone || '',
        designation: form.designation || '',
        is_primary: form.is_primary,
        notes: form.notes || '',
      };

      if (contact) {
        await updateContact(companyId, contact.contact_id, payload);
        toast.success('Contact updated');
      } else {
        await createContact(companyId, payload);
        toast.success('Contact created');
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(contact ? 'Failed to update contact' : 'Failed to create contact');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'New Contact'}</DialogTitle>
          <DialogDescription>
            {contact ? 'Update the details for this contact.' : 'Add a new contact to your CRM.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="John Doe" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="john@example.com" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 234 567 8900" />
            </div>
            <div>
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="CEO, Manager..." />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="is_primary" className="text-base">Primary Contact</Label>
                <p className="text-xs text-muted-foreground">Mark this contact as the primary contact for their company.</p>
              </div>
              <Switch id="is_primary" checked={form.is_primary} onCheckedChange={(c) => set('is_primary', c)} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional notes about this contact..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (contact ? 'Update Contact' : 'Create Contact')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAuth } from '@/lib/firebase/auth-context';
import { getLeads } from '@/lib/firebase/database';
import type { Lead } from '@/lib/db/types';
import type { DocumentClient } from './types';

interface ClientSectionProps {
  client: DocumentClient;
  onClientChange: (client: Partial<DocumentClient>) => void;
}

export function ClientSection({ client, onClientChange }: ClientSectionProps) {
  const { workspace, user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (workspace?.id) {
      getLeads(workspace?.id).then(setLeads);
    }
  }, [workspace?.id]);

  const options = Array.from(
    new Map(
      leads
        .filter((l) => l.company || l.name)
        .map((l) => {
          const val = l.company || l.name;
          return [val, { label: val, value: val, group: 'Saved Clients' }];
        })
    ).values()
  );

  const handleCompanySelect = (val: string) => {
    const lead = leads.find((l) => l.company === val || l.name === val);
    if (lead) {
      onClientChange({
        company: val,
        contact_person: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
      });
    } else {
      onClientChange({ company: val });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Client Information</h2>
        <p className="text-sm text-muted-foreground">Enter the client or recipient details.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company Name *</Label>
          <SearchableSelect
            options={options}
            value={client.company}
            onValueChange={handleCompanySelect}
            placeholder="Select or type new..."
            searchPlaceholder="Search clients..."
            allowCustom={true}
          />
        </div>
        <div className="space-y-2">
          <Label>Contact Person</Label>
          <Input
            value={client.contact_person}
            onChange={(e) => onClientChange({ contact_person: e.target.value })}
            placeholder="John Doe"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input
            type="email"
            value={client.email}
            onChange={(e) => onClientChange({ email: e.target.value })}
            placeholder="client@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={client.phone}
            onChange={(e) => onClientChange({ phone: e.target.value })}
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea
          value={client.address || ''}
          onChange={(e) => onClientChange({ address: e.target.value })}
          placeholder="123 Business Park, Sector 5&#10;Mumbai, Maharashtra 400001"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>GSTIN / Tax ID</Label>
        <Input
          value={client.gstin || ''}
          onChange={(e) => onClientChange({ gstin: e.target.value })}
          placeholder="27AABCU9603R1ZM"
        />
      </div>
    </div>
  );
}

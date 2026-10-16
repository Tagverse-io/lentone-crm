'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CustomFieldDef, CustomValue } from '@/lib/db';

/** Render admin-defined custom fields as form inputs bound to record.custom. */
export function CustomFieldsForm({
  defs,
  values,
  onChange,
}: {
  defs: CustomFieldDef[];
  values: Record<string, CustomValue>;
  onChange: (values: Record<string, CustomValue>) => void;
}) {
  if (defs.length === 0) return null;
  return (
    <div className="grid gap-3">
      {defs.map((d) => (
        <div key={d.key} className="grid gap-1.5">
          <Label>{d.label}</Label>
          {d.type === 'select' ? (
            <Select
              value={String(values[d.key] ?? '')}
              onValueChange={(v) => onChange({ ...values, [d.key]: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${d.label}`} />
              </SelectTrigger>
              <SelectContent>
                {(d.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={d.type === 'number' ? 'number' : d.type === 'date' ? 'date' : 'text'}
              value={String(values[d.key] ?? '')}
              onChange={(e) =>
                onChange({
                  ...values,
                  [d.key]: d.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value,
                })
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Inline "Label: value" list for detail views and exports. */
export function CustomFieldsView({ defs, values }: { defs: CustomFieldDef[]; values?: Record<string, CustomValue> }) {
  if (!values || defs.length === 0) return null;
  const shown = defs.filter((d) => values[d.key] !== undefined && values[d.key] !== '' && values[d.key] !== null);
  if (shown.length === 0) return null;
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-sm">
      {shown.map((d) => (
        <div key={d.key}>
          <span className="text-muted-foreground">{d.label}: </span>
          {String(values[d.key])}
        </div>
      ))}
    </div>
  );
}

/** Header labels for table columns (used with row.custom?.[key]). */
export function customColumns<T extends { custom?: Record<string, CustomValue> }>(defs: CustomFieldDef[]): {
  key: string;
  header: string;
  render: (row: T) => string;
}[] {
  return defs.map((d) => ({
    key: `custom.${d.key}`,
    header: d.label,
    render: (row: T) => {
      const v = row.custom?.[d.key];
      return v === undefined || v === null || v === '' ? '—' : String(v);
    },
  }));
}

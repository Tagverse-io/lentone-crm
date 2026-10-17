'use client';

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SearchableSelectOption {
  label: string;
  value: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
  groups?: string[];
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
  allowCustom = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [customValue, setCustomValue] = React.useState('');
  const [showCustom, setShowCustom] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : value || placeholder;

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, search]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onValueChange(customValue.trim());
      setOpen(false);
      setShowCustom(false);
      setCustomValue('');
    }
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-full justify-between text-left font-normal h-9',
          !value && 'text-muted-foreground'
        )}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 overflow-hidden flex flex-col">
          <div className="flex items-center border-b px-2 py-1.5 bg-muted/40">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-48 p-1">
            {showCustom ? (
              <div className="flex items-center gap-1.5 p-1.5">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomSubmit();
                    if (e.key === 'Escape') setShowCustom(false);
                  }}
                  placeholder="Enter custom value..."
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none"
                  autoFocus
                />
                <Button size="sm" type="button" onClick={handleCustomSubmit} className="h-7 text-xs px-2">
                  Add
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCustom(false)}
                  className="h-7 text-xs px-2"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                {filtered.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted-foreground">{emptyMessage}</div>
                ) : (
                  filtered.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                        value === option.value && 'bg-accent/50 font-medium'
                      )}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </div>
                  ))
                )}

                {allowCustom && (
                  <div
                    onClick={() => setShowCustom(true)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs text-primary font-medium hover:bg-accent border-t mt-1"
                  >
                    <Search className="mr-2 h-3.5 w-3.5" />
                    Enter custom value...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SimpleSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  disabled = false,
  className,
}: {
  options: { label: string; value: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      allowCustom={false}
    />
  );
}

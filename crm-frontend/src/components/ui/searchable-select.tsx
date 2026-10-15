'use client';

import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  groups,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [customValue, setCustomValue] = React.useState('');
  const [showCustom, setShowCustom] = React.useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : value || placeholder;

  const groupedOptions = React.useMemo(() => {
    if (!groups || groups.length === 0) return { '': options };
    const grouped: Record<string, SearchableSelectOption[]> = {};
    groups.forEach((g) => (grouped[g] = []));
    options.forEach((opt) => {
      const group = opt.group || '';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(opt);
    });
    return grouped;
  }, [options, groups]);

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === '__custom__') {
      setShowCustom(true);
      return;
    }
    onValueChange(selectedValue);
    setOpen(false);
    setShowCustom(false);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onValueChange(customValue.trim());
      setOpen(false);
      setShowCustom(false);
      setCustomValue('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {showCustom ? (
              <CommandGroup>
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomSubmit();
                      if (e.key === 'Escape') {
                        setShowCustom(false);
                        setCustomValue('');
                      }
                    }}
                    placeholder="Enter custom value..."
                    className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCustomSubmit}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowCustom(false);
                      setCustomValue('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CommandGroup>
            ) : (
              Object.entries(groupedOptions).map(([group, groupOptions]) =>
                groupOptions.length > 0 ? (
                  <CommandGroup key={group} heading={group || undefined}>
                    {groupOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === option.value ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null
              )
            )}
            {allowCustom && !showCustom && (
              <CommandGroup>
                <CommandItem value="__custom__" onSelect={() => handleSelect('__custom__')}>
                  <Search className="mr-2 h-4 w-4" />
                  Enter custom value...
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SimpleSelectProps {
  options: { label: string; value: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SimpleSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  disabled = false,
  className,
}: SimpleSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandList>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === option.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

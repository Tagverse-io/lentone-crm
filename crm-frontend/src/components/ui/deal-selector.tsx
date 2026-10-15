'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Deal } from '@/lib/db/types';
import { getDeals, getCompanyDeals, searchDeals } from '@/lib/db/deals/api';
import { useAuth } from '@/lib/firebase/auth-context';

interface DealSelectorProps {
  companyId?: string; // Filter by company
  value?: string;
  onChange: (dealId: string, deal: Deal | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showCreateButton?: boolean;
  onCreateNew?: () => void;
  className?: string;
}

export function DealSelector({
  companyId,
  value,
  onChange,
  placeholder = 'Select deal...',
  disabled = false,
  showCreateButton = false,
  onCreateNew,
  className,
}: DealSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [deals, setDeals] = React.useState<Deal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  React.useEffect(() => {
    if (!workspaceId) return;
    
    const loadDeals = async () => {
      setLoading(true);
      try {
        const data = companyId 
          ? await getCompanyDeals(workspaceId, companyId)
          : await getDeals(workspaceId);
        setDeals(data);
      } catch (error) {
        console.error('Error loading deals:', error);
      }
      setLoading(false);
    };
    
    loadDeals();
  }, [workspaceId, companyId]);

  const filteredDeals = React.useMemo(() => {
    if (!search) return deals;
    const lowerSearch = search.toLowerCase();
    return deals.filter(deal => 
      deal.title.toLowerCase().includes(lowerSearch)
    );
  }, [deals, search]);

  const selectedDeal = deals.find(d => d.deal_id === value);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !selectedDeal && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {selectedDeal ? selectedDeal.title : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Search deals..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No deal found.'}
            </CommandEmpty>
            <CommandGroup>
              {filteredDeals.map((deal) => (
                <CommandItem
                  key={deal.deal_id}
                  value={deal.deal_id}
                  onSelect={(currentValue) => {
                    const deal = deals.find(d => d.deal_id === currentValue);
                    onChange(currentValue, deal || null);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === deal.deal_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{deal.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(deal.value)}
                      {deal.status && ` • ${deal.status}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreateButton && onCreateNew && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    onCreateNew();
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new deal
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

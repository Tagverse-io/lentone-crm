'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
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
import { Company } from '@/lib/db/types';
import { getCompanies, searchCompanies } from '@/lib/db/companies/api';
import { useAuth } from '@/lib/firebase/auth-context';

interface CompanySelectorProps {
  value?: string;
  onChange: (companyId: string, company: Company | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showCreateButton?: boolean;
  onCreateNew?: () => void;
  className?: string;
}

export function CompanySelector({
  value,
  onChange,
  placeholder = 'Select company...',
  disabled = false,
  showCreateButton = false,
  onCreateNew,
  className,
}: CompanySelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  React.useEffect(() => {
    if (!workspaceId) return;
    
    const loadCompanies = async () => {
      setLoading(true);
      try {
        const data = await getCompanies(workspaceId);
        setCompanies(data);
      } catch (error) {
        console.error('Error loading companies:', error);
      }
      setLoading(false);
    };
    
    loadCompanies();
  }, [workspaceId]);

  const filteredCompanies = React.useMemo(() => {
    if (!search) return companies;
    const lowerSearch = search.toLowerCase();
    return companies.filter(company => 
      company.name.toLowerCase().includes(lowerSearch) ||
      (company.legal_name && company.legal_name.toLowerCase().includes(lowerSearch))
    );
  }, [companies, search]);

  const selectedCompany = companies.find(c => c.workspace_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !selectedCompany && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {selectedCompany ? selectedCompany.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Search companies..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No company found.'}
            </CommandEmpty>
            <CommandGroup>
              {filteredCompanies.map((company) => (
                <CommandItem
                  key={company.workspace_id}
                  value={company.workspace_id}
                  onSelect={(currentValue) => {
                    const company = companies.find(c => c.workspace_id === currentValue);
                    onChange(currentValue, company || null);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === company.workspace_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{company.name}</span>
                    {company.legal_name && company.legal_name !== company.name && (
                      <span className="text-xs text-muted-foreground">
                        {company.legal_name}
                      </span>
                    )}
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
                  Create new company
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

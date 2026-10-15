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
import { Contact } from '@/lib/db/types';
import { getContacts, getCompanyContacts, searchContacts } from '@/lib/db/contacts/api';
import { useAuth } from '@/lib/firebase/auth-context';

interface ContactSelectorProps {
  companyId?: string; // Filter by company
  value?: string;
  onChange: (contactId: string, contact: Contact | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showCreateButton?: boolean;
  onCreateNew?: () => void;
  className?: string;
}

export function ContactSelector({
  companyId,
  value,
  onChange,
  placeholder = 'Select contact...',
  disabled = false,
  showCreateButton = false,
  onCreateNew,
  className,
}: ContactSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  React.useEffect(() => {
    if (!workspaceId) return;
    
    const loadContacts = async () => {
      setLoading(true);
      try {
        const data = companyId 
          ? await getCompanyContacts(workspaceId, companyId)
          : await getContacts(workspaceId);
        setContacts(data);
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
      setLoading(false);
    };
    
    loadContacts();
  }, [workspaceId, companyId]);

  const filteredContacts = React.useMemo(() => {
    if (!search) return contacts;
    const lowerSearch = search.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(lowerSearch) ||
      contact.email.toLowerCase().includes(lowerSearch)
    );
  }, [contacts, search]);

  const selectedContact = contacts.find(c => c.contact_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !selectedContact && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {selectedContact ? selectedContact.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Search contacts..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No contact found.'}
            </CommandEmpty>
            <CommandGroup>
              {filteredContacts.map((contact) => (
                <CommandItem
                  key={contact.contact_id}
                  value={contact.contact_id}
                  onSelect={(currentValue) => {
                    const contact = contacts.find(c => c.contact_id === currentValue);
                    onChange(currentValue, contact || null);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === contact.contact_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{contact.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {contact.email}
                      {contact.designation && ` • ${contact.designation}`}
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
                  Create new contact
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Command, FileText, Users, DollarSign, Briefcase, ArrowRight, CheckCircle, Target, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getLeads, getProjects, getTasks } from '@/lib/firebase/database';
import { useAuth } from '@/lib/firebase/auth-context';

interface SearchResult {
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  category: string;
}

const staticItems: SearchResult[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Briefcase, category: 'Pages' },
  { label: 'Leads', href: '/leads', icon: Users, category: 'CRM' },
  { label: 'Contacts', href: '/contacts', icon: Users, category: 'CRM' },

  { label: 'Quotes', href: '/quotes', icon: FileText, category: 'Revenue' },
  { label: 'Invoices', href: '/invoices', icon: FileText, category: 'Revenue' },
  { label: 'Contracts', href: '/contracts', icon: FileText, category: 'Revenue' },
  { label: 'Projects', href: '/projects', icon: Briefcase, category: 'Collaboration' },
  { label: 'Tasks', href: '/tasks', icon: FileText, category: 'Collaboration' },
  { label: 'Analytics', href: '/analytics', icon: FileText, category: 'Analytics' },
  { label: 'Reports', href: '/reports', icon: FileText, category: 'Analytics' },
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dynamicResults, setDynamicResults] = useState<SearchResult[]>([]);
  const { workspace, user } = useAuth();

  useEffect(() => {
    if (!open || !workspace?.id) return;
    const load = async () => {
      try {
        const [leads, projects, tasks] = await Promise.all([
          getLeads(workspace?.id),
          getProjects(workspace?.id),
          getTasks(workspace?.id),
        ]);
        const results: SearchResult[] = [
          ...leads.map((l) => ({
            label: l.name,
            description: l.email,
            href: '/leads',
            icon: Target,
            category: 'Leads',
          })),
          ...projects.map((p) => ({
            label: p.title,
            description: p.status,
            href: '/projects',
            icon: Briefcase,
            category: 'Projects',
          })),
          ...tasks.map((t) => ({
            label: t.title,
            description: t.status,
            href: '/tasks',
            icon: CheckCircle,
            category: 'Tasks',
          })),
        ];
        setDynamicResults(results);
      } catch {
        setDynamicResults([]);
      }
    };
    load();
  }, [open]);

  const allItems = [...dynamicResults, ...staticItems];

  const filtered = query
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
      )
    : allItems;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      router.push(filtered[selectedIndex].href);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl top-[15%] translate-y-0 p-0 gap-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search across pages, leads, projects, and tasks</DialogDescription>
        <div className="flex items-center gap-3 px-4 border-b">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, people, deals..."
            className="flex-1 h-12 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border bg-muted text-muted-foreground">
            <Command size={10} />K
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No results found
            </div>
          )}
          {filtered.map((item, index) => (
            <button
              key={`${item.category}-${item.label}-${index}`}
              onClick={() => {
                router.push(item.href);
                onOpenChange(false);
              }}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors',
                index === selectedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              )}
            >
              <item.icon size={16} className="shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <span className="truncate block">{item.label}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground truncate block">{item.description}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{item.category}</span>
              <ArrowRight size={14} className="text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

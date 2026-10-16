'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  HelpCircle,
  Settings,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import { ThemeSwitcher } from './theme-switcher';
import { useSidebar } from './sidebar-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/firebase/auth-context';
import { brand } from '@/brand.config';

const breadcrumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clients',
  '/leads': 'Lead Management',
  '/field-force': 'Field Force',
  '/deliveries': 'Delivery',
  '/quotes': 'Quotations',
  '/invoices': 'Invoices',
  '/settings': 'Settings',
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, workspaceRole, signOut } = useAuth();

  const { setMobileOpen } = useSidebar();

  const title = breadcrumbs[pathname || ''] || 'Dashboard';

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center justify-between h-full px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0 -ml-1"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </Button>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground" asChild>
                  <a href={`mailto:${brand.supportEmail}`} target="_blank" rel="noopener noreferrer">
                    <HelpCircle size={18} />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Help & Support</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ThemeSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start text-sm">
                  <span className="font-medium leading-none">{user?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground leading-none mt-1">
                    {workspaceRole ? workspaceRole.charAt(0).toUpperCase() + workspaceRole.slice(1) : '—'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email || '—'}</span>
                  {workspace?.name && (
                    <span className="text-xs font-medium mt-1 truncate" title={workspace.name}>
                      {workspace.name}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <User size={16} className="mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings size={16} className="mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={signOut}>
                <LogOut size={16} className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

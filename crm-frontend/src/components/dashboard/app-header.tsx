'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  Menu,
  HelpCircle,
  Settings,
  LogOut,
  User,
  ChevronDown,
  X,
  Briefcase,
  Check as CheckIcon,
  UserPlus,
} from 'lucide-react';
import { ThemeSwitcher } from './theme-switcher';
import { GlobalSearch } from './global-search';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/lib/firebase/auth-context';
import { brand } from '@/brand.config';
import { getNotifications, markNotificationAsRead } from '@/lib/firebase/database';
import type { Notification } from '@/lib/db/types';
import { format } from 'date-fns';
import { getPendingInvitesByEmail, updateInviteStatus, acceptWorkspaceInvite, type Invite } from '@/lib/workspace/invites';
import { createWorkspaceMember } from '@/lib/workspace/api';
import { toast } from 'sonner';

const breadcrumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/contacts': 'Contacts',

  '/pipeline': 'Pipeline',
  '/field-monitoring': 'Field Monitoring',
  '/quotes': 'Quotes',
  '/invoices': 'Invoices',
  '/contracts': 'Contracts',
  '/content-hub': 'Content Hub',
  '/marketing-calendar': 'Marketing Calendar',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/analytics': 'Analytics',
  '/integrations': 'Automation Hub',
  '/ai-assistant': 'AI Assistant',
  '/settings': 'Settings',
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, workspaceRole, availableWorkspaces, switchWorkspace, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifList, setNotifList] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

  const loadInvites = useCallback(async () => {
    if (!user?.email) return;
    const invites = await getPendingInvitesByEmail(user.email).catch(() => []);
    setPendingInvites(invites);
  }, [user?.email]);

  const loadNotifs = useCallback(async () => {
    if (!user?.id) return;
    const notifications = await getNotifications(user.id, workspace?.id).catch(() => []);
    setNotifList(notifications);
    setNotificationCount(notifications.filter((n) => !n.read).length);
  }, [user?.id, workspace?.id]);

  useEffect(() => { loadNotifs(); loadInvites(); }, [loadNotifs, loadInvites]);

  const handleAcceptInvite = async (invite: Invite) => {
    if (!user?.id) return;
    try {
      await acceptWorkspaceInvite(invite, {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      });
      toast.success(`Joined ${invite.workspace_name}!`);
      // Reload workspace list to include the new workspace
      // Actually switch workspace will be available on reload or through context refresh
      window.location.reload();
    } catch (e) {
      toast.error('Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (invite: Invite) => {
    try {
      await updateInviteStatus(invite.id, 'declined');
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      toast.success('Invite declined');
    } catch (e) {
      toast.error('Failed to decline invite');
    }
  };

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
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search (⌘K)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground relative" aria-label="Notifications">
                <Bell size={18} />
                {notificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium">Notifications</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNotifOpen(false)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                ) : (
                  notifList.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      className={`w-full text-left p-3 text-sm border-b hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5 font-medium' : ''}`}
                      onClick={async () => {
                        if (!n.read) {
                          await markNotificationAsRead(n.id, workspace?.id);
                          loadNotifs();
                        }
                        if (n.link) router.push(n.link);
                        setNotifOpen(false);
                      }}
                    >
                      <p className="font-medium text-xs">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

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
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start text-sm">
                  <span className="font-medium leading-none">{user?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground leading-none mt-1">
                    {workspaceRole ? workspaceRole.charAt(0).toUpperCase() + workspaceRole.slice(1) : (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—')}
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
              {availableWorkspaces && availableWorkspaces.length > 1 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Workspace</DropdownMenuLabel>
                  {availableWorkspaces.map(ws => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => switchWorkspace(ws.id)}
                      className="justify-between"
                    >
                      <div className="flex items-center">
                        <Briefcase size={14} className="mr-2" />
                        <span className="truncate max-w-[140px]">{ws.name}</span>
                      </div>
                      {ws.id === workspace?.id && <CheckIcon size={14} />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {pendingInvites.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-amber-600 dark:text-amber-400">Pending Invites</DropdownMenuLabel>
                  {pendingInvites.map(invite => (
                    <div key={invite.id} className="px-2 py-1.5 text-sm flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <UserPlus size={14} className="text-muted-foreground" />
                        <span className="font-medium truncate max-w-[150px]">{invite.workspace_name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={() => handleAcceptInvite(invite)}>Accept</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleDeclineInvite(invite)}>Decline</Button>
                      </div>
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
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

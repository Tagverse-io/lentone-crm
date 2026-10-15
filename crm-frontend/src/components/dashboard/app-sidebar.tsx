'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { subscribeToLeads } from '@/lib/firebase/database';
import { usePermissions } from '@/components/context/permissions-context';
import { useSidebar } from './sidebar-context';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useAuth } from '@/lib/firebase/auth-context';
import { brand } from '@/brand.config';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  Contact2,
  DollarSign,
  FileText,
  FileSpreadsheet,
  Megaphone,
  Image,
  Calendar,
  Briefcase,
  CheckSquare,
  Users2,
  BarChart3,
  Puzzle,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Receipt,
  X,
  Activity,
  Target,
  Camera,
  Mail,
  Wallet,
  Hexagon,
  LineChart,
  Bell,
  GitBranch,
  Handshake,
  Filter,
  MessageSquare,
  TrendingUp,
  Globe,
  PenTool,
  Folder,
  Rocket,
  Smartphone
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavConfig {
  topItems: NavItem[];
  groups: NavGroup[];
}

function getNavConfig(leadCount: number, hasPermission: (module: string, action: 'view' | 'edit' | 'delete') => boolean): NavConfig {
  // Filter items based on permissions
  const filterByPermission = (items: NavItem[], module: string) => 
    hasPermission(module, 'view') ? items : [];

  return {
    topItems: [
      { title: 'Dashboard', href: '/dashboard', icon: Hexagon },
    ],
    groups: [
      {
        title: 'CRM',
        items: [
          ...filterByPermission([{ title: 'Leads', href: '/leads', icon: Target, badge: leadCount || undefined }], 'leads'),
          ...filterByPermission([
            { title: 'Clients', href: '/clients', icon: Contact2 },
            { title: 'Contacts', href: '/contacts', icon: Contact2 },
            { title: 'Follow-ups', href: '/follow-ups', icon: Bell },
            { title: 'Pipelines', href: '/pipeline', icon: GitBranch },
          ], 'contracts'), // Reusing contracts perms for general CRM for now
        ],
      },
      {
        title: 'Revenue Hub',
        items: [
          ...filterByPermission([
            { title: 'Quotations', href: '/quotes', icon: FileText },
            { title: 'Invoices', href: '/invoices', icon: Receipt },
          ], 'contracts'),
          ...filterByPermission([
            { title: 'Payments', href: '/payments', icon: Wallet },
          ], 'payments')
        ],
      },
      {
        title: 'Workspace',
        items: filterByPermission([
          { title: 'Projects', href: '/projects', icon: Briefcase },
          { title: 'Tasks', href: '/tasks', icon: CheckSquare },
          { title: 'Calendar', href: '/calendar', icon: Calendar },
        ], 'workspace')
      },
      {
        title: 'Marketing',
        items: filterByPermission([
          { title: 'Social Media', href: '/social', icon: Smartphone },
          { title: 'Content Calendar', href: '/content-calendar', icon: Calendar },
          { title: 'Video Pipeline', href: '/video', icon: Camera },
        ], 'workspace')
      },
    ].filter(g => g.items.length > 0)
  };
}

function SidebarNav({ collapsed, onToggleGroup, expandedGroups, leadCount, pathname, companyLogo, companyName }: {
  collapsed: boolean;
  onToggleGroup: (title: string) => void;
  expandedGroups: Record<string, boolean>;
  leadCount: number;
  pathname: string;
  companyLogo: string;
  companyName: string;
}) {
  const { hasPermission } = usePermissions();
  const { availableWorkspaces, switchWorkspace, workspace } = useAuth();
  const { topItems, groups: navGroups } = getNavConfig(leadCount, hasPermission);
  // Brand default logo is white-on-transparent: invert it in light mode.
  const logoSrc = companyLogo || brand.logo;
  const logoFilter = !companyLogo && brand.logoInvertLight ? 'invert dark:invert-0' : '';

  const WorkspaceSelector = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 min-w-0 hover:bg-sidebar-muted p-1 rounded-md transition-colors w-full text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt={companyName || brand.appName} className={`w-8 h-8 rounded-lg object-contain shrink-0 ${logoFilter}`} />
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-sm tracking-tight truncate">
                {companyName || 'CRM'}
              </span>
              <span className="text-xs text-sidebar-muted-foreground truncate">
                {workspace?.setup_completed ? 'Active Workspace' : 'Setup Required'}
              </span>
            </div>
          )}
          {!collapsed && <ChevronsUpDown size={14} className="text-sidebar-muted-foreground ml-auto shrink-0" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableWorkspaces?.map((ws) => (
          <DropdownMenuItem 
            key={ws.id}
            onClick={() => switchWorkspace(ws.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {ws.name.charAt(0)}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{ws.name}</span>
            </div>
            {ws.id === workspace?.id && (
              <div className="w-2 h-2 rounded-full bg-green-500 ml-auto shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <div className="flex items-center gap-2 px-4 h-16 border-b shrink-0">
        <WorkspaceSelector />
        <button
          onClick={() => onToggleGroup('__collapse__')}
          className="ml-auto p-1.5 rounded-md hover:bg-sidebar-muted text-sidebar-muted-foreground shrink-0 hidden lg:block"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-1">
        <div className={cn('space-y-0.5 mb-4', collapsed && 'space-y-1')}>
          {topItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group relative',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
                )}
              >
                <item.icon size={18} className={cn('shrink-0', isActive && 'text-primary')} />
                {!collapsed && (
                  <span className="truncate">{item.title}</span>
                )}
              </Link>
            );
          })}
        </div>
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <button
                onClick={() => onToggleGroup(group.title)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-full hover:text-foreground transition-colors"
              >
                <ChevronDown
                  size={12}
                  className={cn(
                    'transition-transform',
                    expandedGroups[group.title] && 'rotate-180'
                  )}
                />
                {group.title}
              </button>
            )}
            {(expandedGroups[group.title] || collapsed) && (
              <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group relative',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
                      )}
                    >
                      <item.icon size={18} className={cn('shrink-0', isActive && 'text-primary')} />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && item.badge && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-primary text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t p-2 space-y-0.5 shrink-0">

        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
          )}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [leadCount, setLeadCount] = useState(0);
  const { companyName, logoUrl } = useWorkspace();
  const { workspace, user } = useAuth();
  const companyId = workspace?.id;

  useEffect(() => {
    if (!companyId) return;
    const unsub = subscribeToLeads(companyId, (leads) => {
      setLeadCount(leads.length);
    });
    return () => unsub();
  }, [companyId]);

  const { hasPermission } = usePermissions();
  const { topItems, groups: navGroups } = getNavConfig(leadCount, hasPermission);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(navGroups.map((g) => [g.title, true]))
  );

  const toggleGroup = (title: string) => {
    if (title === '__collapse__') {
      setCollapsed(!collapsed);
      return;
    }
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const navContent = (
    <SidebarNav
      collapsed={collapsed}
      onToggleGroup={toggleGroup}
      expandedGroups={expandedGroups}
      leadCount={leadCount}
      pathname={pathname}
      companyLogo={logoUrl}
      companyName={companyName}
    />
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-sidebar transition-all duration-300 ease-in-out h-screen sticky top-0 z-30',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {navContent}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0 [&>button]:hidden">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl || brand.logo} alt={companyName || brand.appName} className={`w-8 h-8 rounded-lg object-contain ${!logoUrl && brand.logoInvertLight ? 'invert dark:invert-0' : ''}`} />
              <SheetTitle className="font-semibold text-lg tracking-tight">
                {companyName || 'CRM'}
              </SheetTitle>
            </div>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
            <SheetClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 h-[calc(100vh-4rem)]">
            <div className="space-y-0.5 mb-4">
              {topItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
                      )}
                    >
                      <item.icon size={18} className={cn('shrink-0', isActive && 'text-primary')} />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </div>
            {navGroups.map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
                          )}
                        >
                          <item.icon size={18} className={cn('shrink-0', isActive && 'text-primary')} />
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 space-y-0.5">
              <SheetClose asChild>
                <Link
                  href="/ai-assistant"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    pathname === '/ai-assistant'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
                  )}
                >
                  <Bot size={18} />
                  <span>AI Assistant</span>
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/settings"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    pathname === '/settings'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-foreground'
                  )}
                >
                  <Settings size={18} />
                  <span>Settings</span>
                </Link>
              </SheetClose>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

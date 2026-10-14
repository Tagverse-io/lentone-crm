"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/brand.config";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, UserRound, PhoneCall, KanbanSquare, FileText,
  Receipt, Wallet, Briefcase, CheckSquare, Share2, CalendarDays,
  Clapperboard, CalendarRange, Settings, Menu,
} from "lucide-react";
import { useState } from "react";

interface Item {
  href: string;
  label: string;
  icon: React.ElementType;
  flag: boolean;
}

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, flag: brand.modules.dashboard },
  { href: "/leads", label: "Leads", icon: Users, flag: brand.modules.crm },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, flag: brand.modules.crm },
  { href: "/clients", label: "Clients", icon: UserRound, flag: brand.modules.crm },
  { href: "/contacts", label: "Contacts", icon: Users, flag: brand.modules.crm },
  { href: "/follow-ups", label: "Follow-ups", icon: PhoneCall, flag: brand.modules.crm },
  { href: "/quotations", label: "Quotations", icon: FileText, flag: brand.modules.sales },
  { href: "/invoices", label: "Invoices", icon: Receipt, flag: brand.modules.sales },
  { href: "/payments", label: "Payments", icon: Wallet, flag: brand.modules.sales },
  { href: "/projects", label: "Projects", icon: Briefcase, flag: brand.modules.projects },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, flag: brand.modules.projects },
  { href: "/social", label: "Social", icon: Share2, flag: brand.modules.marketing },
  { href: "/content-calendar", label: "Content Calendar", icon: CalendarDays, flag: brand.modules.marketing },
  { href: "/video", label: "Video Pipeline", icon: Clapperboard, flag: brand.modules.marketing },
  { href: "/calendar", label: "Calendar", icon: CalendarRange, flag: brand.modules.calendar },
  { href: "/settings", label: "Settings", icon: Settings, flag: true },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = ITEMS.filter((i) => i.flag);
  const list = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
      {visible.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <button className="rounded-md border p-2 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </button>
      <aside className="hidden w-60 shrink-0 border-r bg-card md:block">
        <div className="border-b p-4">
          <Link href="/dashboard" className="text-lg font-bold" style={{ color: "var(--brand-primary)" }}>
            {brand.appName}
          </Link>
        </div>
        {list}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-card shadow-lg">{list}</div>
        </div>
      ) : null}
    </>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary text-primary-foreground",
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  danger: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({ className, tone = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }): JSX.Element {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone] ?? tones.default, className)} {...props} />
  );
}

export function stageTone(stage: string): keyof typeof tones {
  switch (stage) {
    case "Won":
    case "paid":
    case "accepted":
    case "published":
    case "done":
    case "completed":
      return "success";
    case "Lost":
    case "rejected":
    case "overdue":
    case "failed":
    case "cancelled":
      return "danger";
    case "Proposal":
    case "sent":
    case "scheduled":
    case "in_progress":
      return "info";
    case "Qualified":
    case "partial":
    case "review":
      return "warning";
    default:
      return "muted";
  }
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className={cn("w-full text-sm", className)}>{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }): JSX.Element {
  return (
    <thead className="bg-muted/60">
      <tr>{children}</tr>
    </thead>
  );
}
export function TH({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <th className={cn("px-4 py-2 text-left font-medium text-muted-foreground", className)}>{children}</th>;
}
export function TBody({ children }: { children: ReactNode }): JSX.Element {
  return <tbody className="divide-y">{children}</tbody>;
}
export function TR({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <tr className={cn("hover:bg-muted/40", className)}>{children}</tr>;
}
export function TD({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <td className={cn("px-4 py-2", className)}>{children}</td>;
}

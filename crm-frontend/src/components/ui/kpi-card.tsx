import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

export function KpiCard({ title, value, hint, icon, tone }: { title: string; value: string; hint?: string; icon?: React.ReactNode; tone?: string }): JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? <div className={cn("rounded-full p-3", tone ?? "bg-primary/10 text-primary")}>{icon}</div> : null}
      </CardContent>
    </Card>
  );
}

'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface DocumentLayoutProps {
  leftColumn: React.ReactNode;
  rightColumn: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
}

/**
 * Two-column layout for document create/edit pages.
 * Left: form fields (scrollable)
 * Right: sticky live preview
 */
export function DocumentLayout({
  leftColumn,
  rightColumn,
  leftLabel = 'Edit',
  rightLabel = 'Live Preview',
}: DocumentLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0">
      {/* Left Column - Form */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{leftLabel}</h3>
          <Separator className="flex-1" />
        </div>
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="pr-4 space-y-6">
            {leftColumn}
          </div>
        </ScrollArea>
      </div>

      {/* Right Column - Preview */}
      <div className="lg:w-[420px] xl:w-[480px] flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{rightLabel}</h3>
          <Separator className="flex-1" />
        </div>
        <div className="sticky top-4">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="pr-2 scale-[0.85] origin-top-left">
              {rightColumn}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

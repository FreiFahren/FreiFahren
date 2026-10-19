import { ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Green while covered, orange while coverage is about to end or not started, red when not covered.
export type FundStatusTone = 'ok' | 'warn' | 'danger';

// Only the icon carries the tone; the card itself stays neutral.
const TONES = {
  ok: { Icon: ShieldCheck, icon: 'text-ok' },
  warn: { Icon: ShieldAlert, icon: 'text-warn' },
  danger: { Icon: ShieldOff, icon: 'text-destructive' },
} as const;

type FundStatusCardProps = {
  tone: FundStatusTone;
  title: string;
  body?: string;
  // Secondary facts such as the contribution and the next renewal, deliberately small.
  details?: ReactNode;
};

export function FundStatusCard({ tone, title, body, details }: FundStatusCardProps) {
  const { Icon, icon } = TONES[tone];

  return (
    <div role="status" className="border-border flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden="true" className={cn('size-5 shrink-0', icon)} />
        <p className="font-heading text-base leading-snug font-semibold">{title}</p>
      </div>
      {body !== undefined && (
        <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      )}
      {details !== undefined && <div className="text-muted-foreground text-sm">{details}</div>}
    </div>
  );
}

import { ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Green while covered, orange while coverage is about to end or not started, red when not covered.
export type FundStatusTone = 'ok' | 'warn' | 'danger';

const TONES = {
  ok: { Icon: ShieldCheck, card: 'border-ok/40 bg-ok/10', icon: 'text-ok' },
  warn: { Icon: ShieldAlert, card: 'border-warn/40 bg-warn/10', icon: 'text-warn' },
  danger: {
    Icon: ShieldOff,
    card: 'border-destructive/50 bg-destructive/10',
    icon: 'text-destructive',
  },
} as const;

type FundStatusCardProps = {
  tone: FundStatusTone;
  title: string;
  body?: string;
  // Secondary facts such as the contribution and the next renewal, deliberately small.
  details?: ReactNode;
};

export function FundStatusCard({ tone, title, body, details }: FundStatusCardProps) {
  const { Icon, card, icon } = TONES[tone];

  return (
    <div role="status" className={cn('flex flex-col gap-2 rounded-lg border p-4', card)}>
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden="true" className={cn('size-6 shrink-0', icon)} />
        <p className="font-heading text-lg leading-snug font-semibold">{title}</p>
      </div>
      {body !== undefined && <p className="text-sm leading-relaxed">{body}</p>}
      {details !== undefined && <div className="text-muted-foreground text-sm">{details}</div>}
    </div>
  );
}

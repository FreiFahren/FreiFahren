import { Clock3, LoaderCircle, Minus, TriangleAlert } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@freifahren/ui/cn';
import { NAMESPACE } from './ReportForm.i18n';
import type { ReportRejection, VerificationChecks } from './report-verification';

type Row = keyof VerificationChecks;
type Status = VerificationChecks[Row]['status'];

const ROWS = [
  { key: 'location', label: 'checkLocation' },
  { key: 'device', label: 'checkDevice' },
  { key: 'activity', label: 'checkActivity' },
] as const;

// One entry per state a row can actually be in: a new status fails to compile until it has copy.
const DETAIL = {
  location: {
    running: 'location_running',
    passed: 'location_passed',
    unavailable: 'location_unavailable',
  },
  device: {
    running: 'device_running',
    passed: 'device_passed',
    not_required: 'device_not_required',
    unavailable: 'device_unavailable',
  },
  activity: { pending: 'checkWaiting', passed: 'activity_passed', skipped: 'checkNotRun' },
} satisfies {
  [Key in Row]: Record<Exclude<VerificationChecks[Key]['status'], 'failed'>, string>;
};

const REASON: Record<ReportRejection, string> = {
  too_far: 'reason_too_far',
  verification_failed: 'reason_verification_failed',
  too_fast: 'reason_too_fast',
  rate_limited: 'reason_rate_limited',
};

type StatusIcon = ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;

const STATUS: Record<Status, { label: string; Icon: StatusIcon; color?: string }> = {
  pending: { label: 'status_pending', Icon: Clock3 },
  running: { label: 'status_running', Icon: LoaderCircle },
  passed: { label: 'status_passed', Icon: DrawnCheck, color: 'text-ok' },
  failed: { label: 'status_failed', Icon: TriangleAlert, color: 'text-destructive' },
  skipped: { label: 'status_skipped', Icon: Minus },
  unavailable: { label: 'status_unavailable', Icon: Minus },
  not_required: { label: 'status_not_required', Icon: Minus },
};

function detailKey<Key extends Row>(row: Key, check: VerificationChecks[Key]): string {
  if (check.status === 'failed') return REASON[check.reason];
  return (DETAIL[row] as Record<string, string>)[check.status];
}

export function ReportCheckList({ checks }: { checks: VerificationChecks }) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <ul
      className="border-border/60 divide-border/60 w-full divide-y rounded-xl border text-left"
      aria-label={t('checksLabel')}
    >
      {ROWS.map(({ key, label }) => (
        <ReportCheckRow key={key} row={key} label={label} check={checks[key]} />
      ))}
    </ul>
  );
}

function ReportCheckRow<Key extends Row>({
  row,
  label,
  check,
}: {
  row: Key;
  label: string;
  check: VerificationChecks[Key];
}) {
  const { t } = useTranslation(NAMESPACE);
  if (row === 'device' && check.status === 'unavailable') return null;
  const failed = check.status === 'failed';
  return (
    <li
      data-check={row}
      data-status={check.status}
      className={cn(
        'relative flex items-center gap-4 overflow-hidden px-4 py-5 transition-colors duration-200 first:rounded-t-xl last:rounded-b-xl',
        failed && 'bg-destructive/5',
      )}
    >
      {check.status === 'running' && (
        <span
          aria-hidden="true"
          className="animate-check-sweep via-foreground/5 pointer-events-none absolute inset-0 bg-linear-to-r from-transparent to-transparent motion-reduce:hidden"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t(label)}</p>
        <p
          className={cn(
            'mt-1 text-xs leading-relaxed',
            failed ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {t(detailKey(row, check))}
        </p>
      </div>
      <CheckStatusIcon status={check.status} />
    </li>
  );
}

function CheckStatusIcon({ status }: { status: Status }) {
  const { t } = useTranslation(NAMESPACE);
  const { label, Icon, color = 'text-muted-foreground' } = STATUS[status];
  return (
    <span
      // Remounting per status lets each new icon settle in instead of swapping abruptly.
      key={status}
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 flex size-5 shrink-0 items-center justify-center duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
        color,
      )}
      aria-label={t(label)}
    >
      <Icon
        className={cn('size-5', status === 'running' && 'animate-spin motion-reduce:animate-none')}
        aria-hidden="true"
      />
    </span>
  );
}

function DrawnCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12l5 5L20 6" pathLength={1} className="motion-safe:animate-check-draw" />
    </svg>
  );
}

import { Check, Upload, X, type LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { FineUploadVersion } from '@/lib/fund-api';
import { cn } from '@/lib/utils';

import { FineStatus } from './fine-status';
import { NAMESPACE } from './fund.i18n';

export function FineUploadHistory({ uploads }: { uploads: FineUploadVersion[] }) {
  const { t } = useTranslation(NAMESPACE);
  if (uploads.length === 0) return null;

  // The API returns the current upload first, followed by earlier versions.
  const chronologicalUploads = uploads.toReversed();
  return (
    <section aria-label={t('fineUploadHistory')} className="space-y-4">
      <h2 className="font-semibold">{t('fineUploadHistory')}</h2>
      <ol>
        {chronologicalUploads.map((upload, index) => (
          <Fragment key={upload.id}>
            <ActivityItem icon={Upload}>
              <p>{t(index === 0 ? 'invoiceUploaded' : 'invoiceReuploaded')}</p>
              <ActivityDate value={upload.createdAt} />
              <div className="text-muted-foreground mt-1">
                <FineStatus status="in_review" />
              </div>
            </ActivityItem>
            <ReviewActivity upload={upload} />
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

function ActivityItem({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  children: ReactNode;
}) {
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span
        className="bg-border absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 group-last:hidden"
        aria-hidden="true"
      />
      <span className="bg-card text-muted-foreground relative flex size-6 shrink-0 items-center justify-center">
        <Icon className={cn('size-4', iconClassName)} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5 text-sm">{children}</div>
    </li>
  );
}

function ActivityDate({ value }: { value: string | null }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  if (!value)
    return <p className="text-muted-foreground mt-0.5 text-xs">{t('reviewDateUnknown')}</p>;
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
  return (
    <time dateTime={value} className="text-muted-foreground mt-0.5 block text-xs">
      {date}
    </time>
  );
}

function ReviewActivity({ upload }: { upload: FineUploadVersion }) {
  const { t } = useTranslation(NAMESPACE);
  if (upload.status === 'in_review') return null;
  if (upload.status === 'paid')
    return (
      <ActivityItem icon={Check} iconClassName="text-ok">
        <p>{t('invoicePaid')}</p>
        <ActivityDate value={upload.paidAt} />
      </ActivityItem>
    );
  return (
    <ActivityItem icon={X} iconClassName="text-destructive">
      <p>{t('invoiceDeclined')}</p>
      <ActivityDate value={null} />
      <p className="text-muted-foreground mt-2 leading-relaxed wrap-anywhere whitespace-pre-wrap">
        {upload.declineReason?.trim() || t('declineReasonMissing')}
      </p>
    </ActivityItem>
  );
}

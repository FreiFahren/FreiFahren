import { Check, Clock3, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { useFundHistory, type Fine } from '@/hooks/use-fund-history';
import { cn } from '@/lib/utils';

import { FineUpload } from './fine-upload';
import { NAMESPACE } from './fund.i18n';

const STATUS_STYLES = {
  in_review: { icon: Clock3, color: 'text-muted-foreground' },
  paid: { icon: Check, color: 'text-ok' },
  declined: { icon: X, color: 'text-destructive' },
};

function Status({ status, label }: { status: Fine['status']; label: string }) {
  const { icon: Icon, color } = STATUS_STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className={cn('size-3.5 shrink-0', color)} aria-hidden="true" />
      {label}
    </span>
  );
}

function HistoryError({ retry }: { retry: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div role="alert" className="space-y-2 py-4 text-sm">
      <p>{t('historyError')}</p>
      <Button variant="outline" onClick={retry}>
        {t('retry')}
      </Button>
    </div>
  );
}

function LoadingHistory() {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div role="status" className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {t('loadingHistory')}
    </div>
  );
}

function FineRow({ fine }: { fine: Fine }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(fine.createdAt),
  );
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
    new Date(fine.createdAt),
  );
  return (
    <tr className="border-border border-b">
      <td className="py-3 pr-2">
        <time dateTime={fine.createdAt} className="block text-xs">
          {date}
          <span className="text-muted-foreground mt-0.5 block">{time}</span>
        </time>
      </td>
      <td className="py-3 pr-2">
        <Status status={fine.status} label={t(`fineStatus.${fine.status}`)} />
      </td>
    </tr>
  );
}

const TABLE_HEAD =
  'text-muted-foreground border-border border-b text-left text-xs [&_th]:pb-2 [&_th]:font-normal';

function UploadHistory({ userId, sessionId }: { userId: string; sessionId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const fines = useFundHistory(userId, sessionId);

  if (fines.isPending) return <LoadingHistory />;
  if (fines.isError) return <HistoryError retry={() => void fines.refetch()} />;
  if (fines.data.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">{t('emptyUploads')}</p>;
  }

  return (
    <table className="w-full" aria-label={t('uploadsTitle')}>
      <thead className={TABLE_HEAD}>
        <tr>
          <th scope="col">{t('uploadedAt')}</th>
          <th scope="col">{t('status')}</th>
        </tr>
      </thead>
      <tbody>
        {fines.data.map((fine) => (
          <FineRow key={fine.id} fine={fine} />
        ))}
      </tbody>
    </table>
  );
}

export function FundOverview({
  userId,
  sessionId,
  onSignIn,
}: {
  userId: string;
  sessionId: string;
  onSignIn: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="pb-20">
      <FineUpload userId={userId} sessionId={sessionId} onSignIn={onSignIn} />
      <section aria-label={t('uploadsTitle')}>
        <SectionHeading className="mb-4">{t('uploadsTitle')}</SectionHeading>
        <UploadHistory userId={userId} sessionId={sessionId} />
      </section>
    </div>
  );
}

import { Check, Clock3, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFundHistory, type Fine } from '@/hooks/use-fund-history';

import { FineUpload } from './fine-upload';
import { FundHistoryStatus } from './fund-history-status';
import { NAMESPACE } from './fund.i18n';

const STATUS_STYLES = {
  in_review: { icon: Clock3, color: 'text-muted-foreground' },
  paid: { icon: Check, color: 'text-ok' },
  declined: { icon: X, color: 'text-destructive' },
};

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
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });
  const date = dateFormatter.format(new Date(fine.createdAt));
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
    new Date(fine.createdAt),
  );
  const { icon, color } = STATUS_STYLES[fine.status];
  const paidAt = fine.status === 'paid' ? fine.paidAt : null;

  return (
    <TableRow>
      <TableCell>
        <time dateTime={fine.createdAt} className="block">
          {date}
          <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{time}</span>
        </time>
      </TableCell>
      <TableCell>
        <FundHistoryStatus
          icon={icon}
          iconClassName={color}
          label={t(`fineStatus.${fine.status}`)}
          paidAt={paidAt}
        />
      </TableCell>
    </TableRow>
  );
}

function UploadHistory({ userId, sessionId }: { userId: string; sessionId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const fines = useFundHistory(userId, sessionId);

  if (fines.isPending) return <LoadingHistory />;
  if (fines.isError) return <HistoryError retry={() => void fines.refetch()} />;
  if (fines.data.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">{t('emptyUploads')}</p>;
  }

  return (
    <Table aria-label={t('uploadsTitle')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('uploadedAt')}</TableHead>
          <TableHead>{t('status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fines.data.map((fine) => (
          <FineRow key={fine.id} fine={fine} />
        ))}
      </TableBody>
    </Table>
  );
}

// Former members keep their history: fines uploaded while covered are still handled.
export function FundOverview({
  userId,
  sessionId,
  onSignIn,
  canUpload = true,
  onUploaded,
}: {
  userId: string;
  sessionId: string;
  onSignIn: () => void;
  canUpload?: boolean;
  onUploaded?: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className={canUpload ? 'pb-20' : 'pb-4'}>
      {canUpload && (
        <FineUpload
          userId={userId}
          sessionId={sessionId}
          onSignIn={onSignIn}
          onUploaded={onUploaded}
        />
      )}
      <section aria-label={t('uploadsTitle')}>
        <SectionHeading className="mb-4">{t('uploadsTitle')}</SectionHeading>
        <UploadHistory userId={userId} sessionId={sessionId} />
      </section>
    </div>
  );
}

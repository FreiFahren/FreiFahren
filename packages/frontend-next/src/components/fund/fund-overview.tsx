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
  let declineReason: string | undefined;
  let descriptionId: string | undefined;
  if (fine.status === 'declined') {
    declineReason = fine.declineReason?.trim() || t('declineReasonMissing');
    descriptionId = `fine-${fine.id}-decline-reason`;
  }

  return (
    <TableBody className="border-border border-b last:border-b-0 [&_tr]:border-0">
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
            descriptionId={descriptionId}
          />
        </TableCell>
      </TableRow>
      {declineReason !== undefined && (
        <TableRow>
          <TableCell colSpan={2} className="pt-0">
            <p
              id={descriptionId}
              className="text-muted-foreground text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap"
            >
              {declineReason}
            </p>
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

function UploadHistory({
  userId,
  sessionId,
  canUpload,
}: {
  userId: string;
  sessionId: string;
  canUpload: boolean;
}) {
  const { t } = useTranslation(NAMESPACE);
  const fines = useFundHistory(userId, sessionId);

  if (fines.isPending) return <LoadingHistory />;
  if (fines.isError) return <HistoryError retry={() => void fines.refetch()} />;
  if (fines.data.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-3 pt-8 text-center">
        <h3 className="font-heading text-2xl leading-tight font-semibold">
          {t('emptyUploadsTitle')}
        </h3>
        <p className="text-muted-foreground text-base leading-relaxed">
          {t(canUpload ? 'emptyUploadsPrompt' : 'emptyUploads')}
        </p>
      </div>
    );
  }

  return (
    <Table className="table-fixed" aria-label={t('uploadsTitle')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('uploadedAt')}</TableHead>
          <TableHead>{t('status')}</TableHead>
        </TableRow>
      </TableHeader>
      {fines.data.map((fine) => (
        <FineRow key={fine.id} fine={fine} />
      ))}
    </Table>
  );
}

// Former members keep their history: fines uploaded while covered are still handled.
export function FundOverview({
  userId,
  sessionId,
  onSignIn,
  canUpload = true,
}: {
  userId: string;
  sessionId: string;
  onSignIn: () => void;
  canUpload?: boolean;
}) {
  const { t } = useTranslation(NAMESPACE);
  const fines = useFundHistory(userId, sessionId);
  // An empty history centres a prominent upload action under the empty state; once there are
  // uploads, the action floats so it stays reachable however long the list grows.
  const floating = fines.data?.length !== 0;

  return (
    <div className={`flex flex-col ${canUpload && floating ? 'pb-20' : 'pb-4'}`}>
      <section aria-label={t('uploadsTitle')}>
        <SectionHeading className="mb-4">{t('uploadsTitle')}</SectionHeading>
        <UploadHistory userId={userId} sessionId={sessionId} canUpload={canUpload} />
      </section>
      {canUpload && (
        <FineUpload userId={userId} sessionId={sessionId} onSignIn={onSignIn} floating={floating} />
      )}
    </div>
  );
}

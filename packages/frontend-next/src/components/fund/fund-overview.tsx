import { ChevronRight, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
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
import { Route as FineDetailsRoute } from '@/routes/fund/$fineId';

import { FineUpload } from './fine-upload';
import { FineStatus } from './fine-status';
import { NAMESPACE } from './fund.i18n';

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
  const navigate = useNavigate();
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });
  const date = dateFormatter.format(new Date(fine.createdAt));
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
    new Date(fine.createdAt),
  );
  let declineReason: string | undefined;
  let descriptionId: string | undefined;
  if (fine.status === 'declined') {
    declineReason = fine.declineReason?.trim() || t('declineReasonMissing');
    descriptionId = `fine-${fine.id}-decline-reason`;
  }

  return (
    <TableBody
      className="border-border hover:bg-muted/40 cursor-pointer border-b last:border-b-0 [&_tr]:border-0"
      onClick={() => void navigate({ to: FineDetailsRoute.to, params: { fineId: fine.id } })}
    >
      <TableRow>
        <TableCell>
          <Link
            to={FineDetailsRoute.to}
            params={{ fineId: fine.id }}
            className="focus-visible:ring-ring rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t('openFineDetails', { date })}
            onClick={(event) => event.stopPropagation()}
          >
            <time dateTime={fine.createdAt} className="block">
              {date}
              <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                {time}
              </span>
            </time>
          </Link>
        </TableCell>
        <TableCell>
          <div className="flex items-start justify-between gap-2">
            <FineStatus status={fine.status} paidAt={fine.paidAt} descriptionId={descriptionId} />
            <ChevronRight
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          </div>
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

function UploadHistory({ userId, sessionId }: { userId: string; sessionId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const fines = useFundHistory(userId, sessionId);

  if (fines.isPending) return <LoadingHistory />;
  if (fines.isError) return <HistoryError retry={() => void fines.refetch()} />;
  if (fines.data.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">{t('emptyUploads')}</p>;
  }

  return (
    <Table
      className="table-fixed [&_tr>:first-child]:pl-3 [&_tr>:last-child]:pr-3"
      aria-label={t('uploadsTitle')}
    >
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

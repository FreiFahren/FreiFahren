import { Check, Clock3, CircleAlert, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SECONDARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type Contribution, useContributions } from '@/hooks/use-contributions';

import { FundHistoryStatus } from './fund-history-status';
import { NAMESPACE } from './fund.i18n';

const STATUS_STYLES = {
  paid: { icon: Check, color: 'text-ok' },
  pending: { icon: Clock3, color: 'text-muted-foreground' },
  failed: { icon: CircleAlert, color: 'text-warn' },
  action_required: { icon: CircleAlert, color: 'text-warn' },
  void: { icon: Clock3, color: 'text-muted-foreground' },
  uncollectible: { icon: CircleAlert, color: 'text-warn' },
};

export function FundContributions({ userId, sessionId }: { userId: string; sessionId: string }) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <section aria-labelledby="payment-summary-title" className="flex flex-col gap-4">
      <h2 id="payment-summary-title" className="font-heading text-lg font-semibold">
        {t('paymentSummary')}
      </h2>
      <ContributionHistory userId={userId} sessionId={sessionId} />
    </section>
  );
}

function ContributionHistory({ userId, sessionId }: { userId: string; sessionId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const history = useContributions(userId, sessionId);

  if (history.isPending) {
    return (
      <LoaderCircle
        role="status"
        aria-label={t('loadingContributions')}
        className="mx-auto size-6 animate-spin"
      />
    );
  }
  if (history.isError) {
    return (
      <div role="alert" className="flex flex-col gap-3 text-sm">
        <p>{t('contributionsError')}</p>
        <Button className={SECONDARY_BUTTON} onClick={() => void history.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  if (history.data.contributions.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('emptyContributions')}</p>;
  }

  return (
    <Table className="table-fixed">
      <TableCaption className="sr-only">{t('contributionsTitle')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[38%]">{t('contributionPeriod')}</TableHead>
          <TableHead className="w-[20%]">{t('contributionAmount')}</TableHead>
          <TableHead>{t('status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.data.contributions.map((row) => (
          <ContributionRow key={row.id} contribution={row} />
        ))}
      </TableBody>
    </Table>
  );
}

function ContributionRow({ contribution }: { contribution: Contribution }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));
  const amount = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: contribution.currency,
    minimumFractionDigits: contribution.amountCents % 100 === 0 ? 0 : 2,
  }).format(contribution.amountCents / 100);
  const { icon, color } = STATUS_STYLES[contribution.status];
  let description;
  if (contribution.failureReason !== null)
    description = t(`paymentFailure.${contribution.failureReason}`);
  else if (contribution.status === 'action_required') description = t('paymentActionRequired');

  return (
    <TableRow>
      <TableCell>
        {contribution.periods.map((period) => (
          <div key={`${period.start}-${period.end}`} className="mb-1 last:mb-0">
            <time dateTime={period.start}>{date(period.start)}</time>
            <span className="text-muted-foreground block">
              – <time dateTime={period.end}>{date(period.end)}</time>
            </span>
          </div>
        ))}
      </TableCell>
      <TableCell className="tabular-nums">{amount}</TableCell>
      <TableCell>
        <FundHistoryStatus
          icon={icon}
          iconClassName={color}
          label={t(`paymentStatus.${contribution.status}`)}
          paidAt={contribution.paidAt}
          showTime
          description={description}
        />
      </TableCell>
    </TableRow>
  );
}

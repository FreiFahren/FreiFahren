import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';
import {
  markRulesSeen,
  rulesSeen,
  useEuro,
  useMembership,
  useOpenStripe,
} from '@/hooks/use-membership';

import { ManageMembershipButton } from './fund-account-status';
import { FundIntroduction } from './fund-introduction';
import { FundOverview } from './fund-overview';
import { FundRulesSlide } from './fund-rules';
import { FundStatusCard } from './fund-status-card';
import { NAMESPACE } from './fund.i18n';

// Pay what you think is fair: the Fund Worker's floor up to the usual range.
const MIN_EUR = 9;
const MAX_EUR = 30;

export function FundMembership({
  userId,
  sessionId,
  onSignIn,
}: {
  userId: string;
  sessionId: string;
  onSignIn: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const membership = useMembership(userId);
  // 'uploaded' also confirms the upload above the rules.
  const [showRules, setShowRules] = useState<boolean | 'uploaded'>(() => !rulesSeen(userId));

  if (membership.isPending) {
    return <LoaderCircle role="status" className="mx-auto mt-8 size-6 animate-spin" />;
  }
  if (membership.isError) {
    return (
      <div role="alert" className="flex flex-col gap-4 text-sm">
        <p>{t('loadFailed')}</p>
        <Button size="lg" className={SECONDARY_BUTTON} onClick={() => void membership.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const { status } = membership.data;
  if (status === 'active' || status === 'past_due') {
    if (showRules) {
      return (
        <FundRulesSlide
          intro={showRules === 'uploaded' ? t('uploadSuccess') : undefined}
          onDone={() => {
            markRulesSeen(userId);
            setShowRules(false);
          }}
        />
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {status === 'past_due' && (
          <>
            <p role="alert" className="text-destructive text-sm">
              {t('memberPastDueBody')}
            </p>
            <ManageMembershipButton />
          </>
        )}
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="text-muted-foreground hover:text-foreground self-start text-sm underline underline-offset-4"
        >
          {t('rulesTitle')}
        </button>
        <FundOverview
          userId={userId}
          sessionId={sessionId}
          onSignIn={onSignIn}
          onUploaded={() => setShowRules('uploaded')}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <FundIntroduction>
        {status !== 'none' && (
          <FundStatusCard
            tone={status === 'pending' ? 'warn' : 'danger'}
            title={t(`${status}Title`)}
            body={t(`${status}Body`)}
          />
        )}
        <JoinForm onAlreadyMember={() => void membership.refetch()} />
      </FundIntroduction>
      {status === 'canceled' && (
        <FundOverview userId={userId} sessionId={sessionId} onSignIn={onSignIn} canUpload={false} />
      )}
    </div>
  );
}

function JoinForm({ onAlreadyMember }: { onAlreadyMember: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  const euro = useEuro();
  const { state, open } = useOpenStripe(onAlreadyMember);
  const [amount, setAmount] = useState(MIN_EUR);

  return (
    <section aria-labelledby="fund-price-title" className="flex flex-col gap-3">
      <h3 id="fund-price-title" className="font-heading text-base font-semibold">
        {t('priceTitle')}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t('amountBody', { amount: euro(MIN_EUR * 100) })}
      </p>
      <p aria-live="polite" className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-semibold tabular-nums">
          {euro(amount * 100)}
        </span>
        <span className="text-muted-foreground text-sm">{t('perMonth')}</span>
      </p>
      <input
        type="range"
        aria-label={t('amountField')}
        aria-valuetext={t('contribution', { amount: euro(amount * 100) })}
        min={MIN_EUR}
        max={MAX_EUR}
        step={1}
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
        className="accent-accent-bright h-2 w-full cursor-pointer"
      />
      <div aria-hidden="true" className="text-muted-foreground flex justify-between text-xs">
        <span>{euro(MIN_EUR * 100)}</span>
        <span>{euro(MAX_EUR * 100)}</span>
      </div>
      <Button
        size="lg"
        className={`${PRIMARY_BUTTON} mt-2`}
        disabled={state === 'opening'}
        onClick={() => void open('/checkout-sessions', { amountCents: amount * 100 })}
      >
        {state === 'opening' ? <LoaderCircle className="animate-spin" /> : t('join')}
      </Button>
      <p className="text-muted-foreground text-xs leading-relaxed">{t('joinHint')}</p>
      {state === 'failed' && (
        <p role="alert" className="text-destructive text-sm">
          {t('stripeFailed')}
        </p>
      )}
    </section>
  );
}

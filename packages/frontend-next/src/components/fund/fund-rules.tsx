import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PRIMARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';

import { NAMESPACE } from './fund.i18n';

const RULES = [
  { title: 'ruleDontPayTitle', body: 'ruleDontPayBody' },
  { title: 'ruleNoTicketTitle', body: 'ruleNoTicketBody' },
  { title: 'ruleRepeatTitle', body: 'ruleRepeatBody' },
] as const;

// Shown after joining and after every upload, so nobody pays a fine they've handed to the Fund.
export function FundRulesSlide({ intro, onDone }: { intro?: string; onDone: () => void }) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <section aria-labelledby="fund-rules-title" className="flex flex-col gap-6 pt-2 pb-4">
      {intro !== undefined && (
        <p role="status" className="flex items-start gap-2 text-sm">
          <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {intro}
        </p>
      )}
      <h2 id="fund-rules-title" className="font-heading text-xl leading-snug font-semibold">
        {t('rulesTitle')}
      </h2>
      <ol className="flex flex-col gap-5">
        {RULES.map(({ title, body }, index) => (
          <li key={title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="leading-snug font-semibold">{t(title)}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{t(body)}</p>
            </div>
          </li>
        ))}
      </ol>
      <Button size="lg" className={PRIMARY_BUTTON} onClick={onDone}>
        {t('rulesDone')}
      </Button>
    </section>
  );
}

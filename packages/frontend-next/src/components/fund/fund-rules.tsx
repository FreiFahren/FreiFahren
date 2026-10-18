import { useTranslation } from 'react-i18next';

import { NAMESPACE } from './fund.i18n';

const RULES = [
  { title: 'ruleDontPayTitle', body: 'ruleDontPayBody' },
  { title: 'ruleNoTicketTitle', body: 'ruleNoTicketBody' },
  { title: 'ruleRepeatTitle', body: 'ruleRepeatBody' },
] as const;

// Shown only to members: first thing after joining, then at the end of the membership page.
export function FundRules() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <section aria-labelledby="fund-rules-title" className="flex flex-col gap-3">
      <h3 id="fund-rules-title" className="font-heading text-base font-semibold">
        {t('rulesTitle')}
      </h3>
      <ol className="flex flex-col gap-2">
        {RULES.map(({ title, body }, index) => (
          <li
            key={title}
            className="border-accent-bright/25 bg-accent-dim/40 flex gap-3 rounded-lg border p-3"
          >
            <span
              aria-hidden="true"
              className="bg-accent-bright text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm leading-snug font-semibold">{t(title)}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{t(body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

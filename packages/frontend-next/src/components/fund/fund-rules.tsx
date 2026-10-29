import { Dialog } from 'radix-ui';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';

import { NAMESPACE } from './fund.i18n';

const RULES = [
  { title: 'ruleDontPayTitle', body: 'ruleDontPayBody' },
  { title: 'ruleNoTicketTitle', body: 'ruleNoTicketBody' },
  { title: 'ruleRepeatTitle', body: 'ruleRepeatBody' },
] as const;

export function FundRulesSlide({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <Dialog.Title className="font-heading shrink-0 text-xl leading-snug font-semibold">
        {t('rulesTitle')}
      </Dialog.Title>
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to scroll the rules on small screens. */}
      <ol
        tabIndex={0}
        aria-label={t('rulesTitle')}
        className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1"
      >
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
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
      <div className="flex shrink-0 flex-col gap-2">
        <Button type="button" size="lg" className={PRIMARY_BUTTON} onClick={onDone}>
          {t('rulesDone')}
        </Button>
        <Button type="button" size="lg" className={SECONDARY_BUTTON} onClick={onCancel}>
          {t('rulesCancel')}
        </Button>
      </div>
    </section>
  );
}

export function FundRulesDialog({
  open,
  onOpenChange,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const dismiss = () => onOpenChange(false);
    window.addEventListener('popstate', dismiss);
    return () => window.removeEventListener('popstate', dismiss);
  }, [open, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-card fixed top-1/2 right-4 left-4 z-50 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col overflow-hidden rounded-xl p-4 shadow-xl"
        >
          <FundRulesSlide onDone={onConfirm} onCancel={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

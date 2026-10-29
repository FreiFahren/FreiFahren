import { Dialog } from 'radix-ui';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import { NAMESPACE } from './fund.i18n';

const RULES = [
  { title: 'ruleDontPayTitle', body: 'ruleDontPayBody' },
  { title: 'ruleNoTicketTitle', body: 'ruleNoTicketBody' },
  { title: 'ruleRepeatTitle', body: 'ruleRepeatBody' },
] as const;

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
  const { t } = useTranslation(NAMESPACE);

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
        {/* Mirrors the legal disclaimer modal so both rule sheets read as the same kind of notice. */}
        <Dialog.Overlay className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 duration-150">
          <Dialog.Content aria-describedby={undefined} asChild>
            <Card className="animate-in zoom-in-95 fade-in shadow-2 relative z-10 max-h-[85vh] w-full max-w-md duration-200">
              <CardHeader>
                <Dialog.Title asChild>
                  <CardTitle className="font-heading text-lg font-semibold">
                    {t('rulesTitle')}
                  </CardTitle>
                </Dialog.Title>
              </CardHeader>
              <CardContent tabIndex={0} className="min-h-0 flex-1 overflow-y-auto">
                <ol className="marker:text-muted-foreground list-decimal space-y-3 pl-5">
                  {RULES.map(({ title, body }) => (
                    <li key={title}>
                      <strong className="font-semibold">{t(title)}</strong>
                      <p className="text-muted-foreground mt-1 text-sm">{t(body)}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={onConfirm}
                  className="bg-accent-bright text-primary-foreground hover:bg-accent-press"
                >
                  {t('rulesDone')}
                </Button>
                <Button type="button" size="lg" variant="ghost" onClick={() => onOpenChange(false)}>
                  {t('rulesCancel')}
                </Button>
              </CardFooter>
            </Card>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

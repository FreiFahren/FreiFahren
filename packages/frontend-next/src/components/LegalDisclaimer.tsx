import { Link, useRouterState } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  closeLegalDisclaimer,
  useLegalDisclaimer,
  useLegalDisclaimerReview,
} from '@/lib/legal-disclaimer';
import { Route as ImpressumRoute } from '@/routes/impressum';
import { Route as PrivacyRoute } from '@/routes/privacy';

import { NAMESPACE } from './LegalDisclaimer.i18n';

/**
 * Two ways to appear:
 * - Consent gate (non-dismissible): the user hasn't accepted within the last six months and the
 *   active leaf route opted in via `staticData.legalDisclaimer`. The required static-data flag
 *   (see `types/tanstack-router.d.ts`) guarantees every route makes that choice explicitly.
 * - Review (dismissible): opened on demand as the Terms of Use, e.g. from the settings hub.
 */
export function LegalDisclaimer() {
  const { accepted, accept } = useLegalDisclaimer();
  const reviewOpen = useLegalDisclaimerReview();
  const required = useRouterState({
    select: (state) => state.matches.at(-1)?.staticData.legalDisclaimer ?? false,
  });
  const { t } = useTranslation(NAMESPACE);

  const consentRequired = !accepted && required;
  if (!consentRequired && !reviewOpen) return null;

  // Only the hard consent gate is non-dismissible; on-demand review can be closed.
  const dismissible = !consentRequired;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-disclaimer-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 duration-150"
    >
      {/* Review mode can be dismissed by clicking outside; the consent gate cannot. */}
      {dismissible && (
        <Backdrop
          onClose={closeLegalDisclaimer}
          aria-label={t('close')}
          className="z-0 bg-transparent"
        />
      )}
      <Card className="animate-in zoom-in-95 fade-in shadow-2 relative z-10 max-h-[85vh] w-full max-w-md duration-200">
        <CardHeader>
          <CardTitle id="legal-disclaimer-title" className="font-heading text-lg font-semibold">
            {dismissible ? t('reviewTitle') : t('title')}
          </CardTitle>
          <CardDescription className="text-sm">{t('text')}</CardDescription>
          {dismissible && (
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closeLegalDisclaimer}
                aria-label={t('close')}
              >
                <X />
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <ol className="marker:text-muted-foreground list-decimal space-y-3 pl-5">
            <li>
              <strong className="font-medium">{t('ticket')}</strong>
              <p className="text-muted-foreground mt-1 text-sm">{t('ticketDescription')}</p>
            </li>
            <li>
              <strong className="font-medium">{t('activeUsage')}</strong>
              <p className="text-muted-foreground mt-1 text-sm">{t('activeUsageDescription')}</p>
            </li>
          </ol>
          <p className="text-muted-foreground mt-4 text-xs">{t('saved')}</p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          {!dismissible && (
            <Button
              size="lg"
              onClick={accept}
              className="bg-accent-bright text-primary-foreground hover:bg-accent-press"
            >
              {t('confirm')}
            </Button>
          )}
          <div className="flex gap-4 self-end">
            <Link
              to={ImpressumRoute.to}
              preload={false}
              onClick={dismissible ? closeLegalDisclaimer : undefined}
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              {t('imprint')}
            </Link>
            <Link
              to={PrivacyRoute.to}
              preload={false}
              onClick={dismissible ? closeLegalDisclaimer : undefined}
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              {t('privacy')}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

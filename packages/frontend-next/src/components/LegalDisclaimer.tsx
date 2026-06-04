import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useLegalDisclaimer } from '@/lib/legal-disclaimer';
import { Route as PrivacyRoute } from '@/routes/privacy';

import { NAMESPACE } from './LegalDisclaimer.i18n';

/**
 * Visibility is driven by two things: whether the user has accepted within the
 * last six months, and whether the active leaf route opted in via
 * `staticData.legalDisclaimer`. The required static-data flag (see
 * `types/tanstack-router.d.ts`) guarantees every route makes that choice
 * explicitly.
 */
export function LegalDisclaimer() {
  const { accepted, accept } = useLegalDisclaimer();
  const required = useRouterState({
    select: (state) => state.matches.at(-1)?.staticData.legalDisclaimer ?? false,
  });
  const { t } = useTranslation(NAMESPACE);

  if (accepted || !required) return null;

  return (
    // Non-dismissible: this is a consent gate, so the backdrop has no close action.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-disclaimer-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 duration-150"
    >
      <div className="bg-card text-card-foreground ring-foreground/10 animate-in zoom-in-95 fade-in shadow-2 flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-hidden rounded-lg p-5 ring-1 duration-200">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <h1 id="legal-disclaimer-title" className="font-heading mb-3 text-lg font-semibold">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mb-4 text-sm">{t('text')}</p>
          <ol className="marker:text-muted-foreground mb-4 list-decimal space-y-3 pl-5">
            <li>
              <strong className="font-medium">{t('ticket')}</strong>
              <p className="text-muted-foreground mt-1 text-sm">{t('ticketDescription')}</p>
            </li>
            <li>
              <strong className="font-medium">{t('activeUsage')}</strong>
              <p className="text-muted-foreground mt-1 text-sm">{t('activeUsageDescription')}</p>
            </li>
          </ol>
          <p className="text-muted-foreground text-xs">{t('saved')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={accept}
            className="bg-accent-bright text-primary-foreground hover:bg-accent-press"
          >
            {t('confirm')}
          </Button>
          <Link
            to={PrivacyRoute.to}
            className="text-muted-foreground hover:text-foreground self-end text-xs underline"
          >
            {t('privacy')}
          </Link>
        </div>
      </div>
    </div>
  );
}

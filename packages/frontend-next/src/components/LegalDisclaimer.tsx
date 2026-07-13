import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { closeLegalDisclaimer, useLegalDisclaimerReview } from '@/lib/legal-disclaimer';
import { cn } from '@/lib/utils';
import { Route as ImpressumRoute } from '@/routes/impressum';
import { Route as PrivacyRoute } from '@/routes/privacy';

import { NAMESPACE } from './LegalDisclaimer.i18n';

// Points and links are shared with the onboarding legal step so the copy can't drift.

export function LegalDisclaimerPoints() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <ol className="marker:text-muted-foreground list-decimal space-y-3 pl-5">
      <li>
        <strong className="font-semibold">{t('ticket')}</strong>
        <p className="text-muted-foreground mt-1 text-sm">{t('ticketDescription')}</p>
      </li>
      <li>
        <strong className="font-semibold">{t('activeUsage')}</strong>
        <p className="text-muted-foreground mt-1 text-sm">{t('activeUsageDescription')}</p>
      </li>
    </ol>
  );
}

export function LegalLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className={cn('flex gap-4', className)}>
      <Link
        to={ImpressumRoute.to}
        preload={false}
        onClick={onNavigate}
        className="text-muted-foreground hover:text-foreground text-xs underline"
      >
        {t('imprint')}
      </Link>
      <Link
        to={PrivacyRoute.to}
        preload={false}
        onClick={onNavigate}
        className="text-muted-foreground hover:text-foreground text-xs underline"
      >
        {t('privacy')}
      </Link>
    </div>
  );
}

/** Terms of Use review opened from settings; first-time acceptance happens in the legal step. */
export function LegalDisclaimer() {
  const reviewOpen = useLegalDisclaimerReview();
  const { t } = useTranslation(NAMESPACE);

  if (!reviewOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-disclaimer-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 duration-150"
    >
      <Backdrop
        onClose={closeLegalDisclaimer}
        aria-label={t('close')}
        className="z-0 bg-transparent"
      />
      <Card className="animate-in zoom-in-95 fade-in shadow-2 relative z-10 max-h-[85vh] w-full max-w-md duration-200">
        <CardHeader>
          <CardTitle id="legal-disclaimer-title" className="font-heading text-lg font-semibold">
            {t('reviewTitle')}
          </CardTitle>
          <CardDescription className="text-sm">{t('text')}</CardDescription>
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
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <LegalDisclaimerPoints />
          <LegalLinks className="mt-4 justify-end" onNavigate={closeLegalDisclaimer} />
        </CardContent>
      </Card>
    </div>
  );
}

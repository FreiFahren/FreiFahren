import { Link } from '@tanstack/react-router';
import { ChevronRight, HeartHandshake, Mail, MessageSquarePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { Separator } from '@/components/ui/separator';
import { openConsentSettings } from '@/lib/consent';
import { openContributeModal } from '@/lib/contribute-modal';
import { openFeedbackModal } from '@/lib/feedback-modal';
import { openLegalDisclaimer } from '@/lib/legal-disclaimer';
import { Route as ContactRoute } from '@/routes/_map/settings/contact';
import { Route as ImpressumRoute } from '@/routes/impressum';
import { Route as PrivacyRoute } from '@/routes/privacy';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './SettingsButton.i18n';
import { SocialLinks } from './SocialLinks';

const WEBSITE_URL = 'https://freifahren.org';

function LegalLink({
  to,
  onClick,
  children,
}: {
  to?: typeof ImpressumRoute.to | typeof PrivacyRoute.to;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (to) {
    return (
      <Link
        to={to}
        preload={false}
        className="text-muted-foreground hover:text-foreground text-xs underline"
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground text-xs underline"
    >
      {children}
    </button>
  );
}

type SettingsCardProps = {
  onClose: () => void;
};

export function SettingsCard({ onClose }: SettingsCardProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <DetailCard title={t('title')} closeLabel={t('close')} onClose={onClose}>
      <div className="flex flex-col px-2">
        <Link
          to={ContactRoute.to}
          className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors outline-none"
        >
          <Mail className="text-muted-foreground size-4" />
          <span>{t('contact')}</span>
          <ChevronRight className="text-muted-foreground ml-auto size-4" />
        </Link>
        <button
          type="button"
          onClick={() => openFeedbackModal('settings')}
          className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors outline-none"
        >
          <MessageSquarePlus className="text-muted-foreground size-4" />
          <span>{t('feedback')}</span>
          <ChevronRight className="text-muted-foreground ml-auto size-4" />
        </button>
      </div>

      <CardContent>
        <Button
          type="button"
          onClick={() => openContributeModal('settings')}
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press h-11 w-full gap-2"
        >
          <HeartHandshake />
          {t('contribute')}
        </Button>
      </CardContent>

      <Separator className="my-1" />

      <CardContent className="flex flex-col gap-2">
        <SectionHeading className="text-muted-foreground">{t('follow')}</SectionHeading>
        <SocialLinks appearance="inline" className="-ml-2" />
      </CardContent>

      <Separator className="my-1" />

      <CardContent className="flex flex-wrap gap-x-4 gap-y-1">
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          {t('association')}
        </a>
        <LegalLink to={ImpressumRoute.to}>{t('imprint')}</LegalLink>
        <LegalLink to={PrivacyRoute.to}>{t('privacy')}</LegalLink>
        <LegalLink onClick={openLegalDisclaimer}>{t('terms')}</LegalLink>
        <LegalLink onClick={openConsentSettings}>{t('analytics')}</LegalLink>
      </CardContent>
    </DetailCard>
  );
}

import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Route as SettingsRoute } from '@/routes/_map/settings/index';

import { NAMESPACE } from './SettingsButton.i18n';

export function SettingsButton() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="pointer-events-none fixed top-14 left-0 z-20 p-3 sm:top-0">
      <Button
        asChild
        variant="secondary"
        size="icon"
        aria-label={t('open')}
        className="bg-card text-foreground hover:bg-card/80 pointer-events-auto size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
      >
        <Link to={SettingsRoute.to}>
          <Settings className="size-5" />
        </Link>
      </Button>
    </div>
  );
}

import { Link } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/account/account.i18n';
import { Button } from '@/components/ui/button';
import { useAccountsEnabled } from '@/lib/session';
import { Route as AccountRoute } from '@/routes/account/index';

export function AccountButton() {
  const { t } = useTranslation(NAMESPACE);
  if (!useAccountsEnabled()) return null;

  return (
    <Button
      asChild
      variant="secondary"
      size="icon"
      aria-label={t('open')}
      className="bg-card text-foreground hover:bg-card/80 pointer-events-auto size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <Link to={AccountRoute.to}>
        <UserRound className="size-5" />
      </Link>
    </Button>
  );
}

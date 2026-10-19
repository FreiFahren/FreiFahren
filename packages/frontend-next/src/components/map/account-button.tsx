import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/account/account.i18n';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { membershipQueryOptions } from '@/hooks/use-membership';
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
      className="bg-card text-foreground hover:bg-card/80 pointer-events-auto relative size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <Link to={AccountRoute.to}>
        <UserRound className="size-5" />
        <MemberBadge />
      </Link>
    </Button>
  );
}

// A green check on the account button for Fund members.
function MemberBadge() {
  const session = useAuthSession();
  const fundEnabled = useFundEnabled();
  if (!fundEnabled || session.status !== 'signed-in') return null;
  return <MemberCheck userId={session.session.user.id} />;
}

function MemberCheck({ userId }: { userId: string }) {
  const { t } = useTranslation(NAMESPACE);
  // The map is open all the time; the membership rarely changes, so don't refetch on every focus.
  const { data } = useQuery({
    ...membershipQueryOptions(userId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  if (data?.status !== 'active' && data?.status !== 'past_due') return null;
  return (
    <span className="bg-ok ring-card absolute -bottom-0 -right-0 flex size-4 items-center justify-center rounded-full ring-2">
      <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">{t('fundMember')}</span>
    </span>
  );
}

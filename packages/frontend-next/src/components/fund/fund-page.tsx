import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { SignInGate } from '@/components/account/sign-in-gate';
import { PageHeader } from '@/components/templates/PageHeader';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { useKeyboardScrollArea } from '@/hooks/use-keyboard-scroll-area';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { FundMembership } from './fund-membership';
import { FundSignIn } from './fund-sign-in';
import { NAMESPACE } from './fund.i18n';

export function FundPage() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const enabled = useFundEnabled();
  const scrollAreaRef = useKeyboardScrollArea();

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader title={t('title')} onBack={() => navigate({ to: MapIndexRoute.to })} />
        <div
          ref={scrollAreaRef}
          className="pb-safe-6 mb-[max(var(--keyboard-inset),var(--browser-keyboard-inset,0px))] min-h-0 flex-1 overflow-y-auto px-4 pt-4"
        >
          {enabled && <FundAccessFlow />}
        </div>
      </div>
    </div>
  );
}

function FundAccessFlow() {
  // An account isn't a membership: signed-in users join or manage it through Stripe's hosted pages.
  return (
    <SignInGate signedOut={(onSignedIn) => <FundSignIn onSignedIn={onSignedIn} />}>
      {(session, refetch) => (
        <FundMembership
          key={session.session.id}
          userId={session.user.id}
          sessionId={session.session.id}
          onSignIn={refetch}
        />
      )}
    </SignInGate>
  );
}

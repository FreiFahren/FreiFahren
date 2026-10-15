import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { SessionLoadError } from '@/components/account/session-load-error';
import { PageHeader } from '@/components/templates/PageHeader';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useKeyboardScrollArea } from '@/hooks/use-keyboard-scroll-area';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { FundOverview } from './fund-overview';
import { FundSignIn } from './fund-sign-in';
import { NAMESPACE } from './fund.i18n';

export function FundPage() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const auth = useAuthSession();
  const scrollAreaRef = useKeyboardScrollArea();

  let content: ReactNode;
  if (auth.status === 'error') {
    content = <SessionLoadError onRetry={auth.retry} />;
  } else if (auth.status === 'signed-in') {
    content = <FundOverview />;
  } else {
    content = <FundSignIn onSignedIn={auth.refetch} />;
  }

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader title={t('title')} onBack={() => navigate({ to: MapIndexRoute.to })} />
        <div
          ref={scrollAreaRef}
          className="pb-safe-6 mb-[max(var(--keyboard-inset),var(--browser-keyboard-inset,0px))] min-h-0 flex-1 overflow-y-auto px-4 pt-4"
        >
          {content}
        </div>
      </div>
    </div>
  );
}

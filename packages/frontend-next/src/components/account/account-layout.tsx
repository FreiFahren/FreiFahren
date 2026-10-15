import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { NAMESPACE } from './account.i18n';

export const SUPPORT_EMAIL = 'support@freifahren.org';

// Inputs use text-base so iOS doesn't zoom in on focus.
export const BUTTON_SHAPE = 'h-12 w-full rounded-lg text-base font-semibold';
export const PRIMARY_BUTTON = `bg-accent-bright text-primary-foreground hover:bg-accent-press ${BUTTON_SHAPE}`;
export const SECONDARY_BUTTON = `bg-muted hover:bg-muted/80 ${BUTTON_SHAPE}`;
export const INPUT = 'h-12 rounded-lg text-base';

export function AccountLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <FullScreenPage>
      <PageHeader title={title} onBack={() => navigate({ to: MapIndexRoute.to })} />
      <div className="pb-safe-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2">
        {children}
        <SupportHint />
      </div>
    </FullScreenPage>
  );
}

function SupportHint() {
  const { t } = useTranslation(NAMESPACE);
  return (
    <p className="text-muted-foreground mt-auto pt-4 text-center text-xs">
      {t('support')}{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline">
        {SUPPORT_EMAIL}
      </a>
    </p>
  );
}

// Dev-only, so untranslated: without RESEND_API_KEY the auth-worker logs emails instead of sending.
export function DevEmailHint() {
  if (!import.meta.env.DEV) return null;
  return (
    <p className="text-muted-foreground border-border rounded-md border border-dashed p-2 text-xs">
      Local dev: unless the auth-worker has a RESEND_API_KEY, this email is printed in its terminal
      (the [auth] lines of `just dev`) instead of sent.
    </p>
  );
}

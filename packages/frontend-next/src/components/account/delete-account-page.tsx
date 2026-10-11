import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { forgetDeletionToken, getDeletionToken } from '@/lib/deletion-link';
import { clearSessionToken } from '@/lib/session';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { AccountLayout, PRIMARY_BUTTON, SECONDARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';

// Where the emailed deletion link lands. Opening it changes nothing (mail scanners open links on
// their own); only the button deletes, and it needs no session, so the link works in any browser.
export function DeleteAccountPage() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const [token] = useState(getDeletionToken);
  const [state, setState] = useState<'idle' | 'pending' | 'deleted' | 'invalid' | 'error'>(
    token ? 'idle' : 'invalid',
  );

  const confirm = async () => {
    setState('pending');
    const { error } = await authClient.$fetch('/delete-user/confirm', {
      method: 'POST',
      body: { token },
    });
    if (error) {
      if (error.status === 400) forgetDeletionToken();
      setState(error.status === 400 ? 'invalid' : 'error');
      return;
    }
    forgetDeletionToken();
    // The deleted account need not be the one signed in here; drop this device's token only if its
    // session went with it.
    const current = await authClient.getSession();
    if (!current.error && current.data === null) await clearSessionToken();
    authClient.$store.notify('$sessionSignal');
    setState('deleted');
  };

  const backToMap = (
    <Button
      variant="secondary"
      size="lg"
      onClick={() => navigate({ to: MapIndexRoute.to })}
      className={SECONDARY_BUTTON}
    >
      {t('backToMap')}
    </Button>
  );

  return (
    <AccountLayout title={t('deleteTitle')}>
      {state === 'deleted' ? (
        <>
          <p role="status" className="text-sm">
            {t('deleteDone')}
          </p>
          {backToMap}
        </>
      ) : state === 'invalid' ? (
        <>
          <p role="alert" className="text-sm">
            {t('deleteLinkInvalid')}
          </p>
          {backToMap}
        </>
      ) : (
        <>
          <p className="text-sm">{t('deleteConfirmIntro')}</p>
          {state === 'error' && (
            <p role="alert" className="text-destructive text-sm">
              {t('genericError')}
            </p>
          )}
          <Button
            size="lg"
            disabled={state === 'pending'}
            onClick={() => void confirm()}
            className={PRIMARY_BUTTON}
          >
            {t('deleteConfirm')}
          </Button>
        </>
      )}
    </AccountLayout>
  );
}

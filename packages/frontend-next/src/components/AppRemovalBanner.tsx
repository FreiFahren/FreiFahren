import { Capacitor } from '@capacitor/core';
import { TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { track } from '@/lib/analytics';

import { NAMESPACE } from './AppRemovalBanner.i18n';

export const WEBSITE_URL = 'https://app.freifahren.org';

// iOS-only warning that Apple may pull the app from the App Store, pointing users at the identical
// web app instead. Deliberately not persisted anywhere: the dismissal only lives in this component's
// state, so it reappears on every fresh launch (a new JS context) but can still be dismissed for the
// current session. Publishes its height so top-anchored UI shifts down while the warning is visible.
export function AppRemovalBanner() {
  const { t } = useTranslation(NAMESPACE);
  const [dismissed, setDismissed] = useState(false);
  const show = Capacitor.getPlatform() === 'ios' && !dismissed;

  useEffect(() => {
    if (show) track('app_removal_banner_shown', {});
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    const el = document.getElementById('app-removal-banner');
    if (!el) return;
    const apply = () => root.style.setProperty('--top-banner-offset', `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--top-banner-offset');
    };
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div
      id="app-removal-banner"
      className="bg-destructive fixed inset-x-0 top-0 z-50 flex items-start gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 text-white shadow-lg"
    >
      <TriangleAlert className="mt-0.5 size-6 shrink-0" />
      <a
        href={WEBSITE_URL}
        target="_blank"
        rel="noreferrer"
        onClick={() => track('app_removal_banner_clicked', {})}
        className="min-w-0 flex-1"
      >
        <p className="text-base leading-tight font-bold">{t('title')}</p>
        <p className="mt-1 text-sm leading-snug text-white/90">{t('text')}</p>
        <p className="mt-2 text-sm font-semibold underline underline-offset-2">{t('cta')}</p>
      </a>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={() => {
          track('app_removal_banner_dismissed', {});
          setDismissed(true);
        }}
        className="-mt-1 -mr-1 shrink-0 p-1 text-white/80 hover:text-white"
      >
        <X className="size-5" />
      </button>
    </div>,
    document.body,
  );
}

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { APP_STORE_URL, dismissAppBanner, useShowAppBanner } from '@/lib/app-banner';

import { NAMESPACE } from './AppBanner.i18n';

// "Get the app" banner for iOS users on a non-Safari browser (Safari gets Apple's native Smart App
// Banner via the meta tag in index.html). While mounted it publishes its height as --app-banner-offset,
// which the pt-safe / top-safe utilities add in so the top-anchored UI shifts down instead of overlapping.
export function AppBanner() {
  const { t } = useTranslation(NAMESPACE);
  const show = useShowAppBanner();

  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    const el = document.getElementById('app-banner');
    if (!el) return;
    const apply = () => root.style.setProperty('--app-banner-offset', `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--app-banner-offset');
    };
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div
      id="app-banner"
      className="bg-card text-card-foreground border-border-soft fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 shadow-sm"
    >
      <img src="/pwa-192x192.png" alt="" className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{t('title')}</p>
        <p className="text-muted-foreground truncate text-xs">{t('text')}</p>
      </div>
      <Button
        asChild
        size="xs"
        className="bg-accent-bright text-primary-foreground hover:bg-accent-press shrink-0"
      >
        <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
          {t('open')}
        </a>
      </Button>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={dismissAppBanner}
        className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 p-1"
      >
        <X className="size-4" />
      </button>
    </div>,
    document.body,
  );
}

import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useRiskLayer } from '@/hooks/useRiskLayer';
import { selectionTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './LayerToggleButton.i18n';

export function LayerToggleButton() {
  const { t } = useTranslation(NAMESPACE);
  const { visible, toggle } = useRiskLayer();

  return (
    <div className="top-safe-14 pointer-events-none fixed right-0 z-20 p-3 sm:top-0">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          selectionTap();
          toggle();
        }}
        aria-pressed={visible}
        aria-label={visible ? t('hideRiskLayer') : t('showRiskLayer')}
        className={cn(
          'bg-card hover:bg-card/80 pointer-events-auto h-11 flex-col gap-0.5 rounded-lg px-3 shadow-[0_6px_16px_rgba(0,0,0,0.28)]',
          // Risk is the default and switching is rare, so keep the states quiet: full-strength
          // when on, dimmed when off. The label stays put in both states, so it never reflows.
          visible ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Layers className="size-5" />
        <span className="text-[11px] leading-none font-semibold">{t('risk')}</span>
      </Button>
    </div>
  );
}

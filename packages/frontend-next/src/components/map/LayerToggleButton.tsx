import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useRiskLayer } from '@/hooks/useRiskLayer';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './LayerToggleButton.i18n';

export function LayerToggleButton() {
  const { t } = useTranslation(NAMESPACE);
  const { visible, toggle } = useRiskLayer();

  return (
    <div className="pointer-events-none fixed top-0 right-0 z-20 p-3">
      <Button
        type="button"
        variant="secondary"
        onClick={toggle}
        aria-pressed={visible}
        aria-label={visible ? t('hideRiskLayer') : t('showRiskLayer')}
        className={cn(
          'bg-card ring-foreground/10 hover:bg-card/80 pointer-events-auto h-auto flex-col gap-0.5 rounded-lg p-2 shadow-[0_6px_16px_rgba(0,0,0,0.28)] ring-1',
          // Risk is the default and switching is rare, so keep the states quiet: full-strength
          // when on, dimmed when off. The label stays put in both states, so it never reflows.
          visible ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Layers className="size-4" />
        <span className="text-[10px] leading-none font-medium">{t('risk')}</span>
      </Button>
    </div>
  );
}

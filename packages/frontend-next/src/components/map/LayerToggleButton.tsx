import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RISK_COLORS } from '@/api/risk';
import { Button } from '@/components/ui/button';
import { useRiskLayer } from '@/hooks/useRiskLayer';
import { selectionTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './LayerToggleButton.i18n';

const RISK_SCALE = [RISK_COLORS.clear, RISK_COLORS.moderate, RISK_COLORS.high, RISK_COLORS.severe];

export function LayerToggleButton() {
  const { t } = useTranslation(NAMESPACE);
  const { visible, toggle } = useRiskLayer();

  return (
    <div className="top-safe-14 pointer-events-none fixed right-0 z-20 flex flex-col items-end gap-1.5 p-3 sm:top-0">
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
          'bg-card hover:bg-card/80 pointer-events-auto h-11 w-[4.5rem] flex-col gap-0.5 rounded-lg px-3 shadow-[0_6px_16px_rgba(0,0,0,0.28)]',
          // Risk is the default and switching is rare, so keep the states quiet: full-strength
          // when on, dimmed when off. The fixed width keeps the two labels from reflowing the row.
          visible ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Layers className="size-5" />
        <span className="text-[11px] leading-none font-semibold">
          {visible ? t('risk') : t('lines')}
        </span>
      </Button>
      {/*
       * The risk shading had no key, so users couldn't tell what the colours meant (in-app
       * feedback: "the risk button is unclear", "Was bedeuten die Farben der Gleise?"). Only the
       * risk scale needs one — in the other state the button reads "Lines" and the segments carry
       * the network's own colours.
       */}
      {visible && (
        <div className="bg-card text-card-foreground pointer-events-none w-[4.5rem] rounded-lg p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.28)]">
          <div className="flex overflow-hidden rounded-full">
            {RISK_SCALE.map((color) => (
              <span key={color} className="h-1.5 flex-1" style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[9px] leading-none">
            <span>{t('riskLow')}</span>
            <span>{t('riskHigh')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

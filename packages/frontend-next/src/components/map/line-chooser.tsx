import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { DAY_MS, useReports } from '@/api/reports';
import { type Line, useLines } from '@/api/transit';
import { Button } from '@/components/ui/button';

import { NAMESPACE } from './line-chooser.i18n';
import { PopupCard } from './PopupCard';
import { LineReportRow } from './StationLineReports';
import { lineReportsForIds } from './station-detail-data';

type LineChooserProps = {
  lines: Line[];
  onSelect: (name: string) => void;
  onClose: () => void;
};

export function LineChooser({ lines, onSelect, onClose }: LineChooserProps) {
  const { t } = useTranslation(NAMESPACE);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const { data: allLines } = useLines();
  const { data: reports, isSuccess: reportsLoaded } = useReports(DAY_MS);
  const names = new Set(lines.map((line) => line.name));
  const variants = (allLines ?? lines).filter((line) => names.has(line.name));
  const lineReports = lineReportsForIds(
    variants.map((line) => line.id),
    variants,
    reports,
  );

  useEffect(() => {
    firstChoiceRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <PopupCard
      onClose={onClose}
      closeLabel={t('close')}
      cardClassName="max-h-[min(28rem,70dvh)] overflow-hidden"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-chooser-title"
        className="flex min-h-0 flex-col"
      >
        <div className="flex items-start justify-between gap-2 px-4 pb-2">
          <div>
            <h2 id="line-chooser-title" className="font-heading text-lg font-semibold">
              {t('title')}
            </h2>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')}>
            <X />
          </Button>
        </div>
        <div className="divide-border mx-4 min-h-0 overflow-y-auto overscroll-contain rounded-md border">
          {lineReports.map((line, index) => (
            <LineReportRow
              key={line.name}
              line={line}
              onSelect={() => onSelect(line.name)}
              buttonRef={index === 0 ? firstChoiceRef : undefined}
              reportsLoaded={reportsLoaded}
            />
          ))}
        </div>
      </section>
    </PopupCard>,
    document.body,
  );
}

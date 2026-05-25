import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type Station, useLines } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { resolveStationLineNames } from '@/components/transit/displayLines';
import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { NAMESPACE } from './StationDetail.i18n';

type StationDetailProps = {
  station: Station;
  onClose: () => void;
};

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const lineNames = resolveStationLineNames(station.lines, lines);

  return (
    <>
      <Backdrop
        aria-label={t('close')}
        onClose={onClose}
        className="animate-in fade-in duration-150"
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3">
        <Card className="animate-in slide-in-from-bottom-4 fade-in pointer-events-auto w-full max-w-md gap-1 py-4 duration-200 ease-out">
          <CardContent className="flex items-start justify-between">
            <h2 className="font-heading text-lg font-semibold">{station.name}</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')}>
              <X />
            </Button>
          </CardContent>
          <CardContent className="flex flex-wrap gap-1.5">
            {lineNames.map((name) => (
              <LineBadge key={name} name={name} />
            ))}
          </CardContent>
          <CardContent className="mt-2">
            <Button
              variant="default"
              className="bg-destructive hover:bg-destructive/90 h-9 w-full text-sm font-medium text-white"
            >
              {t('reportSighting')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

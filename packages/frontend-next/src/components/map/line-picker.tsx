import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { prefetchLineInsights } from '@/api/insights';
import { useLines, useStations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { CardContent } from '@freifahren/ui/card';
import { mergeLineVariants } from '@/lib/line-variants';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './line-picker.i18n';

type LinePickerProps = {
  lineNames: string[];
  onClose: () => void;
};

function LineRow({ name }: { name: string }) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const { data: stations } = useStations();
  // Merged like the detail this row opens, so both name the same ends.
  const variants = (lines ?? []).filter((line) => line.name === name);
  const line = variants.length > 0 ? mergeLineVariants(variants) : undefined;
  const start = stations?.[line?.stations[0] ?? '']?.name;
  const end = stations?.[line?.stations.at(-1) ?? '']?.name;
  // A ring has no ends to tell it apart by.
  const route = line?.isCircular ? t('circular') : start && end ? `${start} – ${end}` : '';

  return (
    <Link
      to={LineDetailRoute.to}
      params={{ lineName: name }}
      search={{ source: 'map' }}
      className="hover:bg-muted/70 focus-visible:ring-ring flex items-center gap-3 px-3 py-2.5 outline-none focus-visible:ring-2"
    >
      <LineBadge name={name} className="shrink-0" />
      <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">{route}</p>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}

export function LinePicker({ lineNames, onClose }: LinePickerProps) {
  const { t } = useTranslation(NAMESPACE);
  const queryClient = useQueryClient();

  // One request warms every listed line's insights, so whichever is picked opens filled.
  useEffect(() => {
    prefetchLineInsights(queryClient, lineNames);
  }, [lineNames, queryClient]);

  return (
    <DetailCard
      title={t('title')}
      closeLabel={t('close')}
      onClose={onClose}
      cardClassName="max-h-[calc(var(--viewport-height)-6rem)]"
    >
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-xs">{t('description')}</p>
        <div className="divide-border max-h-[calc(var(--viewport-height)*0.4)] divide-y overflow-y-auto overscroll-contain rounded-md border">
          {lineNames.map((name) => (
            <LineRow key={name} name={name} />
          ))}
        </div>
      </CardContent>
    </DetailCard>
  );
}

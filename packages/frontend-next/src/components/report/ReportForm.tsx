import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LINE_TYPE_PRIORITY, type LineType, useLines } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Route as IndexRoute } from '@/routes/index';

import { NAMESPACE } from './ReportForm.i18n';

type LineFilter = 'all' | LineType;

const FILTERS: LineFilter[] = ['all', 'subway', 'light_rail', 'tram'];

type LinePickerProps = {
  selectedLine: string | null;
  onSelectLine: (name: string | null) => void;
};

function LinePicker({ selectedLine, onSelectLine }: LinePickerProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const [filter, setFilter] = useState<LineFilter>('all');

  // One badge per line name (collapsing per-direction variants), ordered
  // U-Bahn → S-Bahn → Tram, then ascending within a group (e.g. U1 before U9).
  const allLines = () => {
    const typeByName = new Map<string, LineType>();
    for (const line of lines ?? []) {
      if (!typeByName.has(line.name)) typeByName.set(line.name, line.type);
    }
    return [...typeByName]
      .map(([name, type]) => ({ name, type }))
      .sort((a, b) => {
        if (LINE_TYPE_PRIORITY[a.type] !== LINE_TYPE_PRIORITY[b.type]) {
          return LINE_TYPE_PRIORITY[a.type] - LINE_TYPE_PRIORITY[b.type];
        }
        return parseInt(a.name.replace(/\D/g, ''), 10) - parseInt(b.name.replace(/\D/g, ''), 10);
      });
  };

  const visibleLines = filter === 'all' ? allLines() : allLines().filter((l) => l.type === filter);

  return (
    <section className="px-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 tracking-wide uppercase">
          <h2 className="text-sm font-semibold">{t('line')}</h2>
          <p className="text-muted-foreground text-[0.625rem] tracking-wide">{t('optional')}</p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          value={filter}
          onValueChange={(value) => {
            if (value) setFilter(value as LineFilter);
          }}
          className="bg-surface-solid border-border border"
        >
          {FILTERS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="text-muted-foreground data-[state=on]:bg-surface-elev data-[state=on]:text-foreground font-semibold tracking-wide uppercase"
            >
              {t(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleLines.map((line) => {
          const isSelected = selectedLine === line.name;
          return (
            <button
              key={line.name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                if (isSelected) {
                  onSelectLine(null);
                  return;
                }
                onSelectLine(line.name);
                setFilter(line.type);
              }}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <LineBadge name={line.name} className={cn(isSelected && 'ring-2 ring-white')} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ReportForm() {
  const { t } = useTranslation(NAMESPACE);
  const [lineName, setLineName] = useState<string | null>(null);

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 overflow-y-auto duration-150">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <header className="flex items-center gap-2 px-4 pt-6">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('back')}>
            <Link to={IndexRoute.to}>
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="font-heading text-lg font-semibold">{t('title')}</h1>
        </header>
        <Separator className="my-2" />

        <LinePicker selectedLine={lineName} onSelectLine={setLineName} />
      </div>
    </div>
  );
}

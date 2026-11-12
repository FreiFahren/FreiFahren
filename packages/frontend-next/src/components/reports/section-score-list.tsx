import { useTranslation } from 'react-i18next';

import type { ReportStatistics } from '@/api/statistics';
import { useLines } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';

import { NAMESPACE } from './Reports.i18n';

type SectionScoreListProps = { sections: ReportStatistics['sections'] };

export function SectionScoreList({ sections }: SectionScoreListProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();

  const colorByLine = new Map<string, string>();
  for (const line of lines ?? []) {
    if (!colorByLine.has(line.name)) colorByLine.set(line.name, line.color);
  }
  // The busiest section fills the full bar width; every other section scales against it.
  const maxScore = Math.max(...sections.map((section) => section.score), 0);

  return (
    <ol>
      {sections.map((section) => (
        <li
          key={`${section.from.id}-${section.to.id}`}
          className="flex min-h-14 items-center gap-3 px-4 py-2"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap gap-1">
              {section.lines.map((line) => (
                <LineBadge
                  key={line.name}
                  name={line.name}
                  className="h-5 w-auto px-1.5 text-[10px]"
                />
              ))}
            </div>
            <span className="truncate text-sm font-medium">
              {t('sectionBetween', { from: section.from.name, to: section.to.name })}
            </span>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${maxScore > 0 ? (section.score / maxScore) * 100 : 0}%`,
                  // The biggest contributor's colour; the badges show the rest.
                  backgroundColor: colorByLine.get(section.lines[0]!.name),
                }}
              />
            </div>
          </div>
          {/* A count rather than a share: spread over the whole network, even the busiest section is ~2%. */}
          <span
            className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums"
            aria-label={t('sectionReportCount', { count: Math.round(section.score) })}
          >
            {Math.round(section.score)}
          </span>
        </li>
      ))}
    </ol>
  );
}

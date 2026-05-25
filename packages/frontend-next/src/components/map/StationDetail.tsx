import { X } from 'lucide-react';

import { type Line, type Segments, type Station, useLines, useSegments } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type StationDetailProps = {
  station: Station;
  onClose: () => void;
};

function buildLineColors(segments: Segments | undefined): Map<string, string> {
  const colors = new Map<string, string>();
  if (!segments) return colors;
  for (const feature of segments.features) {
    const { line, color } = feature.properties;
    if (!colors.has(line)) colors.set(line, color);
  }
  return colors;
}

function buildLineNames(lines: Line[] | undefined): Map<string, string> {
  const names = new Map<string, string>();
  if (!lines) return names;
  for (const line of lines) names.set(line.id, line.name);
  return names;
}

type DisplayLine = { name: string; color: string | undefined };

function resolveDisplayLines(
  lineIds: Station['lines'],
  lineNames: Map<string, string>,
  lineColors: Map<string, string>,
): DisplayLine[] {
  const seen = new Set<string>();
  const result: DisplayLine[] = [];
  for (const id of lineIds) {
    const name = lineNames.get(id) ?? id;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({ name, color: lineColors.get(id) });
  }
  return result;
}

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { data: segments } = useSegments();
  const { data: lines } = useLines();
  const displayLines = resolveDisplayLines(
    station.lines,
    buildLineNames(lines),
    buildLineColors(segments),
  );

  return (
    <>
      <Backdrop aria-label="Close station details" onClose={onClose} />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3">
        <Card className="pointer-events-auto w-full max-w-md gap-1 py-4">
          <CardContent className="flex items-start justify-between">
            <h2 className="font-heading text-lg font-semibold">{station.name}</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X />
            </Button>
          </CardContent>
          <CardContent className="flex flex-wrap gap-1.5">
            {displayLines.map(({ name, color }) => (
              <LineBadge key={name} name={name} color={color} />
            ))}
          </CardContent>
          <CardContent className="mt-2">
            <Button
              variant="default"
              className="bg-destructive hover:bg-destructive/90 h-9 w-full text-sm font-medium text-white"
            >
              Report sighting
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import type { Line, Station } from '@/api/transit';

export function resolveStationLineNames(
  lineIds: Station['lines'],
  lines: Line[] | undefined,
): string[] {
  const nameById = new Map<string, string>();
  if (lines) for (const line of lines) nameById.set(line.id, line.name);

  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of lineIds) {
    const name = nameById.get(id) ?? id;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

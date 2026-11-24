import type { Line } from '@/api/transit';

type TappedFeature = { layer: { id: string }; properties: Record<string, unknown> | null };

/**
 * The lines under a tap, one per name. Lines that share a track each draw their own segment
 * there, and a line's variants share its name, so one tap can hit several segments that are one
 * line, or several lines at once.
 */
export function tappedLines(
  features: TappedFeature[] | undefined,
  hitLayerIds: readonly string[],
  lines: Line[] | undefined,
): Line[] {
  if (!features || !lines) return [];

  const lineById = new Map(lines.map((line) => [line.id, line]));
  const tapped = new Map<string, Line>();
  for (const feature of features) {
    if (!hitLayerIds.includes(feature.layer.id)) continue;
    const line = lineById.get(String(feature.properties?.line));
    if (line && !tapped.has(line.name)) tapped.set(line.name, line);
  }

  return [...tapped.values()];
}

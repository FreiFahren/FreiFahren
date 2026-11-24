import { stripTypedModeMarker } from '@freifahren/cities';

/**
 * Tests a station name against a typed query, or null when nothing was typed. Station names carry
 * no mode marker, so "S Karlshorst" also has to find "Karlshorst". The query as typed still
 * counts, for a name that really starts with a lone "S" or "U".
 *
 * `normalize` is how the caller folds names; the names passed to the matcher are already folded.
 */
export function stationMatcher(
  query: string,
  normalize: (value: string) => string,
): ((normalizedName: string) => boolean) | null {
  const typed = query.trim();
  if (!typed) return null;
  const needles = [...new Set([typed, stripTypedModeMarker(typed)].map(normalize))];
  return (normalizedName) => needles.some((needle) => normalizedName.includes(needle));
}

import { LINE_TYPE_PRIORITY, type LineType } from '@/api/transit';
import { currentCity } from '@/lib/city';

import { type LineFilter } from './ReportSelection.context';

const LINE_TYPES = new Set<string>(Object.keys(LINE_TYPE_PRIORITY));

export const LINE_FILTERS: LineFilter[] = [
  'all',
  ...currentCity.seed.routeTypePriority
    .filter((type): type is LineType => LINE_TYPES.has(type))
    .sort((a, b) => LINE_TYPE_PRIORITY[a] - LINE_TYPE_PRIORITY[b]),
];

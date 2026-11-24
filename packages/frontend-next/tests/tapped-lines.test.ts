import { describe, expect, it } from 'vitest';

import type { Line } from '../src/api/transit';
import { tappedLines } from '../src/lib/tapped-lines';

const HIT_LAYER = 'segments-hit';
const HIT_LAYERS = [HIT_LAYER, 'risk-segments-hit'];

const line = (id: string, name: string, type: Line['type']): Line => ({
  id,
  name,
  type,
  isCircular: false,
  color: '#000000',
  stations: [],
});

const lines = [
  line('s5', 'S5', 'light_rail'),
  line('s7', 'S7', 'light_rail'),
  line('u8-a', 'U8', 'subway'),
  line('u8-b', 'U8', 'subway'),
];

const segment = (lineId: string, layerId = HIT_LAYER) => ({
  layer: { id: layerId },
  properties: { id: 1, line: lineId },
});

const tappedLineNames = (...args: Parameters<typeof tappedLines>) =>
  tappedLines(...args).map((tapped) => tapped.name);

describe('tapped lines', () => {
  it('names the one line under the tap', () => {
    expect(tappedLineNames([segment('s5')], HIT_LAYERS, lines)).toEqual(['S5']);
  });

  it('counts the variants of a line once', () => {
    expect(tappedLineNames([segment('u8-a'), segment('u8-b')], HIT_LAYERS, lines)).toEqual(['U8']);
  });

  it('lists every line on a shared track', () => {
    const tapped = tappedLineNames(
      [segment('s7'), segment('u8-a'), segment('s5')],
      HIT_LAYERS,
      lines,
    );
    expect(tapped).toEqual(['S7', 'U8', 'S5']);
  });

  it('ignores features of other layers and unknown lines', () => {
    const tapped = tappedLineNames(
      [segment('s5', 'stations-hit'), segment('gone')],
      HIT_LAYERS,
      lines,
    );
    expect(tapped).toEqual([]);
  });

  it('finds nothing until the lines have loaded', () => {
    expect(tappedLineNames([segment('s5')], HIT_LAYERS, undefined)).toEqual([]);
  });
});

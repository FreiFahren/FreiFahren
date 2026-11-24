import { useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

// Without a glyph server MapLibre uses a layer's font stack as a CSS font family, falling back to
// the device's sans-serif, and reads the weight off a word like "Bold" in it. A stack must not
// contain a generic family keyword such as `system-ui`: the canvas then rejects the font and
// draws 10px glyphs.
export const LABEL_FONT_BOLD = ['Map Label Bold'];
export const LABEL_FONT_MEDIUM = ['Map Label Medium'];

/**
 * True once text layers can be added. The basemap style names a glyph server that doesn't exist
 * (it has no text of its own), so this clears it first: MapLibre then draws glyphs from the
 * device's fonts, which costs no request and works offline. A few short names don't justify
 * hosting a font.
 */
export function useLocalGlyphs(): boolean {
  const { current: mapRef } = useMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const prepare = () => {
      if (map.getGlyphs()) map.setGlyphs(null);
      setReady(true);
    };
    if (map.isStyleLoaded()) {
      prepare();
      return;
    }
    map.once('idle', prepare);
    return () => void map.off('idle', prepare);
  }, [mapRef]);

  return ready;
}

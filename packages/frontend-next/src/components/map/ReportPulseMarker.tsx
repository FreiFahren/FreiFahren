import { Marker } from 'react-map-gl/maplibre';

type ReportPulseMarkerProps = {
  longitude: number;
  latitude: number;
  opacity: number;
};

/**
 * The pulse + dot for a fresh, unviewed report, rendered as a DOM marker so the pulse runs as a
 * compositor-driven CSS animation (off the main thread, no map repaint). Reuses MapLibre's own
 * `maplibregl-user-location-dot-pulse` keyframe (from maplibre-gl.css, imported by `Map`). Clicks
 * are owned by the WebGL hit layer underneath, so this marker is `pointer-events:none`.
 */
export function ReportPulseMarker({ longitude, latitude, opacity }: ReportPulseMarkerProps) {
  return (
    <Marker longitude={longitude} latitude={latitude} opacity={opacity.toString()}>
      <span className="pointer-events-none relative block h-5 w-5">
        <span
          className="bg-destructive absolute inset-0 rounded-full"
          style={{ animation: 'maplibregl-user-location-dot-pulse 2s infinite' }}
        />
        <span className="bg-destructive relative block h-5 w-5 rounded-full border-2 border-white shadow-sm" />
      </span>
    </Marker>
  );
}

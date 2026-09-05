import { Marker } from 'react-map-gl/maplibre';

type ReportDirectionMarkerProps = {
  longitude: number;
  latitude: number;
  bearing: number;
  opacity: number;
};

export function ReportDirectionMarker({
  longitude,
  latitude,
  bearing,
  opacity,
}: ReportDirectionMarkerProps) {
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      rotation={bearing}
      rotationAlignment="map"
      pitchAlignment="map"
      opacity={opacity.toString()}
      style={{ pointerEvents: 'none' }}
    >
      <svg
        aria-hidden="true"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        className="text-destructive"
      >
        <path
          d="m19 9 5-5 5 5"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m19 9 5-5 5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Marker>
  );
}

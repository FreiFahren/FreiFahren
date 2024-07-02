import MapLibreGL, {
  Camera,
  LineLayer,
  MapView,
  ShapeSource,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import Geolocation from "@react-native-community/geolocation";
import { noop } from "lodash";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Report } from "../../api";
import { config } from "../../config";
import lines from "../../data/line-segments.json";
import { ReportDetailsNotification } from "./ReportDetailsNotification";
import { ReportMarker } from "./ReportMarker";
import { StationLayer } from "./StationLayer";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
MapLibreGL.setAccessToken(null);

const MAP_REGION = {
  longitude: 13.40587,
  latitude: 52.51346,
  longitudeDelta: 0.1,
  latitudeDelta: 0.1,
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
    alignSelf: "stretch",
  },
});

// Workaround: Map pan performance issue
const useShowMarkersWithDelay = () => {
  const [showMarkers, setShowMarkers] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShowMarkers(true), 500);

    return () => clearTimeout(timeout);
  }, []);

  return showMarkers;
};

type FFMapViewProps = {
  reports: Report[];
};

export const FFMapView = ({ reports }: FFMapViewProps) => {
  useEffect(() => {
    Geolocation.requestAuthorization(noop, noop);
  }, []);

  const [reportToShow, setReportToShow] = useState<Report | null>(null);

  const showMarkers = useShowMarkersWithDelay();

  return (
    <>
      <MapView
        style={styles.map}
        logoEnabled={false}
        styleURL={config.MAP_STYLE_URL}
        attributionEnabled={false} // TODO: Custom attribution
      >
        {showMarkers &&
          reports.map((report, index) => (
            <ReportMarker
              // eslint-disable-next-line react/no-array-index-key
              key={report.stationId + index}
              report={report}
              onClick={() => setReportToShow(report)}
            />
          ))}
        <UserLocation visible animated />
        <Camera
          defaultSettings={{
            centerCoordinate: [MAP_REGION.longitude, MAP_REGION.latitude],
            zoomLevel: 10,
          }}
          maxBounds={{
            ne: [13.88044556529124, 52.77063424239867],
            sw: [12.8364646484805, 52.23115511676795],
          }}
          minZoomLevel={9.5}
          maxZoomLevel={13}
        />
        <ShapeSource id="route-source" shape={lines as GeoJSON.GeoJSON}>
          <LineLayer
            id="route-layer"
            style={{
              lineWidth: 3,
              lineJoin: "round",
              lineCap: "round",
              lineColor: ["get", "color"],
              iconAllowOverlap: true,
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>
        <StationLayer />
      </MapView>
      {reportToShow !== null && (
        <ReportDetailsNotification
          report={reportToShow}
          onClose={() => setReportToShow(null)}
        />
      )}
    </>
  );
};

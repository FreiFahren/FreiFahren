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
import { ReportsLayer } from "./ReportsLayer";
import { StationLayer } from "./StationLayer";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
MapLibreGL.setAccessToken(null);

const MAP_REGION = {
  longitude: 13.40587,
  latitude: 52.51346,
  bounds: {
    ne: [13.88044556529124, 52.77063424239867],
    sw: [12.8364646484805, 52.23115511676795],
  },
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
    alignSelf: "stretch",
  },
});

export const LinesLayer = () => (
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
);

type FFMapViewProps = {
  reports: Report[];
};

export const FFMapView = ({ reports }: FFMapViewProps) => {
  useEffect(() => {
    Geolocation.requestAuthorization(noop, noop);
  }, []);

  const [reportToShow, setReportToShow] = useState<Report | null>(null);

  return (
    <>
      <MapView
        style={styles.map}
        logoEnabled={false}
        styleURL={config.MAP_STYLE_URL}
        attributionEnabled={false} // TODO: Custom attribution
      >
        <Camera
          defaultSettings={{
            centerCoordinate: [MAP_REGION.longitude, MAP_REGION.latitude],
            zoomLevel: 9,
          }}
          maxBounds={MAP_REGION.bounds}
          minZoomLevel={9}
          maxZoomLevel={13}
        />
        <LinesLayer />
        <StationLayer />
        <ReportsLayer reports={reports} onPressReport={setReportToShow} />
        <UserLocation visible animated />
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

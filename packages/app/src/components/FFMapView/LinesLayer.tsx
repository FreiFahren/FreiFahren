import { LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";

import { linesGeoJSON } from "../../data";

export const LinesLayer = () => (
  <ShapeSource id="route-source" shape={linesGeoJSON as GeoJSON.GeoJSON}>
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

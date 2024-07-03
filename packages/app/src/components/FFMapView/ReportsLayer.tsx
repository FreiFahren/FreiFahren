import {
  CircleLayer,
  MarkerView,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Report } from "../../api";
import { stations } from "../../data";

const styles = StyleSheet.create({
  pulse: {
    backgroundColor: "red",
    width: 20,
    height: 20,
    borderRadius: 9999,
  },
});

// Workaround: Map pan performance issue when showing markers immediately
const useShowMarkersWithDelay = () => {
  const [showMarkers, setShowMarkers] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShowMarkers(true), 100);

    return () => clearTimeout(timeout);
  }, []);

  return showMarkers;
};

const Pulse = () => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withDelay(
        1000,
        withTiming(1, {
          duration: 1000,
          easing: Easing.linear,
        })
      ),
      -2,
      false
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0]),
    transform: [
      {
        scale: interpolate(pulse.value, [0, 1], [0, 2.2]),
      },
    ],
  }));

  return <Animated.View style={[styles.pulse, animatedStyle]} />;
};

type ReportsLayerProps = {
  reports: Report[];
  onPressReport: (report: Report) => void;
};

export const ReportsLayer = ({ reports, onPressReport }: ReportsLayerProps) => {
  const reportsGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: reports.map((report) => {
        const { coordinates } = stations[report.stationId];

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [coordinates.longitude, coordinates.latitude],
          },
          properties: {
            id: report.stationId,
          },
        };
      }),
    }),
    [reports]
  );

  const showMarkers = useShowMarkersWithDelay();

  return (
    <>
      {showMarkers &&
        reports.map((report) => (
          <MarkerView
            coordinate={[
              stations[report.stationId].coordinates.longitude,
              stations[report.stationId].coordinates.latitude,
            ]}
            key={report.stationId}
            allowOverlap
          >
            <Pressable onPress={() => onPressReport(report)} hitSlop={10}>
              <Pulse />
            </Pressable>
          </MarkerView>
        ))}
      <ShapeSource
        id="reports-source"
        shape={reportsGeoJson as GeoJSON.GeoJSON}
      >
        <CircleLayer
          id="reports-layer"
          style={{
            circleRadius: 6,
            circleColor: "#f00",
            circleStrokeWidth: 3,
            circleStrokeColor: "#fff",
          }}
        />
      </ShapeSource>
    </>
  );
};

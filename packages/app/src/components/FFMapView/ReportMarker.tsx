import { MarkerView } from "@maplibre/maplibre-react-native";
import { View } from "native-base";
import { useEffect } from "react";
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
  marker: {
    position: "absolute",
    backgroundColor: "red",
    width: 20,
    height: 20,
    borderWidth: 3,
    borderRadius: 9999,
  },
});

const OPulsingMarker = () => {
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

  return (
    <View position="relative" overflow="visible" width="20px" height="20px">
      <View borderColor="white" style={styles.marker} />
      <Animated.View
        style={[{ borderColor: "transparent" }, styles.marker, animatedStyle]}
      />
    </View>
  );
};

type ReportMarkerProps = {
  report: Report;
  onClick: () => void;
};

export const ReportMarker = ({
  report: { stationId },
  onClick,
}: ReportMarkerProps) => {
  const station = stations[stationId];

  const { latitude, longitude } = station.coordinates;

  return (
    <MarkerView coordinate={[longitude, latitude]} allowOverlap>
      <Pressable onPress={onClick} hitSlop={10}>
        <OPulsingMarker />
      </Pressable>
    </MarkerView>
  );
};

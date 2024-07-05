import { View } from "native-base";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { theme } from "../../theme";

const styles = StyleSheet.create({
  spinner: {
    width: "100%",
    height: "100%",
    position: "absolute",
    borderWidth: 5,
    borderRadius: 9999,
  },
});

interface FFSpinnerProps {
  size?: number;
  color1?: string;
  color2?: string;
  speed?: number;
}

export const FFSpinner = ({
  size = 10,
  color1 = theme.colors.bg,
  color2 = theme.colors.blue[500],
  speed = 650,
}: FFSpinnerProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(rotation.value + 360, {
        duration: speed,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [rotation, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View width={size} height={size}>
      <Animated.View
        style={[
          styles.spinner,
          { borderColor: color1, borderTopColor: color2 },
          animatedStyle,
        ]}
      />
    </View>
  );
};

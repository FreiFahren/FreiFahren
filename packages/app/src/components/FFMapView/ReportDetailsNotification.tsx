import { MaterialIcons } from "@expo/vector-icons";
import { Box, Text, View } from "native-base";
import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Report } from "../../api";
import { stations } from "../../data";
import { FFBox } from "../common/FFBox";
import { FFLineTag } from "../common/FFLineTag";

const animationConfig = {
  duration: 400,
  easing: Easing.elastic(0.3),
};

type ReportDetailsNotificationProps = {
  report: Report;
  onClose: () => void;
};

export const ReportDetailsNotification = ({
  report: { stationId, timestamp },
  onClose,
}: ReportDetailsNotificationProps) => {
  const station = stations[stationId];

  const animation = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -animation.value * 200 }],
  }));

  useEffect(() => {
    animation.value = withTiming(0, animationConfig);
  }, [animation]);

  const handleClose = () => {
    animation.value = withTiming(1, animationConfig, () => runOnJS(onClose)());
  };

  return (
    <Box safeAreaTop position="absolute" top={0} left={0} right={0} px={4}>
      <Animated.View style={animatedStyle}>
        <FFBox>
          <View
            flexDir="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <View>
              <View flexDir="row" alignItems="center">
                {station.lines.map((line) => (
                  <FFLineTag key={line} line={line} />
                ))}
                <Text color="white" bold ml={1}>
                  {station.name}
                </Text>
              </View>
              <Text color="fg" mt={1}>
                {new Date(timestamp).toLocaleString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={10}>
              <MaterialIcons name="close" color="white" size={32} />
            </Pressable>
          </View>
        </FFBox>
      </Animated.View>
    </Box>
  );
};

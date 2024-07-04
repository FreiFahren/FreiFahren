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
import { ReportItem } from "../common/ReportItem";

const animationConfig = {
  duration: 400,
  easing: Easing.elastic(0.3),
};

type ReportDetailsNotificationProps = {
  report: Report;
  onClose: () => void;
};

export const ReportDetailsNotification = ({
  report,
  onClose,
}: ReportDetailsNotificationProps) => {
  const station = stations[report.stationId];

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
        <FFBox flexDir="row" alignItems="center" justifyContent="space-between">
          <ReportItem report={report} />
          <Pressable onPress={handleClose} hitSlop={10}>
            <MaterialIcons name="close" color="white" size={32} />
          </Pressable>
        </FFBox>
      </Animated.View>
    </Box>
  );
};

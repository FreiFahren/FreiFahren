import { View } from "native-base";

import { FFMapView } from "./components/FFMapView";
import { UIOverlay } from "./components/UIOverlay";

export const Main = () => (
  <View width="100%" height="100%">
    <FFMapView />
    <UIOverlay />
  </View>
);

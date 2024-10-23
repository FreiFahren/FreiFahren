import { Text } from "native-base";

import { FFBox } from "../common/FFBox";
import { FFSpinner } from "../common/FFSpinner";

export const LoadingBar = () => (
  <FFBox alignItems="center" justifyContent="space-between" flexDirection="row">
    <Text color="white" fontSize="md">
      Meldungen werden geladen...
    </Text>
    <FFSpinner size={8} />
  </FFBox>
);

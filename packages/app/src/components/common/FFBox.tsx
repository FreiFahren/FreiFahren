import { View } from "native-base";
import { ComponentProps } from "react";

type FFBoxProps = ComponentProps<typeof View>;

export const FFBox = (props: FFBoxProps) => (
  <View
    bg="bg"
    borderRadius={24}
    borderColor="bg2"
    borderWidth={3}
    p={3}
    {...props}
  />
);

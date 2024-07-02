import { Text, View } from "native-base";
import { ComponentProps } from "react";

type LineTagProps = {
  line: string;
  textProps?: ComponentProps<typeof Text>;
} & ComponentProps<typeof View>;

export const FFLineTag = ({ line, textProps, ...props }: LineTagProps) => (
  <View bg={`lines.${line}`} px={1} borderRadius={4} mr={1} {...props}>
    <Text color="white" textAlign="center" bold {...textProps}>
      {line}
    </Text>
  </View>
);

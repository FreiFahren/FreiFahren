import { Button } from "native-base";
import { ComponentProps } from "react";

type FFButtonProps = ComponentProps<typeof Button>;

export const FFButton = (props: FFButtonProps) => (
  <Button
    backgroundColor="bg"
    borderRadius={24}
    borderColor="bg2"
    borderWidth={3}
    p={3}
    {...props}
  />
);

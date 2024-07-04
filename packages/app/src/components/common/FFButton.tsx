import { Button } from "native-base";
import { ComponentProps, PropsWithChildren } from "react";

type FFButtonProps = PropsWithChildren<ComponentProps<typeof Button>>;

export const FFButton = ({ children, ...props }: FFButtonProps) => (
  <Button
    backgroundColor="bg"
    borderRadius={24}
    borderColor="bg2"
    borderWidth={3}
    p={3}
    {...props}
  >
    {children}
  </Button>
);

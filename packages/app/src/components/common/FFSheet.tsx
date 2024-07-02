import {
  BottomSheetModal,
  BottomSheetModalProps,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import { View } from "native-base";
import { forwardRef, PropsWithChildren, Ref } from "react";
import { View as RNView, ViewProps } from "react-native";

import { theme } from "../../theme";

export const SheetHandle = () => (
  <View
    bg="fg"
    height={1}
    my={2}
    width={12}
    borderRadius="full"
    alignSelf="center"
    position="absolute"
    top={0.5}
  />
);

const SheetBackground = ({ style, ...props }: ViewProps) => (
  <RNView
    style={[
      style,
      {
        backgroundColor: theme.colors.bg,
        borderColor: theme.colors.bg2,
        borderWidth: 3,
        flex: 1,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
      },
    ]}
    {...props}
  />
);

const FFSheetBase = forwardRef(
  (
    { children, ...props }: PropsWithChildren<Partial<BottomSheetModalProps>>,
    ref: Ref<BottomSheetModalMethods>
  ) => (
    <BottomSheetModal
      ref={ref}
      snapPoints={["35%", "80%"]}
      index={0}
      handleComponent={SheetHandle}
      backgroundComponent={SheetBackground}
      {...props}
    >
      <View flex={1}>{children}</View>
    </BottomSheetModal>
  )
);

export const FFSheet = forwardRef(
  (
    { children, ...props }: PropsWithChildren<Partial<BottomSheetModalProps>>,
    ref: Ref<BottomSheetModalMethods>
  ) => (
    <FFSheetBase ref={ref} {...props}>
      <View px="5" pt="7">
        {children}
      </View>
    </FFSheetBase>
  )
);
export const FFScrollSheet = forwardRef(
  (
    { children, ...props }: PropsWithChildren<Partial<BottomSheetModalProps>>,
    ref: Ref<BottomSheetModalMethods>
  ) => (
    <FFSheetBase ref={ref} {...props}>
      <BottomSheetScrollView>
        <View px="5" pt="7">
          {children}
        </View>
      </BottomSheetScrollView>
    </FFSheetBase>
  )
);

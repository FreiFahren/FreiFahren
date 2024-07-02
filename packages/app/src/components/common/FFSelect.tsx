import { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import { Button, Pressable, Text, View } from "native-base";
import React, { ComponentProps, ReactNode, useRef } from "react";
import { Control, Controller } from "react-hook-form";

import { FFScrollSheet, FFSheet } from "./FFSheet";

type FFSelectProps = {
  control: Control<any>;
  name: string;
  title: string | ReactNode;
  options: string[];
  placeholder: string;
  scrollable?: boolean;
  sheetProps?: Partial<ComponentProps<typeof FFSheet>>;
  optionContainerProps?: ComponentProps<typeof View>;
  renderOption?: (
    option: string,
    index: number,
    options: string[]
  ) => ComponentProps<typeof Pressable>["children"];
};

export const FFSelect = ({
  title,
  control,
  name,
  options,
  placeholder,
  sheetProps,
  scrollable = false,
  optionContainerProps,
  renderOption,
}: FFSelectProps) => {
  const sheetRef = useRef<BottomSheetModalMethods>(null);

  const handleSelect = (item: string, onChange: (value: string) => void) => {
    onChange(item);
    sheetRef.current?.close();
  };

  const SheetComponent = scrollable ? FFScrollSheet : FFSheet;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <>
          <Button onPress={() => sheetRef.current?.present()}>
            {value ?? placeholder}
          </Button>
          {error && (
            <Text color="red.500">
              {error.message ?? "This field is required"}
            </Text>
          )}
          <SheetComponent ref={sheetRef} {...sheetProps}>
            {typeof title === "string" ? (
              <Text fontSize="xl" color="white" bold>
                {title}
              </Text>
            ) : (
              title
            )}
            <View mt={2} {...optionContainerProps}>
              {options.map((option, index, options) => (
                <Pressable
                  key={option}
                  onPress={() => handleSelect(option, onChange)}
                  py={2}
                >
                  {renderOption === undefined ? (
                    <Text>{option}</Text>
                  ) : (
                    renderOption(option, index, options)
                  )}
                </Pressable>
              ))}
            </View>
          </SheetComponent>
        </>
      )}
    />
  );
};

import { FontAwesome5 } from "@expo/vector-icons";
import { Pressable, Row, Stack, useTheme, View } from "native-base";
import { ComponentProps, PropsWithChildren, ReactNode } from "react";

import { Theme } from "../../theme";

type OptionContainerProps = {
  isSelected: boolean;
} & ComponentProps<typeof Pressable>;

const OptionContainer = ({
  isSelected,
  children,
  ...props
}: PropsWithChildren<OptionContainerProps>) => {
  const theme = useTheme() as Theme;

  return (
    <Pressable
      borderRadius={8}
      borderWidth={3}
      opacity={isSelected ? 1 : 0.5}
      borderColor={isSelected ? theme.colors.selected : theme.colors.bg2}
      // bg={isSelected ? "selected" : "bg"}
      alignItems="center"
      justifyContent="center"
      position="relative"
      {...props}
    >
      {children}
      {isSelected && (
        <View
          bg="selected"
          borderRadius="full"
          position="absolute"
          bottom={2}
          right={2}
          p={1}
        >
          <FontAwesome5 name="check" size={14} color="white" />
        </View>
      )}
    </Pressable>
  );
};

type FFCarousellSelectProps<T> = {
  options: T[];
  renderOption: (option: T) => ReactNode;
  onSelect: (option: T) => void;
  selectedOption: T | null;
  containerProps?: ComponentProps<typeof Pressable>;
  vertical?: boolean;
};

export const FFCarousellSelect = <T,>({
  options,
  renderOption,
  onSelect,
  selectedOption,
  containerProps,
  vertical = false,
}: FFCarousellSelectProps<T>) => {
  const Container = vertical ? Stack : Row;

  return (
    <Container space={2}>
      {options.map((option, index) => (
        <OptionContainer
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          isSelected={selectedOption === option}
          onPress={() => onSelect(option)}
          {...containerProps}
        >
          {renderOption(option)}
        </OptionContainer>
      ))}
    </Container>
  );
};

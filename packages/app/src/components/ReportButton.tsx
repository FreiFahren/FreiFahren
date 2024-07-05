import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import { Box, Button, Row, Text, useTheme, View } from "native-base";
import {
  ComponentProps,
  forwardRef,
  PropsWithChildren,
  Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { LayoutAnimation } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { useSubmitReport } from "../api/queries";
import { lines, stations } from "../data";
import { Theme } from "../theme";
import { FFButton } from "./common/FFButton";
import { FFCarousellSelect } from "./common/FFCarousellSelect";
import { FFLineTag } from "./common/FFLineTag";
import { FFScrollSheet } from "./common/FFSheet";
import { FFSpinner } from "./common/FFSpinner";

type ReportModalMethods = {
  open: () => void;
  close: () => void;
};

export const ReportModal = forwardRef(
  (_props: PropsWithChildren<{}>, ref: Ref<ReportModalMethods>) => {
    const { mutateAsync: submitReport, isPending } = useSubmitReport();

    const theme = useTheme() as Theme;

    const sheetRef = useRef<BottomSheetModalMethods>(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.present(),
      close: () => sheetRef.current?.close(),
    }));

    const [lineType, setLineType] = useState<"u" | "s">("u");

    const [selectedLine, setSelectedLine] = useState<string | null>(null);

    const [selectedDirection, setSelectedDirection] = useState<string | null>(
      null
    );

    const [selectedStation, setSelectedStation] = useState<string | null>(null);

    const isValid =
      selectedLine !== null &&
      selectedStation !== null &&
      selectedDirection !== null;

    useEffect(() => setSelectedLine(null), [lineType]);
    useEffect(() => {
      setSelectedDirection(null);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [selectedLine]);
    useEffect(() => setSelectedStation(null), [selectedLine]);

    const lineOptions = useMemo(
      () =>
        Object.keys(lines).filter((line) =>
          line.toLowerCase().startsWith(lineType)
        ),
      [lineType]
    );

    const directionOptions =
      selectedLine === null
        ? []
        : [
            lines[selectedLine][0],
            lines[selectedLine][lines[selectedLine].length - 1],
          ];

    const stationOptions = selectedLine === null ? [] : lines[selectedLine];

    const close = () => {
      sheetRef.current?.close();

      setLineType("u");
      setSelectedLine(null);
    };

    const onSubmit = async () => {
      if (!isValid) return;

      await submitReport({
        line: selectedLine,
        station: selectedStation,
        direction: selectedDirection,
      });

      close();
    };

    return (
      <FFScrollSheet ref={sheetRef} onDismiss={close}>
        <Box
          justifyContent="space-between"
          overflow="visible"
          position="relative"
          safeAreaBottom
          flex={1}
        >
          <Text bold fontSize="2xl" mb={4} color="white">
            Kontrolle Melden
          </Text>
          <FFCarousellSelect
            options={["u", "s"]}
            selectedOption={lineType}
            onSelect={setLineType}
            containerProps={{ py: 3, flex: 1 }}
            renderOption={(option) =>
              option === "u" ? (
                <View borderRadius={8} px={4} py={1} bg="lines.U7">
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    U
                  </Text>
                </View>
              ) : (
                <View borderRadius={999} px={3} py={1} bg="lines.S25">
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    S
                  </Text>
                </View>
              )
            }
          />
          <Text fontSize="xl" fontWeight="bold" color="white" mt={4} mb={2}>
            Linie
          </Text>
          <View mx={-4}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: theme.space[5] }}
            >
              <FFCarousellSelect
                options={lineOptions}
                selectedOption={selectedLine}
                onSelect={setSelectedLine}
                containerProps={{ py: 3, px: 4 }}
                renderOption={(line) => (
                  <FFLineTag line={line} textProps={{ fontSize: "2xl" }} />
                )}
              />
            </ScrollView>
          </View>
          {selectedLine !== null && (
            <>
              <Text fontSize="xl" fontWeight="bold" color="white" mt={4} mb={2}>
                Richtung
              </Text>
              <FFCarousellSelect
                vertical
                options={directionOptions}
                selectedOption={selectedDirection}
                onSelect={setSelectedDirection}
                containerProps={{ py: 3, px: 4 }}
                renderOption={(direction) => (
                  <Row alignSelf="flex-start">
                    <Text bold color="white">
                      {stations[direction].name}
                    </Text>
                  </Row>
                )}
              />
              <Text fontSize="xl" fontWeight="bold" color="white" mt={4} mb={2}>
                Station
              </Text>
              <ScrollView style={{ height: 250 }}>
                <FFCarousellSelect
                  vertical
                  options={stationOptions}
                  selectedOption={selectedStation}
                  onSelect={setSelectedStation}
                  containerProps={{ py: 3, px: 4 }}
                  renderOption={(station) => (
                    <Row alignSelf="flex-start">
                      <Text bold color="white">
                        {stations[station].name}
                      </Text>
                    </Row>
                  )}
                />
              </ScrollView>
            </>
          )}
          <FFButton
            onPress={onSubmit}
            isDisabled={isPending || !isValid}
            bg="selected"
            mt={8}
          >
            {isPending ? (
              <FFSpinner />
            ) : (
              <Text color="white" fontSize="lg" fontWeight="bold">
                Melden
              </Text>
            )}
          </FFButton>
        </Box>
      </FFScrollSheet>
    );
  }
);

type ReportButtonProps = Omit<ComponentProps<typeof Button>, "onPress">;

export const ReportButton = (props: ReportButtonProps) => {
  const modalRef = useRef<ReportModalMethods>(null);

  return (
    <>
      <FFButton onPress={() => modalRef.current?.open()} {...props}>
        <MaterialIcons name="report-gmailerrorred" size={40} color="white" />
      </FFButton>
      <ReportModal ref={modalRef} />
    </>
  );
};

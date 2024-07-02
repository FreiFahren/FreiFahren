import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Box, Button, Spinner, Text, View } from "native-base";
import {
  ComponentProps,
  forwardRef,
  PropsWithChildren,
  Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { Modal } from "react-native";

import { useSubmitReport } from "../api/queries";
import { lines, stations } from "../data";
import { FFButton } from "./common/FFButton";
import { FFLineTag } from "./common/FFLineTag";
import { FFSelect } from "./common/FFSelect";

// TODO: ugly
// TODO: add direction, validation, etc
// TODO: More ergonomic components

type FormType = {
  line?: string;
  stationId?: string;
};

type ReportModalMethods = {
  open: () => void;
  close: () => void;
};

export const ReportModal = forwardRef(
  (_props: PropsWithChildren<{}>, ref: Ref<ReportModalMethods>) => {
    const { mutateAsync: submitReport, isPending } = useSubmitReport();

    const [isModalOpen, setIsModalOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setIsModalOpen(true),
      close: () => setIsModalOpen(false),
    }));

    const {
      handleSubmit,
      watch,
      control,
      reset: resetForm,
    } = useForm<FormType>();

    const selectedLine = watch("line");

    const stationOptions =
      selectedLine === undefined ? [] : lines[selectedLine];

    const close = () => {
      setIsModalOpen(false);
      resetForm();
    };

    const onSubmit: SubmitHandler<FormType> = async ({ line, stationId }) => {
      if (line === undefined || stationId === undefined) return;

      await submitReport({
        line,
        station: stations[stationId].name,
        direction: "",
      });
      close();
    };

    return (
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        <BottomSheetModalProvider>
          <Box
            flex={1}
            bg="bg"
            pt={7}
            px={4}
            safeArea
            justifyContent="space-between"
          >
            <Text bold fontSize="xl" mb={4} color="white">
              Kontrolle Melden
            </Text>
            <View flexDirection="row">
              <FFSelect
                control={control}
                name="line"
                title="Linie"
                options={Object.keys(lines)}
                placeholder="Linie"
                optionContainerProps={{
                  flexDir: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-evenly",
                }}
                sheetProps={{ snapPoints: ["45%"] }}
                renderOption={(line) => (
                  <FFLineTag
                    line={line}
                    textProps={{ fontSize: "2xl" }}
                    px={2}
                    width="65px"
                  />
                )}
              />
              <FFSelect
                control={control}
                name="stationId"
                title="Station"
                options={stationOptions}
                placeholder="Station"
                scrollable
                renderOption={(id) =>
                  selectedLine !== undefined && (
                    <View flexDir="row">
                      <FFLineTag line={selectedLine} mr={2} />
                      <Text bold color="white">
                        {stations[id].name}
                      </Text>
                    </View>
                  )
                }
              />
            </View>
            <View>
              <Button onPress={handleSubmit(onSubmit)} isDisabled={isPending}>
                {isPending ? <Spinner /> : "Melden"}
              </Button>
              <Button onPress={close} mt={4} variant="outline">
                <Text color="white">Abbrechen</Text>
              </Button>
            </View>
          </Box>
        </BottomSheetModalProvider>
      </Modal>
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

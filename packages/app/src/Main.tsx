import { Box, Text, View } from "native-base";

import { useReports } from "./api/queries";
import { FFBox } from "./components/common/FFBox";
import { FFMapView } from "./components/FFMapView";
import { FFSpinner } from "./components/FFSpinner";
import { ReportButton } from "./components/ReportButton";
import { ReportListButton } from "./components/ReportListButton";

const LoadingBar = () => (
  <FFBox justifyContent="space-between" alignItems="center" flexDirection="row">
    <Text color="white" fontWeight="bold" fontSize="md">
      Meldungen werden geladen...
    </Text>
    <FFSpinner size={8} />
  </FFBox>
);

export const Main = () => {
  const { isLoading: isLoadingReports, data: reports } = useReports();

  return (
    <View width="100%" height="100%">
      <FFMapView reports={reports ?? []} />
      <Box
        flex={1}
        position="absolute"
        top={0}
        left={0}
        bottom={0}
        right={0}
        pointerEvents="box-none"
        justifyContent="space-between"
        px={4}
        pb={8}
        safeArea
        backgroundColor="red"
      >
        <View>{isLoadingReports && <LoadingBar />}</View>
        <View pointerEvents="box-none">
          <ReportListButton alignSelf="flex-end" />
          <ReportButton alignSelf="flex-end" mt={2} />
        </View>
      </Box>
    </View>
  );
};

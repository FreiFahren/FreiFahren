import { Text, View } from "native-base";

import { Report } from "../../api";
import { stations } from "../../data";
import { FFLineTag } from "./FFLineTag";

type ReportItemProps = {
  report: Report;
};

export const ReportItem = ({ report }: ReportItemProps) => {
  const station = stations[report.stationId];

  return (
    <View flexDir="row" alignItems="flex-start">
      <View alignItems="center" mr={2}>
        <FFLineTag line={report.line} />
        <Text color="fg" textAlign="center">
          {report.timestamp.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <View>
        <Text color="white" bold>
          {station.name}
        </Text>
        <Text color="fg">Richtung {report.direction.name}</Text>
      </View>
    </View>
  );
};

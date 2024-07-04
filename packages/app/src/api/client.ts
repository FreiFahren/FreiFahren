import axios from "axios";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import { z } from "zod";

import { config } from "../config";

export const reportSchema = z
  .object({
    timestamp: z.string().transform((value) => new Date(value)),
    line: z.string(),
    direction: z.object({
      id: z.string(),
      name: z.string(),
    }),
    station: z.object({
      id: z.string(),
    }),
  })
  .transform(({ station, ...rest }) => ({
    ...rest,
    stationId: station.id,
  }));

export type Report = z.infer<typeof reportSchema>;

const client = axios.create({
  baseURL: config.FF_API_BASE_URL,
  headers: {
    "ff-app-version": DeviceInfo.getVersion(),
    "ff-platform": Platform.OS,
  },
});

const getReports = async (): Promise<Report[]> => {
  const { data } = await client.get("basics/recent");

  return reportSchema.array().parse(data);
};

const stationSchema = z.object({
  name: z.string(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  lines: z.array(z.string()),
});

export type Station = z.infer<typeof stationSchema>;

type PostReport = {
  line: string;
  station: string;
  direction: string;
};

const postReport = async (report: PostReport) => {
  const { data } = await axios.post("basics/newInspector", report);

  return data;
};

export const api = {
  getReports,
  postReport,
};

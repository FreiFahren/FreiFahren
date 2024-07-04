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

const getReports = async (): Promise<Report[]> => {
  const response = await fetch(`${config.FF_API_BASE_URL}/basics/recent`);
  const data = await response.json();

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
  const response = await fetch(
    `${config.FF_API_BASE_URL}/basics/newInspector`,
    {
      method: "POST",
      body: JSON.stringify(report),
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.json();
};

export const api = {
  getReports,
  postReport,
};

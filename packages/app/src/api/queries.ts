import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, Report, reportSchema } from "./client";
import { CACHE_KEYS } from "./queryClient";

export const useReports = <T = Report[]>(select?: (data: Report[]) => T) =>
  useQuery({
    queryKey: CACHE_KEYS.reports,
    queryFn: api.getReports,
    staleTime: 1000 * 60,
    select,
  });

export const useSubmitReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.postReport,
    onSuccess: async (newReport: unknown) => {
      const parsedReport = reportSchema.parse(newReport);

      queryClient.setQueryData(CACHE_KEYS.reports, (oldReports: Report[]) => [
        ...oldReports,
        parsedReport,
      ]);
    },
  });
};

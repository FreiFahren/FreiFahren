import { z } from "zod";

export const config = (() => {
  try {
    return z
      .object({
        FF_API_BASE_URL: z.string(),
        MAP_URL: z.string(),
        MAP_STYLE_URL: z.string(),
      })
      .parse({
        FF_API_BASE_URL: process.env.EXPO_PUBLIC_FF_API_BASE_URL,
        MAP_URL: process.env.EXPO_PUBLIC_MAP_URL,
        MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
      });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Missing environment variables:", error);
    throw error;
  }
})();

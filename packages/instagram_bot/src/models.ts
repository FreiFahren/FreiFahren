import { z } from 'zod';

export const StoryRequestSchema = z.object({
  line: z.string(),
  station: z.string(),
  direction: z.string(),
  message: z.string(),
});

export type StoryRequest = z.infer<typeof StoryRequestSchema>;

export type Inspector = StoryRequest;
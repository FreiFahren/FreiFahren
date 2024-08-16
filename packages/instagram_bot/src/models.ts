import { z } from 'zod';

export const StoryRequestSchema = z.object({
  line: z.string(),
  station: z.string(),
  direction: z.string(),
  message: z.string(),
});

export type StoryRequest = z.infer<typeof StoryRequestSchema>;

export type Inspector = StoryRequest;

export interface TokenResponse {
  access_token: string;
}

export interface PageData {
  access_token: string;
}

export interface AccountsResponse {
  data: PageData[];
}

export interface InstagramAccountResponse {
  instagram_business_account: {
    id: string;
  };
}
import { queryOptions } from '@tanstack/react-query';

import { fetchJson, HttpError } from './transit';

export type AnnouncementLanguage = 'en' | 'de';

export type AnnouncementSummary = {
  id: string;
  publishedAt: string;
  title: string;
  description: string;
  hasBody: boolean;
};

export type AnnouncementDetail = Omit<AnnouncementSummary, 'hasBody'> & {
  bodyHtml: string | null;
};

export function toAnnouncementLanguage(language: string | undefined): AnnouncementLanguage {
  return language === 'de' ? 'de' : 'en';
}

// Announcements only change with an API deploy: the persisted copy paints instantly, and the one
// refetch per launch after restore is an ETag revalidation (the API makes browsers revalidate on every use).
export const announcementsQueryOptions = (lang: AnnouncementLanguage) =>
  queryOptions({
    queryKey: ['announcements', 'list', lang] as const,
    queryFn: () =>
      fetchJson<AnnouncementSummary[]>(
        `/v0/announcements?${new URLSearchParams({ lang }).toString()}`,
      ),
  });

export const announcementQueryOptions = (id: string, lang: AnnouncementLanguage) =>
  queryOptions({
    queryKey: ['announcements', 'detail', id, lang] as const,
    // Null for an unknown id (e.g. a stale shared link): a settled answer, not an error to retry.
    queryFn: () =>
      fetchJson<AnnouncementDetail>(
        `/v0/announcements/${encodeURIComponent(id)}?${new URLSearchParams({ lang }).toString()}`,
      ).catch((error: unknown) => {
        if (error instanceof HttpError && error.status === 404) return null;
        throw error;
      }),
  });

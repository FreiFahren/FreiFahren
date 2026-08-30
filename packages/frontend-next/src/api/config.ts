import { useQuery } from '@tanstack/react-query';
import type { CityCommunity, CityConfig } from '@freifahren/cities';

import { fetchJson } from './transit';

type PublicCityConfig = Omit<
  Pick<
    CityConfig,
    | 'slug'
    | 'subdomain'
    | 'displayName'
    | 'publicAppUrl'
    | 'listed'
    | 'lang'
    | 'timezone'
    | 'map'
    | 'community'
  >,
  'listed' | 'community'
> & { listed: boolean; community: Omit<CityCommunity, 'telegramChatId'> };

export type ApiConfig = {
  reporting: { enabled: boolean };
  city: PublicCityConfig;
};

/*
 * Probed at runtime rather than baked in at build time, because the installed iOS bundle is the one
 * place a build-time flag can never be corrected: closing reporting would need an OTA or App Store
 * push. Kept short-lived and refetched on focus/reconnect so a flip on the API reaches an app that
 * has been sitting in the background.
 */
export const configQueryOptions = () =>
  ({
    queryKey: ['config'] as const,
    queryFn: () => fetchJson<ApiConfig>('/v0/config'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  }) as const;

/**
 * Whether the API is currently accepting reports.
 */
export const useReportingEnabled = (): boolean => {
  const { data } = useQuery(configQueryOptions());
  /*
   * Fails open — while the probe is loading or has failed, reporting counts as on. That is the safe
   * direction because this flag is purely cosmetic: the API's own middleware fails closed and is
   * the actual enforcement, so the worst case here is a form whose submission gets refused, which
   * the form already handles by showing the same notice. Hiding the form because a probe could not
   * reach the network would instead cost a real report for a reason unrelated to the killswitch.
   */
  return data?.reporting.enabled ?? true;
};

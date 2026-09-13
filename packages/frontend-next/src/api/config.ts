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
  city: PublicCityConfig;
};

export const configQueryOptions = () =>
  ({
    queryKey: ['config'] as const,
    queryFn: () => fetchJson<ApiConfig>('/v0/config'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  }) as const;

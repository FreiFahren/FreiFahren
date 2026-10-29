import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { fetchFund, FundRequestError, type Fine, type FineDetails } from '@/lib/fund-api';

import { fundHistoryKey } from './use-fund-history';
import { fineDetailsKey } from './use-fine-details';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function useFineUpload(userId: string, sessionId: string, fineId?: string) {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  return useMutation({
    mutationFn: async (file: File): Promise<FineDetails> => {
      if (file.size === 0) throw new FundRequestError(400);
      if (file.size > MAX_PHOTO_BYTES) throw new FundRequestError(413);
      // Some mobile pickers omit the MIME type. The server verifies the actual image bytes.
      if (!PHOTO_TYPES.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
        throw new FundRequestError(415);
      }

      controller.current = new AbortController();
      const response = await fetchFund(
        fineId ? `/fines/${fineId}/uploads` : '/fines',
        {
          method: 'POST',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          signal: controller.current.signal,
        },
        90_000,
      );
      return response.json();
    },
    // A lost response can hide a successful upload. Never queue or retry a photo automatically.
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    onSuccess: (fine) => {
      if (fineId) queryClient.setQueryData(fineDetailsKey(userId, sessionId, fineId), fine);
      queryClient.setQueryData<Fine[]>(fundHistoryKey(userId, sessionId), (current) => {
        if (!current) return current;
        if (fineId) return current.map((item) => (item.id === fine.id ? fine : item));
        return [fine, ...current.filter((item) => item.id !== fine.id)];
      });
    },
    onSettled: () => {
      if (fineId)
        void queryClient.invalidateQueries({ queryKey: fineDetailsKey(userId, sessionId, fineId) });
      void queryClient.invalidateQueries({ queryKey: fundHistoryKey(userId, sessionId) });
    },
  });
}

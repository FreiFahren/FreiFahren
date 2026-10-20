import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useFundEnabled } from '@/hooks/use-fund-enabled';
import {
  type AccountDeletionBlocker,
  isAccountDeletionBlocker,
  membershipQueryOptions,
} from '@/hooks/use-membership';

// What stands in for the deletion steps while the membership is unknown or can still charge.
export type MembershipGate =
  | { kind: 'blocked'; blockedBy: AccountDeletionBlocker }
  | { kind: 'unreadable'; retrying: boolean; retry: () => void }
  | { kind: 'checking' }
  | null;

/*
 * Whether the Fund membership lets the account be deleted. The membership read is only a hint;
 * the auth-worker enforces the rule, and its refusal (`refuse`) says what blocks deletion. A refusal
 * stands until the membership has been read again, e.g. on returning from Stripe.
 */
export function useMembershipGate(userId: string): {
  gate: MembershipGate;
  refuse: (error: object) => void;
} {
  const [refusal, setRefusal] = useState<{ blockedBy: AccountDeletionBlocker; at: number } | null>(
    null,
  );
  const gated = useFundEnabled() || refusal !== null;
  const membership = useQuery({ ...membershipQueryOptions(userId), enabled: gated });

  // Better Auth's error type doesn't know the auth-worker's `blockedBy` field.
  const refuse = (error: object) => {
    const blockedBy = 'blockedBy' in error ? error.blockedBy : undefined;
    setRefusal({
      blockedBy: isAccountDeletionBlocker(blockedBy) ? blockedBy : 'membership',
      at: Date.now(),
    });
    // A read already in flight predates the refusal and must not lift it; refetching cancels it.
    void membership.refetch();
  };

  const gate = (): MembershipGate => {
    if (!gated) return null;
    const blockedBy =
      refusal !== null && membership.dataUpdatedAt <= refusal.at
        ? refusal.blockedBy
        : membership.data?.accountDeletionBlockedBy;
    if (blockedBy) return { kind: 'blocked', blockedBy };
    // A failed refetch keeps the last answer, so a network blip doesn't interrupt the flow.
    if (membership.data === undefined && membership.isError) {
      return {
        kind: 'unreadable',
        retrying: membership.isFetching,
        retry: () => void membership.refetch(),
      };
    }
    if (membership.isPending) return { kind: 'checking' };
    return null;
  };

  return { gate: gate(), refuse };
}

// The Fund Worker's HTTP API, called by the app. Types and plain constants only, so importing it
// adds nothing to the app's bundle beyond the constants it uses.

export const MIN_AMOUNT_CENTS = 900
// Well above any plausible contribution; it only catches typos like an extra zero or two.
export const MAX_AMOUNT_CENTS = 100_000

export type MembershipStatus = 'none' | 'pending' | 'active' | 'past_due' | 'canceled'

// GET /membership
export type Membership = {
    status: MembershipStatus
    legalName: string | null
    amountCents: number | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
}

// POST /checkout-sessions
export type CheckoutSessionRequest = { amountCents: number }

// POST /checkout-sessions and POST /billing-portal-sessions: a Stripe-hosted page to open.
export type StripeSession = { url: string }

export type ContributionPeriod = { start: string; end: string }

export type Contribution = {
    id: string
    amountCents: number
    currency: string
    createdAt: string
    paidAt: string | null
    periods: ContributionPeriod[]
    status: 'paid' | 'pending' | 'failed' | 'action_required' | 'void' | 'uncollectible'
    failureReason: 'insufficient_funds' | 'expired_card' | 'declined' | 'payment_failed' | null
}

// GET /contributions
export type Contributions = {
    contributions: Contribution[]
    // The paid period covering now, if any.
    paidPeriod: ContributionPeriod | null
}

export const FINE_STATUSES = ['in_review', 'payment_sent', 'settled', 'declined'] as const

// How a fine's payment to the transport operator was confirmed: by the operator's payment portal
// (`provider`) or by hand.
export type FineConfirmation = {
    confirmedAt: string
    source: 'provider' | 'manual'
    providerLabel: string | null
    verificationUrl: string | null
}

// The Fund's transfer for a fine. `receiptPath` is the Fund path serving the transfer receipt, if it has one.
export type FineTransfer = { verificationAvailable: boolean; receiptPath: string | null }

// GET /fines
export type Fine = {
    id: string
    status: (typeof FINE_STATUSES)[number]
    createdAt: string
    paidAt: string | null
    declineReason: string | null
    // Once settled.
    confirmation: FineConfirmation | null
    // Once the payment is sent.
    transfer: FineTransfer | null
}

export type FineUploadVersion = Fine & { version: number; current: boolean }

// GET /fines/:fineId, POST /fines and POST /fines/:fineId/uploads
export type FineDetails = Fine & { uploads: FineUploadVersion[] }

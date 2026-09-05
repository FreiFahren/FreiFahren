import { z } from 'zod'

import type { TelegramReportsApi } from './report-api-contract'

export type Env = Omit<Cloudflare.Env, 'NODE_ENV' | 'BACKEND_URL' | 'MISTRAL_MODEL' | 'SENTRY_DSN' | 'REPORT_API'> & {
    BACKEND_URL: string
    MISTRAL_MODEL: string
    SENTRY_DSN: string
    REPORT_API: TelegramReportsApi
    NODE_ENV?: string
    // Git SHA injected at deploy via `wrangler deploy --var SENTRY_RELEASE:<sha>`; tags Sentry
    // Events with a release so issues can be resolved in the next release. Absent locally.
    SENTRY_RELEASE?: string

    // Secrets (wrangler secret put)
    MISTRAL_API_KEY: string
    TELEGRAM_WEBHOOK_SECRET: string
    TELEGRAM_BOT_TOKEN?: string
}

// Telegram update — only the fields we read.

const TelegramChat = z.object({
    id: z.number(),
    type: z.string().optional(),
    title: z.string().nullish(),
    username: z.string().nullish(),
})

const TelegramMessageEntity = z.object({
    type: z.string(),
    offset: z.number(),
    length: z.number(),
})

const TelegramMessage = z.object({
    text: z.string().nullish(),
    caption: z.string().nullish(),
    chat: TelegramChat.nullish(),
    entities: z.array(TelegramMessageEntity).nullish(),
    caption_entities: z.array(TelegramMessageEntity).nullish(),
})

export const TelegramUpdate = z.object({
    update_id: z.number().optional(),
    message: TelegramMessage.nullish(),
    edited_message: TelegramMessage.nullish(),
    channel_post: TelegramMessage.nullish(),
    edited_channel_post: TelegramMessage.nullish(),
})

export type TelegramUpdate = z.infer<typeof TelegramUpdate>
export type TelegramMessage = z.infer<typeof TelegramMessage>

export const StationNameExtraction = z.object({
    stationName: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
    directionName: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
})

export type StationNameExtraction = z.infer<typeof StationNameExtraction>

export interface IndexStation {
    id: string
    name: string
}

export interface IndexVariant {
    id: string
    name: string
    stations: string[]
}

// Built per message from the backend's transit endpoints (see getTransitIndex).
export interface TransitIndex {
    stations: Record<string, IndexStation>
    byNorm: Record<string, string[]>
    // Derived from the variants, not the /stations `lines` field — see buildIndex.
    linesByStation: Record<string, string[]>
    lineNames: string[]
    circularLineNames: string[]
    variants: IndexVariant[]
}

export const AcceptedReportNotification = z
    .object({
        city: z.string().min(1).max(64),
        report: z
            .object({
                reportId: z.number().int().positive(),
                stationId: z.string().min(1).max(16),
                lineId: z.string().min(1).max(16).nullable(),
                directionId: z.string().min(1).max(16).nullable(),
                timestamp: z.string().datetime(),
                source: z.enum(['web_app', 'mini_app', 'mobile_app', 'telegram']),
            })
            .strict(),
    })
    .strict()

export type AcceptedReportNotification = z.infer<typeof AcceptedReportNotification>

import { z } from 'zod'

export const privacyPolicyMetaSchema = z.object({
    version: z.number(),
    lastModified: z.string(),
})

export type PrivacyPolicyMeta = z.infer<typeof privacyPolicyMetaSchema>

export const PRIVACY_POLICY_META: PrivacyPolicyMeta = {
    version: 5,
    lastModified: '2026-05-30',
}

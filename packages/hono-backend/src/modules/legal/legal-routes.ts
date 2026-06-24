import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

import { PRIVACY_POLICY_META, privacyPolicyMetaSchema } from './constants'

export const getPrivacyPolicyMeta = defineRoute<Env>()({
    method: 'get',
    path: '/privacy-policy-meta',
    docs: {
        summary: 'Get privacy policy metadata',
        description:
            'Returns the current privacy policy version and last-modified date. Clients use this to detect when the privacy policy has changed and prompt users to re-accept it.',
        tags: ['legal'],
        responseSchema: privacyPolicyMetaSchema,
    },
    handler: (c) => c.json(PRIVACY_POLICY_META),
})

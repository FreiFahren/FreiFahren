import { z } from 'zod'

import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

import { getAnnouncement, listAnnouncements } from './announcements-service'
import { ANNOUNCEMENT_LANGUAGES } from './announcements-types'

const langSchema = z.enum(ANNOUNCEMENT_LANGUAGES).default('en')

export const getAnnouncements = defineRoute<Env>()({
    method: 'get',
    path: '/',
    schemas: {
        query: z.object({ lang: langSchema }),
    },
    handler: async (c) => {
        const { lang } = c.req.valid('query')
        return c.json(listAnnouncements(c.get('city').slug, lang))
    },
})

export const getAnnouncementById = defineRoute<Env>()({
    method: 'get',
    path: '/:id',
    schemas: {
        param: z.object({ id: z.string().min(1) }),
        query: z.object({ lang: langSchema }),
    },
    handler: async (c) => {
        const { id } = c.req.valid('param')
        const { lang } = c.req.valid('query')
        return c.json(getAnnouncement(c.get('city').slug, lang, id))
    },
})

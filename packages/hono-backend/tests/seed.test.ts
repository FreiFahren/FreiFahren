import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { db, reports, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'

describe('seedBaseData', () => {
    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('preserves existing reports across a re-seed', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        if (!station) throw new Error('expected at least one seeded station to exist')

        const [inserted] = await db
            .insert(reports)
            .values({
                stationId: station.id,
                lineId: null,
                directionId: null,
                source: 'web_app',
            })
            .returning({ reportId: reports.reportId })

        await seedBaseData(db)

        const after = await db.select({ reportId: reports.reportId }).from(reports)
        expect(after).toEqual([{ reportId: inserted.reportId }])
    })
})

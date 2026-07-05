import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src'
import { db, lineStations, reports, stations } from './test-db'
import { seedBaseData } from '../src/db/seed/seed'
import { sendReportRequest } from './test-utils'

const temporaryStationId = 'test-orphan'

describe('seedBaseData', () => {
    beforeEach(async () => {
        await db.delete(reports)
        await db.delete(stations).where(eq(stations.id, temporaryStationId))
    })

    afterEach(async () => {
        await db.delete(reports)
        await db.delete(stations).where(eq(stations.id, temporaryStationId))
    })

    it('preserves existing reports across a re-seed', async () => {
        const [station] = await db.select({ id: lineStations.stationId }).from(lineStations).limit(1)
        if (!station) throw new Error('expected at least one seeded station to exist')

        const response = await sendReportRequest({ stationId: station.id, lineId: null, directionId: null })
        expect(response.status).toBe(200)
        const inserted = (await response.json()) as { reportId: number }

        await seedBaseData(db)

        const after = await db.select({ reportId: reports.reportId }).from(reports)
        expect(after).toEqual([{ reportId: inserted.reportId }])
    })

    // The seed loads reference data additively and never removes a station a report points at,
    // so a re-seed can't orphan a report. Prune only drops line-less stations with no reports.
    it('does not prune a report-referenced station that lost its line associations', async () => {
        const [lineStation] = await db
            .select({ lineId: lineStations.lineId, lat: stations.lat, lng: stations.lng })
            .from(lineStations)
            .innerJoin(stations, eq(stations.id, lineStations.stationId))
            .limit(1)
        if (!lineStation) throw new Error('expected seeded line station to exist')

        await db.insert(stations).values({
            id: temporaryStationId,
            name: 'Report-referenced test station',
            lat: lineStation.lat,
            lng: lineStation.lng,
        })
        await db.insert(lineStations).values({
            lineId: lineStation.lineId,
            stationId: temporaryStationId,
            order: 10_000,
        })

        const response = await sendReportRequest(
            { stationId: temporaryStationId, lineId: lineStation.lineId, directionId: null },
            createApp()
        )
        expect(response.status).toBe(200)
        const inserted = (await response.json()) as { reportId: number }

        // Drop its only line association so it becomes line-less before the re-seed.
        await db.delete(lineStations).where(eq(lineStations.stationId, temporaryStationId))

        await seedBaseData(db)

        const reportsAfter = await db
            .select({ reportId: reports.reportId })
            .from(reports)
            .where(eq(reports.reportId, inserted.reportId))
        expect(reportsAfter).toEqual([{ reportId: inserted.reportId }])

        const stationAfter = await db
            .select({ id: stations.id })
            .from(stations)
            .where(eq(stations.id, temporaryStationId))
        expect(stationAfter).toEqual([{ id: temporaryStationId }])
    })
})

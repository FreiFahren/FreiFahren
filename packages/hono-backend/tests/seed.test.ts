import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { and, asc, eq } from 'drizzle-orm'

import { createApp } from '../src'
import { db, lineStations, reports, stationDistances, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'
import { sendReportRequest } from './test-utils'

const temporaryStationIds = ['test-orphan-1', 'test-orphan-2'] as const

describe('seedBaseData', () => {
    beforeEach(async () => {
        await db.delete(reports)
        await db.delete(stations).where(eq(stations.id, temporaryStationIds[0]))
        await db.delete(stations).where(eq(stations.id, temporaryStationIds[1]))
    })

    afterEach(async () => {
        await db.delete(reports)
        await db.delete(stations).where(eq(stations.id, temporaryStationIds[0]))
        await db.delete(stations).where(eq(stations.id, temporaryStationIds[1]))
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

    it('rebuilds station distances after seeding', async () => {
        const rows = await db
            .select({
                stationId: lineStations.stationId,
            })
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))
            .limit(2)

        if (rows.length < 2) throw new Error('expected at least two seeded line stations to exist')

        const [distance] = await db
            .select({ distance: stationDistances.distance })
            .from(stationDistances)
            .where(
                and(
                    eq(stationDistances.fromStationId, rows[0].stationId),
                    eq(stationDistances.toStationId, rows[1].stationId)
                )
            )
            .limit(1)

        expect(distance?.distance).toBeGreaterThan(0)
    })

    it('remaps reports from a referenced orphan station to a proximate live station', async () => {
        const [lineStation] = await db
            .select({
                lineId: lineStations.lineId,
                stationId: lineStations.stationId,
                order: lineStations.order,
                stationName: stations.name,
                lat: stations.lat,
                lng: stations.lng,
            })
            .from(lineStations)
            .innerJoin(stations, eq(stations.id, lineStations.stationId))
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))
            .limit(1)
        if (!lineStation) throw new Error('expected seeded line station to exist')

        await db.insert(stations).values({
            id: temporaryStationIds[0],
            name: lineStation.stationName,
            lat: lineStation.lat,
            lng: lineStation.lng,
        })
        await db.insert(lineStations).values({
            lineId: lineStation.lineId,
            stationId: temporaryStationIds[0],
            order: 10_000,
        })

        const routeApp = createApp(db)
        const stationResponse = await sendReportRequest(
            { stationId: temporaryStationIds[0], lineId: lineStation.lineId, directionId: null },
            routeApp
        )
        expect(stationResponse.status).toBe(200)
        const stationReport = (await stationResponse.json()) as { reportId: number }

        const directionResponse = await sendReportRequest(
            {
                stationId: lineStation.stationId,
                lineId: lineStation.lineId,
                directionId: temporaryStationIds[0],
            },
            routeApp
        )
        expect(directionResponse.status).toBe(200)
        const directionReport = (await directionResponse.json()) as { reportId: number }

        await db.delete(lineStations).where(eq(lineStations.stationId, temporaryStationIds[0]))

        await seedBaseData(db)

        const after = await db.select().from(reports).orderBy(asc(reports.reportId))
        expect(after).toEqual([
            expect.objectContaining({
                reportId: stationReport.reportId,
                stationId: lineStation.stationId,
                directionId: null,
            }),
            expect.objectContaining({
                reportId: directionReport.reportId,
                stationId: lineStation.stationId,
                directionId: lineStation.stationId,
            }),
        ])

        const staleStations = await db
            .select({ id: stations.id })
            .from(stations)
            .where(eq(stations.id, temporaryStationIds[0]))
        expect(staleStations).toEqual([])
    })

    it('deletes reports that still reference unresolved orphan stations', async () => {
        const [lineStation] = await db
            .select({
                lineId: lineStations.lineId,
                stationId: lineStations.stationId,
                order: lineStations.order,
                stationName: stations.name,
                lat: stations.lat,
                lng: stations.lng,
            })
            .from(lineStations)
            .innerJoin(stations, eq(stations.id, lineStations.stationId))
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))
            .limit(1)
        if (!lineStation) throw new Error('expected seeded line station to exist')

        await db.insert(stations).values({
            id: temporaryStationIds[1],
            name: 'Unmatched test station',
            lat: lineStation.lat,
            lng: lineStation.lng,
        })
        await db.insert(lineStations).values({
            lineId: lineStation.lineId,
            stationId: temporaryStationIds[1],
            order: 10_001,
        })

        const response = await sendReportRequest(
            { stationId: temporaryStationIds[1], lineId: lineStation.lineId, directionId: null },
            createApp(db)
        )
        expect(response.status).toBe(200)
        const inserted = (await response.json()) as { reportId: number }

        await db.delete(lineStations).where(eq(lineStations.stationId, temporaryStationIds[1]))

        await seedBaseData(db)

        const after = await db
            .select({ reportId: reports.reportId })
            .from(reports)
            .where(eq(reports.reportId, inserted.reportId))
        expect(after).toEqual([])

        const staleStations = await db
            .select({ id: stations.id })
            .from(stations)
            .where(eq(stations.id, temporaryStationIds[1]))
        expect(staleStations).toEqual([])
    })
})

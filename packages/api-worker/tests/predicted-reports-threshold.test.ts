import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'

import { calculatePredictedReportsThreshold } from '../src/modules/reports/reports-service'

// 2024-01-15 is a Monday, 2024-01-13 a Saturday, 2024-01-14 a Sunday.
const monday = (hour: number, minute = 0) => DateTime.utc(2024, 1, 15, hour, minute)
const saturday = (hour: number, minute = 0) => DateTime.utc(2024, 1, 13, hour, minute)
const sunday = (hour: number, minute = 0) => DateTime.utc(2024, 1, 14, hour, minute)

describe('calculatePredictedReportsThreshold', () => {
    describe('weekday piecewise curve (boundaries)', () => {
        it.each([
            ['midnight', monday(0, 0), 1],
            ['just before the morning ramp', monday(6, 59), 1],
            ['start of the morning ramp (07:00)', monday(7, 0), 1],
            ['middle of the morning ramp (08:00)', monday(8, 0), 4],
            ['end of the morning ramp (08:59)', monday(8, 59), 6],
            ['start of the daytime plateau (09:00)', monday(9, 0), 7],
            ['daytime plateau (12:00)', monday(12, 0), 7],
            ['just before the evening ramp (17:59)', monday(17, 59), 7],
            ['start of the evening ramp (18:00)', monday(18, 0), 7],
            ['middle of the evening ramp (19:30)', monday(19, 30), 4],
            ['end of the evening ramp (20:59)', monday(20, 59), 1],
            ['start of the night floor (21:00)', monday(21, 0), 1],
            ['end of the day (23:59)', monday(23, 59), 1],
        ])('returns %s → %i', (_label, time, expected) => {
            expect(calculatePredictedReportsThreshold(time)).toBe(expected)
        })
    })

    describe('Saturday: longer evening ramp (18:00–24:00) plus weekend adjustment', () => {
        it.each([
            ['night floor is clamped up to the minimum', saturday(2, 0), 1],
            ['daytime plateau is halved by the weekend adjustment', saturday(12, 0), 3],
            ['ramp start (18:00)', saturday(18, 0), 3],
            // At 21:00 weekdays are already at the floor; the Saturday ramp is still descending.
            ['still above the floor at 21:00', saturday(21, 0), 2],
            ['ramp end stays clamped at the minimum (23:59)', saturday(23, 59), 1],
        ])('%s → %i', (_label, time, expected) => {
            expect(calculatePredictedReportsThreshold(time)).toBe(expected)
        })
    })

    describe('Sunday: weekday-shaped curve with the weekend adjustment', () => {
        it.each([
            ['daytime plateau is halved', sunday(12, 0), 3],
            // Sunday uses the short 18:00–21:00 ramp, not the Saturday one.
            ['short evening ramp applies', sunday(19, 30), 2],
            ['night floor is clamped up to the minimum', sunday(22, 0), 1],
        ])('%s → %i', (_label, time, expected) => {
            expect(calculatePredictedReportsThreshold(time)).toBe(expected)
        })
    })
})

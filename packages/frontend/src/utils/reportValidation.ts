import { calculateDistance } from './mapUtils'
import { Report } from './types'

export interface ValidationError {
    field: string
    message: string
    type: 'distance' | 'time'
}

export interface ValidationResult {
    isValid: boolean
    errors: ValidationError[]
}

interface UserPosition {
    lat: number
    lng: number
}

/**
 * Validates the distance between user location and reported station
 * Returns error if user is more than 1.5km away from the station
 * @param report
 * @param userPosition
 * @returns ValidationError if user is more than 1.5km away from the station, null otherwise
 */
const validateStationDistance = (report: Report, userPosition: UserPosition | null): ValidationError | null => {
    if (!userPosition) {
        // If no user position available, skip distance validation
        return null
    }

    const distance = calculateDistance(
        userPosition.lat,
        userPosition.lng,
        report.station.coordinates.latitude,
        report.station.coordinates.longitude
    )

    // Convert 1.5km to the same unit (kilometers)
    const maxDistanceKm = 1.5

    if (distance > maxDistanceKm) {
        return {
            field: 'station',
            message: 'Du bist zu weit von der Station entfernt.',
            type: 'distance',
        }
    }

    return null
}

/**
 * Validates the time between the last reported time and the current time
 * Returns error if the time is less than a certain amount of minutes
 * @returns ValidationError if the time is too short, null otherwise
 */
const validateReportTime = (): ValidationError | null => {
    const lastReportedTime = localStorage.getItem('lastReportedTime')
    if (!lastReportedTime) {
        return null
    }

    const minTimeBetweenReports = 30 // in minutes

    const currentTime = new Date()
    const lastReportedTimeDate = new Date(lastReportedTime)
    const timeDifference = currentTime.getTime() - lastReportedTimeDate.getTime()
    const timeDifferenceInMinutes = timeDifference / (1000 * 60)

    if (timeDifferenceInMinutes < minTimeBetweenReports) {
        return {
            field: 'time',
            message: `Warte noch, bevor du eine neue Meldung erstellst.`,
            type: 'time',
        }
    }

    return null
}

/**
 * Main validation function that runs all validation checks
 */
export const validateReport = (report: Report, userPosition: UserPosition | null): ValidationResult => {
    const errors: ValidationError[] = []

    const distanceError = validateStationDistance(report, userPosition)
    if (distanceError) {
        errors.push(distanceError)
    }

    const timeError = validateReportTime()
    if (timeError) {
        errors.push(timeError)
    }

    return {
        isValid: errors.length === 0,
        errors,
    }
}

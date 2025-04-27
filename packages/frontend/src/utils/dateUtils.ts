/**
 * Format a date to a time string in HH:mm format
 * @param dateString - ISO date string to format
 * @returns Formatted time string (HH:mm)
 */
export const formatLocalTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
}

/**
 * Format duration in minutes to a human-readable string
 * @param durationMinutes - Duration in minutes
 * @returns Formatted duration string (e.g., "1 h 30 min" or "45 min")
 */
export const formatDuration = (durationMinutes: number): string => {
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60

    if (hours > 0) {
        return `${hours} h ${minutes} min`
    }
    return `${durationMinutes} min`
}

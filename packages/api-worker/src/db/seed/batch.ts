// D1 caps the number of bound parameters per statement (far lower than libsql), so every
// Bulk write in the seed pipeline is split into chunks that stay under that ceiling. Keeping
// The seed D1-compatible lets the test runtime exercise it against the real Workers D1 binding.
const D1_MAX_BOUND_PARAMS = 90

const chunk = <T>(items: readonly T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }
    return chunks
}

// Split rows for a multi-row insert so `rows * columnsPerRow` stays under the D1 limit.
export const chunkRowsForInsert = <T>(rows: readonly T[], columnsPerRow: number): T[][] => {
    const rowsPerChunk = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / Math.max(1, columnsPerRow)))
    return chunk(rows, rowsPerChunk)
}

// Split a list of values bound into a single predicate (e.g. inArray) into safe-sized batches.
export const chunkValues = <T>(values: readonly T[]): T[][] => chunk(values, D1_MAX_BOUND_PARAMS)

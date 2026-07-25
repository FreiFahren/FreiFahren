// Data moves between databases as generated INSERT statements, because `wrangler d1 execute --file`
// Takes SQL text rather than bound parameters.
export const toSqlLiteral = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    if (typeof value === 'boolean') return value ? '1' : '0'
    return `'${String(value).replace(/'/g, "''")}'`
}

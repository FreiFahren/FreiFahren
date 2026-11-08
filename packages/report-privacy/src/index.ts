// Single source of truth for the reports table's private intake columns (DB names, snake_case).
// Add a column here when it's added to the schema.
export const PRIVATE_REPORT_COLUMNS = new Set(['client_hash', 'asn', 'as_organization', 'ua_family', 'trust_flags'])

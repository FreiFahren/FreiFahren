// Single source of truth for the reports table's private intake columns (DB names, snake_case),
// shared by api-worker (schema, preview copy) and warehouse-export, which don't otherwise depend
// on each other. Add a column here when it's added to the schema.
export const PRIVATE_REPORT_COLUMNS = new Set(['client_hash', 'asn', 'as_organization', 'ua_family', 'trust_flags'])

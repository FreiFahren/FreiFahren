import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as reports from './schema/reports';
import * as lines from './schema/lines';
import * as stations from './schema/stations';

const connectionString = process.env.DATABASE_URL!;

export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, {
  schema: { ...reports, ...lines, ...stations },
});

export type DbConnection = typeof db;

export  *  from './schema/reports';
export  * from './schema/lines';
export  * from './schema/stations';


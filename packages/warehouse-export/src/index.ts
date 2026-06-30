// Snapshots every table in the D1 database to R2 as CSV so PostHog can link them as a warehouse
// source (it has no D1 connector). Tables and columns are discovered at runtime, so a schema change
// in api-worker needs no edit here — the export just picks it up on the next run.

interface Env {
  DB: D1Database;
  WAREHOUSE: R2Bucket;
  // Optional bearer token gating POST /run. Unset = manual runs disabled (cron still works).
  EXPORT_TOKEN?: string;
}

const PREFIX = 'd1';
const PAGE_SIZE = 10_000;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Real data tables only: skip SQLite internals, Cloudflare internals, and the migrations ledger.
async function listTables(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '_cf_%'
       AND name <> 'd1_migrations'
     ORDER BY name`,
  ).all<{ name: string }>();
  return results.map((r) => r.name);
}

async function columnsOf(env: Env, table: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM pragma_table_info('${table.replace(/'/g, "''")}')`,
  ).all<{ name: string }>();
  return results.map((r) => r.name);
}

// Keyset-paginated over rowid so the export stays bounded however large a table grows.
async function exportTable(env: Env, table: string): Promise<number> {
  const columns = await columnsOf(env, table);
  const lines: string[] = [columns.map(csvCell).join(',')];
  let cursor = Number.MIN_SAFE_INTEGER;
  let total = 0;
  for (;;) {
    const { results } = await env.DB.prepare(
      `SELECT *, rowid AS __cursor FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT ?`,
    )
      .bind(cursor, PAGE_SIZE)
      .all<Record<string, unknown>>();
    if (results.length === 0) break;
    for (const row of results) lines.push(columns.map((c) => csvCell(row[c])).join(','));
    cursor = Number(results[results.length - 1].__cursor);
    total += results.length;
    if (results.length < PAGE_SIZE) break;
  }
  await env.WAREHOUSE.put(`${PREFIX}/${table}.csv`, `${lines.join('\n')}\n`, {
    httpMetadata: { contentType: 'text/csv' },
  });
  return total;
}

async function run(env: Env): Promise<Record<string, unknown>> {
  const counts: Record<string, number> = {};
  for (const table of await listTables(env)) counts[table] = await exportTable(env, table);
  return { ok: true, exportedAt: new Date().toISOString(), counts };
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(run(env).then((summary) => console.log('warehouse-export', JSON.stringify(summary))));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/run') {
      if (!env.EXPORT_TOKEN || request.headers.get('authorization') !== `Bearer ${env.EXPORT_TOKEN}`) {
        return new Response('forbidden', { status: 403 });
      }
      return Response.json(await run(env));
    }
    return new Response('warehouse-export: scheduled D1 -> R2 CSV snapshot. POST /run to trigger.', {
      status: 200,
    });
  },
};

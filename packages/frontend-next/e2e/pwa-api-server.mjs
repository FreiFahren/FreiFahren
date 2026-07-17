import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiWorkerDir = fileURLToPath(new URL('../../api-worker/', import.meta.url));
const persistencePath = await mkdtemp(join(tmpdir(), 'freifahren-pwa-api-'));

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: apiWorkerDir, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });

await run('bun', ['run', 'seed', '--city', 'berlin', '--persist-to', persistencePath]);

const worker = spawn(
  'bunx',
  ['wrangler', 'dev', '--local', '--port', '8787', '--persist-to', persistencePath],
  { cwd: apiWorkerDir, stdio: 'inherit' },
);

const stop = () => {
  worker.kill();
  void rm(persistencePath, { recursive: true, force: true });
};

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
worker.once('exit', (code) => process.exit(code ?? 1));

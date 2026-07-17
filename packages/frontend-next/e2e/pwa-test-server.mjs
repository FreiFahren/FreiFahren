import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

let shellRevision = 0;

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (url.pathname === '/health') {
    response.writeHead(200).end();
    return;
  }

  const relativePath = normalize(url.pathname).replace(/^[/\\]+/, '');
  if (relativePath.startsWith('..')) {
    response.writeHead(400).end();
    return;
  }
  let file = join(dist, relativePath);
  if (!relativePath || !existsSync(file) || (await stat(file)).isDirectory())
    file = join(dist, 'index.html');

  const isHtml = file.endsWith('.html');
  response.writeHead(200, {
    'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
    ...(isHtml ? { 'x-pwa-e2e-shell-revision': String(++shellRevision) } : {}),
  });
  createReadStream(file).pipe(response);
}).listen(1871, 'localhost');

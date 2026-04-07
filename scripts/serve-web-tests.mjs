import { createReadStream, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const webDistDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PW_WEB_PORT ?? 4173);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PW_WEB_PORT: ${process.env.PW_WEB_PORT ?? '(unset)'}`);
}

function exportWebBuild() {
  execSync('npx expo export -p web', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_E2E: '1',
      CI: process.env.CI ?? '1',
    },
  });
}

exportWebBuild();

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
]);

function resolvePath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname.split('?')[0]);
  const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = path.join(webDistDir, normalized);

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return path.join(webDistDir, 'index.html');
}

const server = http.createServer((req, res) => {
  const pathname = req.url ?? '/';
  const filePath = resolvePath(pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes.get(ext) ?? 'application/octet-stream';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Playwright web server running at http://127.0.0.1:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

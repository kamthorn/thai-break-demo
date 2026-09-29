// Zero-dependency static server for local development: `npm start` (PORT=3000 by default).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }
  // Resolve inside the project directory only
  const filePath = path.join(root, path.normalize(urlPath === '/' ? '/index.html' : urlPath));
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ThaiBreak demo: http://localhost:${server.address().port}`);
});

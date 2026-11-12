// Tiny static server for previewing /dist locally:  npm run build && npm run preview
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const port = process.env.PORT || 8080;
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.startsWith('/admin') && !extname(p)) p = '/admin/index.html';
  try {
    let f = join(root, p); if ((await stat(f)).isDirectory()) f = join(f, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f));
  } catch { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(join(root, '404.html')).catch(() => 'Not found')); }
}).listen(port, () => console.log(`Preview: http://localhost:${port}`));

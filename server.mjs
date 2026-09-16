import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.mp3':'audio/mpeg' };

createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = normalize(join(root, relative));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  const size = statSync(file).size;
  const range = request.headers.range;
  if (range) {
    const [startText, endText] = range.replace(/bytes=/, '').split('-');
    const start = Number(startText);
    const end = endText ? Number(endText) : size - 1;
    response.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    createReadStream(file, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, { 'Content-Length': size, 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));

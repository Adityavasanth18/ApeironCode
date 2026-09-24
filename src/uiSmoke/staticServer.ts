import {createServer, type Server} from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

export interface StaticServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Start a tiny local static file server rooted at `dir` (Phase 20D, Task A).
 * Path traversal is prevented: requests resolving outside the root return 403.
 * Binds to 127.0.0.1 on the given port (0 = ephemeral). Never serves `.env`.
 */
export const startStaticServer = async (
  dir: string,
  port = 0,
): Promise<StaticServerHandle> => {
  const root = path.resolve(dir);

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
        const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/u, '');
        const resolved = path.resolve(root, relative);

        // Block traversal and dotfile secrets.
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        if (/(?:^|[\\/])\.env(?:\.|$)/u.test(relative)) {
          res.writeHead(403).end('Forbidden');
          return;
        }

        const data = await fs.readFile(resolved);
        res.writeHead(200, {'Content-Type': MIME[path.extname(resolved)] ?? 'application/octet-stream'});
        res.end(data);
      } catch {
        res.writeHead(404).end('Not found');
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  return {
    url: `http://127.0.0.1:${boundPort}`,
    port: boundPort,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

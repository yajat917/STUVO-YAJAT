const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);

// ─── Security hardening ─────────────────────────────────────
const MAX_API_BODY_BYTES = 256 * 1024; // 256 KB cap on /api/* POST bodies
// NOTE: per-IP application rate limiting was intentionally removed — a whole
// school behind one NAT IP shares a single public address, so a per-IP cap
// blocked legitimate classroom use. Abuse protection now rests on input
// validation, the body-size cap above, and upstream OpenRouter limits.
// (Upstream provider 429s cannot be removed here regardless.)
const ENDPOINT_NAME_RE = /^[A-Za-z0-9_-]+$/;

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
}

function safeStaticPath(rootDir, requestPath) {
  // Resolve and contain: block path traversal outside rootDir.
  const resolved = path.resolve(rootDir, '.' + requestPath);
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) return null;
  return resolved;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle Serverless API routes (/api/*)
  if (pathname.startsWith('/api/')) {
    const endpointName = pathname.replace('/api/', '').split('/')[0].split('?')[0];
    if (!ENDPOINT_NAME_RE.test(endpointName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid API route.' }));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed.' }));
      return;
    }
    const handlerPath = path.join(ROOT, 'api', `${endpointName}.js`);

    if (fs.existsSync(handlerPath)) {
      let body = '';
      let tooLarge = false;
      req.on('data', chunk => {
        body += chunk;
        if (body.length > MAX_API_BODY_BYTES) tooLarge = true;
      });
      req.on('end', async () => {
        if (tooLarge) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large.' }));
          return;
        }
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          req.body = jsonBody;

          const vercelRes = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(key, val) { res.setHeader(key, val); return this; },
            json(data) {
              res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            },
            send(data) {
              res.writeHead(this.statusCode, { 'Content-Type': 'text/plain' });
              res.end(data);
            }
          };

          const handler = require(handlerPath);
          await handler(req, vercelRes);
        } catch (err) {
          console.error(`[API Error] ${pathname}:`, err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          // Generic message to clients; details stay server-side in logs.
          res.end(JSON.stringify({ error: 'Internal server error. Please try again.' }));
        }
      });
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `API route ${pathname} not found` }));
      return;
    }
  }

  // Serve static files from /stuvo or root (contained: no traversal)
  let relativePath = pathname === '/' ? '/stuvo/index.html' : pathname;
  let filePath = safeStaticPath(ROOT, relativePath);

  // If path doesn't exist, check inside /stuvo/
  if ((!filePath || !fs.existsSync(filePath)) && safeStaticPath(path.join(ROOT, 'stuvo'), relativePath)) {
    const alt = safeStaticPath(path.join(ROOT, 'stuvo'), relativePath);
    if (alt && fs.existsSync(alt)) filePath = alt;
  }

  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback
    const fallbackPath = path.join(ROOT, 'stuvo', 'index.html');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallbackPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`> StudyOS / Stuvo local server running at: http://localhost:${PORT}`);
  console.log(`> AI endpoints active with OpenRouter API key.`);
});

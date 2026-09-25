const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);

// ─── Security hardening ─────────────────────────────────────
const MAX_API_BODY_BYTES = 256 * 1024; // 256 KB cap on /api/* POST bodies
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_HITS = 60; // 60 /api requests per IP per minute
const rateBuckets = new Map(); // ip -> { count, resetAt }
const ENDPOINT_NAME_RE = /^[A-Za-z0-9_-]+$/;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimited(req, res) {
  const ip = clientIp(req);
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, b);
  }
  b.count++;
  if (rateBuckets.size > 5000) rateBuckets.clear(); // avoid unbounded growth
  if (b.count > RATE_MAX_HITS) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    res.end(JSON.stringify({ error: 'Too many requests. Please wait a minute and try again.' }));
    return true;
  }
  return false;
}

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
    if (rateLimited(req, res)) return;
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

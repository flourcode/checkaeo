/**
 * Aeoden scanner — AWS Lambda adapter (Node.js 20+, ESM)
 *
 * Reuses the same scan pipeline and scoring as the Cloudflare Worker.
 *
 * Deploy as a Lambda with a Function URL:
 *   - Auth type: NONE
 *   - CORS: configure in the Lambda Function URL settings
 *
 * IMPORTANT:
 * Do not also add Access-Control-Allow-* headers in this file when
 * Function URL CORS is enabled. AWS will add them to the response.
 * Adding them here too produces duplicate values such as "*, *",
 * which browsers reject.
 *
 * Accepts:
 *   POST <url>/scan  {"url":"example.com"}
 *   GET  <url>/scan?url=example.com
 *   GET  <url>/health
 */
import { scan, validateUrl } from './index.js';

const RATE = { windowMs: 60_000, max: 12 };
const hits = new Map();
const cache = new Map(); // per-container memo, 10 min
const CACHE_TTL_MS = 600_000;

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/';

  // Lambda Function URL CORS normally answers preflight before invocation.
  // Returning 204 here is harmless if an OPTIONS request reaches the function.
  if (method === 'OPTIONS') return resp(204, '');

  if (path.endsWith('/health')) {
    return json(200, {
      ok: true,
      service: 'checkaeo-scan',
      runtime: 'lambda'
    });
  }

  // Only expose the scanner route (and root for compatibility).
  if (path !== '/' && !path.endsWith('/scan')) {
    return json(404, { ok: false, error: 'Not found' });
  }

  let target = event.queryStringParameters?.url;

  if (method === 'POST') {
    try {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString()
        : (event.body || '{}');

      target = JSON.parse(raw).url;
    } catch {
      return json(400, {
        ok: false,
        error: 'Body must be JSON with a "url" field.'
      });
    }
  }

  if (method !== 'GET' && method !== 'POST') {
    return json(405, {
      ok: false,
      error: 'Method not allowed.'
    });
  }

  const ip = event.requestContext?.http?.sourceIp || 'anon';
  if (!allow(ip)) {
    return json(429, {
      ok: false,
      error: 'Too many scans in the last minute. Try again shortly.'
    });
  }

  const v = validateUrl(target);
  if (v.error) {
    return json(400, { ok: false, error: v.error });
  }

  const fresh = event.queryStringParameters?.fresh === '1';
  const hit = cache.get(v.url);

  if (hit && !fresh && Date.now() - hit.t < CACHE_TTL_MS) {
    return json(200, { ...hit.r, cached: true });
  }

  try {
    const r = await scan(v.url);

    cache.set(v.url, { t: Date.now(), r });
    if (cache.size > 500) cache.clear();

    return json(200, r);
  } catch {
    return json(502, {
      ok: false,
      error: 'We could not reach that site.'
    });
  }
};

function allow(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { start: now, n: 0 };

  if (now - rec.start > RATE.windowMs) {
    rec.start = now;
    rec.n = 0;
  }

  rec.n++;
  hits.set(ip, rec);

  if (hits.size > 5000) hits.clear();

  return rec.n <= RATE.max;
}

/*
 * Do not put CORS headers here while Lambda Function URL CORS is enabled.
 * AWS adds Access-Control-Allow-Origin / Methods / Headers itself.
 */
function resp(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { ...extra },
    body
  };
}

function json(statusCode, obj) {
  return resp(
    statusCode,
    JSON.stringify(obj),
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  );
}

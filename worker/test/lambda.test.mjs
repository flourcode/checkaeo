import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../src/lambda.js';

const ev = (method, rawPath, extra = {}) => ({ requestContext: { http: { method, sourceIp: '9.9.9.9' } }, rawPath, ...extra });

test('health responds without calling the scanner', async () => {
  const r = await handler(ev('GET', '/health'));
  assert.equal(r.statusCode, 200);
  assert.equal(JSON.parse(r.body).service, 'checkaeo-scan');
});

test('no CORS headers from the function (Function URL CORS owns them)', async () => {
  const r = await handler(ev('GET', '/health'));
  assert.ok(!Object.keys(r.headers).some(h => /^access-control-/i.test(h)), 'duplicate CORS headers would produce "*, *"');
});

test('unknown paths are 404, other methods are 405', async () => {
  assert.equal((await handler(ev('GET', '/admin'))).statusCode, 404);
  assert.equal((await handler(ev('PUT', '/scan', { body: '{}' }))).statusCode, 405);
});

test('bad input is rejected before any fetch', async () => {
  assert.equal((await handler(ev('POST', '/scan', { body: 'not json' }))).statusCode, 400);
  const priv = await handler(ev('GET', '/scan', { queryStringParameters: { url: 'http://169.254.169.254/' } }));
  assert.equal(priv.statusCode, 400);
  assert.match(JSON.parse(priv.body).error, /Private|internal/);
});

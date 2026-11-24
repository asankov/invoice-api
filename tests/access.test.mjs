import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';

let anonymous, authenticated;
before(async () => {
  const bundle = await build({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2024' });
  const config = { name: 'access-test', compatibilityDate: '2026-11-04',
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } } },
  };
  anonymous = new Miniflare({ workers: [{ config }], log: new Log(LogLevel.ERROR) });
  authenticated = new Miniflare({ workers: [{ config: { ...config,
    access: { dev: { aud: 'access-test', identity: { email: 'test@example.invalid' } } },
  } }], log: new Log(LogLevel.ERROR) });
});
after(async () => {
  await Promise.all([anonymous?.dispose(), authenticated?.dispose()]);
});

test('all pages, docs, schema, assets, APIs, and unknown routes require Access', async () => {
  for (const path of ['/', '/docs', '/openapi.json', '/styles.css', '/app.js', '/api/dashboard',
    '/api/customers', '/api/products', '/api/invoices', '/api/invoices/id/pdf', '/api/settings', '/unknown']) {
    const response = await anonymous.dispatchFetch(`http://localhost${path}`);
    assert.equal(response.status, 403, path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Cloudflare Access login required' });
  }
});

test('unauthenticated writes and OPTIONS cannot reach handlers', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await anonymous.dispatchFetch('http://localhost/api/products/id', { method });
    assert.equal(response.status, 403, method);
    await response.text();
  }
});

test('forged Access headers and cookies do not authenticate callers', async () => {
  const response = await anonymous.dispatchFetch('http://localhost/docs', { headers: {
    'cf-access-jwt-assertion': 'forged', 'cf-access-authenticated-user-email': 'admin@example.com',
    'cookie': 'CF_Authorization=forged',
  } });
  assert.equal(response.status, 403);
  await response.text();
});

test('runtime-authenticated requests reach docs, schema, and API handlers', async () => {
  for (const path of ['/docs', '/openapi.json']) {
    const response = await authenticated.dispatchFetch(`http://localhost${path}`);
    assert.equal(response.status, 200, path); await response.text();
  }
  const response = await authenticated.dispatchFetch('http://localhost/api/invoices/id/pdf');
  assert.equal(response.status, 501); // Deferred endpoint reached after authentication.
  await response.text();
});

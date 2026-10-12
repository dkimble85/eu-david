// Run: node --test test-api/   (Node >= 22.18 strips TS types natively; no extra deps.)
// Never touches the network: every case either returns before getToken() or stubs fetch.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.FATSECRET_CLIENT_ID = 'x';
process.env.FATSECRET_CLIENT_SECRET = 'x';

const { default: handler } = await import('../api/fatsecret.ts');

let ipCounter = 0;
const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

function call({ method = 'GET', query = {}, ip = freshIp() } = {}) {
  const res = {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  const req = { method, query, headers: { 'x-forwarded-for': ip }, socket: {} };
  return handler(req, res).then(() => res);
}

function stubFetch(fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    return fn(String(url), init);
  };
  return { calls, restore: () => (globalThis.fetch = real) };
}

const json = (body, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body });

test('405 for non-GET/HEAD, with Allow header', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const r = await call({ method, query: { barcode: '12345678' } });
    assert.equal(r.statusCode, 405);
    assert.equal(r.headers.Allow, 'GET, HEAD');
  }
});

test('400 for missing / malformed barcodes (no upstream call)', async () => {
  const s = stubFetch(() => assert.fail('must not hit network'));
  try {
    const bad = [
      undefined,
      '',
      '1234567', // 7 digits: too short
      '123456789012345', // 15 digits: too long
      '1234abcd5678',
      '12345678&x=1',
      '../etc/passwd',
      'usda-12345678',
      ' 12 34 5678 ',
      ['12345678', '87654321'],
    ];
    for (const barcode of bad) {
      const r = await call({ query: { barcode } });
      assert.equal(r.statusCode, 400, `barcode=${JSON.stringify(barcode)}`);
    }
  } finally {
    s.restore();
  }
  assert.equal(s.calls.length, 0);
});

test('accepts 8, 12, 13 and 14 digit barcodes (and trims whitespace)', async () => {
  const s = stubFetch(() => json({}, false)); // token fetch fails -> 500, i.e. past validation
  const origErr = console.error;
  console.error = () => {};
  try {
    for (const barcode of ['12345678', '036000291452', '5449000000996', '10012345678902', ' 5449000000996 ']) {
      const r = await call({ query: { barcode } });
      assert.equal(r.statusCode, 500, `barcode=${barcode}`);
    }
  } finally {
    console.error = origErr;
    s.restore();
  }
});

test('barcode and food_id are URL-encoded / validated before reaching FatSecret', async () => {
  const s = stubFetch((url) => {
    if (url.includes('oauth')) return json({ access_token: 't', expires_in: 3600 });
    if (url.includes('find-by-id')) return json({ food_id: { value: '1&format=xml' } });
    return json({}, false);
  });
  try {
    const r = await call({ query: { barcode: '5449000000001' } });
    assert.equal(r.statusCode, 404); // injected food_id rejected -> not found
    assert.ok(!s.calls.some((u) => u.includes('/food/v5')), 'bad food_id must not be forwarded');
  } finally {
    s.restore();
  }
});

test('429 on the 31st request from one IP, other IPs unaffected', async () => {
  const ip = '192.0.2.99';
  for (let i = 1; i <= 30; i++) {
    const r = await call({ ip, query: { barcode: 'bad' } });
    assert.equal(r.statusCode, 400, `request ${i}`);
  }
  const r31 = await call({ ip, query: { barcode: 'bad' } });
  assert.equal(r31.statusCode, 429);
  assert.equal(r31.headers['Retry-After'], '60');
  const other = await call({ ip: '192.0.2.100', query: { barcode: 'bad' } });
  assert.equal(other.statusCode, 400);
});

test('product cache is bounded at 500 entries (oldest evicted)', async () => {
  // Every lookup 404s upstream -> negative-cache entry. Re-request the first barcode afterwards:
  // if it was evicted, upstream is hit again; entries 2..N must still be cached.
  const s = stubFetch((url) => {
    if (url.includes('oauth')) return json({ access_token: 't', expires_in: 3600 });
    return json({}, false);
  });
  const lookups = () => s.calls.filter((u) => u.includes('find-by-id')).length;
  try {
    const code = (i) => String(20000000 + i);
    for (let i = 0; i < 501; i++) await call({ query: { barcode: code(i) } });
    assert.equal(lookups(), 501);
    await call({ query: { barcode: code(500) } }); // newest: cached
    assert.equal(lookups(), 501, 'newest entry should be served from cache');
    await call({ query: { barcode: code(0) } }); // oldest: evicted
    assert.equal(lookups(), 502, 'oldest entry should have been evicted (cache unbounded?)');
  } finally {
    s.restore();
  }
});

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { listMyTrips } from '../controllers/tripsController.js';
import { tripsQuery } from '../routes/schemas.js';
import { sgToday, addDays, MEMORY_WINDOW_DAYS } from '../services/logic/memoryWindow.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function mockDatabase(total = 35) {
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    requests.push({ url, options });
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) => ({
      id: String(offset + index), name: `Trip ${offset + index}`, start_date: null,
      membership: [{ role: 'member' }], members: [{ count: 3 }], items: [{ done: true }, { done: false }],
    }));
    return new Response(options.method === 'HEAD' ? null : JSON.stringify(rows), { status: 200, headers: {
      'content-type': 'application/json', 'content-range': `${offset}-${offset + rows.length - 1}/${total}`,
    } });
  };
  return requests;
}
async function list(query) {
  let response;
  await listMyTrips({ user: { id: 'current-user' }, valid: { query: tripsQuery.parse(query) } }, {
    json(data) { response = data; },
  });
  return response;
}

test('planner pagination restricts membership, counts and limits in the database', async () => {
  const requests = mockDatabase();
  const result = await list({ page: '2' });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, 'HEAD');
  const query = requests[1].url.searchParams;
  assert.equal(query.get('membership.user_id'), 'eq.current-user');
  assert.equal(query.get('archived_at'), 'is.null');
  assert.equal(query.get('offset'), '12');
  assert.equal(query.get('limit'), '12');
  assert.equal(query.get('order'), 'created_at.desc,id.asc');
  assert.match(query.get('select'), /membership:trip_members!inner/);
  assert.equal(result.page, 2);
  assert.equal(result.total, 35);
  assert.equal(result.totalPages, 3);
  assert.equal(result.items.length, 12);
  assert.equal(result.items[0].id, '12');
  assert.equal(result.items[0].memberCount, 3);
  assert.equal(result.items[0].doneCount, 1);
});

test('search and phase filters are sent to the database before paging', async () => {
  const requests = mockDatabase(1);
  await list({ page: '1', search: '50%_off', phase: 'memory_box' });
  const query = requests[0].url.searchParams;
  assert.equal(query.get('name'), 'ilike.%50\\%\\_off%');
  assert.equal(query.get('start_date'), `lte.${sgToday()}`);
  const cutoff = addDays(sgToday(), -MEMORY_WINDOW_DAYS);
  assert.match(query.get('or'), new RegExp(`end_date.gte.${cutoff}`));
  assert.match(query.get('or'), /end_date.is.null/);
});

test('out-of-range pages are clamped and empty lists return page one', async () => {
  const requests = mockDatabase();
  const result = await list({ page: '99' });
  assert.equal(result.page, 3);
  assert.equal(result.items.length, 11);
  assert.equal(requests[1].url.searchParams.get('offset'), '24');
  mockDatabase(0);
  const empty = await list({ page: '1' });
  assert.deepEqual(empty, { items: [], page: 1, pageSize: 12, total: 0, totalPages: 1 });
});

test('pagination rejects invalid limits and preserves unpaged request support', () => {
  assert.equal(tripsQuery.parse({}).page, undefined);
  for (const query of [{ page: '0' }, { page: '1.5' }, { page: 'no' }, { pageSize: '51' }]) {
    assert.equal(tripsQuery.safeParse(query).success, false);
  }
});

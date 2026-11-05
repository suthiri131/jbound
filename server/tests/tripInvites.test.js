import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { joinByCode, listMyTrips } from '../controllers/tripsController.js';
import { getAttic } from '../controllers/archivesController.js';
import { listPosts } from '../controllers/postsController.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

/** Answers each table from `tables`, and records every request made. */
function mockDatabase(tables = {}) {
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const table = url.pathname.split('/').pop();
    requests.push({ table, method: options.method, query: url.searchParams, body: options.body });
    const body = tables[table] ?? [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-range': '0-0/0' },
    });
  };
  return requests;
}
const respond = () => {
  const out = {};
  return { out, res: { json(data) { out.data = data; }, status() { return this; }, end() {} } };
};
const reads = (requests, table) => requests.filter((r) => r.table === table && r.method === 'GET');

test('the unpaged trip list (Ledger, Basecamp, notifications) only reads accepted memberships', async () => {
  const requests = mockDatabase();
  await listMyTrips({ user: { id: 'me' }, valid: { query: {} } }, respond().res);
  assert.equal(reads(requests, 'trip_members')[0].query.get('status'), 'eq.accepted');
});

test('the Planner page only counts and lists accepted memberships', async () => {
  const requests = mockDatabase();
  await listMyTrips({ user: { id: 'me' }, valid: { query: { page: 1, pageSize: 12 } } }, respond().res);
  assert.equal(requests[0].table, 'trips');
  assert.equal(requests[0].query.get('membership.status'), 'eq.accepted');
});

test('the Archives only read accepted memberships', async () => {
  const requests = mockDatabase();
  await getAttic({ user: { id: 'me' } }, respond().res);
  assert.equal(reads(requests, 'trip_members')[0].query.get('status'), 'eq.accepted');
});

test('the friends feed ignores trips you have only been invited to, and people only invited to yours', async () => {
  const requests = mockDatabase({ trip_members: [{ trip_id: 't1', user_id: 'friend' }] });
  await listPosts({ user: { id: 'me' }, valid: { query: { scope: 'friends', limit: 10 } } }, respond().res);
  const memberReads = reads(requests, 'trip_members');
  assert.equal(memberReads.length, 2);
  for (const read of memberReads) assert.equal(read.query.get('status'), 'eq.accepted');
});

test('using a valid invite code while invited accepts the invite', async () => {
  const requests = mockDatabase({
    trips: { id: 't1', name: 'Muar' },
    trip_members: { role: 'member', status: 'pending' },
    profiles: { name: 'Sam' },
  });
  const { out, res } = respond();
  await joinByCode({ user: { id: 'me' }, valid: { body: { inviteCode: 'abcd1234' } } }, res);
  const update = requests.find((r) => r.table === 'trip_members' && r.method === 'PATCH');
  assert.deepEqual(JSON.parse(update.body), { status: 'accepted' });
  assert.equal(out.data.alreadyMember, false);
});

test('using a valid invite code when already on the trip changes nothing', async () => {
  const requests = mockDatabase({
    trips: { id: 't1', name: 'Muar' },
    trip_members: { role: 'member', status: 'accepted' },
  });
  const { out, res } = respond();
  await joinByCode({ user: { id: 'me' }, valid: { body: { inviteCode: 'abcd1234' } } }, res);
  assert.equal(requests.some((r) => r.method === 'PATCH'), false);
  assert.equal(out.data.alreadyMember, true);
});

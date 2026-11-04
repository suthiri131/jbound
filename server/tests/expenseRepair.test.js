import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { deleteExpense, getBalances, repairSplit } from '../controllers/expensesController.js';
import { createExpenseBody } from '../routes/schemas.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const ALEX = '11111111-1111-4111-8111-111111111111';
const SAM = '22222222-2222-4222-8222-222222222222';

function mockDatabase(tables) {
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const table = new URL(input).pathname.split('/').pop();
    requests.push({ table, method: options.method });
    return new Response(JSON.stringify(tables[table] ?? []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return requests;
}
const expense = (id, amount) => ({
  id, trip_id: 'trip', paid_by: 'alex', currency: 'SGD', amount, amount_sgd: amount, exchange_rate: 1,
  rate_date: '2026-11-01', created_at: '2026-11-01T00:00:00Z',
});
async function balancesFor(tables) {
  mockDatabase({
    trip_members: [{ user_id: 'alex' }, { user_id: 'sam' }],
    profiles: [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }],
    settlements: [],
    ...tables,
  });
  let body;
  await getBalances({ params: { tripId: 'trip' } }, { json(data) { body = data; } });
  return Object.fromEntries(body.balances.map((b) => [b.memberId, b.balanceCents]));
}

test('an expense whose split members have all gone no longer charges anyone', async () => {
  const balances = await balancesFor({ expenses: [expense('one', 10)], expense_splits: [] });
  assert.deepEqual(balances, { alex: 0, sam: 0 });
});

test('when a custom split loses a member, the payer absorbs their share and the rest owe the same', async () => {
  const balances = await balancesFor({
    expenses: [expense('one', 30)],
    expense_splits: [{ expense_id: 'one', user_id: 'sam', amount_sgd: 10 }], // a third member's 20 went with them
  });
  assert.deepEqual(balances, { alex: 1000, sam: -1000 });
});

test('one damaged expense leaves the others counted', async () => {
  const balances = await balancesFor({
    expenses: [expense('bad', 10), expense('good', 4)],
    expense_splits: [{ expense_id: 'good', user_id: 'sam', amount_sgd: null }],
  });
  assert.deepEqual(balances, { alex: 400, sam: -400 });
});

test('shares that add up to more than the expense fall back to an equal split', () => {
  const repaired = repairSplit({
    paid_by: 'alex',
    amount_sgd: 10,
    splitAmong: ['alex', 'sam'],
    splitAmounts: [{ memberId: 'alex', amountCents: 800 }, { memberId: 'sam', amountCents: 800 }],
  });
  assert.equal(repaired.splitAmounts, null);
  assert.deepEqual(repaired.splitAmong, ['alex', 'sam']);
});

test('a healthy split is left alone', () => {
  const healthy = {
    paid_by: 'alex',
    amount_sgd: 10,
    splitAmong: ['sam'],
    splitAmounts: [{ memberId: 'sam', amountCents: 1000 }],
  };
  assert.deepEqual(repairSplit(healthy), { splitAmong: ['sam'], splitAmounts: healthy.splitAmounts });
});

test('expenses need a payer and at least one person to split with, each only once', () => {
  const body = { amount: 10, currency: 'SGD', description: 'Lunch', paidBy: ALEX, splitAmong: [ALEX, SAM] };
  assert.equal(createExpenseBody.safeParse(body).success, true);
  assert.equal(createExpenseBody.safeParse({ ...body, splitAmong: [] }).success, false);
  assert.equal(createExpenseBody.safeParse({ ...body, splitAmong: [ALEX, ALEX] }).success, false);
  assert.equal(createExpenseBody.safeParse({ ...body, splitAmong: undefined }).success, false);
  assert.equal(createExpenseBody.safeParse({ ...body, paidBy: undefined }).success, false);
});

const deleteReq = (userId, role = 'member') => ({
  params: { tripId: 'trip', expenseId: 'one' },
  user: { id: userId },
  membership: { role },
});
const res = () => ({ code: null, status(code) { this.code = code; return this; }, end() {} });

test('the person who added an expense can delete it', async () => {
  const requests = mockDatabase({ expenses: { id: 'one', created_by: 'alex' } });
  const response = res();
  await deleteExpense(deleteReq('alex'), response);
  assert.equal(response.code, 204);
  assert.ok(requests.some((r) => r.table === 'expenses' && r.method === 'DELETE'));
});

test('the trip owner can delete anyone\'s expense', async () => {
  mockDatabase({ expenses: { id: 'one', created_by: 'alex' } });
  const response = res();
  await deleteExpense(deleteReq('sam', 'owner'), response);
  assert.equal(response.code, 204);
});

test('other members cannot delete it', async () => {
  const requests = mockDatabase({ expenses: { id: 'one', created_by: 'alex' } });
  await assert.rejects(deleteExpense(deleteReq('sam'), res()), { status: 403 });
  assert.equal(requests.some((r) => r.method === 'DELETE'), false);
});

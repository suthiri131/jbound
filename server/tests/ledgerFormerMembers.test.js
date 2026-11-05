import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createExpense, createSettlement, getBalances, getExpenses, updateExpense } from '../controllers/expensesController.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

/** Answers each Supabase table from `tables`; rate lookups go to `onOther` so a test can notice them. */
function mockDatabase(tables, onOther = () => {}) {
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (!url.pathname.startsWith('/rest/')) {
      onOther(url);
      return new Response(JSON.stringify({ base: 'MYR', date: '2026-11-05', rates: { SGD: 0.5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const table = url.pathname.split('/').pop();
    requests.push({ table, method: options.method ?? 'GET', query: url.search, body: options.body ? JSON.parse(options.body) : null });
    const data = options.method === 'PATCH' || options.method === 'POST' ? (tables[`${table}:written`] ?? {}) : (tables[table] ?? []);
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return requests;
}
const written = (requests, table, method) => requests.find((r) => r.table === table && r.method === method)?.body;

const expenseRow = (over = {}) => ({
  id: 'e1', trip_id: 'trip', created_by: 'alex', paid_by: 'alex', description: 'Dinner',
  amount: 100, currency: 'MYR', amount_sgd: 30, exchange_rate: 0.3, rate_date: '2026-10-01',
  created_at: '2026-10-01T00:00:00Z', ...over,
});
const editReq = (body, userId = 'alex') => ({
  params: { tripId: 'trip', expenseId: 'e1' },
  user: { id: userId },
  membership: { role: 'member' },
  valid: { body: { amount: 100, currency: 'MYR', description: 'Dinner', paidBy: 'alex', splitAmong: ['alex', 'sam'], ...body } },
});
const responder = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const crew = [{ user_id: 'alex' }, { user_id: 'sam' }];
const splits = [{ user_id: 'alex' }, { user_id: 'sam' }];

// ---------- invited people aren't in the crew yet ----------

test('only people who have accepted count as the crew', async () => {
  const requests = mockDatabase({ trip_members: crew, profiles: [], expenses: [], settlements: [] });
  await getExpenses({ params: { tripId: 'trip' } }, responder());
  assert.match(requests.find((r) => r.table === 'trip_members').query, /status=eq\.accepted/);
});

test('someone still invited cannot be added to a new expense', async () => {
  const requests = mockDatabase({ trip_members: crew });
  const req = { ...editReq({ splitAmong: ['alex', 'invited'] }), params: { tripId: 'trip' } };
  await assert.rejects(createExpense(req, responder()), { status: 400 });
  assert.equal(requests.some((r) => r.table === 'expenses'), false);
});

test('a new expense among the crew still works', async () => {
  const requests = mockDatabase({ trip_members: crew, 'expenses:written': expenseRow() });
  const response = responder();
  await createExpense({ ...editReq({}), params: { tripId: 'trip' } }, response);
  assert.equal(response.code, 201);
  assert.ok(written(requests, 'expense_splits', 'POST'));
});

// ---------- an edit keeps the rate the expense was logged at ----------

test('editing only the description keeps the original rate and SGD amount', async () => {
  let rateLookups = 0;
  const requests = mockDatabase({ trip_members: crew, expenses: expenseRow(), expense_splits: splits, 'expenses:written': expenseRow() }, () => { rateLookups += 1; });
  await updateExpense(editReq({ description: 'Team dinner' }), responder());

  const update = written(requests, 'expenses', 'PATCH');
  assert.equal(rateLookups, 0);
  assert.equal(update.description, 'Team dinner');
  assert.equal(update.amount_sgd, 30);
  assert.equal(update.exchange_rate, 0.3);
  assert.equal(update.rate_date, '2026-10-01');
});

test('changing the amount works it out at the original rate', async () => {
  let rateLookups = 0;
  const requests = mockDatabase({ trip_members: crew, expenses: expenseRow(), expense_splits: splits, 'expenses:written': expenseRow() }, () => { rateLookups += 1; });
  await updateExpense(editReq({ amount: 110 }), responder());

  const update = written(requests, 'expenses', 'PATCH');
  assert.equal(rateLookups, 0);
  assert.equal(update.amount_sgd, 33);
  assert.equal(update.exchange_rate, 0.3);
});

test('custom shares on an edit use the original rate too', async () => {
  const requests = mockDatabase({ trip_members: crew, expenses: expenseRow(), expense_splits: splits, 'expenses:written': expenseRow() });
  await updateExpense(editReq({ splitAmounts: [{ memberId: 'alex', amount: 60 }, { memberId: 'sam', amount: 40 }] }), responder());
  assert.deepEqual(written(requests, 'expense_splits', 'POST').map((s) => s.amount_sgd), [18, 12]);
});

test('changing the currency takes a new rate', async () => {
  const requests = mockDatabase({ trip_members: crew, expenses: expenseRow(), expense_splits: splits, 'expenses:written': expenseRow() });
  await updateExpense(editReq({ currency: 'SGD' }), responder());

  const update = written(requests, 'expenses', 'PATCH');
  assert.equal(update.exchange_rate, 1);
  assert.equal(update.amount_sgd, 100);
  assert.notEqual(update.rate_date, '2026-10-01');
});

// ---------- people who have left ----------

test('an old expense can still be edited after someone on it has left', async () => {
  const requests = mockDatabase({
    trip_members: [{ user_id: 'alex' }],
    expenses: expenseRow({ paid_by: 'gone' }),
    expense_splits: [{ user_id: 'alex' }, { user_id: 'gone' }],
    'expenses:written': expenseRow(),
  });
  await updateExpense(editReq({ paidBy: 'gone', splitAmong: ['alex', 'gone'], description: 'Fixed typo' }), responder());
  assert.equal(written(requests, 'expenses', 'PATCH').paid_by, 'gone');
});

test('an edit cannot add someone new who is not in the crew', async () => {
  mockDatabase({ trip_members: [{ user_id: 'alex' }], expenses: expenseRow(), expense_splits: [{ user_id: 'alex' }] });
  await assert.rejects(updateExpense(editReq({ splitAmong: ['alex', 'stranger'] }), responder()), { status: 400 });
});

test('the ledger still names people who have left', async () => {
  mockDatabase({
    trip_members: [{ user_id: 'alex' }],
    expenses: [expenseRow({ amount: 10, amount_sgd: 10, currency: 'SGD', exchange_rate: 1 })],
    expense_splits: [{ expense_id: 'e1', user_id: 'gone', amount_sgd: null }],
    settlements: [],
    profiles: [{ id: 'gone', name: 'Gone Member' }],
  });
  const response = responder();
  await getExpenses({ params: { tripId: 'trip' } }, response);
  assert.deepEqual(response.body.formerMembers, [{ id: 'gone', name: 'Gone Member' }]);
});

test('nobody is listed as having left when the whole ledger is the crew', async () => {
  mockDatabase({
    trip_members: [{ user_id: 'alex' }],
    expenses: [expenseRow({ amount: 10, amount_sgd: 10, currency: 'SGD', exchange_rate: 1 })],
    expense_splits: [{ expense_id: 'e1', user_id: 'alex', amount_sgd: null }],
    settlements: [],
    profiles: [{ id: 'alex', name: 'Alex' }],
  });
  const response = responder();
  await getExpenses({ params: { tripId: 'trip' } }, response);
  assert.deepEqual(response.body.formerMembers, []);
});

// ---------- settling up with someone who has left ----------

let crewOf; // who is still in the crew for this test

/** A ledger where `from` owes `to` 10. */
const owes = (from, to, amount = 10) => ({
  trip_members: crewOf,
  expenses: [expenseRow({ paid_by: to, amount, amount_sgd: amount, currency: 'SGD', exchange_rate: 1 })],
  expense_splits: [{ expense_id: 'e1', user_id: from, amount_sgd: null }],
  settlements: [],
  profiles: [],
  'settlements:written': { id: 's1', from_user: from, to_user: to, amount_sgd: amount },
});
const settle = (from, to, userId, role = 'member') => createSettlement({
  params: { tripId: 'trip' }, user: { id: userId }, membership: { role }, valid: { body: { from, to, amountSgd: 10 } },
}, responder());

test('you can confirm a payment from someone who has left', async () => {
  crewOf = [{ user_id: 'alex' }];
  const requests = mockDatabase(owes('gone', 'alex'));
  await settle('gone', 'alex', 'alex');
  assert.deepEqual(written(requests, 'settlements', 'POST'), { trip_id: 'trip', from_user: 'gone', to_user: 'alex', amount_sgd: 10 });
});

test('if the person owed has left, the one paying can confirm it', async () => {
  crewOf = [{ user_id: 'alex' }];
  const requests = mockDatabase(owes('alex', 'gone'));
  await settle('alex', 'gone', 'alex');
  assert.ok(written(requests, 'settlements', 'POST'));
});

test('if both have left, the trip owner can confirm it', async () => {
  crewOf = [{ user_id: 'owner' }];
  const requests = mockDatabase(owes('gone', 'alsogone'));
  await settle('gone', 'alsogone', 'owner', 'owner');
  assert.ok(written(requests, 'settlements', 'POST'));
});

test('someone else in the crew cannot confirm it for them', async () => {
  crewOf = [{ user_id: 'alex' }, { user_id: 'sam' }];
  const requests = mockDatabase(owes('gone', 'alsogone'));
  await assert.rejects(settle('gone', 'alsogone', 'sam'), { status: 403 });
  assert.equal(requests.some((r) => r.method === 'POST'), false);
});

test('while the person owed is still here, only they can confirm it', async () => {
  crewOf = [{ user_id: 'alex' }, { user_id: 'sam' }];
  mockDatabase(owes('sam', 'alex'));
  await assert.rejects(settle('sam', 'alex', 'sam'), { status: 403 });
  await assert.rejects(settle('sam', 'alex', 'owner', 'owner'), { status: 403 });
});

test('a settlement with someone who owes nothing on this trip is rejected', async () => {
  crewOf = [{ user_id: 'alex' }];
  mockDatabase(owes('gone', 'alex'));
  await assert.rejects(settle('stranger', 'alex', 'alex'), { status: 400 });
});

test('former members still appear in balances so their debts can be seen', async () => {
  crewOf = [{ user_id: 'alex' }];
  mockDatabase(owes('gone', 'alex'));
  const response = responder();
  await getBalances({ params: { tripId: 'trip' } }, response);
  assert.deepEqual(response.body.settlements.map(({ from, to }) => [from, to]), [['gone', 'alex']]);
});

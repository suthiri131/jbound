import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getBalances } from '../controllers/expensesController.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const expense = (id, amount) => ({
  id, trip_id: 'trip', paid_by: 'alex', currency: 'SGD', amount, amount_sgd: amount, exchange_rate: 1,
  rate_date: '2026-11-01', created_at: '2026-11-01T00:00:00Z',
});

const tables = {
  trip_members: [{ user_id: 'alex' }, { user_id: 'sam' }],
  expenses: [expense('one', 0.1), expense('two', 0.2)],
  expense_splits: [
    { expense_id: 'one', user_id: 'sam', amount_sgd: 0.1 },
    { expense_id: 'two', user_id: 'sam', amount_sgd: 0.2 },
  ],
  profiles: [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }],
  settlements: [],
};

test('balances include the total spent and each member\'s balance', async () => {
  globalThis.fetch = async (input) => {
    const table = new URL(input).pathname.split('/').pop();
    return new Response(JSON.stringify(tables[table]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  let response;
  await getBalances({ params: { tripId: 'trip' } }, { json(data) { response = data; } });

  assert.equal(response.totalSpent, 0.3);
  assert.equal(response.balances.find((b) => b.memberId === 'alex').balanceCents, 30);
  assert.equal(response.balances.find((b) => b.memberId === 'sam').balanceCents, -30);
});

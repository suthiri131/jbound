import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateExpenseSplit } from '../services/logic/expenseSplit.js';

const rates = { SGD: 1, MYR: 0.32 };

test('converts expenses to SGD cents and nets balances between members', () => {
  const result = calculateExpenseSplit([
    { amount: 10, currency: 'SGD', paidBy: 'alex', splitAmong: ['alex', 'sam'] },
    { amount: 20, currency: 'MYR', paidBy: 'sam', splitAmong: ['alex', 'sam'] },
  ], rates);

  assert.deepEqual(result.balances, { alex: 180, sam: -180 });
  assert.deepEqual(result.settlements, [{ from: 'sam', to: 'alex', amountCents: 180 }]);
});

test('distributes leftover cents deterministically across the split members', () => {
  const result = calculateExpenseSplit([
    { amount: 1, currency: 'SGD', paidBy: 'a', splitAmong: ['a', 'b', 'c'] },
  ], rates);

  assert.deepEqual(result.balances, { a: 66, b: -33, c: -33 });
  assert.deepEqual(result.settlements, [
    { from: 'b', to: 'a', amountCents: 33 },
    { from: 'c', to: 'a', amountCents: 33 },
  ]);
});

test('rounds fractional source amounts to cents before currency conversion', () => {
  const result = calculateExpenseSplit([
    { amount: 1.005, currency: 'SGD', paidBy: 'a', splitAmong: ['a', 'b'] },
  ], rates);

  assert.deepEqual(result.balances, { a: 50, b: -50 });
});

test('greedily settles members using the fewest transfers for balanced groups', () => {
  const result = calculateExpenseSplit([
    { amount: 12, currency: 'SGD', paidBy: 'a', splitAmong: ['a', 'b', 'c', 'd'] },
  ], rates);

  assert.deepEqual(result.balances, { a: 900, b: -300, c: -300, d: -300 });
  assert.deepEqual(result.settlements, [
    { from: 'b', to: 'a', amountCents: 300 },
    { from: 'c', to: 'a', amountCents: 300 },
    { from: 'd', to: 'a', amountCents: 300 },
  ]);
});

test('rejects missing conversion rates and malformed splits', () => {
  assert.throws(
    () => calculateExpenseSplit([{ amount: 5, currency: 'MYR', paidBy: 'a', splitAmong: ['a'] }], { SGD: 1 }),
    /conversion rate is required/,
  );
  assert.throws(
    () => calculateExpenseSplit([{ amount: 5, currency: 'SGD', paidBy: 'a', splitAmong: [] }], rates),
    /at least one member/,
  );
});

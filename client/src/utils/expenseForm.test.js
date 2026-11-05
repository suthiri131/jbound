import { describe, expect, it } from 'vitest';
import { customAmountsFor } from './expenseForm';

describe('customAmountsFor', () => {
  it('returns nothing for an equal split', () => {
    expect(customAmountsFor({ amount: 30, amount_sgd: 30, exchange_rate: 1, splitAmounts: null })).toBeNull();
    expect(customAmountsFor({ amount: 30, amount_sgd: 30, exchange_rate: 1, splitAmounts: [] })).toBeNull();
  });

  it('gives back SGD amounts as they were entered', () => {
    const amounts = customAmountsFor({
      amount: 30,
      amount_sgd: 30,
      exchange_rate: 1,
      splitAmounts: [{ memberId: 'a', amountCents: 2000 }, { memberId: 'b', amountCents: 1000 }],
    });
    expect(amounts).toEqual({ a: 20, b: 10 });
  });

  it('converts MYR back, and the amounts still add up to the expense exactly', () => {
    const amounts = customAmountsFor({
      amount: 100,
      amount_sgd: 29.33,
      exchange_rate: 0.2933,
      splitAmounts: [
        { memberId: 'a', amountCents: 978 },
        { memberId: 'b', amountCents: 978 },
        { memberId: 'c', amountCents: 977 },
      ],
    });
    const total = Object.values(amounts).reduce((sum, amount) => sum + Math.round(amount * 100), 0);
    expect(total).toBe(10000);
    for (const amount of Object.values(amounts)) expect(amount).toBeCloseTo(33.33, 0);
  });

  it('leaves the gap showing when a member has gone and their share with them', () => {
    const amounts = customAmountsFor({
      amount: 30,
      amount_sgd: 30,
      exchange_rate: 1,
      splitAmounts: [{ memberId: 'a', amountCents: 2000 }],
    });
    expect(amounts).toEqual({ a: 20 });
  });
});

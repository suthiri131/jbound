const toCents = (amount) => Math.round(Number(amount) * 100);

/**
 * The custom amounts to put back in the form when editing an expense, in the currency it was entered in.
 * Shares are stored in SGD, so an MYR expense is converted back and any rounding goes on the largest share.
 * Returns null for an equal split. { memberId: amount }
 */
export function customAmountsFor(expense) {
  const shares = expense.splitAmounts;
  if (!shares?.length) return null;

  const rate = Number(expense.exchange_rate) || 1;
  const amounts = shares.map(({ memberId, amountCents }) => ({ memberId, cents: Math.round(amountCents / rate) }));

  // A share can be missing if a member has left, and then there's no total to round towards.
  const sgdTotal = shares.reduce((sum, { amountCents }) => sum + amountCents, 0);
  if (sgdTotal === toCents(expense.amount_sgd)) {
    const largest = amounts.reduce((a, b) => (b.cents > a.cents ? b : a));
    largest.cents += toCents(expense.amount) - amounts.reduce((sum, { cents }) => sum + cents, 0);
  }
  return Object.fromEntries(amounts.map(({ memberId, cents }) => [memberId, cents / 100]));
}

import { convertAmountToCents } from '../currencyService.js';

const BASE_CURRENCY = 'SGD';

function getMemberId(member) {
  return typeof member === 'string' ? member : member?.id;
}

function getExpenseMemberIds(expense) {
  const splitAmong = expense.splitAmong ?? [];
  if (!Array.isArray(splitAmong) || splitAmong.length === 0) {
    throw new TypeError('Each expense must be split among at least one member');
  }

  const memberIds = splitAmong.map(getMemberId);
  if (memberIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError('Expense split members must have non-empty string IDs');
  }
  if (new Set(memberIds).size !== memberIds.length) {
    throw new TypeError('Expense split members must be unique');
  }
  return memberIds;
}

function amountInBaseCents(expense, rates) {
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TypeError('Expense amount must be a positive finite number');
  }

  const currency = expense.currency;
  const rate = rates[currency];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new TypeError(`A positive conversion rate is required for ${currency}`);
  }

  const amountCents = Math.round((amount + Number.EPSILON) * 100);
  const convertedCents = convertAmountToCents(amountCents, rate);
  if (!Number.isSafeInteger(convertedCents) || convertedCents <= 0) {
    throw new RangeError('Converted expense amount must be positive and within the safe integer range');
  }
  return convertedCents;
}

/**
 * Compute each member's net SGD balance and a greedy settle-up plan.
 * Positive balances are owed money; negative balances owe money.
 * Rates express SGD per unit of the expense's original currency.
 */
export function calculateExpenseSplit(expenses, rates) {
  if (!Array.isArray(expenses)) throw new TypeError('Expenses must be an array');
  if (!rates || typeof rates !== 'object' || !Number.isFinite(rates[BASE_CURRENCY]) || rates[BASE_CURRENCY] !== 1) {
    throw new TypeError('Rates must include SGD: 1');
  }

  const balances = new Map();
  const addBalance = (memberId, cents) => {
    balances.set(memberId, (balances.get(memberId) ?? 0) + cents);
  };

  for (const expense of expenses) {
    const paidBy = getMemberId(expense.paidBy);
    if (typeof paidBy !== 'string' || paidBy.length === 0) {
      throw new TypeError('Each expense must have a payer with a non-empty string ID');
    }

    const memberIds = getExpenseMemberIds(expense);
    const totalCents = amountInBaseCents(expense, rates);
    addBalance(paidBy, totalCents);

    if (expense.splitAmounts) {
      const shares = expense.splitAmounts;
      if (!Array.isArray(shares) || shares.length !== memberIds.length
        || shares.some(({ memberId, amountCents }) => !memberIds.includes(memberId) || !Number.isSafeInteger(amountCents) || amountCents < 0)
        || new Set(shares.map(({ memberId }) => memberId)).size !== memberIds.length
        || shares.reduce((sum, share) => sum + share.amountCents, 0) !== totalCents) {
        throw new TypeError('Custom split amounts must cover all members and sum to the expense total');
      }
      for (const { memberId, amountCents } of shares) addBalance(memberId, -amountCents);
    } else {
      const baseShareCents = Math.floor(totalCents / memberIds.length);
      const remainder = totalCents % memberIds.length;
      memberIds.forEach((memberId, index) => {
        addBalance(memberId, -(baseShareCents + (index < remainder ? 1 : 0)));
      });
    }
  }

  for (const [memberId, balanceCents] of balances) {
    if (!Number.isSafeInteger(balanceCents)) {
      throw new RangeError(`Balance for ${memberId} exceeds the safe integer range`);
    }
  }

  return {
    balances: Object.fromEntries([...balances].sort(([a], [b]) => a.localeCompare(b))),
    settlements: settleBalances(balances),
  };
}

export function settleBalances(balanceEntries) {
  const balances = balanceEntries instanceof Map ? balanceEntries : new Map(Object.entries(balanceEntries));
  const debtors = [];
  const creditors = [];
  let totalCents = 0;
  for (const [memberId, balanceCents] of balances) {
    if (!Number.isSafeInteger(balanceCents)) {
      throw new RangeError(`Balance for ${memberId} must be an integer number of cents`);
    }
    totalCents += balanceCents;
    if (!Number.isSafeInteger(totalCents)) {
      throw new RangeError('Total member balances exceed the safe integer range');
    }
    if (balanceCents < 0) debtors.push({ memberId, remainingCents: -balanceCents });
    if (balanceCents > 0) creditors.push({ memberId, remainingCents: balanceCents });
  }
  if (totalCents !== 0) throw new RangeError('Member balances must sum to zero');

  const byLargestBalance = (a, b) =>
    b.remainingCents - a.remainingCents || a.memberId.localeCompare(b.memberId);
  debtors.sort(byLargestBalance);
  creditors.sort(byLargestBalance);

  const settlements = [];
  while (debtors.length && creditors.length) {
    const debtor = debtors[0];
    const creditor = creditors[0];
    const amountCents = Math.min(debtor.remainingCents, creditor.remainingCents);
    settlements.push({ from: debtor.memberId, to: creditor.memberId, amountCents });

    debtor.remainingCents -= amountCents;
    creditor.remainingCents -= amountCents;
    if (debtor.remainingCents === 0) debtors.shift();
    if (creditor.remainingCents === 0) creditors.shift();
    debtors.sort(byLargestBalance);
    creditors.sort(byLargestBalance);
  }
  return settlements;
}

export const splitExpenses = calculateExpenseSplit;
export default calculateExpenseSplit;

import { supabase } from '../db/supabase.js';
import { calculateExpenseSplit, settleBalances } from '../services/logic/expenseSplit.js';
import { getSgdRate } from '../services/exchangeRates.js';
import { badRequest, forbidden, notFound, check } from '../utils/httpError.js';

const SGD_RATES = { SGD: 1 };

function toCents(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100);
}

function dollars(cents) {
  return Number((cents / 100).toFixed(2));
}

async function getTripMemberIds(tripId) {
  const { data, error } = await supabase.from('trip_members').select('user_id').eq('trip_id', tripId);
  return check({ data, error }).map(({ user_id }) => user_id);
}

async function getTripMembers(tripId) {
  const memberIds = await getTripMemberIds(tripId);
  if (!memberIds.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, name, avatar_url').in('id', memberIds);
  check({ data, error });
  return data;
}

async function normalizeExpenseRows(rows) {
  const needsMyrRate = rows.some((expense) => expense.currency === 'MYR' && !expense.exchange_rate);
  const myrRate = needsMyrRate ? await getSgdRate('MYR') : null;
  return rows.map((expense) => {
    const exchangeRate = Number(expense.exchange_rate ?? (expense.currency === 'SGD' ? 1 : myrRate?.rate));
    const amountSgd = Number(expense.amount_sgd ?? (Number(expense.amount) * exchangeRate));
    return {
      ...expense,
      amount: Number(expense.amount),
      amount_sgd: dollars(toCents(amountSgd)),
      exchange_rate: exchangeRate,
      rate_date: expense.rate_date ?? (expense.currency === 'SGD' ? expense.created_at.slice(0, 10) : myrRate?.date),
    };
  });
}

async function loadExpenses(tripId) {
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  check({ data: expenses, error });
  if (!expenses.length) return [];

  const { data: splits, error: splitError } = await supabase
    .from('expense_splits')
    .select('expense_id, user_id')
    .in('expense_id', expenses.map(({ id }) => id));
  check({ data: splits, error: splitError });
  const splitMembers = new Map();
  for (const split of splits) {
    const members = splitMembers.get(split.expense_id) ?? [];
    members.push(split.user_id);
    splitMembers.set(split.expense_id, members);
  }

  const profileIds = [...new Set([
    ...expenses.map(({ paid_by }) => paid_by),
    ...splits.map(({ user_id }) => user_id),
  ])];
  const { data: profiles, error: profileError } = profileIds.length
    ? await supabase.from('profiles').select('id, name').in('id', profileIds)
    : { data: [], error: null };
  check({ data: profiles, error: profileError });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return (await normalizeExpenseRows(expenses)).map((expense) => ({
    ...expense,
    paid_by_profile: profileById.get(expense.paid_by) ?? null,
    splitAmong: splitMembers.get(expense.id) ?? [],
    splitMembers: (splitMembers.get(expense.id) ?? []).map((id) => profileById.get(id) ?? { id, name: id }),
  }));
}

async function loadSettlements(tripId) {
  const { data, error } = await supabase
    .from('settlements')
    .select('from_user, to_user, amount_sgd')
    .eq('trip_id', tripId);
  return check({ data, error });
}

function computeTripSplit(expenses, settlements, memberIds = []) {
  const split = calculateExpenseSplit(
    expenses.map((expense) => ({
      amount: expense.amount_sgd,
      currency: 'SGD',
      paidBy: expense.paid_by,
      splitAmong: expense.splitAmong,
    })),
    SGD_RATES,
  );
  const balances = new Map(Object.entries(split.balances));
  for (const memberId of memberIds) balances.set(memberId, balances.get(memberId) ?? 0);
  for (const settlement of settlements) {
    const amountCents = toCents(settlement.amount_sgd);
    balances.set(settlement.from_user, (balances.get(settlement.from_user) ?? 0) + amountCents);
    balances.set(settlement.to_user, (balances.get(settlement.to_user) ?? 0) - amountCents);
  }

  const outstanding = [...balances].map(([memberId, balanceCents]) => ({ memberId, balanceCents }));
  return {
    balances: outstanding.map(({ memberId, balanceCents }) => ({
      memberId,
      balanceSgd: dollars(balanceCents),
      balanceCents,
    })),
    settlements: settleBalances(balances).map((settlement) => ({
      ...settlement,
      amountSgd: dollars(settlement.amountCents),
      currency: 'SGD',
    })),
  };
}

async function resolveCurrencyMetadata(amount, currency) {
  const metadata = await getSgdRate(currency);
  const amountSgd = dollars(Math.round(toCents(amount) * metadata.rate));
  if (amountSgd <= 0) throw badRequest('Expense amount converts to less than one SGD cent');
  return { amount_sgd: amountSgd, exchange_rate: metadata.rate, rate_date: metadata.date };
}

export async function getExpenses(req, res) {
  const [expenses, members] = await Promise.all([
    loadExpenses(req.params.tripId),
    getTripMembers(req.params.tripId),
  ]);
  res.json({ expenses, members, baseCurrency: 'SGD' });
}

export async function createExpense(req, res) {
  const { tripId } = req.params;
  const { amount, currency, description, paidBy, splitAmong } = req.valid.body;
  const memberIds = await getTripMemberIds(tripId);
  if (!memberIds.includes(paidBy) || splitAmong.some((memberId) => !memberIds.includes(memberId))) {
    throw badRequest('Payer and split members must belong to this trip');
  }
  const metadata = await resolveCurrencyMetadata(amount, currency);
  const { data: expense, error } = await supabase.from('expenses').insert({
    trip_id: tripId,
    paid_by: paidBy,
    amount,
    currency,
    description,
    created_by: req.user.id,
    ...metadata,
  }).select('*').single();
  check({ data: expense, error });

  const { error: splitError } = await supabase.from('expense_splits').insert(
    splitAmong.map((userId) => ({ expense_id: expense.id, user_id: userId })),
  );
  check({ data: null, error: splitError });
  res.status(201).json({ expense: { ...expense, splitAmong } });
}

export async function updateExpense(req, res) {
  const { tripId, expenseId } = req.params;
  const { data: existing, error: findError } = await supabase
    .from('expenses')
    .select('id, created_by')
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .maybeSingle();
  check({ data: existing, error: findError });
  if (!existing) throw notFound('Expense not found');
  if (existing.created_by !== req.user.id && req.membership.role !== 'owner') {
    throw forbidden('Only the expense creator or trip owner can edit this expense');
  }

  const { amount, currency, description, paidBy, splitAmong } = req.valid.body;
  const memberIds = await getTripMemberIds(tripId);
  if (!memberIds.includes(paidBy) || splitAmong.some((memberId) => !memberIds.includes(memberId))) {
    throw badRequest('Payer and split members must belong to this trip');
  }
  const metadata = await resolveCurrencyMetadata(amount, currency);
  const { data: expense, error } = await supabase
    .from('expenses')
    .update({ amount, currency, description, paid_by: paidBy, ...metadata })
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .select('*')
    .single();
  check({ data: expense, error });

  const { error: deleteError } = await supabase.from('expense_splits').delete().eq('expense_id', expenseId);
  check({ data: null, error: deleteError });
  const { error: insertError } = await supabase.from('expense_splits').insert(
    splitAmong.map((userId) => ({ expense_id: expenseId, user_id: userId })),
  );
  check({ data: null, error: insertError });
  res.json({ expense: { ...expense, splitAmong } });
}

export async function getBalances(req, res) {
  const [expenses, settlements] = await Promise.all([
    loadExpenses(req.params.tripId),
    loadSettlements(req.params.tripId),
  ]);
  const memberIds = await getTripMemberIds(req.params.tripId);
  const result = computeTripSplit(expenses, settlements, memberIds);
  res.json({ ...result, currency: 'SGD' });
}

export async function createSettlement(req, res) {
  const { tripId } = req.params;
  const { from, to, amountSgd } = req.valid.body;
  if (from === to) throw badRequest('A member cannot settle a balance with themselves');
  const memberIds = await getTripMemberIds(tripId);
  if (!memberIds.includes(from) || !memberIds.includes(to)) {
    throw badRequest('Settlement members must belong to this trip');
  }

  const [expenses, settlements] = await Promise.all([
    loadExpenses(tripId),
    loadSettlements(tripId),
  ]);
  const balances = computeTripSplit(expenses, settlements, memberIds).balances;
  const fromBalance = balances.find(({ memberId }) => memberId === from)?.balanceCents ?? 0;
  const toBalance = balances.find(({ memberId }) => memberId === to)?.balanceCents ?? 0;
  const amountCents = toCents(amountSgd);
  if (amountCents <= 0 || fromBalance >= 0 || toBalance <= 0 || amountCents > Math.min(-fromBalance, toBalance)) {
    throw badRequest('Settlement exceeds the outstanding SGD balance between these members');
  }

  const { data, error } = await supabase.from('settlements').insert({
    trip_id: tripId,
    from_user: from,
    to_user: to,
    amount_sgd: dollars(amountCents),
  }).select('id, trip_id, from_user, to_user, amount_sgd, created_at').single();
  check({ data, error });
  res.status(201).json({ settlement: { ...data, currency: 'SGD' } });
}

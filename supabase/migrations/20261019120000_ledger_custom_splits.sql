alter table public.expense_splits
  add column if not exists amount_sgd numeric(12, 2)
  check (amount_sgd is null or amount_sgd >= 0);

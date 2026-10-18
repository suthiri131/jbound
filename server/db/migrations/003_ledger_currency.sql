alter table public.expenses
  add column if not exists amount_sgd numeric(12,2),
  add column if not exists exchange_rate numeric(18,10),
  add column if not exists rate_date date;

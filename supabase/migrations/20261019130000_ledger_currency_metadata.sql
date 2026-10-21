-- Bring existing Supabase projects in line with the expense controller's
-- SGD conversion metadata. Keep these nullable for legacy rows; new writes
-- populate all three fields.
alter table public.expenses
  add column if not exists amount_sgd numeric(12, 2),
  add column if not exists exchange_rate numeric(18, 10),
  add column if not exists rate_date date;

-- Existing SGD expenses have an exact conversion. Legacy MYR rows are left
-- null and are normalized by the controller when read.
update public.expenses
set amount_sgd = amount,
    exchange_rate = 1,
    rate_date = created_at::date
where currency = 'SGD'
  and (amount_sgd is null or exchange_rate is null or rate_date is null);

notify pgrst, 'reload schema';

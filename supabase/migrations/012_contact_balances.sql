create or replace function public.contact_balances()
returns table(contact_id uuid, balance numeric)
language sql stable security invoker set search_path = public as $$
  select i.contact_id,
         sum((i.total - i.amount_paid) * case when i.kind = 'sales' then 1 else -1 end)
  from invoices i
  where i.status <> 'cancelled' and i.contact_id is not null
  group by i.contact_id
$$;
revoke all on function public.contact_balances() from public, anon;
grant execute on function public.contact_balances() to authenticated;

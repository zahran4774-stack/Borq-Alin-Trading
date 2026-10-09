-- المصروفات الشهرية الإجبارية: إيجار، كهرباء، (إنترنت اختياري)، رواتب — لكل فرع ولكل شهر
alter table public.company_settings add column if not exists monthly_required_from text not null default to_char(current_date, 'YYYY-MM');
alter table public.expenses add column if not exists monthly_period text;
alter table public.expenses add column if not exists monthly_kind text;

create table if not exists public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  completed_by uuid references auth.users(id),
  completed_at timestamptz not null default now(),
  unique (branch_id, period)
);
alter table public.monthly_closings enable row level security;
create policy monthly_closings_select on public.monthly_closings for select
  using (current_app_role() in ('admin','accountant','viewer','branch_manager') and can_see_branch(branch_id));
create policy monthly_closings_write on public.monthly_closings for all using (false) with check (false);

-- الأشهر/الفروع المطلوبة: كل شهر سابق غير مكتمل، والشهر الحالي في آخر 3 أيام منه
create or replace function public.monthly_pending()
returns table(branch_id uuid, period text, period_end date)
language sql stable security definer set search_path to 'public' as $$
  with me as (select p.role, p.branch_id from profiles p where p.id = auth.uid() and p.is_active),
  allowed as (
    select b.id from branches b, me
    where b.is_active and me.role in ('admin','accountant','branch_manager')
      and ((me.branch_id is null and me.role in ('admin','accountant')) or me.branch_id = b.id)
  ),
  months as (
    select to_char(m, 'YYYY-MM') as per, (m + interval '1 month - 1 day')::date as pend
    from generate_series(
      to_date((select monthly_required_from from company_settings limit 1), 'YYYY-MM'),
      date_trunc('month', current_date), interval '1 month') m
  )
  select a.id, mo.per, mo.pend from allowed a cross join months mo
  where (mo.pend < current_date or current_date >= mo.pend - 2)
    and not exists (select 1 from monthly_closings c where c.branch_id = a.id and c.period = mo.per)
  order by mo.per, a.id;
$$;

create or replace function public.submit_monthly_expenses(p_branch uuid, p_period text, p_items jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  it jsonb; v_kind text; v_amt numeric; v_acct uuid; v_id uuid; v_date date; v_pend date;
  v_rent int := 0; v_elec int := 0; v_sal int := 0; v_from text; v_method payment_method;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(p_branch) then
    raise exception 'غير مصرح';
  end if;
  if p_period is null or p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'شهر غير صحيح'; end if;
  select monthly_required_from into v_from from company_settings limit 1;
  v_pend := (to_date(p_period, 'YYYY-MM') + interval '1 month - 1 day')::date;
  if p_period < v_from or to_date(p_period, 'YYYY-MM') > date_trunc('month', current_date) then raise exception 'شهر خارج النطاق'; end if;
  if exists (select 1 from monthly_closings where branch_id = p_branch and period = p_period) then raise exception 'هذا الشهر مغلق مسبقاً لهذا الفرع'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'بيانات غير صحيحة'; end if;
  v_date := least(v_pend, current_date);

  for it in select * from jsonb_array_elements(p_items) loop
    v_kind := it->>'kind';
    v_amt := nullif(it->>'amount', '')::numeric;
    if v_kind not in ('rent','electricity','internet','salary') then raise exception 'بند غير صحيح'; end if;
    if v_amt is null or v_amt <= 0 or v_amt > 10000000 then
      if v_kind = 'internet' and (v_amt is null or v_amt = 0) then continue; end if;
      raise exception 'مبلغ غير صحيح';
    end if;
    v_method := coalesce(nullif(it->>'method', ''), 'cash')::payment_method;
    v_acct := _acct(case v_kind when 'rent' then '5200' when 'electricity' then '5400' when 'internet' then '5500' else '5300' end);
    v_id := create_expense(p_branch, v_acct, v_date, v_amt, 0, v_method,
              left(nullif(it->>'payee', ''), 120),
              left(coalesce(nullif(it->>'memo', ''), case v_kind when 'rent' then 'إيجار المحل' when 'electricity' then 'فاتورة الكهرباء' when 'internet' then 'فاتورة الإنترنت' else 'راتب موظف' end) || ' - ' || p_period, 200));
    update expenses set monthly_period = p_period, monthly_kind = v_kind where id = v_id;
    if v_kind = 'rent' then v_rent := v_rent + 1; elsif v_kind = 'electricity' then v_elec := v_elec + 1; elsif v_kind = 'salary' then v_sal := v_sal + 1; end if;
  end loop;

  if v_rent < 1 then raise exception 'إيجار المحل مطلوب'; end if;
  if v_elec < 1 then raise exception 'فاتورة الكهرباء مطلوبة'; end if;
  if v_sal < 1 then raise exception 'راتب موظف واحد على الأقل مطلوب'; end if;
  insert into monthly_closings (branch_id, period, completed_by) values (p_branch, p_period, auth.uid());
end $$;

revoke all on function public.monthly_pending() from public, anon;
revoke all on function public.submit_monthly_expenses(uuid, text, jsonb) from public, anon;
grant execute on function public.monthly_pending() to authenticated;
grant execute on function public.submit_monthly_expenses(uuid, text, jsonb) to authenticated;

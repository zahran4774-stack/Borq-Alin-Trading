create or replace function public.current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function public.my_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid() and is_active;
$$;

create or replace function public.can_see_branch(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (p.branch_id is null and p.role in ('admin','accountant','viewer'))
        or (p.branch_id is not null and p.branch_id = b)
    from profiles p where p.id = auth.uid() and p.is_active
  ), false);
$$;

create or replace function public.can_write_branch(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (p.branch_id is null and p.role in ('admin','accountant'))
        or (p.branch_id = b and p.role in ('admin','accountant','branch_manager','cashier','technician'))
    from profiles p where p.id = auth.uid() and p.is_active
  ), false);
$$;

alter table public.profiles add constraint profiles_branch_role_chk
  check (role not in ('branch_manager','cashier','technician') or branch_id is not null);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role app_role := 'viewer';
begin
  if not exists (select 1 from profiles) then v_role := 'admin'; end if;
  insert into profiles (id, full_name, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), v_role, new.email);
  return new;
end $$;

create or replace function public._assert_open(d date) returns void
language plpgsql stable security definer set search_path = public as $$
declare l date;
begin
  select books_locked_until into l from company_settings limit 1;
  if l is not null and d <= l then
    raise exception 'الفترة المحاسبية مقفلة حتى %', l;
  end if;
end $$;

create or replace function public._acct(c text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from accounts where code = c;
  if v is null then raise exception 'الحساب % غير موجود في دليل الحسابات', c; end if;
  return v;
end $$;

create or replace function public._pay_acct(m payment_method) returns uuid
language sql stable security definer set search_path = public as $$
  select public._acct(case when m = 'cash' then '1110' else '1120' end);
$$;

create or replace function public._next_no(p_branch uuid, p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare n bigint; c text;
begin
  insert into doc_sequences (branch_id, doc_type, last_no) values (p_branch, p_type, 1)
  on conflict (branch_id, doc_type) do update set last_no = doc_sequences.last_no + 1
  returning last_no into n;
  select code into c from branches where id = p_branch;
  if c is null then raise exception 'الفرع غير موجود'; end if;
  return c || '-' || p_type || '-' || lpad(n::text, 6, '0');
end $$;

create or replace function public._reverse_journal(p_entry uuid, p_date date, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e journal_entries%rowtype; v_new uuid;
begin
  select * into e from journal_entries where id = p_entry for update;
  if not found then raise exception 'القيد غير موجود'; end if;
  if e.is_reversed then raise exception 'القيد معكوس مسبقاً'; end if;
  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id, reversal_of)
  values (p_date, e.reference, coalesce(p_memo, 'عكس قيد') || ' ' || coalesce(e.reference, ''), 'Reversal', 'reversal', e.source_id, true, auth.uid(), e.branch_id, e.id)
  returning id into v_new;
  insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id)
  select v_new, account_id, credit, debit, memo, contact_id from journal_lines where journal_entry_id = p_entry;
  update journal_entries set is_reversed = true where id = p_entry;
  return v_new;
end $$;

create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sign int; v_old_qty numeric; v_old_cost numeric; v_branch_qty numeric; v_allow boolean;
begin
  v_sign := case when new.type in ('purchase_in','adjustment_in','opening_balance','transfer_in','sale_return_in') then 1 else -1 end;

  if new.type in ('purchase_in','opening_balance','adjustment_in') and coalesce(new.unit_cost, 0) > 0 then
    select quantity_on_hand, cost_price into v_old_qty, v_old_cost from products where id = new.product_id for update;
    if v_old_qty > 0 then
      update products set cost_price = round((v_old_qty * v_old_cost + new.quantity * new.unit_cost) / (v_old_qty + new.quantity), 3)
      where id = new.product_id;
    else
      update products set cost_price = new.unit_cost where id = new.product_id;
    end if;
  end if;

  insert into branch_stock (branch_id, product_id, quantity)
  values (new.branch_id, new.product_id, v_sign * new.quantity)
  on conflict (branch_id, product_id)
  do update set quantity = branch_stock.quantity + v_sign * new.quantity, updated_at = now()
  returning quantity into v_branch_qty;

  update products set quantity_on_hand = quantity_on_hand + v_sign * new.quantity where id = new.product_id;

  if v_sign = -1 and v_branch_qty < 0 then
    select allow_negative_stock into v_allow from company_settings limit 1;
    if not coalesce(v_allow, false) then
      raise exception 'الكمية غير كافية في هذا الفرع للمنتج: %', (select name_ar from products where id = new.product_id);
    end if;
  end if;
  return null;
end $$;

create trigger trg_apply_stock_movement after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create or replace function public.repair_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.internal', true), '') = 'on' or auth.uid() is null then
    return new;
  end if;
  if old.status in ('delivered','cancelled') then
    raise exception 'لا يمكن تعديل أمر صيانة مغلق';
  end if;
  if new.deposit_amount is distinct from old.deposit_amount
     or new.invoice_id is distinct from old.invoice_id
     or new.delivered_at is distinct from old.delivered_at
     or new.branch_id is distinct from old.branch_id
     or new.order_no is distinct from old.order_no
     or (new.status in ('delivered','cancelled') and new.status is distinct from old.status) then
    raise exception 'هذا التعديل يتم عبر العمليات المخصصة فقط (تسليم / إلغاء / عربون)';
  end if;
  return new;
end $$;

create trigger trg_repair_guard before update on public.repair_orders
  for each row execute function public.repair_guard();

-- Neutralize legacy branch-unaware RPCs (same signatures, replaced bodies) instead of dropping them
create or replace function public.create_sales_invoice(p_contact_id uuid, p_invoice_number text, p_invoice_date date, p_due_date date, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
begin raise exception 'هذه الدالة القديمة معطّلة، استخدم النسخة الجديدة المرتبطة بالفرع'; end $$;

create or replace function public.create_purchase_invoice(p_contact_id uuid, p_invoice_number text, p_invoice_date date, p_due_date date, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
begin raise exception 'هذه الدالة القديمة معطّلة، استخدم النسخة الجديدة المرتبطة بالفرع'; end $$;

create or replace function public.record_payment(p_contact_id uuid, p_direction payment_direction, p_payment_date date, p_method payment_method, p_amount numeric, p_bank_account_id uuid, p_reference text, p_invoice_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
begin raise exception 'هذه الدالة القديمة معطّلة، استخدم النسخة الجديدة المرتبطة بالفرع'; end $$;

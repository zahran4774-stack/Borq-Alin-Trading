create or replace function public.transfer_stock(
  p_from uuid, p_to uuid, p_product uuid, p_qty numeric, p_serials text[] default '{}', p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_prod products%rowtype; v_id uuid; v_no text; v_s text;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(p_from) then
    raise exception 'غير مصرح بالتحويل من هذا الفرع';
  end if;
  if p_from = p_to then raise exception 'الفرعان متطابقان'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'الكمية غير صحيحة'; end if;
  if not exists (select 1 from branches where id = p_to and is_active) then raise exception 'فرع الوجهة غير صالح'; end if;
  select * into v_prod from products where id = p_product for update;
  if not found or v_prod.is_service then raise exception 'منتج غير صالح للتحويل'; end if;

  if v_prod.track_serial then
    if p_qty <> trunc(p_qty) or coalesce(cardinality(p_serials), 0) <> p_qty then
      raise exception 'يجب إدخال % رقم تسلسلي/IMEI', p_qty;
    end if;
    foreach v_s in array p_serials loop
      update product_serials set branch_id = p_to
      where serial_no = v_s and product_id = p_product and branch_id = p_from and status = 'in_stock';
      if not found then raise exception 'الرقم التسلسلي % غير متوفر في فرع المصدر', v_s; end if;
    end loop;
  end if;

  v_no := _next_no(p_from, 'TRF');
  insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, branch_id, created_by, note)
  values (p_product, 'transfer_out', p_qty, v_prod.cost_price, 'transfer', p_from, auth.uid(), v_no);
  insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, branch_id, created_by, note)
  values (p_product, 'transfer_in', p_qty, v_prod.cost_price, 'transfer', p_to, auth.uid(), v_no);
  insert into stock_transfers (transfer_no, from_branch_id, to_branch_id, product_id, quantity, serial_numbers, note, created_by)
  values (v_no, p_from, p_to, p_product, p_qty, coalesce(p_serials, '{}'), p_note, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.adjust_stock(
  p_branch uuid, p_product uuid, p_kind text, p_qty numeric, p_unit_cost numeric default null,
  p_date date default null, p_note text default null, p_serials text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_prod products%rowtype; v_je uuid; v_cost numeric; v_val numeric; v_s text; v_mid uuid; v_no text;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(p_branch) then
    raise exception 'غير مصرح';
  end if;
  if p_kind not in ('opening','gain','loss') then raise exception 'نوع تسوية غير صحيح'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'الكمية غير صحيحة'; end if;
  p_date := coalesce(p_date, current_date);
  perform _assert_open(p_date);
  select * into v_prod from products where id = p_product for update;
  if not found or v_prod.is_service then raise exception 'منتج غير صالح'; end if;
  if v_prod.track_serial and (p_qty <> trunc(p_qty) or coalesce(cardinality(p_serials), 0) <> p_qty) then
    raise exception 'يجب إدخال % رقم تسلسلي/IMEI', p_qty;
  end if;

  v_cost := case when p_kind = 'loss' then v_prod.cost_price else coalesce(p_unit_cost, v_prod.cost_price) end;
  v_val := round(p_qty * v_cost, 3);
  v_no := _next_no(p_branch, 'ADJ');

  insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, branch_id, created_by, note)
  values (p_product,
          case p_kind when 'opening' then 'opening_balance'::stock_movement_type
                      when 'gain' then 'adjustment_in'::stock_movement_type
                      else 'adjustment_out'::stock_movement_type end,
          p_qty, v_cost, 'adjustment', p_branch, auth.uid(), coalesce(p_note, v_no))
  returning id into v_mid;

  if v_prod.track_serial then
    foreach v_s in array p_serials loop
      if p_kind = 'loss' then
        update product_serials set status = 'lost'
        where serial_no = v_s and product_id = p_product and branch_id = p_branch and status = 'in_stock';
        if not found then raise exception 'الرقم التسلسلي % غير متوفر', v_s; end if;
      else
        if exists (select 1 from product_serials where serial_no = v_s) then raise exception 'الرقم التسلسلي % مسجل مسبقاً', v_s; end if;
        insert into product_serials (product_id, serial_no, branch_id, status, cost) values (p_product, v_s, p_branch, 'in_stock', v_cost);
      end if;
    end loop;
  end if;

  if v_val > 0 then
    insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
    values (p_date, v_no,
            case p_kind when 'opening' then 'رصيد افتتاحي مخزون ' when 'gain' then 'زيادة جرد ' else 'عجز/تالف مخزون ' end || v_prod.name_ar,
            'Stock adjustment', 'stock_adjustment', v_mid, true, auth.uid(), p_branch)
    returning id into v_je;
    if p_kind = 'loss' then
      insert into journal_lines (journal_entry_id, account_id, debit, credit, memo) values
        (v_je, _acct('5710'), v_val, 0, v_prod.name_ar), (v_je, _acct('1140'), 0, v_val, v_prod.name_ar);
    else
      insert into journal_lines (journal_entry_id, account_id, debit, credit, memo) values
        (v_je, _acct('1140'), v_val, 0, v_prod.name_ar),
        (v_je, case when p_kind = 'opening' then _acct('3100') else _acct('5710') end, 0, v_val, v_prod.name_ar);
    end if;
  end if;
  return v_mid;
end $$;

create or replace function public.create_expense(
  p_branch uuid, p_account uuid, p_date date, p_amount numeric, p_vat numeric default 0,
  p_method payment_method default 'cash', p_payee text default null, p_memo text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_no text; v_je uuid; v_acc accounts%rowtype;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(p_branch) then
    raise exception 'غير مصرح';
  end if;
  if p_amount is null or p_amount <= 0 or coalesce(p_vat, 0) < 0 then raise exception 'مبلغ غير صحيح'; end if;
  select * into v_acc from accounts where id = p_account and type = 'expense' and not is_group and is_active;
  if not found then raise exception 'اختر حساب مصروف صحيح'; end if;
  p_date := coalesce(p_date, current_date);
  perform _assert_open(p_date);
  v_no := _next_no(p_branch, 'EXP');
  v_id := gen_random_uuid();
  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
  values (p_date, v_no, 'مصروف: ' || v_acc.name_ar || coalesce(' - ' || p_memo, ''), 'Expense', 'expense', v_id, true, auth.uid(), p_branch)
  returning id into v_je;
  insert into journal_lines (journal_entry_id, account_id, debit, credit, memo) values (v_je, p_account, p_amount, 0, p_memo);
  if coalesce(p_vat, 0) > 0 then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo) values (v_je, _acct('1150'), p_vat, 0, 'ضريبة مدخلات');
  end if;
  insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_je, _pay_acct(p_method), 0, p_amount + coalesce(p_vat, 0), coalesce(p_payee, v_no));
  insert into expenses (id, branch_id, expense_no, expense_date, account_id, amount, vat_amount, method, payee, memo, journal_entry_id, created_by)
  values (v_id, p_branch, v_no, p_date, p_account, p_amount, coalesce(p_vat, 0), p_method, p_payee, p_memo, v_je, auth.uid());
  return v_id;
end $$;

create or replace function public.void_expense(p_expense_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e expenses%rowtype;
begin
  select * into e from expenses where id = p_expense_id for update;
  if not found then raise exception 'المصروف غير موجود'; end if;
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(e.branch_id) then raise exception 'غير مصرح'; end if;
  if e.voided then raise exception 'المصروف ملغى مسبقاً'; end if;
  perform _assert_open(current_date);
  perform _reverse_journal(e.journal_entry_id, current_date, coalesce(p_reason, 'إلغاء مصروف'));
  update expenses set voided = true where id = e.id;
end $$;

create or replace function public.create_manual_journal(p_branch uuid, p_date date, p_memo text, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_je uuid; v_line jsonb; v_d numeric := 0; v_c numeric := 0; v_dd numeric; v_cc numeric;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant') or not can_write_branch(p_branch) then raise exception 'غير مصرح'; end if;
  if p_lines is null or jsonb_array_length(p_lines) < 2 then raise exception 'القيد يحتاج سطرين على الأقل'; end if;
  p_date := coalesce(p_date, current_date);
  perform _assert_open(p_date);
  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, is_posted, created_by, branch_id)
  values (p_date, _next_no(p_branch, 'JV'), coalesce(p_memo, 'قيد يومية'), 'Manual journal', 'manual', true, auth.uid(), p_branch)
  returning id into v_je;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_dd := round(coalesce((v_line->>'debit')::numeric, 0), 3); v_cc := round(coalesce((v_line->>'credit')::numeric, 0), 3);
    if v_dd < 0 or v_cc < 0 or (v_dd > 0 and v_cc > 0) or (v_dd = 0 and v_cc = 0) then raise exception 'سطر قيد غير صحيح'; end if;
    if not exists (select 1 from accounts where id = (v_line->>'account_id')::uuid and not is_group and is_active) then
      raise exception 'حساب غير صالح في القيد';
    end if;
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id)
    values (v_je, (v_line->>'account_id')::uuid, v_dd, v_cc, v_line->>'memo', nullif(v_line->>'contact_id', '')::uuid);
    v_d := v_d + v_dd; v_c := v_c + v_cc;
  end loop;
  if v_d <> v_c then raise exception 'القيد غير متوازن: مدين % ≠ دائن %', v_d, v_c; end if;
  return v_je;
end $$;

create or replace function public.reverse_manual_journal(p_entry uuid, p_reason text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare e journal_entries%rowtype;
begin
  select * into e from journal_entries where id = p_entry;
  if not found then raise exception 'القيد غير موجود'; end if;
  if current_app_role() is null or current_app_role() not in ('admin','accountant') or not can_write_branch(e.branch_id) then raise exception 'غير مصرح'; end if;
  if e.source_type is distinct from 'manual' then raise exception 'يُعكس هذا القيد من خلال مستنده الأصلي'; end if;
  perform _assert_open(current_date);
  return _reverse_journal(p_entry, current_date, coalesce(p_reason, 'عكس قيد يدوي'));
end $$;

create or replace function public._repair_deposit(p_order repair_orders, p_amount numeric, p_method payment_method) returns void
language plpgsql security definer set search_path = public as $$
declare v_je uuid;
begin
  perform _assert_open(current_date);
  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
  values (current_date, p_order.order_no, 'عربون صيانة ' || p_order.order_no, 'Repair deposit', 'repair_deposit', p_order.id, true, auth.uid(), p_order.branch_id)
  returning id into v_je;
  insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id) values
    (v_je, _pay_acct(p_method), p_amount, 0, 'عربون ' || p_order.order_no, null),
    (v_je, _acct('2130'), 0, p_amount, 'عربون ' || p_order.order_no, p_order.contact_id);
end $$;

create or replace function public.create_repair_order(
  p_branch_id uuid, p_customer_name text, p_customer_phone text, p_device_type text, p_brand text, p_model text,
  p_serial_no text, p_problem text, p_accessories text default null, p_condition text default null,
  p_estimated numeric default 0, p_promised date default null, p_deposit numeric default 0,
  p_deposit_method payment_method default 'cash', p_contact_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_contact uuid := p_contact_id; v_id uuid := gen_random_uuid(); v_no text; v_o repair_orders%rowtype;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager','cashier','technician') or not can_write_branch(p_branch_id) then
    raise exception 'غير مصرح';
  end if;
  if coalesce(p_deposit, 0) > 0 and current_app_role() = 'technician' then raise exception 'استلام العربون من صلاحية الكاشير أو المدير'; end if;
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_phone), '') = '' then raise exception 'اسم العميل ورقم هاتفه مطلوبان'; end if;
  if coalesce(trim(p_problem), '') = '' then raise exception 'وصف العطل مطلوب'; end if;

  if v_contact is null then
    select id into v_contact from contacts where phone = trim(p_customer_phone) and type in ('customer','both') limit 1;
    if v_contact is null then
      insert into contacts (name_ar, phone, type) values (trim(p_customer_name), trim(p_customer_phone), 'customer') returning id into v_contact;
    end if;
  end if;

  v_no := _next_no(p_branch_id, 'REP');
  insert into repair_orders (id, branch_id, order_no, contact_id, customer_name, customer_phone, device_type, brand, model, serial_no,
                             problem_ar, accessories_received, condition_notes, estimated_cost, promised_at, deposit_amount, created_by)
  values (v_id, p_branch_id, v_no, v_contact, trim(p_customer_name), trim(p_customer_phone), coalesce(p_device_type, 'هاتف'), p_brand, p_model, p_serial_no,
          trim(p_problem), p_accessories, p_condition, coalesce(p_estimated, 0), p_promised, coalesce(p_deposit, 0), auth.uid())
  returning * into v_o;
  if coalesce(p_deposit, 0) > 0 then perform _repair_deposit(v_o, p_deposit, p_deposit_method); end if;
  return v_id;
end $$;

create or replace function public.repair_add_deposit(p_order_id uuid, p_amount numeric, p_method payment_method default 'cash') returns void
language plpgsql security definer set search_path = public as $$
declare o repair_orders%rowtype;
begin
  select * into o from repair_orders where id = p_order_id for update;
  if not found then raise exception 'أمر الصيانة غير موجود'; end if;
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager','cashier') or not can_write_branch(o.branch_id) then raise exception 'غير مصرح'; end if;
  if o.status in ('delivered','cancelled') then raise exception 'أمر الصيانة مغلق'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ غير صحيح'; end if;
  perform _repair_deposit(o, p_amount, p_method);
  perform set_config('app.internal', 'on', true);
  update repair_orders set deposit_amount = deposit_amount + p_amount where id = o.id;
end $$;

create or replace function public.cancel_repair_order(p_order_id uuid, p_refund_method payment_method default 'cash') returns void
language plpgsql security definer set search_path = public as $$
declare o repair_orders%rowtype; v_je uuid;
begin
  select * into o from repair_orders where id = p_order_id for update;
  if not found then raise exception 'أمر الصيانة غير موجود'; end if;
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager','cashier') or not can_write_branch(o.branch_id) then raise exception 'غير مصرح'; end if;
  if o.status in ('delivered','cancelled') then raise exception 'أمر الصيانة مغلق مسبقاً'; end if;
  if o.deposit_amount > 0 then
    perform _assert_open(current_date);
    insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
    values (current_date, o.order_no, 'رد عربون صيانة ملغاة ' || o.order_no, 'Repair deposit refund', 'repair_refund', o.id, true, auth.uid(), o.branch_id)
    returning id into v_je;
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id) values
      (v_je, _acct('2130'), o.deposit_amount, 0, 'رد عربون', o.contact_id),
      (v_je, _pay_acct(p_refund_method), 0, o.deposit_amount, 'رد عربون', null);
  end if;
  perform set_config('app.internal', 'on', true);
  update repair_orders set status = 'cancelled', deposit_amount = 0 where id = o.id;
end $$;

create or replace function public.repair_deliver(p_order_id uuid, p_payments jsonb default '[]'::jsonb, p_invoice_date date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare o repair_orders%rowtype; v_lines jsonb := '[]'::jsonb; r record;
begin
  select * into o from repair_orders where id = p_order_id;
  if not found then raise exception 'أمر الصيانة غير موجود'; end if;
  if o.labor_charge > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'description_ar', 'أجور صيانة - ' || o.order_no || ' (' || coalesce(o.brand, '') || ' ' || coalesce(o.model, '') || ')',
      'quantity', 1, 'unit_price', o.labor_charge));
  end if;
  for r in select * from repair_parts where repair_order_id = o.id loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('product_id', r.product_id, 'quantity', r.quantity, 'unit_price', r.unit_price));
  end loop;
  if jsonb_array_length(v_lines) = 0 then raise exception 'لا توجد أجور أو قطع غيار لإصدار الفاتورة'; end if;
  return create_sales_invoice(o.branch_id, o.contact_id, coalesce(p_invoice_date, current_date), null, v_lines, p_payments,
                              'فاتورة صيانة ' || o.order_no || ' - ضمان الصيانة ' || o.warranty_days || ' يوم', o.id);
end $$;

create or replace function public.report_trial_balance(p_from date, p_to date, p_branch uuid default null)
returns table (account_id uuid, code text, name_ar text, name_en text, type account_type, debit numeric, credit numeric)
language sql stable as $$
  select a.id, a.code, a.name_ar, a.name_en, a.type, coalesce(sum(x.debit), 0), coalesce(sum(x.credit), 0)
  from accounts a
  left join (
    select l.account_id, l.debit, l.credit
    from journal_lines l join journal_entries e on e.id = l.journal_entry_id
    where e.is_posted and e.entry_date between p_from and p_to and (p_branch is null or e.branch_id = p_branch)
  ) x on x.account_id = a.id
  where not a.is_group
  group by a.id, a.code, a.name_ar, a.name_en, a.type
  order by a.code;
$$;

create or replace function public.report_branch_summary(p_from date, p_to date)
returns table (branch_id uuid, branch_name text, invoices_count bigint, sales_net numeric, vat numeric, cogs numeric, gross_profit numeric, expenses_total numeric)
language sql stable as $$
  select b.id, b.name_ar,
    coalesce(s.cnt, 0), coalesce(s.net, 0), coalesce(s.vat, 0), coalesce(c.cogs, 0),
    coalesce(s.net, 0) - coalesce(c.cogs, 0), coalesce(x.exp, 0)
  from branches b
  left join (select i.branch_id, count(*) cnt, sum(i.subtotal) net, sum(i.tax_amount) vat
             from invoices i where i.kind = 'sales' and i.status <> 'cancelled' and i.invoice_date between p_from and p_to group by i.branch_id) s on s.branch_id = b.id
  left join (select i.branch_id, sum(l.cost_at_sale * l.quantity) cogs
             from invoice_lines l join invoices i on i.id = l.invoice_id
             where i.kind = 'sales' and i.status <> 'cancelled' and i.invoice_date between p_from and p_to group by i.branch_id) c on c.branch_id = b.id
  left join (select e.branch_id, sum(e.amount) exp from expenses e where not e.voided and e.expense_date between p_from and p_to group by e.branch_id) x on x.branch_id = b.id
  where b.is_active
  order by b.code;
$$;

create or replace function public.report_sales_by_category(p_from date, p_to date, p_branch uuid default null)
returns table (category text, qty numeric, net_sales numeric, cogs numeric)
language sql stable as $$
  select coalesce(c.name_ar, 'بدون تصنيف / خدمات'), sum(l.quantity), sum(l.line_total), sum(l.cost_at_sale * l.quantity)
  from invoice_lines l
  join invoices i on i.id = l.invoice_id
  left join products p on p.id = l.product_id
  left join product_categories c on c.id = p.category_id
  where i.kind = 'sales' and i.status <> 'cancelled' and i.invoice_date between p_from and p_to and (p_branch is null or i.branch_id = p_branch)
  group by 1 order by 3 desc;
$$;

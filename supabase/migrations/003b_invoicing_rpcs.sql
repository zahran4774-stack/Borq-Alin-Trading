create or replace function public.create_sales_invoice(
  p_branch_id uuid, p_contact_id uuid, p_invoice_date date, p_due_date date,
  p_lines jsonb, p_payments jsonb default '[]'::jsonb, p_notes text default null,
  p_repair_order_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_walkin uuid; v_contact uuid; v_inv uuid; v_no text; v_je uuid;
  v_line jsonb; v_prod products%rowtype; v_has_prod boolean;
  v_qty numeric; v_price numeric; v_disc numeric; v_rate numeric; v_base numeric; v_tax numeric;
  v_sub numeric := 0; v_vat numeric := 0; v_disc_total numeric := 0; v_total numeric; v_cogs numeric := 0;
  v_cost numeric; v_rev uuid; v_serials text[]; v_s text; v_def_vat numeric; v_desc text;
  v_paid numeric := 0; v_dep numeric := 0; v_dep_applied numeric := 0; v_credit numeric;
  v_pay jsonb; v_amt numeric; v_method payment_method; v_pid uuid; v_status invoice_status;
  v_ro repair_orders%rowtype;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager','cashier')
     or not can_write_branch(p_branch_id) then
    raise exception 'غير مصرح لك بإصدار فواتير لهذا الفرع';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'الفاتورة لا تحتوي على بنود';
  end if;
  p_invoice_date := coalesce(p_invoice_date, current_date);
  perform _assert_open(p_invoice_date);

  select default_vat_rate into v_def_vat from company_settings limit 1;
  v_def_vat := coalesce(v_def_vat, 5);
  select id into v_walkin from contacts where code = 'CASH';
  v_contact := coalesce(p_contact_id, v_walkin);

  if p_repair_order_id is not null then
    select * into v_ro from repair_orders where id = p_repair_order_id for update;
    if not found or v_ro.branch_id <> p_branch_id then raise exception 'أمر الصيانة غير موجود في هذا الفرع'; end if;
    if v_ro.status <> 'ready' then raise exception 'يجب أن تكون حالة أمر الصيانة "جاهز للتسليم"'; end if;
    v_dep := v_ro.deposit_amount;
  end if;

  v_no := _next_no(p_branch_id, 'INV');
  v_inv := gen_random_uuid();

  insert into invoices (id, kind, invoice_number, contact_id, invoice_date, due_date, status, notes, branch_id, repair_order_id, created_by)
  values (v_inv, 'sales', v_no, v_contact, p_invoice_date, p_due_date, 'confirmed', p_notes, p_branch_id, p_repair_order_id, auth.uid());

  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
  values (p_invoice_date, v_no, 'فاتورة مبيعات ' || v_no, 'Sales invoice ' || v_no, 'invoice', v_inv, true, auth.uid(), p_branch_id)
  returning id into v_je;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty   := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    v_disc  := round(coalesce((v_line->>'discount')::numeric, 0), 3);
    if v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 or v_disc < 0 then
      raise exception 'بيانات بند غير صحيحة (الكمية/السعر/الخصم)';
    end if;
    v_base := round(v_qty * v_price - v_disc, 3);
    if v_base < 0 then raise exception 'الخصم أكبر من قيمة البند'; end if;
    v_serials := array(select jsonb_array_elements_text(coalesce(v_line->'serials', '[]'::jsonb)));
    v_cost := 0; v_has_prod := nullif(v_line->>'product_id', '') is not null;

    if v_has_prod then
      select * into v_prod from products where id = (v_line->>'product_id')::uuid and is_active for update;
      if not found then raise exception 'منتج غير موجود أو غير فعّال'; end if;
      v_rate := coalesce((v_line->>'tax_rate')::numeric, v_prod.tax_rate);
      v_rev := coalesce(v_prod.revenue_account_id, case when v_prod.is_service then _acct('4110') else _acct('4100') end);
      v_desc := coalesce(nullif(v_line->>'description_ar', ''), v_prod.name_ar);
      if not v_prod.is_service then
        v_cost := v_prod.cost_price;
        insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, branch_id, created_by)
        values (v_prod.id, 'sale_out', v_qty, v_cost, 'invoice', v_inv, p_branch_id, auth.uid());
        if v_prod.track_serial then
          if v_qty <> trunc(v_qty) or coalesce(cardinality(v_serials), 0) <> v_qty then
            raise exception 'يجب إدخال % رقم تسلسلي/IMEI للمنتج: %', v_qty, v_prod.name_ar;
          end if;
          foreach v_s in array v_serials loop
            update product_serials set status = 'sold', sale_invoice_id = v_inv, sold_at = now(),
              warranty_end = case when v_prod.warranty_months > 0
                                  then (p_invoice_date + make_interval(months => v_prod.warranty_months))::date end
            where serial_no = v_s and product_id = v_prod.id and branch_id = p_branch_id and status = 'in_stock';
            if not found then raise exception 'الرقم التسلسلي % غير متوفر في هذا الفرع لهذا المنتج', v_s; end if;
          end loop;
        end if;
      end if;
    else
      v_rate := coalesce((v_line->>'tax_rate')::numeric, v_def_vat);
      v_rev := _acct('4110');
      v_desc := coalesce(nullif(v_line->>'description_ar', ''), 'خدمة');
    end if;

    v_tax := round(v_base * v_rate / 100, 3);
    insert into invoice_lines (invoice_id, product_id, description_ar, quantity, unit_price, tax_rate, line_total,
                               discount_amount, tax_amount, cost_at_sale, serial_numbers)
    values (v_inv, case when v_has_prod then v_prod.id end, v_desc, v_qty, v_price, v_rate, v_base,
            v_disc, v_tax, v_cost, coalesce(v_serials, '{}'));

    if v_base > 0 then
      insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_je, v_rev, 0, v_base, v_desc);
    end if;
    v_sub := v_sub + v_base; v_vat := v_vat + v_tax; v_disc_total := v_disc_total + v_disc;
    if v_has_prod and not v_prod.is_service then v_cogs := v_cogs + round(v_cost * v_qty, 3); end if;
  end loop;

  v_total := v_sub + v_vat;
  if v_total <= 0 then raise exception 'إجمالي الفاتورة يجب أن يكون أكبر من صفر'; end if;

  if v_vat > 0 then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_je, _acct('2120'), 0, v_vat, 'ضريبة القيمة المضافة');
  end if;
  if v_cogs > 0 then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo) values
      (v_je, _acct('5100'), v_cogs, 0, 'تكلفة البضاعة المباعة'),
      (v_je, _acct('1140'), 0, v_cogs, 'صرف مخزون');
  end if;

  v_dep_applied := least(v_dep, v_total);

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_amt := round(coalesce((v_pay->>'amount')::numeric, 0), 3);
    if v_amt < 0 then raise exception 'مبلغ دفعة غير صحيح'; end if;
    if v_amt = 0 then continue; end if;
    v_method := coalesce(nullif(v_pay->>'method', ''), 'cash')::payment_method;
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_je, _pay_acct(v_method), v_amt, 0, 'تحصيل ' || v_no);
    insert into payments (direction, contact_id, payment_date, method, amount, bank_account_id, reference, notes, journal_entry_id, created_by, branch_id)
    values ('in', v_contact, p_invoice_date, v_method, v_amt, _pay_acct(v_method), v_no, v_pay->>'reference', v_je, auth.uid(), p_branch_id)
    returning id into v_pid;
    insert into payment_allocations (payment_id, invoice_id, amount) values (v_pid, v_inv, v_amt);
    v_paid := v_paid + v_amt;
  end loop;

  if v_paid + v_dep_applied > v_total then
    raise exception 'المبلغ المدفوع (%) أكبر من المتبقي على الفاتورة', v_paid;
  end if;

  v_credit := round(v_total - v_paid - v_dep_applied, 3);
  if v_credit > 0 then
    if v_contact = v_walkin then raise exception 'البيع الآجل أو الدفع الجزئي يتطلب اختيار عميل غير "العميل النقدي"'; end if;
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id)
    values (v_je, _acct('1130'), v_credit, 0, 'ذمم مدينة ' || v_no, v_contact);
  end if;

  if v_dep > 0 then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id)
    values (v_je, _acct('2130'), v_dep, 0, 'استخدام عربون الصيانة', v_contact);
    if v_dep > v_dep_applied then
      insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_je, _acct('1110'), 0, v_dep - v_dep_applied, 'رد فائض العربون');
    end if;
  end if;

  v_status := case when v_credit <= 0 then 'paid'::invoice_status
                   when v_paid + v_dep_applied > 0 then 'partially_paid'::invoice_status
                   else 'confirmed'::invoice_status end;
  update invoices set subtotal = v_sub, tax_amount = v_vat, total = v_total, discount_amount = v_disc_total,
         amount_paid = v_paid + v_dep_applied, deposit_applied = v_dep_applied, status = v_status, journal_entry_id = v_je
  where id = v_inv;

  if p_repair_order_id is not null then
    perform set_config('app.internal', 'on', true);
    update repair_orders set status = 'delivered', delivered_at = now(), invoice_id = v_inv where id = p_repair_order_id;
  end if;
  return v_inv;
end $$;

create or replace function public.create_purchase_invoice(
  p_branch_id uuid, p_contact_id uuid, p_supplier_invoice_no text, p_invoice_date date, p_due_date date,
  p_lines jsonb, p_payments jsonb default '[]'::jsonb, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv uuid; v_no text; v_je uuid; v_line jsonb; v_prod products%rowtype; v_ct contacts%rowtype;
  v_qty numeric; v_price numeric; v_rate numeric; v_base numeric; v_tax numeric; v_def_vat numeric;
  v_sub numeric := 0; v_vat numeric := 0; v_total numeric; v_serials text[]; v_s text;
  v_paid numeric := 0; v_credit numeric; v_pay jsonb; v_amt numeric; v_method payment_method; v_pid uuid;
  v_status invoice_status;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager')
     or not can_write_branch(p_branch_id) then
    raise exception 'غير مصرح لك بتسجيل مشتريات لهذا الفرع';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'الفاتورة لا تحتوي على بنود';
  end if;
  select * into v_ct from contacts where id = p_contact_id and type in ('supplier','both');
  if not found then raise exception 'يجب اختيار مورد صحيح'; end if;
  p_invoice_date := coalesce(p_invoice_date, current_date);
  perform _assert_open(p_invoice_date);
  select default_vat_rate into v_def_vat from company_settings limit 1;
  v_def_vat := coalesce(v_def_vat, 5);

  v_no := _next_no(p_branch_id, 'PUR');
  v_inv := gen_random_uuid();
  insert into invoices (id, kind, invoice_number, contact_id, invoice_date, due_date, status, notes, branch_id, supplier_invoice_no, created_by)
  values (v_inv, 'purchase', v_no, p_contact_id, p_invoice_date, p_due_date, 'confirmed', p_notes, p_branch_id, p_supplier_invoice_no, auth.uid());

  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
  values (p_invoice_date, v_no, 'فاتورة مشتريات ' || v_no, 'Purchase invoice ' || v_no, 'invoice', v_inv, true, auth.uid(), p_branch_id)
  returning id into v_je;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line->>'quantity')::numeric; v_price := (v_line->>'unit_price')::numeric;
    if v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then raise exception 'بيانات بند غير صحيحة'; end if;
    select * into v_prod from products where id = (v_line->>'product_id')::uuid and is_active for update;
    if not found then raise exception 'منتج غير موجود'; end if;
    if v_prod.is_service then raise exception 'لا يمكن شراء خدمة كمخزون: %', v_prod.name_ar; end if;
    v_rate := coalesce((v_line->>'tax_rate')::numeric, v_def_vat);
    v_base := round(v_qty * v_price, 3); v_tax := round(v_base * v_rate / 100, 3);
    v_serials := array(select jsonb_array_elements_text(coalesce(v_line->'serials', '[]'::jsonb)));

    insert into invoice_lines (invoice_id, product_id, description_ar, quantity, unit_price, tax_rate, line_total, tax_amount, serial_numbers)
    values (v_inv, v_prod.id, v_prod.name_ar, v_qty, v_price, v_rate, v_base, v_tax, coalesce(v_serials, '{}'));

    insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, branch_id, created_by)
    values (v_prod.id, 'purchase_in', v_qty, v_price, 'invoice', v_inv, p_branch_id, auth.uid());

    if v_prod.track_serial then
      if v_qty <> trunc(v_qty) or coalesce(cardinality(v_serials), 0) <> v_qty then
        raise exception 'يجب إدخال % رقم تسلسلي/IMEI للمنتج: %', v_qty, v_prod.name_ar;
      end if;
      foreach v_s in array v_serials loop
        if exists (select 1 from product_serials where serial_no = v_s) then
          raise exception 'الرقم التسلسلي % مسجل مسبقاً', v_s;
        end if;
        insert into product_serials (product_id, serial_no, branch_id, status, cost, purchase_invoice_id)
        values (v_prod.id, v_s, p_branch_id, 'in_stock', v_price, v_inv);
      end loop;
    end if;
    v_sub := v_sub + v_base; v_vat := v_vat + v_tax;
  end loop;

  v_total := v_sub + v_vat;
  if v_total <= 0 then raise exception 'إجمالي الفاتورة يجب أن يكون أكبر من صفر'; end if;

  insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_je, _acct('1140'), v_sub, 0, 'مشتريات مخزون');
  if v_vat > 0 then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_je, _acct('1150'), v_vat, 0, 'ضريبة مدخلات');
  end if;

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_amt := round(coalesce((v_pay->>'amount')::numeric, 0), 3);
    if v_amt < 0 then raise exception 'مبلغ دفعة غير صحيح'; end if;
    if v_amt = 0 then continue; end if;
    v_method := coalesce(nullif(v_pay->>'method', ''), 'cash')::payment_method;
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_je, _pay_acct(v_method), 0, v_amt, 'سداد ' || v_no);
    insert into payments (direction, contact_id, payment_date, method, amount, bank_account_id, reference, notes, journal_entry_id, created_by, branch_id)
    values ('out', p_contact_id, p_invoice_date, v_method, v_amt, _pay_acct(v_method), v_no, v_pay->>'reference', v_je, auth.uid(), p_branch_id)
    returning id into v_pid;
    insert into payment_allocations (payment_id, invoice_id, amount) values (v_pid, v_inv, v_amt);
    v_paid := v_paid + v_amt;
  end loop;
  if v_paid > v_total then raise exception 'المبلغ المدفوع أكبر من إجمالي الفاتورة'; end if;
  v_credit := round(v_total - v_paid, 3);
  if v_credit > 0 then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id)
    values (v_je, _acct('2110'), 0, v_credit, 'ذمم دائنة ' || v_no, p_contact_id);
  end if;

  v_status := case when v_credit <= 0 then 'paid'::invoice_status
                   when v_paid > 0 then 'partially_paid'::invoice_status
                   else 'confirmed'::invoice_status end;
  update invoices set subtotal = v_sub, tax_amount = v_vat, total = v_total, amount_paid = v_paid,
         status = v_status, journal_entry_id = v_je where id = v_inv;
  return v_inv;
end $$;

create or replace function public.record_payment(
  p_branch_id uuid, p_contact_id uuid, p_direction payment_direction, p_payment_date date,
  p_method payment_method, p_amount numeric, p_reference text default null, p_invoice_ids uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_je uuid; v_no text; v_remaining numeric; v_iid uuid; v_inv invoices%rowtype; v_alloc numeric;
  v_kind invoice_kind; v_acct uuid;
begin
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager','cashier')
     or not can_write_branch(p_branch_id) then
    raise exception 'غير مصرح';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  p_payment_date := coalesce(p_payment_date, current_date);
  perform _assert_open(p_payment_date);
  v_kind := case when p_direction = 'in' then 'sales'::invoice_kind else 'purchase'::invoice_kind end;
  v_acct := case when p_direction = 'in' then _acct('1130') else _acct('2110') end;
  v_no := _next_no(p_branch_id, case when p_direction = 'in' then 'RCT' else 'PAY' end);
  v_pid := gen_random_uuid();

  insert into journal_entries (entry_date, reference, memo_ar, memo_en, source_type, source_id, is_posted, created_by, branch_id)
  values (p_payment_date, v_no, case when p_direction = 'in' then 'سند قبض ' else 'سند صرف ' end || v_no, 'Payment voucher', 'payment', v_pid, true, auth.uid(), p_branch_id)
  returning id into v_je;

  insert into payments (id, direction, contact_id, payment_date, method, amount, bank_account_id, reference, notes, journal_entry_id, created_by, branch_id)
  values (v_pid, p_direction, p_contact_id, p_payment_date, p_method, p_amount, _pay_acct(p_method), v_no, p_reference, v_je, auth.uid(), p_branch_id);

  v_remaining := p_amount;
  foreach v_iid in array coalesce(p_invoice_ids, '{}') loop
    exit when v_remaining <= 0;
    select * into v_inv from invoices where id = v_iid and contact_id = p_contact_id and kind = v_kind
      and status in ('confirmed','partially_paid') for update;
    if not found then raise exception 'فاتورة غير صالحة للسداد'; end if;
    v_alloc := least(v_inv.total - v_inv.amount_paid, v_remaining);
    if v_alloc > 0 then
      insert into payment_allocations (payment_id, invoice_id, amount) values (v_pid, v_iid, v_alloc);
      update invoices set amount_paid = amount_paid + v_alloc,
        status = case when amount_paid + v_alloc >= total then 'paid'::invoice_status else 'partially_paid'::invoice_status end
      where id = v_iid;
      v_remaining := v_remaining - v_alloc;
    end if;
  end loop;

  if p_direction = 'in' then
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id) values
      (v_je, _pay_acct(p_method), p_amount, 0, 'قبض ' || v_no, null),
      (v_je, v_acct, 0, p_amount, 'سداد ذمة عميل', p_contact_id);
  else
    insert into journal_lines (journal_entry_id, account_id, debit, credit, memo, contact_id) values
      (v_je, v_acct, p_amount, 0, 'سداد ذمة مورد', p_contact_id),
      (v_je, _pay_acct(p_method), 0, p_amount, 'صرف ' || v_no, null);
  end if;
  return v_pid;
end $$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p payments%rowtype; a record;
begin
  select * into p from payments where id = p_payment_id for update;
  if not found then raise exception 'السند غير موجود'; end if;
  if current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(p.branch_id) then raise exception 'غير مصرح'; end if;
  if p.voided then raise exception 'السند ملغى مسبقاً'; end if;
  if exists (select 1 from payment_allocations pa join invoices i on i.id = pa.invoice_id
             where pa.payment_id = p.id and i.journal_entry_id = p.journal_entry_id) then
    raise exception 'هذه دفعة فاتورة نقطة البيع، تُلغى بإلغاء الفاتورة نفسها';
  end if;
  perform _assert_open(current_date);
  perform _reverse_journal(p.journal_entry_id, current_date, coalesce(p_reason, 'إلغاء سند'));
  for a in select * from payment_allocations where payment_id = p.id loop
    update invoices set amount_paid = amount_paid - a.amount,
      status = case when amount_paid - a.amount <= 0 then 'confirmed'::invoice_status else 'partially_paid'::invoice_status end
    where id = a.invoice_id and status in ('paid','partially_paid');
  end loop;
  update payments set voided = true where id = p.id;
end $$;

create or replace function public.cancel_invoice(p_invoice_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare i invoices%rowtype; l record;
begin
  select * into i from invoices where id = p_invoice_id for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager') or not can_write_branch(i.branch_id) then
    raise exception 'غير مصرح بإلغاء الفواتير';
  end if;
  if i.status = 'cancelled' then raise exception 'الفاتورة ملغاة مسبقاً'; end if;
  perform _assert_open(i.invoice_date);
  perform _assert_open(current_date);

  if exists (select 1 from payment_allocations pa join payments p on p.id = pa.payment_id
             where pa.invoice_id = i.id and not p.voided and p.journal_entry_id is distinct from i.journal_entry_id) then
    raise exception 'توجد سندات قبض/صرف مرتبطة بالفاتورة، ألغِها أولاً';
  end if;

  perform _reverse_journal(i.journal_entry_id, current_date, 'إلغاء فاتورة');

  if i.kind = 'sales' then
    for l in select * from invoice_lines where invoice_id = i.id and product_id is not null loop
      if exists (select 1 from products where id = l.product_id and not is_service) then
        insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, branch_id, created_by, note)
        values (l.product_id, 'sale_return_in', l.quantity, l.cost_at_sale, 'invoice_cancel', i.id, i.branch_id, auth.uid(), 'إلغاء فاتورة');
      end if;
    end loop;
    update product_serials set status = 'in_stock', sale_invoice_id = null, sold_at = null, warranty_end = null
    where sale_invoice_id = i.id;
    update payments set voided = true
    where id in (select payment_id from payment_allocations where invoice_id = i.id)
      and journal_entry_id = i.journal_entry_id;
    if i.repair_order_id is not null then
      perform set_config('app.internal', 'on', true);
      update repair_orders set status = 'ready', invoice_id = null, delivered_at = null where id = i.repair_order_id;
    end if;
  else
    if exists (select 1 from product_serials where purchase_invoice_id = i.id and status <> 'in_stock') then
      raise exception 'بعض الأرقام التسلسلية لهذه المشتريات بيعت أو نُقلت، لا يمكن الإلغاء';
    end if;
    if exists (select 1 from product_serials ps where ps.purchase_invoice_id = i.id and ps.branch_id <> i.branch_id) then
      raise exception 'بعض الأجهزة نُقلت لفرع آخر، لا يمكن الإلغاء';
    end if;
    for l in select * from invoice_lines where invoice_id = i.id and product_id is not null loop
      insert into stock_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, branch_id, created_by, note)
      values (l.product_id, 'purchase_return_out', l.quantity, l.unit_price, 'invoice_cancel', i.id, i.branch_id, auth.uid(), 'إلغاء فاتورة مشتريات');
    end loop;
    update product_serials set status = 'returned_supplier' where purchase_invoice_id = i.id;
    update payments set voided = true
    where id in (select payment_id from payment_allocations where invoice_id = i.id)
      and journal_entry_id = i.journal_entry_id;
  end if;

  update invoices set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
  where id = i.id;
end $$;

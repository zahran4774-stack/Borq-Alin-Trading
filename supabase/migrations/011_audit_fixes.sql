-- F-01: لا قراءة إلا لمن له دور في النظام (تسجيل دخول فقط لا يكفي)
alter policy accounts_select on public.accounts using (public.current_app_role() is not null);
alter policy branches_select on public.branches using (public.current_app_role() is not null);
alter policy company_settings_select on public.company_settings using (public.current_app_role() is not null);
alter policy contacts_select on public.contacts using (public.current_app_role() is not null);
alter policy categories_select on public.product_categories using (public.current_app_role() is not null);
alter policy products_select on public.products using (public.current_app_role() is not null);

-- F-02: الكاشير لا يصرف أموالاً للموردين (سند صرف)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname='record_payment' and p.pronamespace='public'::regnamespace and p.pronargs=8
     and pg_get_functiondef(p.oid) like '%p_branch_id uuid, p_contact_id uuid%';
  d := replace(d, E'  if p_amount is null or p_amount <= 0 then',
    E'  if p_direction = ''out'' and current_app_role() not in (''admin'',''accountant'',''branch_manager'') then\n    raise exception ''غير مصرح بسندات الصرف'';\n  end if;\n  if p_amount is null or p_amount <= 0 then');
  execute d;
end $$;

-- F-03: نسبة الضريبة من المنتج وليس من العميل (البند الحر: النسبة الافتراضية)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname='create_sales_invoice' and p.pronamespace='public'::regnamespace and p.pronargs=8;
  d := replace(d, 'coalesce((v_line->>''tax_rate'')::numeric, v_prod.tax_rate)', 'v_prod.tax_rate');
  d := replace(d, 'coalesce((v_line->>''tax_rate'')::numeric, v_def_vat)', 'v_def_vat');
  execute d;
end $$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' loop
    execute format('revoke all on function %s from public, anon', r.sig);
  end loop;
end $$;

revoke all on function public._assert_open(date), public._acct(text), public._pay_acct(payment_method),
  public._next_no(uuid, text), public._reverse_journal(uuid, date, text), public.apply_stock_movement(),
  public._repair_deposit(repair_orders, numeric, payment_method), public.handle_new_user(), public.check_journal_balance(),
  public.log_repair_status(), public.repair_stamp_dates(), public.repair_guard(), public.touch_updated_at()
  from authenticated;

revoke all on function
  public.create_sales_invoice(uuid, text, date, date, jsonb),
  public.create_purchase_invoice(uuid, text, date, date, jsonb),
  public.record_payment(uuid, payment_direction, date, payment_method, numeric, uuid, text, uuid[])
  from authenticated;

revoke all on all tables in schema public from anon;

-- 1) فهارس على الأعمدة المستخدمة في الفلترة والترتيب والربط
create index if not exists idx_invoices_list on public.invoices (kind, branch_id, invoice_date desc, created_at desc);
create index if not exists idx_invoice_lines_product on public.invoice_lines (product_id);
create index if not exists idx_payments_created on public.payments (created_at desc);
create index if not exists idx_payments_branch on public.payments (branch_id);
create index if not exists idx_expenses_date_branch on public.expenses (expense_date desc, branch_id);
create index if not exists idx_stock_movements_created on public.stock_movements (created_at desc);
create index if not exists idx_stock_transfers_created on public.stock_transfers (created_at desc);
create index if not exists idx_branch_stock_product on public.branch_stock (product_id);
create index if not exists idx_repair_orders_received on public.repair_orders (received_at desc);
create index if not exists idx_repair_orders_contact on public.repair_orders (contact_id);
create index if not exists idx_repair_parts_order on public.repair_parts (repair_order_id);
create index if not exists idx_repair_events_order on public.repair_events (repair_order_id, created_at desc);
create index if not exists idx_serials_branch_status on public.product_serials (branch_id, status);
create index if not exists idx_serials_sale_invoice on public.product_serials (sale_invoice_id);
create index if not exists idx_journal_lines_contact on public.journal_lines (contact_id);
create index if not exists idx_profiles_branch on public.profiles (branch_id);

-- 2) سياسة profiles: تقييم auth.uid() مرة واحدة لا لكل صف
alter policy profiles_select on public.profiles using (
  (id = (select auth.uid()))
  or ((select public.current_app_role()) = any (array['admin'::app_role, 'accountant'::app_role]))
  or ((branch_id is not null) and (branch_id = (select public.my_branch())))
);

-- 3) لوحة التحكم: أرقام مجمّعة في استعلام واحد بدل تحميل آلاف الفواتير للمتصفح
create or replace function public.dashboard_stats(p_branch uuid, p_today date)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'today_sales', coalesce((select sum(total) from invoices where kind='sales' and status<>'cancelled' and invoice_date=p_today and (p_branch is null or branch_id=p_branch)),0),
    'today_count', (select count(*) from invoices where kind='sales' and status<>'cancelled' and invoice_date=p_today and (p_branch is null or branch_id=p_branch)),
    'recv', coalesce((select sum(total-amount_paid) from invoices where kind='sales' and status<>'cancelled' and (p_branch is null or branch_id=p_branch)),0),
    'pay',  coalesce((select sum(total-amount_paid) from invoices where kind='purchase' and status<>'cancelled' and (p_branch is null or branch_id=p_branch)),0),
    'repairs', (select count(*) from repair_orders where status not in ('delivered','cancelled') and (p_branch is null or branch_id=p_branch)),
    'ready',   (select count(*) from repair_orders where status='ready' and (p_branch is null or branch_id=p_branch)),
    'low', (select count(*) from (
        select bs.product_id from branch_stock bs join products p on p.id=bs.product_id
        where p.is_active and (p_branch is null or bs.branch_id=p_branch)
        group by bs.product_id, p.reorder_level
        having p.reorder_level > 0 and sum(bs.quantity) <= p.reorder_level) x)
  )
$$;
revoke all on function public.dashboard_stats(uuid, date) from public, anon;
grant execute on function public.dashboard_stats(uuid, date) to authenticated;

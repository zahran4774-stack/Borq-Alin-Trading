-- New tables: enable RLS
alter table public.branches enable row level security;
alter table public.product_categories enable row level security;
alter table public.branch_stock enable row level security;
alter table public.product_serials enable row level security;
alter table public.doc_sequences enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.expenses enable row level security;
alter table public.repair_orders enable row level security;
alter table public.repair_parts enable row level security;
alter table public.repair_events enable row level security;

-- Existing policies: tighten in place (branch-aware, no direct writes to transactional tables)
alter policy contacts_write on public.contacts
  using (current_app_role() in ('admin','accountant','branch_manager','cashier'))
  with check (current_app_role() in ('admin','accountant','branch_manager','cashier'));

alter policy products_write on public.products
  using (current_app_role() in ('admin','accountant','branch_manager'))
  with check (current_app_role() in ('admin','accountant','branch_manager'));

alter policy invoices_select on public.invoices using (can_see_branch(branch_id));
alter policy invoices_write on public.invoices using (false) with check (false);

alter policy invoice_lines_select on public.invoice_lines
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
alter policy invoice_lines_write on public.invoice_lines using (false) with check (false);

alter policy payments_select on public.payments
  using (can_see_branch(branch_id) and current_app_role() in ('admin','accountant','branch_manager','cashier','viewer'));
alter policy payments_write on public.payments using (false) with check (false);

alter policy payment_allocations_select on public.payment_allocations
  using (exists (select 1 from public.payments p where p.id = payment_id));
alter policy payment_allocations_write on public.payment_allocations using (false) with check (false);

alter policy journal_entries_select on public.journal_entries
  using (current_app_role() in ('admin','accountant','viewer','branch_manager') and can_see_branch(branch_id));
alter policy journal_entries_write on public.journal_entries with check (false);
alter policy journal_entries_update on public.journal_entries using (false) with check (false);
alter policy journal_entries_delete on public.journal_entries using (false);

alter policy journal_lines_select on public.journal_lines
  using (exists (select 1 from public.journal_entries e where e.id = journal_entry_id));
alter policy journal_lines_write on public.journal_lines with check (false);
alter policy journal_lines_update on public.journal_lines using (false) with check (false);
alter policy journal_lines_delete on public.journal_lines using (false);

alter policy stock_movements_select on public.stock_movements
  using (current_app_role() in ('admin','accountant','viewer','branch_manager') and can_see_branch(branch_id));
alter policy stock_movements_write on public.stock_movements using (false) with check (false);

alter policy profiles_select on public.profiles
  using (id = auth.uid() or current_app_role() in ('admin','accountant')
         or (branch_id is not null and branch_id = my_branch()));

-- New policies
create policy branches_select on public.branches for select using (auth.uid() is not null);
create policy branches_write on public.branches for all
  using (current_app_role() = 'admin') with check (current_app_role() = 'admin');

create policy categories_select on public.product_categories for select using (auth.uid() is not null);
create policy categories_write on public.product_categories for all
  using (current_app_role() in ('admin','accountant','branch_manager'))
  with check (current_app_role() in ('admin','accountant','branch_manager'));

create policy branch_stock_select on public.branch_stock for select using (can_see_branch(branch_id));
create policy serials_select on public.product_serials for select using (can_see_branch(branch_id));
create policy transfers_select on public.stock_transfers for select
  using (can_see_branch(from_branch_id) or can_see_branch(to_branch_id));
create policy expenses_select on public.expenses for select
  using (current_app_role() in ('admin','accountant','viewer','branch_manager') and can_see_branch(branch_id));

create policy repair_orders_select on public.repair_orders for select using (can_see_branch(branch_id));
create policy repair_orders_update on public.repair_orders for update
  using (can_write_branch(branch_id) and current_app_role() in ('admin','accountant','branch_manager','cashier','technician'))
  with check (can_write_branch(branch_id) and current_app_role() in ('admin','accountant','branch_manager','cashier','technician'));

create policy repair_parts_select on public.repair_parts for select
  using (exists (select 1 from public.repair_orders o where o.id = repair_order_id));
create policy repair_parts_write on public.repair_parts for all
  using (current_app_role() in ('admin','accountant','branch_manager','cashier','technician')
         and exists (select 1 from public.repair_orders o where o.id = repair_order_id and can_write_branch(o.branch_id) and o.status not in ('delivered','cancelled')))
  with check (current_app_role() in ('admin','accountant','branch_manager','cashier','technician')
         and exists (select 1 from public.repair_orders o where o.id = repair_order_id and can_write_branch(o.branch_id) and o.status not in ('delivered','cancelled')));

create policy repair_events_select on public.repair_events for select
  using (exists (select 1 from public.repair_orders o where o.id = repair_order_id));

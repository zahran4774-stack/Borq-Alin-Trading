create table if not exists public.branches (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  address_ar text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.branches (code, name_ar, name_en)
select 'B1', 'الفرع الرئيسي', 'Main Branch'
where not exists (select 1 from public.branches where code = 'B1');
insert into public.branches (code, name_ar, name_en)
select 'B2', 'الفرع الثاني', 'Second Branch'
where not exists (select 1 from public.branches where code = 'B2');

alter table public.profiles
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists email text,
  add column if not exists is_active boolean not null default true;

alter table public.company_settings
  add column if not exists default_vat_rate numeric(5,2) not null default 5,
  add column if not exists allow_negative_stock boolean not null default false,
  add column if not exists books_locked_until date,
  add column if not exists invoice_footer_ar text default 'شكراً لتعاملكم معنا',
  add column if not exists repair_terms_ar text default 'الشركة غير مسؤولة عن الأجهزة غير المستلمة بعد 30 يوماً من تاريخ الإشعار. ضمان الصيانة لا يشمل سوء الاستخدام أو السوائل أو الكسر.';

create table if not exists public.product_categories (
  id uuid primary key default extensions.uuid_generate_v4(),
  name_ar text not null unique,
  name_en text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.product_categories (name_ar, name_en, sort_order) values
  ('هواتف وأجهزة ذكية', 'Phones & Smart Devices', 1),
  ('إكسسوارات الهواتف', 'Phone Accessories', 2),
  ('طابعات', 'Printers', 3),
  ('أحبار وتوريدات الطباعة', 'Inks & Printing Supplies', 4),
  ('أجهزة إلكترونية', 'Electronics', 5),
  ('قطع غيار', 'Spare Parts', 6),
  ('خدمات الصيانة', 'Repair Services', 7)
on conflict (name_ar) do nothing;

alter table public.products
  add column if not exists category_id uuid references public.product_categories(id),
  add column if not exists barcode text,
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists is_service boolean not null default false,
  add column if not exists track_serial boolean not null default false,
  add column if not exists tax_rate numeric(5,2) not null default 5,
  add column if not exists warranty_months int not null default 0;

create unique index if not exists products_barcode_key on public.products (barcode) where barcode is not null;
create index if not exists idx_products_category on public.products (category_id);

create table if not exists public.branch_stock (
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(18,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_id, product_id)
);

alter table public.stock_movements
  add column if not exists branch_id uuid references public.branches(id);
do $$ begin
  if not exists (select 1 from public.stock_movements) then
    alter table public.stock_movements alter column branch_id set not null;
  end if;
end $$;
create index if not exists idx_stock_movements_branch on public.stock_movements (branch_id);

create table if not exists public.product_serials (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid not null references public.products(id),
  serial_no text not null,
  branch_id uuid not null references public.branches(id),
  status text not null default 'in_stock' check (status in ('in_stock','sold','returned_supplier','lost')),
  cost numeric(18,3) not null default 0,
  purchase_invoice_id uuid references public.invoices(id),
  sale_invoice_id uuid references public.invoices(id),
  sold_at timestamptz,
  warranty_end date,
  created_at timestamptz not null default now(),
  unique (serial_no)
);
create index if not exists idx_serials_product on public.product_serials (product_id, branch_id, status);

insert into public.contacts (code, name_ar, name_en, type)
select 'CASH', 'عميل نقدي', 'Walk-in Customer', 'customer'
where not exists (select 1 from public.contacts where code = 'CASH');

insert into public.accounts (code, name_ar, name_en, type, parent_id, is_group, is_system)
select '1150', 'ضريبة القيمة المضافة - مدخلات', 'VAT Receivable (Input)', 'asset', (select id from public.accounts where code='1100'), false, true
where not exists (select 1 from public.accounts where code='1150');
insert into public.accounts (code, name_ar, name_en, type, parent_id, is_group, is_system)
select '2130', 'دفعات مقدمة من العملاء (عربون الصيانة)', 'Customer Deposits', 'liability', (select id from public.accounts where code='2100'), false, true
where not exists (select 1 from public.accounts where code='2130');
insert into public.accounts (code, name_ar, name_en, type, parent_id, is_group, is_system)
select '4110', 'إيرادات الصيانة والخدمات', 'Repair & Service Revenue', 'revenue', (select id from public.accounts where code='4000'), false, true
where not exists (select 1 from public.accounts where code='4110');
insert into public.accounts (code, name_ar, name_en, type, parent_id, is_group, is_system)
select '5710', 'فروقات وخسائر المخزون', 'Inventory Adjustments', 'expense', (select id from public.accounts where code='5000'), false, true
where not exists (select 1 from public.accounts where code='5710');

alter table public.journal_entries
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists reversal_of uuid references public.journal_entries(id),
  add column if not exists is_reversed boolean not null default false;
create index if not exists idx_journal_entries_branch on public.journal_entries (branch_id, entry_date);

alter table public.invoices
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists discount_amount numeric(18,3) not null default 0,
  add column if not exists supplier_invoice_no text,
  add column if not exists repair_order_id uuid,
  add column if not exists deposit_applied numeric(18,3) not null default 0,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancel_reason text;
do $$ begin
  if not exists (select 1 from public.invoices) then
    alter table public.invoices alter column branch_id set not null;
  end if;
end $$;
create index if not exists idx_invoices_branch on public.invoices (branch_id, invoice_date);

alter table public.invoice_lines
  add column if not exists discount_amount numeric(18,3) not null default 0,
  add column if not exists tax_amount numeric(18,3) not null default 0,
  add column if not exists cost_at_sale numeric(18,3) not null default 0,
  add column if not exists serial_numbers text[] not null default '{}';

alter table public.payments
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists voided boolean not null default false;

create table if not exists public.doc_sequences (
  branch_id uuid not null references public.branches(id),
  doc_type text not null,
  last_no bigint not null default 0,
  primary key (branch_id, doc_type)
);

create table if not exists public.stock_transfers (
  id uuid primary key default extensions.uuid_generate_v4(),
  transfer_no text not null unique,
  from_branch_id uuid not null references public.branches(id),
  to_branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  quantity numeric(18,3) not null check (quantity > 0),
  serial_numbers text[] not null default '{}',
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (from_branch_id <> to_branch_id)
);

create table if not exists public.expenses (
  id uuid primary key default extensions.uuid_generate_v4(),
  branch_id uuid not null references public.branches(id),
  expense_no text not null unique,
  expense_date date not null default current_date,
  account_id uuid not null references public.accounts(id),
  amount numeric(18,3) not null check (amount > 0),
  vat_amount numeric(18,3) not null default 0,
  method payment_method not null default 'cash',
  payee text,
  memo text,
  journal_entry_id uuid references public.journal_entries(id),
  voided boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.repair_orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  branch_id uuid not null references public.branches(id),
  order_no text not null unique,
  contact_id uuid references public.contacts(id),
  customer_name text not null,
  customer_phone text not null,
  device_type text not null default 'هاتف',
  brand text,
  model text,
  serial_no text,
  problem_ar text not null,
  accessories_received text,
  condition_notes text,
  status text not null default 'received' check (status in
    ('received','diagnosing','waiting_approval','waiting_parts','in_repair','ready','delivered','cancelled')),
  estimated_cost numeric(18,3) not null default 0,
  diagnosis text,
  labor_charge numeric(18,3) not null default 0,
  deposit_amount numeric(18,3) not null default 0,
  technician_id uuid references public.profiles(id),
  warranty_days int not null default 30,
  received_at timestamptz not null default now(),
  promised_at date,
  ready_at timestamptz,
  delivered_at timestamptz,
  invoice_id uuid references public.invoices(id),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_repair_branch_status on public.repair_orders (branch_id, status);
create index if not exists idx_repair_serial on public.repair_orders (serial_no);
create index if not exists idx_repair_phone on public.repair_orders (customer_phone);

alter table public.invoices
  add constraint invoices_repair_order_fk foreign key (repair_order_id) references public.repair_orders(id);

create table if not exists public.repair_parts (
  id uuid primary key default extensions.uuid_generate_v4(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.repair_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_repair_touch before update on public.repair_orders
  for each row execute function public.touch_updated_at();

create or replace function public.log_repair_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into repair_events (repair_order_id, status, note, created_by)
    values (new.id, new.status, 'استلام الجهاز', auth.uid());
  elsif new.status is distinct from old.status then
    insert into repair_events (repair_order_id, status, created_by) values (new.id, new.status, auth.uid());
  end if;
  return null;
end $$;

create or replace function public.repair_stamp_dates() returns trigger
language plpgsql as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' and new.ready_at is null then
    new.ready_at := now();
  end if;
  return new;
end $$;

create trigger trg_repair_log after insert or update on public.repair_orders
  for each row execute function public.log_repair_status();

create trigger trg_repair_stamp before update on public.repair_orders
  for each row execute function public.repair_stamp_dates();

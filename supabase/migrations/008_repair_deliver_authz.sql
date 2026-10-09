-- دفاع إضافي: تحقق صلاحية صريح داخل repair_deliver قبل أي قراءة
create or replace function public.repair_deliver(p_order_id uuid, p_payments jsonb default '[]'::jsonb, p_invoice_date date default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare o repair_orders%rowtype; v_lines jsonb := '[]'::jsonb; r record;
begin
  select * into o from repair_orders where id = p_order_id;
  if not found then raise exception 'أمر الصيانة غير موجود'; end if;
  if current_app_role() is null or current_app_role() not in ('admin','accountant','branch_manager','cashier') or not can_write_branch(o.branch_id) then
    raise exception 'غير مصرح';
  end if;
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
end $function$;

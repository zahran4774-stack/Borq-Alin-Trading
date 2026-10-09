-- الرصيد السالب ممنوع دائماً (لا يعتمد على إعداد)؛ يُحدَّث apply_stock_movement ويُضاف قيد على الإعدادات
update public.company_settings set allow_negative_stock = false where true;
-- (تعريف apply_stock_movement الكامل مطبّق على القاعدة: نفس المنطق السابق مع رفع الاستثناء دون التحقق من الإعداد)
alter table public.company_settings drop constraint if exists no_negative_stock_always;
alter table public.company_settings add constraint no_negative_stock_always check (allow_negative_stock = false);

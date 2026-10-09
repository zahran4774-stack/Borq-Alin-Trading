alter view public.trial_balance set (security_invoker = true);
alter view public.income_statement set (security_invoker = true);
alter view public.balance_sheet set (security_invoker = true);
alter view public.ar_aging set (security_invoker = true);

alter function public.touch_updated_at() set search_path = public;
alter function public.repair_stamp_dates() set search_path = public;
alter function public.check_journal_balance() set search_path = public;
alter function public.report_sales_by_category(date, date, uuid) set search_path = public;
alter function public.report_trial_balance(date, date, uuid) set search_path = public;
alter function public.report_branch_summary(date, date) set search_path = public;
alter function public.repair_guard() set search_path = public;

revoke all on public.trial_balance, public.income_statement, public.balance_sheet, public.ar_aging from anon;

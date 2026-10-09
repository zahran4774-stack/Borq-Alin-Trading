create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_first boolean; v_prov boolean;
begin
  v_first := not exists (select 1 from profiles);
  v_prov := coalesce(new.raw_app_meta_data->>'provisioned', '') = 'true';
  insert into profiles (id, full_name, role, email, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email),
          case when v_first then 'admin'::app_role else 'viewer'::app_role end,
          new.email, v_first or v_prov);
  return new;
end $$;

create or replace function public.needs_setup() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles);
$$;
grant execute on function public.needs_setup() to anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

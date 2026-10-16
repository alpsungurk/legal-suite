-- =====================================================================================
-- Haciz gönderilecek bankalar listesi (Ayarlar → Kategoriler → Bankalar)
--   - Aktif / pasif; 89/1 formunda listeden seçilir
--   - Excel ile toplu yükleme (uygulama tarafı)
-- Tekrar çalıştırılabilir.
-- =====================================================================================

create table if not exists public.banks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, id),
  constraint banks_name_not_blank check (length(btrim(name)) > 0)
);

create unique index if not exists banks_org_name_lower_idx
  on public.banks (org_id, lower(btrim(name)));

create index if not exists banks_org_active_idx on public.banks (org_id, active);

-- Görüntüleme: kategoriler veya icra (89/1 formunda liste lazım)
-- Yazma: yalnızca Ayarlar → Kategoriler yetkisi
alter table public.banks enable row level security;
drop policy if exists banks_select on public.banks;
drop policy if exists banks_insert on public.banks;
drop policy if exists banks_update on public.banks;
drop policy if exists banks_delete on public.banks;

create policy banks_select on public.banks for select to authenticated
  using (
    org_id = app.current_org_id()
    and (
      app.can('settings_categories', 'view')
      or app.can('enforcements', 'view')
      or app.can('enforcements', 'create')
    )
  );
create policy banks_insert on public.banks for insert to authenticated
  with check (org_id = app.current_org_id() and app.can('settings_categories', 'create'));
create policy banks_update on public.banks for update to authenticated
  using (org_id = app.current_org_id() and app.can('settings_categories', 'edit'))
  with check (org_id = app.current_org_id());
create policy banks_delete on public.banks for delete to authenticated
  using (org_id = app.current_org_id() and app.can('settings_categories', 'delete'));

grant select, insert, update, delete on public.banks to authenticated;
revoke all on public.banks from anon;

drop trigger if exists trg_touch on public.banks;
create trigger trg_touch before update on public.banks
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_force_org on public.banks;
create trigger trg_force_org before insert or update on public.banks
  for each row execute function app.force_org();
drop trigger if exists trg_audit on public.banks;
create trigger trg_audit after insert or update or delete on public.banks
  for each row execute function app.audit();

-- Denetim etiketi: banks → Banka
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb; n jsonb; d jsonb := '{}'::jsonb; k text; j jsonb;
  v_org uuid; v_id uuid; v_label text; v_action text;
begin
  if coalesce(current_setting('app.skip_audit', true), '') = '1' then return null; end if;
  o := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  j := coalesce(n, o);
  v_org := (j ->> 'org_id')::uuid;
  v_id  := coalesce(j ->> 'id', j ->> 'org_id')::uuid;
  v_label := case tg_table_name
    when 'clients' then 'Müvekkil' when 'cases' then 'Dosya' when 'expenses' then 'Masraf'
    when 'accounts' then 'Hesap' when 'account_transactions' then 'Hesap hareketi'
    when 'fee_plans' then 'Tahsilat planı' when 'installment_payments' then 'Tahsilat'
    when 'reminders' then 'Ajanda' when 'debtors' then 'Borçlu' when 'enforcements' then 'İcra dosyası'
    when 'payment_promises' then 'Ödeme sözü' when 'collections' then 'İcra tahsilatı'
    when 'enforcement_events' then 'İcra işlemi'
    when 'banks' then 'Banka'
    when 'documents' then 'Belge' when 'profiles' then 'Kullanıcı' when 'org_settings' then 'Ayarlar'
    else tg_table_name end;
  v_action := case tg_op when 'INSERT' then 'Ekleme' when 'UPDATE' then 'Güncelleme' else 'Silme' end;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k in ('updated_at', 'created_at') then continue; end if;
      if n -> k is distinct from o -> k then
        d := d || jsonb_build_object(k, jsonb_build_object('before', o -> k, 'after', n -> k));
      end if;
    end loop;
    if d = '{}'::jsonb then return null; end if;
  end if;
  insert into public.activities (org_id, actor_id, action, entity, entity_id, detail, changes)
  values (
    v_org, auth.uid(), v_action, v_label, v_id,
    left(coalesce(j ->> 'name', j ->> 'title', j ->> 'no', j ->> 'description', j ->> 'type', j ->> 'amount', ''), 300),
    case when tg_op = 'UPDATE' then d end
  );
  return null;
end $$;

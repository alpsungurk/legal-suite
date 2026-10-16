-- =====================================================================================
-- Ayarlar bölümlerini avukata verebilme (Ayarlar → İzinler → "Ayarlar sayfası")
-- Her bölümde Görüntüle / Ekle / Düzenle / Sil ayrı ayrı verilir:
--   settings_firm       view, edit                    Büro bilgileri (firm jsonb, büro adı)
--   settings_categories view, create, edit, delete    Açılır listeler (create: değer ekle, delete: değer sil),
--                                                     edit: haciz süresi / hatırlatma günü / kapalı dosya saklama süresi
--   settings_companies  view, create, edit, delete    Şirket listeleri (create: liste aç, edit: ad / müvekkil / ikon, delete: sil)
--   settings_users      view, create, edit            Kullanıcılar (devri 20261016140000 dosyasında)
--   settings_backup     view                          Yedek indirme (yalnızca arayüz)
-- Admin her şeyi yapmaya devam eder. İzinler (role_permissions), arşiv ve zamanlama yalnızca Admin'dedir.
-- Yetki arayüzde değil veritabanında zorunludur: kural ve tetikleyiciler aşağıda.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

-- Ayarlarda herhangi bir değişiklik hakkı var mı? (ayrıntılı denetimi aşağıdaki tetikleyici yapar)
create or replace function app.can_change_settings() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin()
      or app.can('settings_firm', 'edit')
      or app.can('settings_categories', 'create') or app.can('settings_categories', 'edit') or app.can('settings_categories', 'delete')
      or app.can('settings_companies', 'create') or app.can('settings_companies', 'edit') or app.can('settings_companies', 'delete')
$$;
revoke all on function app.can_change_settings() from public, anon;
grant execute on function app.can_change_settings() to authenticated;

drop policy if exists org_settings_update on public.org_settings;
create policy org_settings_update on public.org_settings for update to authenticated
  using (org_id = app.current_org_id() and app.can_change_settings())
  with check (org_id = app.current_org_id());

-- Admin olmayan hangi kolonda ne yapabilir?
--   firm                              → settings_firm.edit
--   açılır liste kolonları (text[])   → yeni değer: settings_categories.create, silinen değer: .delete, yalnızca sıra: .edit
--   sayısal ayarlar                   → settings_categories.edit
--   company_lists                     → yeni liste: settings_companies.create, silinen: .delete, değişen: .edit
--   diğer her kolon (role_permissions…) → yalnızca Admin
create or replace function app.guard_settings_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
  old_arr text[]; new_arr text[]; old_map jsonb; new_map jsonb;
  added boolean; removed boolean; changed boolean;
begin
  if auth.uid() is null or app.is_admin() then return new; end if;
  for k in select jsonb_object_keys(n) loop
    if k = 'updated_at' or n -> k is not distinct from o -> k then continue; end if;

    if k = 'firm' then
      if not app.can('settings_firm', 'edit') then
        raise exception 'Bu ayarı değiştirme yetkiniz yok (%)', k using errcode = '42501';
      end if;

    elsif k in (
      'case_types', 'case_statuses', 'expense_types', 'reminder_types', 'document_categories',
      'fee_kinds', 'payment_methods', 'enforcement_statuses', 'enforcement_types', 'contact_channels',
      'courts', 'enforcement_offices', 'enforcement_stop_reasons', 'inquiry_types', 'seizure_types',
      'result_types', 'enforcement_event_types'
    ) then
      old_arr := array(select jsonb_array_elements_text(o -> k));
      new_arr := array(select jsonb_array_elements_text(n -> k));
      added   := exists (select 1 from unnest(new_arr) x where x <> all (old_arr));
      removed := exists (select 1 from unnest(old_arr) x where x <> all (new_arr));
      if added and not app.can('settings_categories', 'create') then
        raise exception 'Listeye değer ekleme yetkiniz yok (%)', k using errcode = '42501';
      end if;
      if removed and not app.can('settings_categories', 'delete') then
        raise exception 'Listeden değer silme yetkiniz yok (%)', k using errcode = '42501';
      end if;
      if not added and not removed and not app.can('settings_categories', 'edit') then
        raise exception 'Bu ayarı değiştirme yetkiniz yok (%)', k using errcode = '42501';
      end if;

    elsif k in ('seizure_valid_months', 'seizure_reminder_days', 'closed_case_retention_months') then
      if not app.can('settings_categories', 'edit') then
        raise exception 'Bu ayarı değiştirme yetkiniz yok (%)', k using errcode = '42501';
      end if;

    elsif k = 'company_lists' then
      old_map := coalesce((select jsonb_object_agg(e ->> 'id', e) from jsonb_array_elements(o -> k) e), '{}'::jsonb);
      new_map := coalesce((select jsonb_object_agg(e ->> 'id', e) from jsonb_array_elements(n -> k) e), '{}'::jsonb);
      added   := exists (select 1 from jsonb_object_keys(new_map) i where not old_map ? i);
      removed := exists (select 1 from jsonb_object_keys(old_map) i where not new_map ? i);
      changed := exists (select 1 from jsonb_each(new_map) j where old_map ? j.key and old_map -> j.key is distinct from j.value);
      if added and not app.can('settings_companies', 'create') then
        raise exception 'Şirket listesi ekleme yetkiniz yok' using errcode = '42501';
      end if;
      if removed and not app.can('settings_companies', 'delete') then
        raise exception 'Şirket listesi silme yetkiniz yok' using errcode = '42501';
      end if;
      if changed and not app.can('settings_companies', 'edit') then
        raise exception 'Şirket listesini düzenleme yetkiniz yok' using errcode = '42501';
      end if;
      -- yalnızca sıra değiştiyse düzenleme sayılır
      if not added and not removed and not changed and not app.can('settings_companies', 'edit') then
        raise exception 'Şirket listesini düzenleme yetkiniz yok' using errcode = '42501';
      end if;

    else
      raise exception 'Bu ayarı yalnızca yönetici değiştirebilir (%)', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_guard_settings on public.org_settings;
create trigger trg_guard_settings before update on public.org_settings
  for each row execute function app.guard_settings_update();

-- ---- Büro adı: "Büro bilgileri → Düzenle" izni olan yalnızca adı değiştirebilir -------------------
drop policy if exists organizations_update_name on public.organizations;
create policy organizations_update_name on public.organizations for update to authenticated
  using (id = app.current_org_id() and app.can('settings_firm', 'edit'))
  with check (id = app.current_org_id());

create or replace function app.guard_org_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
begin
  if auth.uid() is null or app.is_admin() then return new; end if;
  for k in select jsonb_object_keys(n) loop
    if k in ('name', 'updated_at') or n -> k is not distinct from o -> k then continue; end if;
    raise exception 'Bu alanı yalnızca yönetici değiştirebilir (%)', k using errcode = '42501';
  end loop;
  return new;
end $$;
drop trigger if exists trg_guard_org on public.organizations;
create trigger trg_guard_org before update on public.organizations
  for each row execute function app.guard_org_update();

-- ---- my_permissions: bütün anahtarlar ------------------------------------------------------------
create or replace function public.my_permissions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(m || '.' || a, app.can(m, a)), '{}'::jsonb)
  from (
    values
      ('clients','view'),('clients','create'),('clients','edit'),('clients','delete'),
      ('cases','view'),('cases','create'),('cases','edit'),('cases','delete'),
      ('documents','view'),('documents','create'),('documents','edit'),('documents','delete'),
      ('expenses','view'),('expenses','create'),('expenses','edit'),('expenses','delete'),
      ('reminders','view'),('reminders','create'),('reminders','edit'),('reminders','delete'),
      ('enforcements','view'),('enforcements','create'),('enforcements','edit'),('enforcements','delete'),
      ('fees','view'),('fees','create'),('fees','edit'),('fees','delete'),
      ('ledger','view'),
      ('accounts','view'),('accounts','create'),('accounts','edit'),('accounts','delete'),
      ('reports','view'),
      ('activity','view'),
      ('statements','view'),
      ('settings_firm','view'),('settings_firm','edit'),
      ('settings_categories','view'),('settings_categories','create'),('settings_categories','edit'),('settings_categories','delete'),
      ('settings_companies','view'),('settings_companies','create'),('settings_companies','edit'),('settings_companies','delete'),
      ('settings_users','view'),('settings_users','create'),('settings_users','edit'),
      ('settings_backup','view')
  ) as t(m, a)
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

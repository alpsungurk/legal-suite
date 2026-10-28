-- =====================================================================================
-- Duruşma katılımı seçenekleri (haftalık duruşma listesinde "Katılacak avukat")
--   - org_settings.hearing_attendance: avukatların yanında seçilen seçenekler. Varsayılan
--     "Mazeret" ve "Mazeret (hakim yokluğu)"; büro Ayarlar → Kategoriler'den ekler / siler
--     (ör. "Tevkil", "E-duruşma"). "Mazeret" silinemez.
--   - Kategori izni (settings_categories) diğer listelerle aynı şekilde uygulanır.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.org_settings add column if not exists hearing_attendance text[] not null
  default '{Mazeret,"Mazeret (hakim yokluğu)"}';

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
      'result_types', 'enforcement_event_types', 'enforcement_close_reasons', 'claim_types', 'bank_answer_types',
      'hearing_attendance'
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

    elsif k in ('seizure_valid_months', 'seizure_reminder_days', 'closed_case_retention_months',
                'bank_response_days', 'salary_response_days', 'procedures') then
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
      if (changed or (not added and not removed)) and not app.can('settings_companies', 'edit') then
        raise exception 'Şirket listesini düzenleme yetkiniz yok' using errcode = '42501';
      end if;

    else
      raise exception 'Bu ayarı yalnızca yönetici değiştirebilir (%)', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

create or replace function app.keep_locked_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.case_statuses := app.with_locked(new.case_statuses,
    array['Açık', 'Derdest', 'Kanun yolu', 'Kapalı']);
  new.fee_kinds := app.with_locked(new.fee_kinds, array['Aylık ücret']);
  new.enforcement_statuses := app.with_locked(new.enforcement_statuses,
    array['Açık', 'Durdurulmuş', 'Kapalı', 'İşlem Yapılmayacak', 'Tahsil edildi']);
  new.enforcement_close_reasons := app.with_locked(new.enforcement_close_reasons, array['İnfaz']);
  new.enforcement_event_types := app.with_locked(new.enforcement_event_types, array[
    'Ödeme emri tebliği', 'Kesinleşme', 'Sorgu', 'Haciz', 'Maaş haczi tebliği',
    '89/1 haciz ihbarnamesi', '89/2 haciz ihbarnamesi', '89/3 haciz ihbarnamesi',
    'Borçlu ekleme talebi', 'Tahliye talebi']);
  new.reminder_types := app.with_locked(new.reminder_types, array['Duruşma', 'Keşif', 'Diğer']);
  new.hearing_attendance := app.with_locked(new.hearing_attendance, array['Mazeret']);
  return new;
end $$;

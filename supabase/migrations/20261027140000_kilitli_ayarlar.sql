-- =====================================================================================
-- Ayarlar → Kategoriler: programın kullandığı (kilitli) değerler sunucuda da silinemez
--   Arayüz bu değerlerde silme düğmesi göstermez; bu tetikleyici API'den ya da eski bir
--   ekrandan gelen güncellemede de eksik kilitli değeri listeye geri ekler.
--   Liste src/lib/erp-types.ts'deki LOCKED_* sabitleriyle aynı tutulmalı.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

-- Listede olmayan kilitli değerler (kendi sıralarıyla) sona eklenir
create or replace function app.with_locked(p_list text[], p_locked text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(p_list, '{}'::text[]) || coalesce(array(
    select u.x from unnest(p_locked) with ordinality as u(x, ord)
    where not (u.x = any (coalesce(p_list, '{}'::text[])))
    order by u.ord
  ), '{}'::text[])
$$;

create or replace function app.keep_locked_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.case_statuses := app.with_locked(new.case_statuses, array['Açık', 'Kapalı']);
  new.fee_kinds := app.with_locked(new.fee_kinds, array['Aylık ücret']);
  new.enforcement_statuses := app.with_locked(new.enforcement_statuses,
    array['Açık', 'Durdurulmuş', 'Kapalı', 'İşlem Yapılmayacak', 'Tahsil edildi']);
  new.enforcement_close_reasons := app.with_locked(new.enforcement_close_reasons, array['İnfaz']);
  new.enforcement_event_types := app.with_locked(new.enforcement_event_types, array[
    'Ödeme emri tebliği', 'Kesinleşme', 'Sorgu', 'Haciz', 'Maaş haczi tebliği',
    '89/1 haciz ihbarnamesi', '89/2 haciz ihbarnamesi', '89/3 haciz ihbarnamesi',
    'Borçlu ekleme talebi', 'Tahliye talebi']);
  return new;
end $$;

drop trigger if exists trg_keep_locked_settings on public.org_settings;
create trigger trg_keep_locked_settings before insert or update on public.org_settings
  for each row execute function app.keep_locked_settings();

-- Mevcut bürolarda daha önce silinmiş kilitli değerler geri gelir
select set_config('app.skip_audit', '1', true);
update public.org_settings set case_statuses = case_statuses;
select set_config('app.skip_audit', '', true);

-- =====================================================================================
-- Kilitli ayar değerlerine eklemeler (programın doğrudan kullandığı değerler)
--   - Dosya durumları: "Derdest" ve "Kanun yolu" (Dosyalar sayfasındaki kartlarda sayılır)
--   - Ajanda türleri: "Duruşma", "Keşif" (haftalık duruşma listesi) ve "Diğer" (yedek tür)
--   Liste src/lib/erp-types.ts'deki LOCKED_* sabitleriyle aynı tutulmalı.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

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
  return new;
end $$;

-- Mevcut bürolarda daha önce silinmiş kilitli değerler geri gelir
select set_config('app.skip_audit', '1', true);
update public.org_settings set case_statuses = case_statuses;
select set_config('app.skip_audit', '', true);

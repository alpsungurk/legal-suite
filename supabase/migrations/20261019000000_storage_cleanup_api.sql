-- =====================================================================================
-- Storage temizliği Storage API'ye taşındı
--   Supabase artık storage.objects'ten doğrudan DELETE'e izin vermiyor (storage.protect_delete).
--   cron_retention bu yüzden tamamen geri alınıyordu (bildirim / aktivite temizliği de çalışmıyordu).
--   - cron_retention: storage.objects silme kaldırıldı; sıra artık 1 gün sonra kör silinmez
--   - app.cron_storage_cleanup: pg_net ile storage-cleanup Edge Function'ını tetikler
--     (fonksiyon service_role ile Storage API'den siler ve işlenen satırları sıradan düşürür)
-- Tekrar çalıştırılabilir.
-- =====================================================================================

create or replace function app.cron_storage_cleanup() returns text
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text; v_id bigint;
begin
  if not exists (select 1 from public.storage_cleanup) then
    return 'sıra boş';
  end if;
  select value into v_url from app.config where key = 'project_url';
  select value into v_key from app.config where key = 'anon_key';
  if v_url is null or v_key is null then
    raise notice 'storage-cleanup: app.config içinde project_url / anon_key tanımlı değil; istek atılmadı';
    return 'ayarlanmadı';
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'storage-cleanup: pg_net uzantısı kapalı; Database > Extensions > pg_net''i açın';
    return 'pg_net yok';
  end if;
  execute format(
    'select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 30000)',
    rtrim(v_url, '/') || '/functions/v1/storage-cleanup',
    '{}',
    jsonb_build_object('apikey', v_key, 'Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json')::text
  ) into v_id;
  return 'gönderildi #' || v_id;
end $$;
revoke all on function app.cron_storage_cleanup() from public, anon, authenticated;

create or replace function app.cron_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record; v_year int; v_through int; n int;
  v_notif int := 0; v_act int := 0; v_arch int := 0; v_storage int := 0;
begin
  perform set_config('app.skip_audit', '1', true);
  -- Okunmuş bildirimler 30 gün, okunmamışlar 120 gün tutulur
  delete from public.notifications where (read and created_at < now() - interval '30 days') or created_at < now() - interval '120 days';
  get diagnostics n = row_count; v_notif := n;

  for r in select id, timezone, retention_months, auto_archive_keep_years, last_auto_archive_year
           from public.organizations where active loop
    delete from public.activities where org_id = r.id and created_at < now() - make_interval(months => r.retention_months);
    get diagnostics n = row_count; v_act := v_act + n;

    -- Otomatik arşiv: yılda bir kez; "N tam yıl tut" → bundan eski yıllar arşivlenir
    if r.auto_archive_keep_years is not null then
      v_year := extract(year from (now() at time zone r.timezone))::int;
      v_through := v_year - r.auto_archive_keep_years - 1;
      if v_through >= 2000 and coalesce(r.last_auto_archive_year, 0) < v_year then
        v_arch := v_arch + app.archive_org(r.id, v_through);
        update public.organizations set last_auto_archive_year = v_year where id = r.id;
      end if;
    end if;
  end loop;

  -- Yüklenip hiçbir kayda bağlanmamış (form iptal edilmiş) ekler 2 gün sonra silinir
  delete from public.attachments where entity_id is null and entity <> 'logo' and created_at < now() - interval '2 days'
    and not exists (select 1 from public.documents d where d.attachment_id = public.attachments.id);

  -- pg_cron çalışma geçmişi şişmesin (14 günden eskisi silinir)
  if to_regclass('cron.job_run_details') is not null then
    execute $q$delete from cron.job_run_details where end_time < now() - interval '14 days'$q$;
  end if;

  -- Storage: dosyalar SQL ile silinemez; sıradakileri storage-cleanup Edge Function'ı Storage API ile siler.
  -- pg_net isteği işlem commit edildikten sonra gider, yani yukarıda sıraya girenler de dahil olur.
  select count(*)::int into v_storage from public.storage_cleanup;
  perform app.cron_storage_cleanup();

  return jsonb_build_object('notifications', v_notif, 'activities', v_act, 'archived', v_arch, 'storage_queue', v_storage);
end $$;

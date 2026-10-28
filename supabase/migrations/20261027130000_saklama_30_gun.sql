-- =====================================================================================
-- Saklama süreleri 30 gün
--   - Bildirimler (okunmuş ya da okunmamış) 30 gün sonra silinir (eskiden 30 / 120 gün).
--   - Tamamlanan / iptal edilen ajanda kayıtları (kontrol hatırlatmaları dahil) son
--     değişiklikten 30 gün sonra silinir. Bekleyen kayıtlara dokunulmaz.
-- Haftalık saklama işi (lexkasa-saklama) çalıştırır. Tekrar çalıştırılabilir.
-- =====================================================================================

create or replace function app.cron_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record; v_year int; v_through int; n int;
  v_notif int := 0; v_rem int := 0; v_arch int := 0; v_storage int := 0;
begin
  perform set_config('app.skip_audit', '1', true);
  delete from public.notifications where created_at < now() - interval '30 days';
  get diagnostics n = row_count; v_notif := n;

  delete from public.reminders where status <> 'Bekliyor' and updated_at < now() - interval '30 days';
  get diagnostics n = row_count; v_rem := n;

  for r in select id, timezone, retention_months, auto_archive_keep_years, last_auto_archive_year
           from public.organizations where active loop
    if r.auto_archive_keep_years is not null then
      v_year := extract(year from (now() at time zone r.timezone))::int;
      v_through := v_year - r.auto_archive_keep_years - 1;
      if v_through >= 2000 and coalesce(r.last_auto_archive_year, 0) < v_year then
        v_arch := v_arch + app.archive_org(r.id, v_through);
        update public.organizations set last_auto_archive_year = v_year where id = r.id;
      end if;
    end if;
  end loop;

  delete from public.attachments where entity_id is null and entity <> 'logo' and created_at < now() - interval '2 days'
    and not exists (select 1 from public.documents d where d.attachment_id = public.attachments.id);

  if to_regclass('cron.job_run_details') is not null then
    execute $q$delete from cron.job_run_details where end_time < now() - interval '14 days'$q$;
  end if;

  select count(*)::int into v_storage from public.storage_cleanup;
  perform app.cron_storage_cleanup();

  return jsonb_build_object('notifications', v_notif, 'reminders', v_rem, 'archived', v_arch, 'storage_queue', v_storage);
end $$;
revoke all on function app.cron_retention() from public, anon, authenticated;

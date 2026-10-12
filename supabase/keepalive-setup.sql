-- Bir kerelik: keepalive + sabit haftalık cron.
-- SQL Editor'de (postgres) çalıştırın. pg_cron + pg_net açık olmalı.
-- Saatler sabittir (disk I/O için esnek UI yok):
--   Aylık ücret  Pzt 00:10 TR
--   Bildirimler  Pzt 08:00 TR
--   Saklama      Pzt 03:30 TR
--   Keepalive    5 günde bir 09:00 TR

create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into app.config (key, value) values
  ('project_url', 'https://cflkynimfesmztxfurxl.supabase.co'),
  ('anon_key',    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbGt5bmltZmVzbXp0eGZ1cnhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4Mjk1MDUsImV4cCI6MjEwNzQwNTUwNX0.zv547bz_cwCxVDGBnHdsF4Mzxk4Rhkg4K-qlEfGqrtE')
on conflict (key) do update set value = excluded.value;

-- Eski esnek-UI RPC'leri (varsa)
drop function if exists public.set_cron_job(text, text);
drop function if exists public.list_cron_jobs();

-- Eski job'ları silip sabit programla kur
select cron.unschedule(jobid) from cron.job
  where jobname in ('lexkasa-aylik-ucret', 'lexkasa-bildirimler', 'lexkasa-saklama', 'lexkasa-keepalive');

select cron.schedule('lexkasa-aylik-ucret',  '10 21 * * 0', 'select app.cron_accrue_fees()');      -- Pzt 00:10 TR
select cron.schedule('lexkasa-bildirimler', '0 5 * * 1',   'select app.cron_notifications()');    -- Pzt 08:00 TR
select cron.schedule('lexkasa-saklama',     '30 0 * * 1',  'select app.cron_retention()');        -- Pzt 03:30 TR
select cron.schedule('lexkasa-keepalive',   '0 6 */5 * *', 'select app.cron_keepalive()');        -- 5 günde bir

select app.cron_keepalive();

select jobname, schedule from cron.job order by jobname;

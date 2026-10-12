-- Esnek cron UI kaldırıldı: list/set RPC'lerini düşür (daha önce kurulduysa).
-- Zamanlamalar sabittir; bkz. lexkasa_init.sql / keepalive-setup.sql.

drop function if exists public.set_cron_job(text, text);
drop function if exists public.list_cron_jobs();

-- =====================================================================================
-- Kullanıcı yönetimini avukata verebilme (isteğe bağlı: Ayarlar → İzinler → Kullanıcılar → Ekle / Düzenle)
--
--   Ekle (settings_users.create):  avukat rolünde yeni kullanıcı ekleyebilir (Edge Function: invite-user)
--   Düzenle (settings_users.edit): başka avukatların bilgilerini (ad, ünvan, telefon, kullanıcı adı) değiştirebilir,
--                                  pasife alabilir / etkinleştirebilir, geçici şifre verebilir
--   Görüntüle (settings_users.view): kullanıcı listesini görür
--   ✘ Admin hesaplarına dokunamaz, kimseyi Admin yapamaz,
--   ✘ izin (permissions) ve e-posta değiştiremez,
--   ✘ kendi rolünü / aktifliğini değiştiremez, kullanıcı silemez.
-- Böylece yetki yükseltme (kendini ya da başkasını Admin yapma) mümkün değildir; kural veritabanında zorunludur.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

-- Başkalarının (Admin olmayan) profillerini güncelleme
drop policy if exists profiles_update_managed on public.profiles;
create policy profiles_update_managed on public.profiles for update to authenticated
  using (
    org_id = app.current_org_id() and app.can('settings_users', 'edit')
    and role <> 'admin' and id <> auth.uid()
  )
  with check (org_id = app.current_org_id() and role <> 'admin');

-- Yönetici olmayan kullanıcı hangi alanı değiştirebilir?
--   kendi profilinde: yalnızca ad / telefon / ünvan
--   izin, büro, e-posta: kimse (Admin hariç)
--   rol / aktiflik / kullanıcı adı: yalnızca "kullanıcı yönetimi" izni olan, kendisi dışındaki avukat hesaplarında
create or replace function app.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not app.is_admin() then
    if new.permissions is distinct from old.permissions
       or new.org_id is distinct from old.org_id
       or new.email is distinct from old.email then
      raise exception 'Bu alanları yalnızca yönetici değiştirebilir' using errcode = '42501';
    end if;
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.username is distinct from old.username then
      if old.id = auth.uid() or old.role = 'admin' or new.role = 'admin'
         or not app.can('settings_users', 'edit') then
        raise exception 'Bu alanları yalnızca yönetici değiştirebilir' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;

-- my_permissions: yeni anahtar (Edge Function da bu fonksiyonla yetkiyi doğrular)
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

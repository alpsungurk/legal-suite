-- Auth kullanıcısını büro admin'i yap (SQL Editor, postgres).
-- User id: auth.users'dan alındı.

do $$
declare
  v_uid   uuid := 'b008a140-ce39-41c6-9278-7a604da991c1';
  v_email text;
  v_name  text;
  v_user  text;
  v_org   uuid;
begin
  select email,
         coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
         lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9çğıöşü._-]', '', 'gi'))
    into v_email, v_name, v_user
  from auth.users
  where id = v_uid;

  if v_email is null then
    raise exception 'auth.users içinde bu id yok: %', v_uid;
  end if;

  if length(v_user) < 3 then
    v_user := 'admin';
  end if;
  -- kullanıcı adı çakışırsa benzersizleştir
  while exists (
    select 1 from public.profiles p where lower(p.username) = v_user and p.id <> v_uid
  ) loop
    v_user := v_user || '1';
  end loop;

  perform set_config('app.skip_audit', '1', true);
  perform set_config('app.bootstrap', '1', true);

  if exists (select 1 from public.profiles where id = v_uid) then
    -- Profil var → admin yap, org_id'yi al
    update public.profiles
       set role = 'admin',
           active = true,
           email = coalesce(v_email, email),
           name = coalesce(nullif(btrim(name), ''), v_name),
           username = case
             when username is null or btrim(username) = '' then v_user
             else username
           end
     where id = v_uid
     returning org_id into v_org;

    update public.organizations set active = true where id = v_org;
    raise notice 'Mevcut profil admin yapıldı. org_id = %', v_org;
  else
    -- Profil yok → yeni büro + admin
    insert into public.organizations (name)
    values ('LexKasa Büro')
    returning id into v_org;

    insert into public.org_settings (org_id, firm)
    values (
      v_org,
      jsonb_build_object(
        'name', 'LexKasa Büro',
        'legalName', 'LexKasa Büro',
        'email', v_email,
        'phone', ''
      )
    );

    insert into public.profiles (id, org_id, name, username, email, phone, title, role, active)
    values (v_uid, v_org, v_name, v_user, v_email, null, 'Büro sahibi', 'admin', true);

    -- Kasa hesapları yoksa ekle
    if not exists (select 1 from public.accounts where org_id = v_org) then
      insert into public.accounts (org_id, name, type, created_by) values
        (v_org, 'Büro Kasası', 'Kasa', v_uid),
        (v_org, 'Barokart', 'Banka', v_uid);
    end if;

    raise notice 'Yeni büro kuruldu. org_id = %  username = %', v_org, v_user;
  end if;

  perform set_config('app.bootstrap', '', true);
end $$;

-- Kontrol
select
  p.id as user_id,
  p.org_id,
  p.username,
  p.email,
  p.role,
  p.active,
  o.name as org_name
from public.profiles p
join public.organizations o on o.id = p.org_id
where p.id = 'b008a140-ce39-41c6-9278-7a604da991c1';

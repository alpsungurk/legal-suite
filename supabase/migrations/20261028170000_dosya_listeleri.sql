-- =====================================================================================
-- Hukuk / ceza / idare dosya listeleri
--   - cases.fee_status: vekalet ücreti durumu (alındı, icrada, istendi, yok, CMK…)
--   - org_settings.case_fee_statuses: bu durumların büroca düzenlenen listesi
--   - Dosya türleri "Hukuk", "Ceza", "İdare" (Dosyalar sayfasındaki sekmeler) ve dosya durumları
--     "İstinafta", "Temyizde" eklenir ve silinemez.
--   - import_batch dava dosyalarında fee_status'u da yazar (tamamı yeniden tanımlanır).
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.cases add column if not exists fee_status text;
alter table public.org_settings add column if not exists case_fee_statuses text[] not null
  default '{"Vekalet ücreti alındı","Vekalet ücreti icrada","Vekalet ücreti istendi","Vekalet ücreti yok","CMK vekalet ücreti alınacak",CMK}';

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
      'hearing_attendance', 'case_fee_statuses'
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
    array['Açık', 'Derdest', 'Kanun yolu', 'İstinafta', 'Temyizde', 'Kapalı']);
  new.case_types := app.with_locked(new.case_types, array['Hukuk', 'Ceza', 'İdare']);
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

-- Mevcut bürolarda yeni kilitli türler ve durumlar listeye eklenir
select set_config('app.skip_audit', '1', true);
update public.org_settings set case_statuses = case_statuses;
select set_config('app.skip_audit', '', true);

create or replace function public.import_batch(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := app.current_org_id();
  v_actor uuid := auth.uid();
  v_clients int := 0;
  v_debtors int := 0;
  v_banks int := 0;
  v_cases int := 0;
  v_expenses int := 0;
  v_enforcements int := 0;
  v_links int := 0;
  v_reminders int := 0;
  v_arr jsonb;
  v_ids uuid[];
begin
  if v_org is null then
    raise exception 'Büro bulunamadı' using errcode = 'P0001';
  end if;
  if v_actor is null then
    raise exception 'Oturum gerekli' using errcode = 'P0001';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Geçersiz aktarım verisi' using errcode = '22023';
  end if;

  -- ── Müvekkiller ────────────────────────────────────────────────────────────
  v_arr := coalesce(p_payload->'clients', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('clients', 'create') then
      raise exception 'Müvekkil aktarma yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.clients as t (
      id, org_id, name, kind, email, phone, status, identity, tax_office, address, notes,
      monthly_fee, monthly_fee_start_date, created_by
    )
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'name', '')),
      coalesce(nullif(r->>'kind', ''), 'Bireysel'),
      coalesce(r->>'email', ''),
      coalesce(r->>'phone', ''),
      coalesce(nullif(r->>'status', ''), 'Aktif'),
      nullif(r->>'identity', ''),
      nullif(r->>'tax_office', ''),
      nullif(r->>'address', ''),
      nullif(r->>'notes', ''),
      nullif(r->>'monthly_fee', '')::numeric,
      nullif(r->>'monthly_fee_start_date', '')::date,
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null and btrim(coalesce(r->>'name', '')) <> ''
    on conflict (id) do update set
      name = excluded.name,
      kind = excluded.kind,
      email = excluded.email,
      phone = excluded.phone,
      status = excluded.status,
      identity = excluded.identity,
      tax_office = excluded.tax_office,
      address = excluded.address,
      notes = excluded.notes,
      monthly_fee = excluded.monthly_fee,
      monthly_fee_start_date = excluded.monthly_fee_start_date,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_clients = row_count;
  end if;

  -- ── Borçlular / karşı taraf ────────────────────────────────────────────────
  v_arr := coalesce(p_payload->'debtors', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('enforcements', 'create') then
      raise exception 'Borçlu / icra aktarma yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.debtors as t (
      id, org_id, name, kind, identity, phone, email, address, assets, notes, created_by
    )
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'name', '')),
      coalesce(nullif(r->>'kind', ''), 'Bireysel'),
      nullif(r->>'identity', ''),
      nullif(r->>'phone', ''),
      nullif(r->>'email', ''),
      nullif(r->>'address', ''),
      nullif(r->>'assets', ''),
      nullif(r->>'notes', ''),
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null and btrim(coalesce(r->>'name', '')) <> ''
    on conflict (id) do update set
      name = excluded.name,
      kind = excluded.kind,
      identity = excluded.identity,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address,
      assets = excluded.assets,
      notes = excluded.notes,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_debtors = row_count;
  end if;

  -- ── Bankalar ───────────────────────────────────────────────────────────────
  v_arr := coalesce(p_payload->'banks', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('settings_categories', 'create') then
      raise exception 'Banka listesi aktarma yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.banks as t (id, org_id, name, active, created_by)
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'name', '')),
      coalesce((r->>'active')::boolean, true),
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null and btrim(coalesce(r->>'name', '')) <> ''
    on conflict (id) do update set
      name = excluded.name,
      active = excluded.active,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_banks = row_count;
  end if;

  -- ── Dosyalar ───────────────────────────────────────────────────────────────
  v_arr := coalesce(p_payload->'cases', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('cases', 'create') then
      raise exception 'Dosya aktarma yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.cases as t (
      id, org_id, no, title, client_id, court, esas_no, type, status,
      responsible_ids, opposing_party, opening_date, closing_date, agreed_fee, note, fee_status,
      created_by
    )
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'no', '')),
      btrim(coalesce(r->>'title', '')),
      nullif(r->>'client_id', '')::uuid,
      nullif(r->>'court', ''),
      nullif(r->>'esas_no', ''),
      coalesce(nullif(r->>'type', ''), 'Dava'),
      coalesce(nullif(r->>'status', ''), 'Açık'),
      coalesce(
        (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(r->'responsible_ids', '[]'::jsonb)) as x),
        '{}'::uuid[]
      ),
      nullif(r->>'opposing_party', ''),
      coalesce(nullif(r->>'opening_date', '')::date, current_date),
      nullif(r->>'closing_date', '')::date,
      nullif(r->>'agreed_fee', '')::numeric,
      nullif(r->>'note', ''),
      nullif(r->>'fee_status', ''),
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null and btrim(coalesce(r->>'no', '')) <> ''
    on conflict (id) do update set
      no = excluded.no,
      title = excluded.title,
      client_id = excluded.client_id,
      court = excluded.court,
      esas_no = excluded.esas_no,
      type = excluded.type,
      status = excluded.status,
      responsible_ids = excluded.responsible_ids,
      opposing_party = excluded.opposing_party,
      opening_date = excluded.opening_date,
      closing_date = excluded.closing_date,
      agreed_fee = excluded.agreed_fee,
      note = excluded.note,
      fee_status = excluded.fee_status,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_cases = row_count;
  end if;

  -- ── Masraflar ──────────────────────────────────────────────────────────────
  v_arr := coalesce(p_payload->'expenses', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('expenses', 'create') then
      raise exception 'Masraf aktarma yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.expenses as t (
      id, org_id, title, type, amount, date, case_id, enforcement_id, client_id,
      charge_to, paid_by, account_id, note, created_by
    )
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'title', '')),
      btrim(coalesce(r->>'type', '')),
      coalesce(nullif(r->>'amount', '')::numeric, 0),
      coalesce(nullif(r->>'date', '')::date, current_date),
      nullif(r->>'case_id', '')::uuid,
      nullif(r->>'enforcement_id', '')::uuid,
      nullif(r->>'client_id', '')::uuid,
      coalesce(nullif(r->>'charge_to', ''), 'Müvekkil'),
      coalesce(nullif(r->>'paid_by', ''), 'Büro'),
      nullif(r->>'account_id', '')::uuid,
      nullif(r->>'note', ''),
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null and btrim(coalesce(r->>'title', '')) <> ''
    on conflict (id) do update set
      title = excluded.title,
      type = excluded.type,
      amount = excluded.amount,
      date = excluded.date,
      case_id = excluded.case_id,
      enforcement_id = excluded.enforcement_id,
      client_id = excluded.client_id,
      charge_to = excluded.charge_to,
      paid_by = excluded.paid_by,
      account_id = excluded.account_id,
      note = excluded.note,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_expenses = row_count;
  end if;

  -- ── İcra dosyaları + borçlu bağları ────────────────────────────────────────
  v_arr := coalesce(p_payload->'enforcements', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('enforcements', 'create') then
      raise exception 'İcra aktarma yetkiniz yok' using errcode = '42501';
    end if;
    if not app.can('enforcements', 'edit') and exists (
      select 1 from jsonb_array_elements(v_arr) r
      join public.enforcements e on e.id = (r->>'id')::uuid and e.org_id = v_org
    ) then
      raise exception 'Kayıtlı icra dosyalarını güncelleme yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.enforcements as t (
      id, org_id, no, office, type, side, client_id, principal, interest, costs,
      status, stop_reason, close_reason, "procedure", opening_date, responsible_ids,
      case_id, details, last_seizure_date, note, created_by
    )
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'no', '')),
      btrim(coalesce(r->>'office', '')),
      coalesce(r->>'type', ''),
      coalesce(nullif(r->>'side', ''), 'Alacaklı'),
      (r->>'client_id')::uuid,
      coalesce(nullif(r->>'principal', '')::numeric, 0),
      coalesce(nullif(r->>'interest', '')::numeric, 0),
      coalesce(nullif(r->>'costs', '')::numeric, 0),
      coalesce(nullif(r->>'status', ''), 'Açık'),
      nullif(r->>'stop_reason', ''),
      nullif(r->>'close_reason', ''),
      nullif(r->>'procedure', ''),
      coalesce(nullif(r->>'opening_date', '')::date, current_date),
      coalesce(
        (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(r->'responsible_ids', '[]'::jsonb)) as x),
        '{}'::uuid[]
      ),
      nullif(r->>'case_id', '')::uuid,
      nullif(r->>'details', ''),
      nullif(r->>'last_seizure_date', '')::date,
      nullif(r->>'note', ''),
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null
      and btrim(coalesce(r->>'no', '')) <> ''
      and btrim(coalesce(r->>'office', '')) <> ''
      and nullif(r->>'client_id', '') is not null
    on conflict (id) do update set
      no = excluded.no,
      office = excluded.office,
      type = excluded.type,
      side = excluded.side,
      client_id = excluded.client_id,
      principal = excluded.principal,
      interest = excluded.interest,
      costs = excluded.costs,
      status = excluded.status,
      stop_reason = excluded.stop_reason,
      close_reason = excluded.close_reason,
      "procedure" = excluded."procedure",
      opening_date = excluded.opening_date,
      responsible_ids = excluded.responsible_ids,
      case_id = excluded.case_id,
      details = excluded.details,
      last_seizure_date = excluded.last_seizure_date,
      note = excluded.note,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_enforcements = row_count;

    select coalesce(array_agg((r->>'id')::uuid), '{}'::uuid[])
      into v_ids
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null;

    if cardinality(v_ids) > 0 then
      delete from public.enforcement_debtors ed
      where ed.org_id = v_org and ed.enforcement_id = any (v_ids);

      insert into public.enforcement_debtors (org_id, enforcement_id, debtor_id)
      select distinct v_org, (r->>'id')::uuid, d::uuid
      from jsonb_array_elements(v_arr) r
      cross join lateral jsonb_array_elements_text(coalesce(r->'debtor_ids', '[]'::jsonb)) as d
      where r->>'id' is not null and nullif(d, '') is not null
      on conflict do nothing;
      get diagnostics v_links = row_count;
    end if;
  end if;

  -- ── Ajanda (duruşma listesi) ───────────────────────────────────────────────
  v_arr := coalesce(p_payload->'reminders', '[]'::jsonb);
  if jsonb_typeof(v_arr) = 'array' and jsonb_array_length(v_arr) > 0 then
    if not app.can('reminders', 'create') then
      raise exception 'Ajanda aktarma yetkiniz yok' using errcode = '42501';
    end if;
    insert into public.reminders as t (
      id, org_id, title, type, date, time, location, case_id, client_id, enforcement_id,
      assignee_id, status, note, case_no, parties, excuse, created_by
    )
    select
      (r->>'id')::uuid,
      v_org,
      btrim(coalesce(r->>'title', '')),
      coalesce(nullif(r->>'type', ''), 'Diğer'),
      (r->>'date')::date,
      nullif(r->>'time', '')::time,
      nullif(r->>'location', ''),
      nullif(r->>'case_id', '')::uuid,
      nullif(r->>'client_id', '')::uuid,
      nullif(r->>'enforcement_id', '')::uuid,
      coalesce(nullif(r->>'assignee_id', '')::uuid, v_actor),
      coalesce(nullif(r->>'status', ''), 'Bekliyor'),
      nullif(r->>'note', ''),
      nullif(r->>'case_no', ''),
      nullif(r->>'parties', ''),
      nullif(r->>'excuse', ''),
      v_actor
    from jsonb_array_elements(v_arr) r
    where r->>'id' is not null
      and btrim(coalesce(r->>'title', '')) <> ''
      and nullif(r->>'date', '') is not null
    on conflict (id) do update set
      title = excluded.title,
      type = excluded.type,
      date = excluded.date,
      time = excluded.time,
      location = excluded.location,
      case_id = excluded.case_id,
      client_id = excluded.client_id,
      enforcement_id = excluded.enforcement_id,
      assignee_id = excluded.assignee_id,
      status = excluded.status,
      note = excluded.note,
      case_no = excluded.case_no,
      parties = excluded.parties,
      excuse = excluded.excuse,
      updated_at = now()
    where t.org_id = v_org;
    get diagnostics v_reminders = row_count;
  end if;

  return jsonb_build_object(
    'clients', v_clients,
    'debtors', v_debtors,
    'banks', v_banks,
    'cases', v_cases,
    'expenses', v_expenses,
    'enforcements', v_enforcements,
    'enforcement_debtors', v_links,
    'reminders', v_reminders,
    'total', v_clients + v_debtors + v_banks + v_cases + v_expenses + v_enforcements + v_reminders
  );
end;
$$;

revoke all on function public.import_batch(jsonb) from public, anon;
grant execute on function public.import_batch(jsonb) to authenticated;

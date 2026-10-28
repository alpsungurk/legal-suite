-- =====================================================================================
-- Excel toplu aktarım: tek RPC ile JSON batch yazma (PostgREST satır satır upsert yok).
-- Tekrar çalıştırılabilir.
-- =====================================================================================

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
      responsible_ids, opposing_party, opening_date, closing_date, agreed_fee, note, created_by
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
      coalesce(nullif(r->>'type', ''), 'İlamsız'),
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

  return jsonb_build_object(
    'clients', v_clients,
    'debtors', v_debtors,
    'banks', v_banks,
    'cases', v_cases,
    'expenses', v_expenses,
    'enforcements', v_enforcements,
    'enforcement_debtors', v_links,
    'total', v_clients + v_debtors + v_banks + v_cases + v_expenses + v_enforcements
  );
end;
$$;

revoke all on function public.import_batch(jsonb) from public, anon;
grant execute on function public.import_batch(jsonb) to authenticated;

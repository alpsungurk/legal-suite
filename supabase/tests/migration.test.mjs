/* eslint-disable */
import { PGlite } from "@electric-sql/pglite";
process.on("uncaughtException", (e) => { console.log(R.join("\n")); console.log("\nHATA:", String(e.message).slice(0, 400), e.detail ? "| " + String(e.detail).slice(0, 300) : ""); process.exit(2); });
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Migration, gerçek bir PostgreSQL (PGlite) üzerinde çalıştırılıp RLS, izinler ve iş fonksiyonları sınanır.
// Çalıştırma: npm run test:db
const MIGRATION = fileURLToPath(new URL("../migrations/20261012000000_lexkasa_init.sql", import.meta.url));
const R = [];
const ok = (n, c, x = "") => R.push(`${c ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`);

const db = new PGlite();

// ── Supabase'in sağladığı parçaların taklidi
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text default auth.uid()::text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage to authenticated; grant select, insert, delete on storage.objects to authenticated;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated, anon;
`);

// ── Migration (iki kez: tekrar çalıştırılabilirlik)
const sql = readFileSync(MIGRATION, "utf8");
let migErr = null;
try { await db.exec(sql); } catch (e) { migErr = e; }
ok("migration çalıştı", !migErr, migErr ? migErr.message : "");
if (migErr) { console.log(R.join("\n")); process.exit(1); }
let again = null;
try { await db.exec(sql); } catch (e) { again = e; }
ok("migration ikinci kez de çalışıyor (tekrar edilebilir)", !again, again ? again.message : "");

// İcra geri bildirim migration'ı (init'ten sonra, iki kez)
const ICRA = fileURLToPath(new URL("../migrations/20261016000000_icra_geri_bildirim.sql", import.meta.url));
const icraSql = readFileSync(ICRA, "utf8");
let icraErr = null;
try { await db.exec(icraSql); await db.exec(icraSql); } catch (e) { icraErr = e; }
ok("icra migration'ı çalıştı (iki kez)", !icraErr, icraErr ? icraErr.message : "");
if (icraErr) { console.log(R.join("\n")); process.exit(1); }
const AYAR = fileURLToPath(new URL("../migrations/20261016130000_ayarlar_izinleri.sql", import.meta.url));
const ayarSql = readFileSync(AYAR, "utf8");
let ayarErr = null;
try { await db.exec(ayarSql); await db.exec(ayarSql); } catch (e) { ayarErr = e; }
ok("ayarlar izinleri migration'ı çalıştı (iki kez)", !ayarErr, ayarErr ? ayarErr.message : "");
if (ayarErr) { console.log(R.join("\n")); process.exit(1); }
const KULLANICI = fileURLToPath(new URL("../migrations/20261016140000_kullanici_yonetimi_devri.sql", import.meta.url));
const kullaniciSql = readFileSync(KULLANICI, "utf8");
let kullaniciErr = null;
try { await db.exec(kullaniciSql); await db.exec(kullaniciSql); } catch (e) { kullaniciErr = e; }
ok("kullanıcı yönetimi devri migration'ı çalıştı (iki kez)", !kullaniciErr, kullaniciErr ? kullaniciErr.message : "");
if (kullaniciErr) { console.log(R.join(String.fromCharCode(10))); process.exit(1); }
const SURE = fileURLToPath(new URL("../migrations/20261016150000_icra_sureler.sql", import.meta.url));
const sureSql = readFileSync(SURE, "utf8");
let sureErr = null;
try { await db.exec(sureSql); await db.exec(sureSql); } catch (e) { sureErr = e; }
ok("icra süreleri migration'ı çalıştı (iki kez)", !sureErr, sureErr ? sureErr.message : "");
if (sureErr) { console.log(R.join(String.fromCharCode(10))); process.exit(1); }
const KAPALI = fileURLToPath(new URL("../migrations/20261016120000_kapali_dosya_saklama.sql", import.meta.url));
const kapaliSql = readFileSync(KAPALI, "utf8");
let kapaliErr = null;
try { await db.exec(kapaliSql); await db.exec(kapaliSql); } catch (e) { kapaliErr = e; }
ok("kapalı dosya migration'ı çalıştı (iki kez)", !kapaliErr, kapaliErr ? kapaliErr.message : "");
if (kapaliErr) { console.log(R.join("\n")); process.exit(1); }
const STCL = fileURLToPath(new URL("../migrations/20261019000000_storage_cleanup_api.sql", import.meta.url));
const stclSql = readFileSync(STCL, "utf8");
let stclErr = null;
try { await db.exec(stclSql); await db.exec(stclSql); } catch (e) { stclErr = e; }
ok("storage temizliği migration'ı çalıştı (iki kez)", !stclErr, stclErr ? stclErr.message : "");
if (stclErr) { console.log(R.join("\n")); process.exit(1); }
// Supabase gibi: storage.objects'ten doğrudan SQL silme yasak (cron_retention buna takılmamalı)
await db.exec(`
  create function storage.protect_delete() returns trigger language plpgsql as $$
  begin raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'; end $$;
  create trigger protect_objects_delete before delete on storage.objects for each statement execute function storage.protect_delete();
`);

const q = async (text, params) => (await db.query(text, params)).rows;
const one = async (text, params) => (await q(text, params))[0];
const asUser = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const asAnon = async (fn) => {
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
};
const fails = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

// ── Kullanıcılar
const newUser = async (email) => (await one(`insert into auth.users (email) values ($1) returning id`, [email])).id;
const A = await newUser("a@a.com"), B = await newUser("b@b.com");
const orgA = await asUser(A, async () => (await one(`select public.create_organization('A Hukuk','Ayşe Admin','ayse','0532') as id`)).id);
const orgB = await asUser(B, async () => (await one(`select public.create_organization('B Hukuk','Bora Admin','bora') as id`)).id);
ok("iki büro kuruldu", orgA && orgB && orgA !== orgB);
ok("büro kurulunca Kasa + Barokart hesabı", (await one(`select count(*)::int c from public.accounts where org_id=$1`, [orgA])).c === 2);
ok("admin profili", (await one(`select role from public.profiles where id=$1`, [A])).role === "admin");
ok("aynı kullanıcı ikinci büro kuramaz", await fails(() => asUser(A, () => q(`select public.create_organization('X','Y','yyy')`)), /zaten bir büroya/));
const Cx = await newUser("c@c.com"), Dx = await newUser("d@d.com");
ok("kullanıcı adı benzersiz (başka büroda da)", await fails(() => asUser(Cx, () => q(`select public.create_organization('C','C Kişi','ayse')`)), /alınmış/));
ok("kötü kullanıcı adı reddedildi", await fails(() => asUser(Dx, () => q(`select public.create_organization('D','D Kişi','a b')`)), /en az 3 karakter/));

// Avukatlar (profil ekleme service_role/superuser ile)
const S = await newUser("selin@a.com"), U = await newUser("buse@a.com");
await db.exec(`
  insert into public.profiles (id, org_id, name, username, email, role) values
   ('${S}', '${orgA}', 'Selin', 'selin', 'selin@a.com', 'avukat'),
   ('${U}', '${orgA}', 'Buse',  'buse',  'buse@a.com',  'avukat');
`);

// ── Temel veri (admin A)
const clientA = await asUser(A, async () => (await one(`insert into public.clients (name, kind, monthly_fee, monthly_fee_start_date) values ('Kaya Holding','Kurumsal', 25000, current_date - 90) returning id`)).id);
const client2 = await asUser(A, async () => (await one(`insert into public.clients (name) values ('Mehmet Kaya') returning id`)).id);
ok("org_id otomatik (varsayılan)", (await one(`select org_id from public.clients where id=$1`, [clientA])).org_id === orgA);
const spoof = await asUser(A, async () => (await one(`insert into public.clients (org_id, name) values ($1,'Sızma') returning org_id`, [orgB])).org_id);
ok("başka büro adına kayıt açılamaz (org_id zorlanır)", spoof === orgA);
const caseA = await asUser(A, async () => (await one(`insert into public.cases (no, title, client_id, court) values ('2026/001','Alacak davası',$1,'İstanbul 3. Asliye') returning id`, [clientA])).id);
ok("başka bürodaki müvekkile bağlanamaz (bileşik FK)", await fails(() => asUser(B, () => q(`insert into public.cases (no, title, client_id) values ('2026/009','Sızma',$1)`, [clientA]))));

// ── Büro izolasyonu
ok("B bürosu A'nın müvekkillerini görmez", (await asUser(B, () => q(`select * from public.clients`))).length === 0);
ok("B, A'nın kaydını güncelleyemez", (await asUser(B, () => q(`update public.clients set name='Hack' where id=$1 returning id`, [clientA]))).length === 0);
ok("B, A'nın kaydını silemez", (await asUser(B, () => q(`delete from public.clients where id=$1 returning id`, [clientA]))).length === 0);
ok("B, A'nın ayarlarını görmez", (await asUser(B, () => q(`select * from public.org_settings where org_id=$1`, [orgA]))).length === 0);
ok("B, A'nın profillerini görmez", (await asUser(B, () => q(`select * from public.profiles where org_id=$1`, [orgA]))).length === 0);
ok("anon hiçbir tabloyu okuyamaz", await fails(() => asAnon(() => q(`select * from public.clients`)), /permission denied/));
ok("anon resolve_login çağırabilir", (await asAnon(() => one(`select public.resolve_login('SELIN') as e`))).e === "selin@a.com");
ok("anon RPC (close_case) çağıramaz", await fails(() => asAnon(() => q(`select public.close_case('${caseA}')`)), /permission denied/));

// ── Avukat varsayılan izinleri
ok("avukat müvekkil görür", (await asUser(S, () => q(`select * from public.clients`))).length >= 2);
ok("avukat müvekkil ekleyebilir", (await asUser(S, () => q(`insert into public.clients (name) values ('Selin Müvekkil') returning id`))).length === 1);
ok("avukat müvekkil silemez", (await asUser(S, () => q(`delete from public.clients where name='Selin Müvekkil' returning id`))).length === 0);
ok("avukat tahsilat planı göremez", (await asUser(S, () => q(`select * from public.fee_plans`))).length === 0);
ok("avukat tahsilat planı ekleyemez", await fails(() => asUser(S, () => q(`insert into public.fee_plans (title, client_id, total) values ('x',$1,100)`, [clientA])), /row-level security/));
ok("avukat hesapları göremez", (await asUser(S, () => q(`select * from public.accounts`))).length === 0);
ok("avukat bakiye görünümünden satır alamaz", (await asUser(S, () => q(`select * from public.v_account_balances`))).length === 0);
ok("avukat cari görünümünden satır alamaz", (await asUser(S, () => q(`select * from public.v_client_balances`))).length === 0);
ok("avukat hesap seçeneklerini görür (masraf formu)", (await asUser(S, () => q(`select * from public.account_options()`))).length === 2);
ok("avukat aktiviteyi göremez (tablo varken RLS)", (await asUser(S, () => q(`select * from public.activities`))).length === 0);
ok("avukat ayarları okur ama değiştiremez", (await asUser(S, () => q(`select * from public.org_settings`))).length === 1
  && (await asUser(S, () => q(`update public.org_settings set courts='{x}' returning org_id`))).length === 0);
ok("avukat izinlerini göremez/değiştiremez (profil)", await fails(() => asUser(S, () => q(`update public.profiles set role='admin' where id='${S}'`)), /yalnızca yönetici/));
ok("avukat kendi adını değiştirebilir", (await asUser(S, () => q(`update public.profiles set name='Selin Aras' where id='${S}' returning id`))).length === 1);
ok("avukat başkasının profilini değiştiremez", (await asUser(S, () => q(`update public.profiles set name='Hack' where id='${U}' returning id`))).length === 0);
ok("avukat org ayarlarını (büro) değiştiremez", (await asUser(S, () => q(`update public.organizations set name='Hack' where id='${orgA}' returning id`))).length === 0);
const perms = await asUser(S, () => one(`select public.my_permissions() p`));
ok("my_permissions: avukat", perms.p["clients.create"] === true && perms.p["fees.view"] === false && perms.p["expenses.view"] === false && perms.p["expenses.create"] === true);
const permsA = await asUser(A, () => one(`select public.my_permissions() p`));
ok("my_permissions: admin her şey", Object.values(permsA.p).every((v) => v === true));

// ── Masraflar: kendi girdiğini görür
const expS = await asUser(S, async () => (await one(`insert into public.expenses (title, type, amount, case_id, charge_to, paid_by, account_id) values ('Harç','Harç',500,$1,'Müvekkil','Büro',(select id from public.accounts where org_id='${orgA}' and type='Kasa')) returning id`, [caseA])).id);
ok("avukat masraf girdi (created_by = kendisi)", (await one(`select created_by from public.expenses where id=$1`, [expS])).created_by === S);
ok("avukat başkası adına masraf giremez", await fails(() => asUser(S, () => q(`insert into public.expenses (title,type,amount,charge_to,paid_by,created_by) values ('x','Harç',1,'Büro','Büro','${U}')`)), /row-level security/));
ok("avukat kendi masrafını görür", (await asUser(S, () => q(`select * from public.expenses`))).length === 1);
ok("diğer avukat onu göremez", (await asUser(U, () => q(`select * from public.expenses`))).length === 0);
ok("admin görür", (await asUser(A, () => q(`select * from public.expenses`))).length === 1);
ok("avukat kendi masrafını düzenler", (await asUser(S, () => q(`update public.expenses set note='n' where id=$1 returning id`, [expS]))).length === 1);
ok("diğer avukat düzenleyemez", (await asUser(U, () => q(`update public.expenses set note='h' where id=$1 returning id`, [expS]))).length === 0);
ok("masraf müvekkil+dosya kuralı", await fails(() => asUser(A, () => q(`insert into public.expenses (title,type,amount,charge_to,paid_by) values ('x','Harç',1,'Müvekkil','Büro')`)), /check/i));

// ── Ekler / makbuz
const att = await asUser(S, async () => (await one(`insert into public.attachments (name, mime, size, storage_path, entity, entity_id) values ('makbuz.pdf','application/pdf',1000,'${orgA}/f1','expense',$1) returning id`, [expS])).id);
ok("makbuz eklendi", !!att);
ok("yanlış büro klasörlü ek reddedilir", await fails(() => asUser(S, () => q(`insert into public.attachments (name,storage_path) values ('x','${orgB}/f2')`))));
ok("masraf silinince makbuz künyesi de silinir + Storage sırasına girer", await (async () => {
  await asUser(S, () => q(`delete from public.expenses where id=$1`, [expS]));
  return (await one(`select count(*)::int c from public.attachments where id=$1`, [att])).c === 0 && (await one(`select count(*)::int c from public.storage_cleanup`)).c === 1;
})());

// ── İzin istisnası (kişiye özel)
await db.exec(`update public.profiles set permissions='{"clients.view": false}' where id='${S}'`);
ok("istisna: Selin müvekkil göremez", (await asUser(S, () => q(`select * from public.clients`))).length === 0);
ok("istisna: görmediği şeyi ekleyemez (bağlı izin)", await fails(() => asUser(S, () => q(`insert into public.clients (name) values ('x')`)), /row-level security/));
ok("istisna: Buse etkilenmedi", (await asUser(U, () => q(`select * from public.clients`))).length >= 2);
await db.exec(`update public.profiles set permissions='{"fees.view": true}' where id='${S}'`);
ok("istisna: Selin tahsilatları görebilir", (await asUser(S, () => q(`select * from public.fee_plans`))).length === 0 && (await asUser(S, () => one(`select app.can('fees') c`))).c === true);
await db.exec(`update public.profiles set permissions='{}' where id='${S}'`);

// ── Rol varsayılanı değişince
await asUser(A, () => q(`update public.org_settings set role_permissions = role_permissions || '{"cases.view": false}'::jsonb`));
ok("rol varsayılanı kapatılınca avukat dosya göremez", (await asUser(U, () => q(`select * from public.cases`))).length === 0);
await asUser(A, () => q(`update public.org_settings set role_permissions = role_permissions || '{"cases.view": true}'::jsonb`));

// ── Tahsilat planı + ödeme dağıtımı
const plan = await asUser(A, async () => (await one(`insert into public.fee_plans (title, client_id, case_id, total) values ('Vekalet',$1,$2,3000) returning id`, [clientA, caseA])).id);
const inst = [];
for (let i = 1; i <= 3; i++)
  inst.push(await asUser(A, async () => (await one(`insert into public.installments (plan_id, position, due_date, amount) values ($1,$2,current_date + ($2 - 2) * 10, 1000) returning id`, [plan, i])).id));
const kasa = (await one(`select id from public.accounts where org_id='${orgA}' and type='Kasa'`)).id;
ok("2. taksite 1500 → 2. ve 3. taksite dağıtılır", await (async () => {
  const n = await asUser(A, async () => (await one(`select public.record_installment_payment($1,$2,1500,current_date,'Nakit',$3,null) n`, [plan, inst[1], kasa])).n);
  const rows = await asUser(A, () => q(`select position, paid, remaining, status from public.v_installments where plan_id=$1 order by position`, [plan]));
  return n === 2 && rows[1].status === "Ödendi" && Number(rows[2].paid) === 500 && Number(rows[0].paid) === 0;
})());
ok("fazla ödeme son taksite yazılır", await (async () => {
  await asUser(A, () => q(`select public.record_installment_payment($1,$2,5000,current_date,'Nakit',null,null)`, [plan, inst[0]]));
  const t = await one(`select sum(p.amount) s from public.installment_payments p join public.installments i on i.id=p.installment_id where i.plan_id=$1`, [plan]);
  return Number(t.s) === 6500;
})());
ok("avukat tahsilat alamaz", await fails(() => asUser(U, () => q(`select public.record_installment_payment($1,$2,10,current_date,'Nakit',null,null)`, [plan, inst[0]])), /yetkiniz yok/));
ok("negatif tutar reddedilir", await fails(() => asUser(A, () => q(`select public.record_installment_payment($1,$2,-5,current_date,'Nakit',null,null)`, [plan, inst[0]])), /sıfırdan büyük/));
// geri al
await db.exec(`delete from public.installment_payments where amount = 5000 - 0 and false`);

// ── Cari ve hesap bakiyeleri
const bal = await asUser(A, () => q(`select * from public.v_client_balances where client_id=$1`, [clientA]));
// borç: masraf 500 (Selin silindi → masraf yok) + plan 3000; alacak: ödemeler 6500
ok("cari bakiye: 3000 borç − 6500 ödeme", Number(bal[0].debit) === 3000 && Number(bal[0].credit) === 6500 && Number(bal[0].balance) === -3500 && bal[0].status === "Alacaklı", JSON.stringify(bal[0]));
const accBal = await asUser(A, () => one(`select balance from public.v_account_balances where id=$1`, [kasa]));
ok("kasa bakiyesi: sadece 1500 tahsilat girdi", Number(accBal.balance) === 1500, JSON.stringify(accBal));

// ── Aylık ücret
const n1 = await asUser(A, async () => (await one(`select public.accrue_monthly_fees() n`)).n);
ok("aylık ücret oluşturuldu", n1 === 1, String(n1));
const n2 = await asUser(A, async () => (await one(`select public.accrue_monthly_fees() n`)).n);
ok("ikinci çalıştırma yinelemez", n2 === 0);
ok("cron: yinelemez", (await one(`select app.cron_accrue_fees() n`)).n === 0);
ok("avukat aylık ücret oluşturamaz", await fails(() => asUser(U, () => q(`select public.accrue_monthly_fees()`)), /yetkiniz yok/));
ok("aynı dönem ikinci plan engellenir (benzersiz indeks)", await fails(() => asUser(A, () => q(`insert into public.fee_plans (title, kind, client_id, total, period) values ('x','Aylık ücret',$1,1, to_char(current_date,'YYYY-MM'))`, [clientA]))));

// ── Dosya kapatma: bakiyeler korunur
const exp2 = await asUser(A, async () => (await one(`insert into public.expenses (title,type,amount,case_id,charge_to,paid_by,account_id,date) values ('Bilirkişi','Bilirkişi',700,$1,'Müvekkil','Büro',$2,current_date) returning id`, [caseA, kasa])).id);
await asUser(A, () => q(`insert into public.reminders (title,type,date,case_id) values ('Duruşma','Duruşma',current_date + 3,$1)`, [caseA]));
const before = {
  client: Number((await asUser(A, () => one(`select balance from public.v_client_balances where client_id=$1`, [clientA]))).balance),
  kasa: Number((await asUser(A, () => one(`select balance from public.v_account_balances where id=$1`, [kasa]))).balance),
};
ok("avukat dosya kapatamaz", await fails(() => asUser(U, () => q(`select public.close_case('${caseA}')`)), /yetkiniz yok/));
const closed = await asUser(A, () => one(`select public.close_case('${caseA}') r`));
const after = {
  client: Number((await asUser(A, () => one(`select balance from public.v_client_balances where client_id=$1`, [clientA]))).balance),
  kasa: Number((await asUser(A, () => one(`select balance from public.v_account_balances where id=$1`, [kasa]))).balance),
};
ok("dosya kapatma: cari bakiye aynı", Math.abs(before.client - after.client) < 0.005, `${before.client} → ${after.client}`);
ok("dosya kapatma: kasa bakiyesi aynı", Math.abs(before.kasa - after.kasa) < 0.005, `${before.kasa} → ${after.kasa}`);
ok("dosya ve bağlı kayıtlar silindi", (await q(`select 1 from public.cases where id='${caseA}'`)).length === 0 && (await q(`select 1 from public.expenses where case_id='${caseA}'`)).length === 0 && (await q(`select 1 from public.reminders where case_id='${caseA}'`)).length === 0);
ok("kapanan dosya özeti müvekkilde", await (async () => {
  const c = await one(`select closed_case_count n, closed_receivable r, closed_payable p, closed_fee_total ft from public.clients where id=$1`, [clientA]);
  return c.n === 1 && Number(c.ft) === 3000 && (Number(c.r) > 0 || Number(c.p) > 0);
})(), JSON.stringify(closed.r));
ok("yıllık özete eklendi", await (async () => {
  const y = await one(`select fee_income, client_expense, closed_cases from public.yearly_stats where org_id='${orgA}' and year = extract(year from current_date)::int`);
  return Number(y.fee_income) === 6500 && Number(y.client_expense) === 700 && y.closed_cases === 1;
})());
ok("kapatma aktivite kaydı (kaldırılmadan önce)", (await asUser(A, () => q(`select * from public.activities where entity='Dosya' and detail like 'Dosya kapatıldı%'`))).length === 1);

// ── Arşiv: eski yıl verisi
await db.exec(`
  insert into public.expenses (org_id,title,type,amount,charge_to,paid_by,account_id,client_id,date,created_by)
    values ('${orgA}','Eski harç','Harç',1000,'Müvekkil','Büro','${kasa}','${client2}','2024-05-01','${A}'),
           ('${orgA}','Eski kira','Ofis gideri',400,'Büro','Büro','${kasa}',null,'2024-06-01','${A}');
  insert into public.account_transactions (org_id,account_id,date,amount,category,description) values ('${orgA}','${kasa}','2024-06-01',500,'Diğer gelir','Eski gelir');
  insert into public.fee_plans (id,org_id,title,client_id,date,total) values ('00000000-0000-0000-0000-0000000000a1','${orgA}','Eski vekalet','${client2}','2024-03-01',3000);
  insert into public.installments (id,org_id,plan_id,position,due_date,amount) values ('00000000-0000-0000-0000-0000000000b1','${orgA}','00000000-0000-0000-0000-0000000000a1',1,'2024-03-01',3000);
  insert into public.installment_payments (org_id,installment_id,date,amount,method,account_id) values ('${orgA}','00000000-0000-0000-0000-0000000000b1','2024-03-10',3000,'Nakit','${kasa}');
  insert into public.reminders (org_id,title,type,date,status,assignee_id) values ('${orgA}','Eski görev','Toplantı','2024-02-01','Tamamlandı','${A}');
`);
const pre = {
  cli: Object.fromEntries((await asUser(A, () => q(`select client_id, balance from public.v_client_balances`))).map((r) => [r.client_id, Number(r.balance)])),
  acc: Object.fromEntries((await asUser(A, () => q(`select id, balance from public.v_account_balances`))).map((r) => [r.id, Number(r.balance)])),
};
ok("avukat arşivleyemez", await fails(() => asUser(U, () => q(`select public.archive_years(2024)`)), /yalnızca yönetici/));
ok("içinde bulunulan yıl arşivlenemez", await fails(() => asUser(A, () => q(`select public.archive_years(extract(year from current_date)::int)`)), /geçmiş yıllar/));
const deleted = await asUser(A, async () => (await one(`select public.archive_years(2024) n`)).n);
const post = {
  cli: Object.fromEntries((await asUser(A, () => q(`select client_id, balance from public.v_client_balances`))).map((r) => [r.client_id, Number(r.balance)])),
  acc: Object.fromEntries((await asUser(A, () => q(`select id, balance from public.v_account_balances`))).map((r) => [r.id, Number(r.balance)])),
};
ok("arşiv: kayıt silindi", deleted >= 5, String(deleted));
ok("arşiv: tüm hesap bakiyeleri aynı", Object.keys(pre.acc).every((k) => Math.abs(pre.acc[k] - post.acc[k]) < 0.005), JSON.stringify([pre.acc, post.acc]));
ok("arşiv: tüm cari bakiyeler aynı", Object.keys(pre.cli).every((k) => Math.abs(pre.cli[k] - post.cli[k]) < 0.005), JSON.stringify([pre.cli, post.cli]));
ok("arşiv: 2024 toplamı kaldı", await (async () => {
  const y = await asUser(A, () => one(`select * from public.yearly_stats where year=2024`));
  return Number(y.fee_income) === 3000 && Number(y.client_expense) === 1000 && Number(y.office_expense) === 400 && Number(y.other_income) === 500;
})());
ok("arşiv: 2024 detayı yok", (await q(`select 1 from public.expenses where date < '2025-01-01'`)).length === 0);
ok("arşiv: avukat yıllık özeti göremez, admin görür", (await asUser(U, () => q(`select * from public.yearly_stats`))).length === 0 && (await asUser(A, () => q(`select * from public.yearly_stats`))).length >= 1);

// ── Bildirimler (cron)
await db.exec(`
  insert into public.fee_plans (id, org_id, title, client_id, total) values ('00000000-0000-0000-0000-0000000000c1','${orgA}','Yeni plan','${client2}',800);
  insert into public.installments (org_id, plan_id, position, due_date, amount) values ('${orgA}','00000000-0000-0000-0000-0000000000c1',1,current_date - 5, 800);
  insert into public.reminders (org_id,title,type,date,assignee_id) values ('${orgA}','Yarın duruşma','Duruşma', current_date + 1, '${S}');
`);
const c1 = (await one(`select app.cron_notifications() n`)).n;
ok("bildirimler üretildi", c1 >= 2, String(c1));
ok("admin geciken taksit bildirimi aldı", (await asUser(A, () => q(`select * from public.notifications where dedupe_key like 'inst-overdue:%'`))).length >= 1);
ok("avukat taksit bildirimi almadı (izni yok)", (await asUser(U, () => q(`select * from public.notifications where type='Taksit'`))).length === 0);
ok("sorumlusu ajanda bildirimi aldı", (await asUser(S, () => q(`select * from public.notifications where type='Ajanda'`))).length === 1);
ok("kimse başkasının bildirimini görmez", (await asUser(U, () => q(`select * from public.notifications`))).length === 0);
const c2 = (await one(`select app.cron_notifications() n`)).n;
ok("ikinci çalıştırma yinelemez", c2 === 0, String(c2));
ok("bildirimi okundu yapabilir", (await asUser(S, () => q(`update public.notifications set read=true where type='Ajanda' returning id`))).length === 1);

// ── Saklama süresi + otomatik arşiv
await db.exec(`
  insert into public.notifications (org_id,user_id,title,created_at,read) values ('${orgA}','${A}','eski bildirim', now() - interval '60 days', true);
  insert into public.activities (org_id,action,entity,detail,created_at) values ('${orgA}','İşlem','Test','çok eski', now() - interval '30 months');
  update public.organizations set retention_months = 24, auto_archive_keep_years = 1 where id='${orgA}';
  insert into public.expenses (org_id,title,type,amount,charge_to,paid_by,date,created_by) values ('${orgA}','2023 gideri','Harç',50,'Büro','Büro','2023-03-03','${A}');
`);
const ret = (await one(`select app.cron_retention() r`)).r;
ok("saklama: Storage sırası Edge Function için korunur", ret.storage_queue >= 1 && (await one(`select count(*)::int c from public.storage_cleanup`)).c === ret.storage_queue, JSON.stringify(ret));
ok("saklama: eski okunmuş bildirim silindi", (await q(`select 1 from public.notifications where title='eski bildirim'`)).length === 0);
ok("saklama: 24 aydan eski aktivite silindi", (await q(`select 1 from public.activities where detail='çok eski'`)).length === 0);
ok("otomatik arşiv: yıl-1'den eski yıllar", (await q(`select 1 from public.expenses where title='2023 gideri'`)).length === 0 && ret.archived >= 1, JSON.stringify(ret));
ok("otomatik arşiv yılda bir kez", (await one(`select app.cron_retention() r`)).r.archived === 0);
ok("2023 toplamı yıllık özette", Number((await one(`select office_expense o from public.yearly_stats where org_id='${orgA}' and year=2023`)).o) === 50);

// ── Denetim kaydı
ok("denetim: admin değişiklikleri kayıtlı", (await asUser(A, () => q(`select * from public.activities where entity='Müvekkil'`))).length >= 2);
ok("denetim: güncelleme alan farkını tutar", await (async () => {
  await asUser(A, () => q(`update public.clients set phone='0555' where id=$1`, [client2]));
  const r = await asUser(A, () => one(`select changes from public.activities where entity='Müvekkil' and changes ? 'phone' order by created_at desc limit 1`));
  return r?.changes?.phone?.after === "0555";
})());
ok("aktivite kaydı istemciden yazılamaz", await fails(() => asUser(A, () => q(`insert into public.activities (org_id,action,entity) values ('${orgA}','İşlem','Sahte')`)), /permission denied/));

// ── Admin koruması
ok("son admin pasife alınamaz", await fails(() => asUser(A, () => q(`update public.profiles set active=false where id='${A}'`)), /son yöneticisi/));
ok("son admin avukata çevrilemez", await fails(() => asUser(A, () => q(`update public.profiles set role='avukat' where id='${A}'`)), /son yöneticisi/));
ok("admin kendini silemez", (await asUser(A, () => q(`delete from public.profiles where id='${A}' returning id`))).length === 0);
await asUser(A, () => q(`update public.profiles set role='admin' where id='${U}'`));
ok("ikinci admin atanınca ilki düşürülebilir", (await asUser(A, () => q(`update public.profiles set role='avukat' where id='${A}' returning id`))).length === 1);
await db.exec(`update public.profiles set role='admin' where id='${A}'; update public.profiles set role='avukat' where id='${U}'`);
ok("admin avukatın iznini değiştirebilir", (await asUser(A, () => q(`update public.profiles set permissions='{"reports.view":true}' where id='${U}' returning id`))).length === 1);
ok("pasif kullanıcı hiçbir şey göremez", await (async () => {
  await db.exec(`update public.profiles set active=false where id='${U}'`);
  const r = (await asUser(U, () => q(`select * from public.clients`))).length === 0;
  await db.exec(`update public.profiles set active=true where id='${U}'`);
  return r;
})());
ok("askıya alınan büro erişemez", await (async () => {
  await db.exec(`update public.organizations set active=false where id='${orgB}'`);
  const r = (await asUser(B, () => q(`select * from public.clients`))).length === 0 && (await asUser(B, () => one(`select app.current_org_id() o`))).o === null;
  await db.exec(`update public.organizations set active=true where id='${orgB}'`);
  return r;
})());

// ── Storage kuralları
ok("storage: kova özel", (await one(`select public from storage.buckets where id='attachments'`)).public === false);
ok("storage: kendi büro klasörüne yükleme", (await asUser(A, () => q(`insert into storage.objects (bucket_id,name) values ('attachments','${orgA}/ok1') returning name`))).length === 1);
ok("storage: yükleyen kendi dosyasını görür, başkası (metadata yokken) göremez", (await asUser(A, () => q(`select name from storage.objects where name='${orgA}/ok1'`))).length === 1 && (await asUser(U, () => q(`select name from storage.objects where name='${orgA}/ok1'`))).length === 0);
await db.exec(`insert into public.attachments (org_id,name,storage_path,entity) values ('${orgA}','ok1','${orgA}/ok1','document')`);
ok("storage: künye görünür olunca büro içinde okunur (belge izni)", (await asUser(U, () => q(`select name from storage.objects where name='${orgA}/ok1'`))).length === 1);
ok("storage: başka büro okuyamaz", (await asUser(B, () => q(`select name from storage.objects where name='${orgA}/ok1'`))).length === 0);
ok("storage: başka büro klasörüne yükleme reddedilir", await fails(() => asUser(A, () => q(`insert into storage.objects (bucket_id,name) values ('attachments','${orgB}/hack')`)), /row-level security/));

// ── İcra: taraf, yeni alanlar, işlem geçmişi, haciz hatırlatması
const debtorA = await asUser(A, async () => (await one(`insert into public.debtors (name) values ('Borçlu Bir') returning id`)).id);
const enfNew = (no, extra = "", vals = "") =>
  asUser(A, async () => (await one(`insert into public.enforcements (no, office, client_id${extra}) values ('${no}','Ankara 1. İcra',$1${vals}) returning *`, [clientA])));
const e1 = await enfNew("2026/1 E.");
ok("icra: varsayılan taraf alacaklı, durum Açık", e1.side === "Alacaklı" && e1.status === "Açık", `${e1.side} ${e1.status}`);
ok("icra: geçersiz taraf reddedilir", await fails(() => enfNew("2026/2 E.", ", side", ",'Hepsi'"), /check/i));
const st = await asUser(A, () => one(`select enforcement_statuses s, seizure_valid_months m, seizure_reminder_days d, inquiry_types i, company_lists c from public.org_settings`));
ok("ayarlar: yeni durumlar başta, süre 12 ay / 14 gün, 7 sorgu türü", st.s.slice(0, 3).join(",") === "Açık,Durdurulmuş,Kapalı" && st.m === 12 && st.d === 14 && st.i.length === 7 && Array.isArray(st.c), JSON.stringify(st.s));
await db.exec(`update public.org_settings set enforcement_statuses='{Derdest,Kapandı}' where org_id='${orgB}'`);
await db.exec(icraSql);
ok("migration: eski büronun durum listesine ana durumlar eklenir, eskiler korunur",
  (await one(`select enforcement_statuses s from public.org_settings where org_id='${orgB}'`)).s.join(",") === "Açık,Durdurulmuş,Kapalı,Derdest,Kapandı");
ok("ayarlar: haciz süresi sınır dışı reddedilir", await fails(() => asUser(A, () => q(`update public.org_settings set seizure_valid_months = 0`)), /check/i));
ok("işlem geçmişi: avukat ekleyebilir", (await asUser(U, () => q(`insert into public.enforcement_events (enforcement_id, debtor_id, date, type, inquiry_type, result) values ($1,$2,current_date,'Sorgu','Banka','Olumsuz') returning id`, [e1.id, debtorA]))).length === 1);
ok("işlem geçmişi: başka büro göremez", (await asUser(B, () => q(`select * from public.enforcement_events`))).length === 0);
ok("işlem geçmişi: denetim kaydına 'İcra işlemi' olarak girer", (await asUser(A, () => q(`select * from public.activities where entity='İcra işlemi'`))).length === 1);
ok("işlem geçmişi: dosya silinince işlemler de silinir", await (async () => {
  const tmp = await enfNew("2026/99 E.");
  await asUser(A, () => q(`insert into public.enforcement_events (enforcement_id, type) values ($1,'Haciz')`, [tmp.id]));
  await asUser(A, () => q(`delete from public.enforcements where id=$1`, [tmp.id]));
  return (await q(`select 1 from public.enforcement_events where enforcement_id=$1`, [tmp.id])).length === 0;
})());
// Hatırlatma senaryoları: son haciz + 12 ay - 14 gün ≤ bugün olanlar
const soon = `(current_date - interval '12 months' + interval '10 days')::date`;
await enfNew("2026/10 E.", ", last_seizure_date, responsible_ids", `, ${soon}, array['${S}']::uuid[]`);
await enfNew("2026/11 E.", ", last_seizure_date", `, ${soon}`);
await enfNew("2026/12 E.", ", last_seizure_date, side, responsible_ids", `, ${soon}, 'Borçlu', array['${S}']::uuid[]`);
await enfNew("2026/13 E.", ", last_seizure_date, status, responsible_ids", `, ${soon}, 'Kapalı', array['${S}']::uuid[]`);
await enfNew("2026/14 E.", ", last_seizure_date, responsible_ids", `, current_date - 30, array['${S}']::uuid[]`);
// Haczi bugün düşen dosya (son haciz tam 12 ay önce)
await enfNew("2026/15 E.", ", last_seizure_date, responsible_ids", `, (current_date - interval '12 months')::date, array['${U}']::uuid[]`);
const hz1 = (await one(`select app.cron_seizure_reminders() n`)).n;
const hzS = await asUser(S, () => q(`select title, detail from public.notifications where type='Haciz'`));
const hzA = await asUser(A, () => q(`select detail from public.notifications where type='Haciz'`));
const hzU = await asUser(U, () => q(`select title, detail from public.notifications where type='Haciz'`));
ok("haciz: sorumluya bildirim (yalnızca açık + alacaklı + süresi yaklaşan)", hzS.length === 1 && hzS[0].detail.startsWith("2026/10 E.") && /10 gün kaldı/.test(hzS[0].title), JSON.stringify(hzS));
ok("haciz: sorumlusu olmayan dosya yöneticiye gider", hzA.length === 1 && hzA[0].detail.startsWith("2026/11 E."), JSON.stringify(hzA));
ok("haciz: düşme günü ayrıca 'Haciz bugün düşüyor' bildirimi", hzU.length === 1 && hzU[0].title === "Haciz bugün düşüyor" && hzU[0].detail.startsWith("2026/15 E."), JSON.stringify(hzU));
ok("haciz: ikinci çalıştırma yinelemez", (await one(`select app.cron_seizure_reminders() n`)).n === 0 && hz1 === 3, String(hz1));
await db.exec(`delete from public.notifications where type='Haciz'`);
ok("haciz: bildirimler saklama ile silinse de yeniden gönderilmez", (await one(`select app.cron_seizure_reminders() n`)).n === 0);
await db.exec(`update public.enforcements set last_seizure_date = (current_date - interval '12 months' + interval '5 days')::date where no='2026/10 E.'`);
ok("haciz: son haciz tarihi değişince yeni tarih için yeniden hatırlatır", (await one(`select app.cron_seizure_reminders() n`)).n === 1
  && /5 gün kaldı/.test((await asUser(S, () => one(`select title from public.notifications where type='Haciz'`))).title));
ok("haciz: gönderim kayıtları istemciye kapalı", await fails(() => asUser(A, () => q(`select * from public.seizure_notices`)), /permission denied/));
ok("haciz: istemci cron fonksiyonunu çağıramaz", await fails(() => asUser(A, () => q(`select app.cron_seizure_reminders()`)), /permission denied/));

// ── Kapalı dava dosyası: hemen silinmez, saklama süresi dolunca gece işi siler
const kc = async (no) => (await asUser(A, async () => (await one(`insert into public.cases (no, title, client_id) values ('${no}','Kapanacak dosya',$1) returning id`, [client2])).id));
const kOld = await kc("2025/900"), kNew = await kc("2025/901");
await asUser(A, () => q(`insert into public.expenses (title,type,amount,case_id,charge_to,paid_by,account_id) values ('Harç','Harç',300,$1,'Müvekkil','Büro',$2)`, [kOld, kasa]));
await asUser(A, () => q(`update public.cases set status='Kapalı' where id=$1`, [kNew]));
ok("kapalı dosya: kapanış tarihi kendiliğinden bugün", (await one(`select closing_date = current_date as t from public.cases where id=$1`, [kNew])).t === true);
ok("kapalı dosya: kapatınca silinmez", (await q(`select 1 from public.cases where id=$1`, [kNew])).length === 1);
await asUser(A, () => q(`update public.cases set status='Açık' where id=$1`, [kNew]));
ok("kapalı dosya: yeniden açılınca kapanış tarihi temizlenir", (await one(`select closing_date from public.cases where id=$1`, [kNew])).closing_date === null);
await asUser(A, () => q(`update public.cases set status='Kapalı' where id=$1`, [kNew]));
await asUser(A, () => q(`update public.cases set status='Kapalı', closing_date = current_date - interval '13 months' where id=$1`, [kOld]));
const balBefore = Number((await asUser(A, () => one(`select balance from public.v_client_balances where client_id=$1`, [client2]))).balance);
const kasaBefore = Number((await asUser(A, () => one(`select balance from public.v_account_balances where id=$1`, [kasa]))).balance);
const purged = (await one(`select app.cron_purge_closed_cases() n`)).n;
ok("gece işi: süresi (12 ay) dolan kapalı dosya silindi, yenisi kaldı", purged === 1 && (await q(`select 1 from public.cases where id=$1`, [kOld])).length === 0 && (await q(`select 1 from public.cases where id=$1`, [kNew])).length === 1, String(purged));
ok("gece işi: dosyanın masrafı da silindi", (await q(`select 1 from public.expenses where case_id=$1`, [kOld])).length === 0);
ok("gece işi: müvekkil cari bakiyesi ve kasa aynı kaldı (toplamlar korunur)",
  Math.abs(Number((await asUser(A, () => one(`select balance from public.v_client_balances where client_id=$1`, [client2]))).balance) - balBefore) < 0.005
  && Math.abs(Number((await asUser(A, () => one(`select balance from public.v_account_balances where id=$1`, [kasa]))).balance) - kasaBefore) < 0.005);
ok("gece işi: müvekkilde kapanan dosya sayısı arttı", (await one(`select closed_case_count n from public.clients where id=$1`, [client2])).n >= 1);
ok("gece işi: ikinci çalıştırma bir şey silmez", (await one(`select app.cron_purge_closed_cases() n`)).n === 0);
ok("şimdi kalıcı sil (close_case) hâlâ çalışır, avukat yapamaz", await fails(() => asUser(U, () => q(`select public.close_case($1)`, [kNew])), /yetkiniz yok/)
  && !!(await asUser(A, () => one(`select public.close_case($1) r`, [kNew]))).r);
ok("ayar: saklama süresi başta 12 ay", (await one(`select closed_case_retention_months m from public.org_settings where org_id=$1`, [orgA])).m === 12);
// Borçlu olduğumuz dosyada süre + kapalı dosyalar büro silmedikçe silinmez
const BS = fileURLToPath(new URL("../migrations/20261016160000_borclu_sureler_kapali_saklama.sql", import.meta.url));
const bsSql = readFileSync(BS, "utf8");
let bsErr = null;
try { await db.exec(bsSql); await db.exec(bsSql); } catch (e) { bsErr = e; }
ok("borçlu süreleri + kapalı saklama migration'ı çalıştı (iki kez)", !bsErr, bsErr ? bsErr.message : "");
if (bsErr) { console.log(R.join(String.fromCharCode(10))); process.exit(1); }
ok("ayar: saklama süresi 12 iken 0'a (silme yok) çekildi, varsayılan 0, eksi değer reddedilir",
  (await one(`select closed_case_retention_months m from public.org_settings where org_id=$1`, [orgA])).m === 0
  && await fails(() => asUser(A, () => q(`update public.org_settings set closed_case_retention_months = -1`)), /check/i));
const kX = await kc('2025/902');
await asUser(A, () => q(`update public.cases set status='Kapalı', closing_date = current_date - interval '40 months' where id=$1`, [kX]));
ok("gece işi: süre 0 ise çok eski kapalı dosya bile silinmez", (await one(`select app.cron_purge_closed_cases() n`)).n === 0 && (await q(`select 1 from public.cases where id=$1`, [kX])).length === 1);
await asUser(A, () => q(`update public.org_settings set closed_case_retention_months = 6`));
ok("gece işi: süre verilirse yine silinir (6 ay)", (await one(`select app.cron_purge_closed_cases() n`)).n === 1);
await asUser(A, () => q(`update public.org_settings set closed_case_retention_months = 0`));
ok("gece işi: istemci çağıramaz", await fails(() => asUser(A, () => q(`select app.cron_purge_closed_cases()`)), /permission denied/));

// ── Ayarlar bölümlerini avukata verme (Görüntüle / Ekle / Düzenle / Sil ayrı ayrı)
const setAs = (uid, perms) => db.exec(`update public.profiles set permissions='${JSON.stringify(perms)}'::jsonb where id='${uid}'`);
const tryUpd = (uid, sql) => asUser(uid, () => q(sql));
await asUser(A, () => q(`update public.org_settings set courts='{Ankara 1. Asliye,İzmir 2. Asliye}', company_lists='[{"id":"L1","name":"Bir","clientIds":[]}]'::jsonb`));
await setAs(U, {});
ok("ayarlar: izni olmayan avukat ayar değiştiremez", (await tryUpd(U, `update public.org_settings set courts = courts || '{x}' returning org_id`)).length === 0);
// Kategoriler: yalnızca görüntüleme
await setAs(U, { "settings_categories.view": true });
ok("kategoriler: yalnızca görüntüleyen değişiklik yapamaz", (await tryUpd(U, `update public.org_settings set courts = courts || '{x}' returning org_id`)).length === 0);
// Kategoriler: ekle
await setAs(U, { "settings_categories.view": true, "settings_categories.create": true });
ok("kategoriler: Ekle izniyle listeye değer ekler", (await tryUpd(U, `update public.org_settings set courts = courts || '{Bursa 1. Asliye}' returning org_id`)).length === 1);
ok("kategoriler: Ekle izni değer silmeye yetmez", await fails(() => tryUpd(U, `update public.org_settings set courts = array_remove(courts, 'İzmir 2. Asliye')`), /silme yetkiniz yok/));
ok("kategoriler: Ekle izni süre değiştirmeye yetmez", await fails(() => tryUpd(U, `update public.org_settings set seizure_valid_months = 10`), /yetkiniz yok/));
// Kategoriler: sil
await setAs(U, { "settings_categories.view": true, "settings_categories.delete": true });
ok("kategoriler: Sil izniyle değer siler", (await tryUpd(U, `update public.org_settings set courts = array_remove(courts, 'İzmir 2. Asliye') returning org_id`)).length === 1);
ok("kategoriler: Sil izni değer eklemeye yetmez", await fails(() => tryUpd(U, `update public.org_settings set courts = courts || '{y}'`), /ekleme yetkiniz yok/));
// Kategoriler: düzenle
await setAs(U, { "settings_categories.view": true, "settings_categories.edit": true });
ok("kategoriler: Düzenle izniyle haciz / saklama süresini değiştirir", (await tryUpd(U, `update public.org_settings set seizure_valid_months = 10, closed_case_retention_months = 6 returning org_id`)).length === 1);
ok("kategoriler: izni olan bile büro bilgisi, şirket listesi ve izinleri değiştiremez",
  await fails(() => tryUpd(U, `update public.org_settings set firm = firm || '{"name":"Hack"}'::jsonb`), /yetkiniz yok/)
  && await fails(() => tryUpd(U, `update public.org_settings set company_lists = '[]'::jsonb, seizure_valid_months = 11`), /yetkiniz yok/)
  && await fails(() => tryUpd(U, `update public.org_settings set role_permissions = role_permissions || '{"fees.view": true}'::jsonb, seizure_valid_months = 9`), /yalnızca yönetici/));
// Şirket listeleri
await setAs(U, { "settings_companies.view": true, "settings_companies.create": true });
ok("şirket listesi: Ekle izniyle liste açar", (await tryUpd(U, `update public.org_settings set company_lists = company_lists || '[{"id":"L2","name":"İki","clientIds":[]}]'::jsonb returning org_id`)).length === 1);
ok("şirket listesi: Ekle izni düzenlemeye ve silmeye yetmez",
  await fails(() => tryUpd(U, `update public.org_settings set company_lists = '[{"id":"L1","name":"Bir (yeni ad)","clientIds":[]},{"id":"L2","name":"İki","clientIds":[]}]'::jsonb`), /düzenleme yetkiniz yok/)
  && await fails(() => tryUpd(U, `update public.org_settings set company_lists = '[{"id":"L2","name":"İki","clientIds":[]}]'::jsonb`), /silme yetkiniz yok/));
await setAs(U, { "settings_companies.view": true, "settings_companies.edit": true, "settings_companies.delete": true });
ok("şirket listesi: Düzenle ve Sil izniyle ad / ikon değiştirir ve siler",
  (await tryUpd(U, `update public.org_settings set company_lists = '[{"id":"L1","name":"Bir","clientIds":[],"icon":"star"},{"id":"L2","name":"İki","clientIds":[]}]'::jsonb returning org_id`)).length === 1
  && (await tryUpd(U, `update public.org_settings set company_lists = '[{"id":"L1","name":"Bir","clientIds":[],"icon":"star"}]'::jsonb returning org_id`)).length === 1);
// Büro bilgileri
await setAs(U, { "settings_firm.view": true });
ok("büro bilgileri: yalnızca görüntüleyen değiştiremez", (await tryUpd(U, `update public.org_settings set firm = firm || '{"phone":"0212"}'::jsonb returning org_id`)).length === 0
  && (await tryUpd(U, `update public.organizations set name='X' returning id`)).length === 0);
await setAs(U, { "settings_firm.view": true, "settings_firm.edit": true });
ok("büro bilgileri: Düzenle izniyle firm ve büro adını değiştirir", (await tryUpd(U, `update public.org_settings set firm = firm || '{"phone":"0212"}'::jsonb returning org_id`)).length === 1
  && (await tryUpd(U, `update public.organizations set name='Yeni Ad Hukuk' returning id`)).length === 1);
ok("büro bilgileri: büronun diğer alanlarını (aktiflik, saklama) değiştiremez", await fails(() => tryUpd(U, `update public.organizations set retention_months = 6`), /yönetici değiştirebilir/)
  && await fails(() => tryUpd(U, `update public.organizations set active = false`), /yönetici değiştirebilir/));
ok("ayarlar: izin kendi kendine verilemez (profil koruması)", await fails(() => tryUpd(U, `update public.profiles set permissions='{"settings_firm.view":true,"settings_categories.view":true}'::jsonb where id='${U}'`), /yalnızca yönetici/));
await setAs(U, {});
ok("ayarlar: izin geri alınınca değişiklik yapamaz", (await tryUpd(U, `update public.org_settings set courts = courts || '{q}' returning org_id`)).length === 0);
ok("ayarlar: admin hepsini değiştirebilir", (await asUser(A, () => q(`update public.org_settings set courts='{Admin}', role_permissions = role_permissions returning org_id`))).length === 1);
ok("ayarlar: my_permissions ayrıntılı anahtarları içerir", (await asUser(A, () => one(`select public.my_permissions() p`))).p["settings_companies.delete"] === true
  && (await asUser(U, () => one(`select public.my_permissions() p`))).p["settings_firm.edit"] === false);

// ── Kullanıcı yönetimini avukata verme (sınırlı: admin hesaplarına ve izinlere dokunamaz)
const T = await newUser("tolga@a.com");
await db.exec(`insert into public.profiles (id, org_id, name, username, email, role) values ('${T}', '${orgA}', 'Tolga', 'tolga', 'tolga@a.com', 'avukat')`);
const upd = (uid, sql) => asUser(uid, () => q(sql));
await setAs(U, { "settings_users.view": true, "settings_users.create": true });
ok("kullanıcılar: Görüntüle + Ekle izni düzenlemeye yetmez", (await upd(U, `update public.profiles set active=false where id='${T}' returning id`)).length === 0);
await setAs(U, { "settings_users.view": true, "settings_users.edit": true });
ok("kullanıcılar: Düzenle izniyle başka avukatın bilgisini değiştirir", (await upd(U, `update public.profiles set name='Tolga Kaya', title='Stajyer Avukat' where id='${T}' returning id`)).length === 1);
ok("kullanıcılar: Düzenle izniyle başka avukatı pasife alıp etkinleştirir", (await upd(U, `update public.profiles set active=false where id='${T}' returning id`)).length === 1
  && (await upd(U, `update public.profiles set active=true where id='${T}' returning id`)).length === 1);
ok("kullanıcılar: admin hesabına dokunamaz", (await upd(U, `update public.profiles set name='Hack' where id='${A}' returning id`)).length === 0);
ok("kullanıcılar: kimseyi admin yapamaz", await fails(() => upd(U, `update public.profiles set role='admin' where id='${T}'`), /row-level security|yalnızca yönetici/));
ok("kullanıcılar: kendini admin yapamaz", await fails(() => upd(U, `update public.profiles set role='admin' where id='${U}'`), /yalnızca yönetici|row-level security/));
ok("kullanıcılar: izin (permissions) değiştiremez", await fails(() => upd(U, `update public.profiles set permissions='{"fees.view":true}'::jsonb where id='${T}'`), /yalnızca yönetici/));
ok("kullanıcılar: e-posta değiştiremez", await fails(() => upd(U, `update public.profiles set email='x@x.com' where id='${T}'`), /yalnızca yönetici/));
ok("kullanıcılar: kendini pasife alamaz", await fails(() => upd(U, `update public.profiles set active=false where id='${U}'`), /yalnızca yönetici/));
ok("kullanıcılar: kullanıcı silemez", (await upd(U, `delete from public.profiles where id='${T}' returning id`)).length === 0);
ok("kullanıcılar: my_permissions ekle / düzenle anahtarlarını verir", (await asUser(U, () => one(`select public.my_permissions() p`))).p["settings_users.edit"] === true
  && (await asUser(U, () => one(`select public.my_permissions() p`))).p["settings_users.create"] === false);
await setAs(U, {});

// ── İcra süreleri (takip şekline göre kesinleştirme, 89/2, işveren, taksit günü)
const st2 = await asUser(A, () => one(`select procedures p, enforcement_close_reasons c, claim_types t, bank_answer_types b from public.org_settings`));
ok("süreler: 14 takip şekli, kapanış sebepleri ve hazır takip bilgileri geldi", st2.p.length === 14 && st2.c.includes("İnfaz") && st2.t.includes("Çek Alacağı") && st2.b.includes("Hacizli"));
ok("süreler: Örnek No 7 → 7 gün kesinleştirme, Örnek No 14 → 15 gün tahliye",
  st2.p.find((x) => x.name === "Örnek No: 7").days === 7 && st2.p.find((x) => x.name === "Örnek No: 14").action === "Tahliye");
const sf = await enfNew("2026/700 E.", ", procedure, responsible_ids", `, 'Örnek No: 7', array['${S}']::uuid[]`);
const evIns = (type, date, data = null) => asUser(A, async () => (await one(`insert into public.enforcement_events (enforcement_id, type, date, data) values ($1,$2,${date},$3) returning id`, [sf.id, type, data])).id);
const teb = await evIns("Ödeme emri tebliği", "current_date - 8");
const dl = async (key) => (await asUser(S, () => q(`select * from public.v_icra_deadlines where enforcement_id=$1 and kind=$2`, [sf.id, key])))[0];
let k1 = await dl("Kesinleştirme");
ok("süreler: tebliğ + 7 + 1 gün = kesinleştirme bugün (avukat da görür)", k1 && k1.due_date.toISOString().slice(0, 10) === (await one(`select current_date::text d`)).d && k1.resolved === false, JSON.stringify(k1));
const b891 = await evIns("89/1 haciz ihbarnamesi", "current_date - 14", JSON.stringify({ banks: [{ name: "Ziraat", answers: ["Olumsuz"] }, { name: "Garanti", answers: [] }] }));
let b = await dl("89/2 haciz ihbarnamesi");
ok("süreler: 89/1'den 13 gün sonra cevapsız banka → 89/2 bugün", b && b.resolved === false);
const maas = await evIns("Maaş haczi tebliği", "current_date - 31");
ok("süreler: maaş haczi tebliğinden 31. gün → işveren borçlu ekleme", !!(await dl("İşveren borçlu ekleme")));
const nSure = (await one(`select app.cron_icra_deadlines() n`)).n;
const sn = await asUser(S, () => q(`select title from public.notifications where type='İcra süresi'`));
ok("süreler: sorumluya 3 bildirim (kesinleştirme, 89/2, işveren)", nSure === 3 && sn.length === 3, JSON.stringify(sn));
ok("süreler: ikinci çalıştırma yinelemez", (await one(`select app.cron_icra_deadlines() n`)).n === 0);
await evIns("Kesinleşme", "current_date");
await db.exec(`update public.enforcement_events set data = '{"banks":[{"name":"Ziraat","answers":["Olumsuz"]},{"name":"Garanti","answers":["Hacizli","Rehinli"]}]}'::jsonb where id='${b891}'`);
k1 = await dl("Kesinleştirme"); b = await dl("89/2 haciz ihbarnamesi");
ok("süreler: kesinleşme girilince ve bankalar cevaplanınca süre kapanır", k1.resolved === true && b.resolved === true);
await db.exec(`update public.enforcement_events set data = '{"doneAt":"2026-01-01"}'::jsonb where id='${maas}'`);
ok("süreler: 'tamamlandı' işaretlenen süre kapanır", (await dl("İşveren borçlu ekleme")).resolved === true);
await db.exec(`update public.enforcements set status='Kapalı', close_reason='İnfaz' where id='${sf.id}'`);
ok("süreler: kapalı dosyanın süresi listelenmez", (await asUser(A, () => q(`select 1 from public.v_icra_deadlines where enforcement_id=$1`, [sf.id]))).length === 0);
ok("süreler: başka büro göremez", (await asUser(B, () => q(`select 1 from public.v_icra_deadlines`))).length === 0);
await setAs(U, { "settings_categories.view": true });
ok("süreler: takip şekillerini yalnızca Kategoriler → Düzenle izni olan değiştirir", (await asUser(U, () => q(`update public.org_settings set procedures = '[]'::jsonb returning org_id`))).length === 0);
await setAs(U, {});

// ── Borçlu olduğumuz dosyada tebliğ süresi (itiraz / ödeme)
const bf = await enfNew("2026/800 E.", ", side, procedure, responsible_ids", `, 'Borçlu', 'Örnek No: 7', array['${S}']::uuid[]`);
const bev = await asUser(A, async () => (await one(`insert into public.enforcement_events (enforcement_id, type, date) values ($1,'Ödeme emri tebliği', current_date - 5) returning id`, [bf.id])).id);
const bd = (await asUser(S, () => q(`select * from public.v_icra_deadlines where enforcement_id=$1`, [bf.id])))[0];
ok("borçlu süre: tebliğ + 7 gün son gün, 2 gün önce hatırlatma", bd && bd.kind === "İtiraz / ödeme süresi"
  && bd.due_date.toISOString().slice(0, 10) === (await one(`select (current_date + 2)::text d`)).d
  && bd.remind_from.toISOString().slice(0, 10) === (await one(`select current_date::text d`)).d && bd.resolved === false, JSON.stringify(bd));
const nb = (await one(`select app.cron_icra_deadlines() n`)).n;
const bn = await asUser(S, () => q(`select title from public.notifications where title like 'İtiraz%'`));
ok("borçlu süre: sorumluya bildirim gitti, tekrarlanmadı", nb === 1 && bn.length === 1 && (await one(`select app.cron_icra_deadlines() n`)).n === 0, JSON.stringify(bn));
await evIns("89/1 haciz ihbarnamesi", "current_date - 14").catch(() => {});
await asUser(A, () => q(`insert into public.enforcement_events (enforcement_id, type, date) values ($1,'89/1 haciz ihbarnamesi', current_date - 14)`, [bf.id]));
ok("borçlu süre: 89/1 vb. alacaklı süreleri borçlu dosyada üretilmez", (await asUser(S, () => q(`select 1 from public.v_icra_deadlines where enforcement_id=$1`, [bf.id]))).length === 1);
await db.exec(`update public.enforcement_events set data = '{"doneAt":"2026-01-01"}'::jsonb where id='${bev}'`);
ok("borçlu süre: tamamlandı işaretlenince kapanır", (await asUser(S, () => one(`select resolved from public.v_icra_deadlines where enforcement_id=$1 and kind='İtiraz / ödeme süresi'`, [bf.id]))).resolved === true);

// ── cron zamanlaması (pg_cron taklidiyle)
await db.exec(`
  create schema cron;
  create table cron.job (jobid serial primary key, jobname text, schedule text, command text);
  create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid::bigint $$;
  create function cron.unschedule(j int) returns boolean language sql as $$ delete from cron.job where jobid = j returning true $$;
`);
let cronErr = null;
try { await db.exec(sql); await db.exec(sql); } catch (e) { cronErr = e; }
ok("cron: zamanlama bölümü çalıştı", !cronErr, cronErr?.message);
const jobs = await q(`select jobname, schedule from cron.job order by jobname`);
ok("cron: 4 iş, tekrarlanmadı", jobs.length === 4, JSON.stringify(jobs));
await db.exec(icraSql); await db.exec(icraSql); await db.exec(kapaliSql); await db.exec(kapaliSql); await db.exec(ayarSql); await db.exec(kullaniciSql); await db.exec(sureSql); await db.exec(bsSql);
const jobs2 = await q(`select jobname, schedule from cron.job order by jobname`);
ok("cron: kapalı dosya işi her ayın 1'i 03:45 (TR), tekrarlanmadı", jobs2.filter((j) => j.jobname === "lexkasa-kapali-dosya").length === 1 && jobs2.some((j) => j.jobname === "lexkasa-kapali-dosya" && j.schedule === "45 0 1 * *"), JSON.stringify(jobs2));
ok("cron: haciz işi her gün 08:00 (TR), tekrarlanmadı", jobs2.length === 6 && jobs2.some((j) => j.jobname === "lexkasa-haciz" && j.schedule === "0 5 * * *"), JSON.stringify(jobs2));
ok("cron: Zamanlama ekranı haciz işini listeler", (await asUser(A, () => q(`select * from public.list_cron_jobs()`))).some((j) => j.jobname === "lexkasa-haciz"));

// ── Maaş haczi sıraları
const MH = fileURLToPath(new URL("../migrations/20261021120000_maas_haczi.sql", import.meta.url));
const mhSql = readFileSync(MH, "utf8");
let mhErr = null;
try { await db.exec(mhSql); await db.exec(mhSql); } catch (e) { mhErr = e; }
ok("maaş haczi migration'ı çalıştı (iki kez)", !mhErr, mhErr ? mhErr.message : "");
if (mhErr) { console.log(R.join("\n")); process.exit(1); }
await db.exec(mhSql); // cron.job varken lexkasa-haciz yeniden bağlanır
const employer = await asUser(A, async () => (await one(`insert into public.clients (name, kind) values ('İşveren A.Ş.','Kurumsal') returning id`)).id);
const qid = await asUser(A, async () => (await one(
  `insert into public.salary_garnishments (client_id, employee_name, payday, status)
   values ($1, 'Örnek Çalışan', extract(day from current_date)::int, 'Devam ediyor') returning id`,
  [employer],
)).id);
await asUser(A, () => q(
  `insert into public.salary_garnishment_entries (queue_id, position, office, file_no, notified_at) values
   ($1, 1, 'Ankara Banka Alacakları İcra Dairesi', '2024/47030', current_date - 10),
   ($1, 2, 'İzmir 3. İcra Dairesi', '2026/980', current_date - 5)`,
  [qid],
));
ok("maaş haczi: kayıt ve 2 dosya yazıldı", (await asUser(A, () => q(`select 1 from public.salary_garnishment_entries where queue_id=$1`, [qid]))).length === 2);
await setAs(U, { "enforcements.view": false, "enforcements.create": false, "enforcements.edit": false, "enforcements.delete": false });
ok("maaş haczi: icra izni kapalıyken göremez", (await asUser(U, () => q(`select 1 from public.salary_garnishments`))).length === 0);
await setAs(U, { "enforcements.view": true, "enforcements.create": true, "enforcements.edit": true });
ok("maaş haczi: icra izniyle görür / düzenler", (await asUser(U, () => q(`select employee_name from public.salary_garnishments where id=$1`, [qid]))).length === 1
  && (await asUser(U, () => q(`update public.salary_garnishments set note='ok' where id=$1 returning id`, [qid]))).length === 1);
await setAs(U, {});
ok("maaş haczi: başka büro göremez", (await asUser(B, () => q(`select 1 from public.salary_garnishments`))).length === 0);
const nPay = (await one(`select app.cron_salary_payday_reminders() n`)).n;
const payN = await asUser(A, () => q(`select title from public.notifications where type='Maaş haczi'`));
ok("maaş haczi: ödeme günü hatırlatması gitti", nPay >= 1 && payN.length >= 1, JSON.stringify({ nPay, payN }));
ok("maaş haczi: aynı gün ikinci kez yinelemez", (await one(`select app.cron_salary_payday_reminders() n`)).n === 0);
ok("maaş haczi: cron_icra_daily payday'i de çalıştırır", typeof (await one(`select app.cron_icra_daily() n`)).n === "number");

// ── Aktivite geçmişi tamamen kaldırıldı
const ACTOFF = fileURLToPath(new URL("../migrations/20261021130000_activities_kapat.sql", import.meta.url));
const actOffSql = readFileSync(ACTOFF, "utf8");
let actOffErr = null;
try { await db.exec(actOffSql); await db.exec(actOffSql); } catch (e) { actOffErr = e; }
ok("aktivite silme migration'ı çalıştı (iki kez)", !actOffErr, actOffErr ? actOffErr.message : "");
ok("activities tablosu yok", (await one(`select to_regclass('public.activities') is null as gone`)).gone === true);
ok("app.audit() yok", (await one(`select to_regprocedure('app.audit()') is null as gone`)).gone === true);
ok("trg_audit kalmadı", Number((await one(`select count(*)::int c from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where t.tgname='trg_audit' and not t.tgisinternal and n.nspname='public'`)).c) === 0);
await asUser(A, () => q(`insert into public.clients (name) values ('AuditNoOp')`));
ok("dosya kapatma audit'siz çalışır", await (async () => {
  const c = await asUser(A, async () => (await one(`insert into public.cases (no,title,client_id) values ('2026/AUDIT','x',$1) returning id`, [client2])).id);
  await asUser(A, () => q(`select public.close_case($1)`, [c]));
  return (await q(`select 1 from public.cases where id=$1`, [c])).length === 0;
})());

// ── Toplu Excel aktarım: tek JSON RPC
const IMP = fileURLToPath(new URL("../migrations/20261021140000_import_batch.sql", import.meta.url));
const impSql = readFileSync(IMP, "utf8");
let impErr = null;
try { await db.exec(impSql); await db.exec(impSql); } catch (e) { impErr = e; }
ok("import_batch migration'ı çalıştı (iki kez)", !impErr, impErr ? impErr.message : "");
const ibClient = "aaaaaaaa-bbbb-cccc-dddd-000000000001";
const ibDebtor = "aaaaaaaa-bbbb-cccc-dddd-000000000002";
const ibEnf = "aaaaaaaa-bbbb-cccc-dddd-000000000003";
const ibPayload = {
  clients: [{ id: ibClient, name: "Toplu Müvekkil", kind: "Kurumsal", email: "", phone: "", status: "Aktif" }],
  debtors: [{ id: ibDebtor, name: "Toplu Borçlu", kind: "Bireysel" }],
  enforcements: [{
    id: ibEnf, no: "2026/BATCH E.", office: "Ankara 1. İcra", type: "İlamsız", side: "Alacaklı",
    client_id: ibClient, principal: 1000, interest: 0, costs: 0, status: "Açık",
    opening_date: "2026-01-15", responsible_ids: [], debtor_ids: [ibDebtor], details: "batch test",
  }],
};
const ibRes = await asUser(A, async () => (await one(`select public.import_batch($1::jsonb) r`, [JSON.stringify(ibPayload)])).r);
ok("import_batch: müvekkil+borçlu+icra yazıldı", ibRes.clients === 1 && ibRes.debtors === 1 && ibRes.enforcements === 1 && ibRes.enforcement_debtors === 1 && ibRes.total === 3, JSON.stringify(ibRes));
ok("import_batch: bağlar doğru", (await one(`select count(*)::int c from public.enforcement_debtors where enforcement_id='${ibEnf}' and debtor_id='${ibDebtor}'`)).c === 1);
ok("import_batch: başka büro göremez", (await asUser(B, () => q(`select 1 from public.enforcements where id='${ibEnf}'`))).length === 0);
await setAs(U, { "clients.create": false });
ok("import_batch: izinsiz avukat yazamaz", await fails(() => asUser(U, () => q(
  `select public.import_batch($1::jsonb)`,
  [JSON.stringify({ clients: [{ id: "aaaaaaaa-bbbb-cccc-dddd-000000000099", name: "X", kind: "Bireysel", email: "", phone: "", status: "Aktif" }] })],
)), /yetkiniz yok|42501|permission/i));
await setAs(U, {});
const ib2 = await asUser(A, async () => (await one(
  `select public.import_batch($1::jsonb) r`,
  [JSON.stringify({ enforcements: [{ ...ibPayload.enforcements[0], principal: 2500, debtor_ids: [ibDebtor] }] })],
)).r);
ok("import_batch: upsert günceller", ib2.enforcements === 1 && Number((await one(`select principal from public.enforcements where id='${ibEnf}'`)).principal) === 2500, JSON.stringify(ib2));

// ── Toplu aktarım: boş takip türü boş kalır
const IMP2 = fileURLToPath(new URL("../migrations/20261021150000_import_batch_bos_tur.sql", import.meta.url));
let imp2Err = null;
try { await db.exec(readFileSync(IMP2, "utf8")); } catch (e) { imp2Err = e; }
ok("import_batch boş tür migration'ı çalıştı", !imp2Err, imp2Err ? imp2Err.message : "");
const ibEnf2 = "aaaaaaaa-bbbb-cccc-dddd-000000000004";
await asUser(A, () => one(`select public.import_batch($1::jsonb) r`, [JSON.stringify({ enforcements: [{
  ...ibPayload.enforcements[0], id: ibEnf2, no: "2026/BOSTUR", type: "", debtor_ids: [ibDebtor],
}] })]));
ok("import_batch: boş takip türü İlamsız yapılmaz", (await one(`select type from public.enforcements where id='${ibEnf2}'`)).type === "");
await setAs(U, { "enforcements.create": true, "enforcements.edit": false });
ok("import_batch: düzenleme yetkisi olmadan kayıtlı dosya güncellenemez", await fails(() => asUser(U, () => q(
  `select public.import_batch($1::jsonb)`,
  [JSON.stringify({ enforcements: [{ ...ibPayload.enforcements[0], id: ibEnf2, no: "2026/BOSTUR", type: "", principal: 1, debtor_ids: [ibDebtor] }] })],
)), /güncelleme yetkiniz yok|42501/i));
const ibEnf3 = "aaaaaaaa-bbbb-cccc-dddd-000000000005";
ok("import_batch: düzenleme yetkisi olmadan yeni dosya eklenebilir", (await asUser(U, async () => (await one(
  `select public.import_batch($1::jsonb) r`,
  [JSON.stringify({ enforcements: [{ ...ibPayload.enforcements[0], id: ibEnf3, no: "2026/YENIYETKI", debtor_ids: [ibDebtor] }] })],
)).r)).enforcements === 1);
await setAs(U, {});

// ── Maaş haczi: hatırlatma yalnızca sorumluya, sorumlu yoksa yöneticiye
const MHS = fileURLToPath(new URL("../migrations/20261021160000_maas_haczi_sorumlu.sql", import.meta.url));
let mhsErr = null;
try { const sql = readFileSync(MHS, "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { mhsErr = e; }
ok("maaş haczi sorumlu migration'ı çalıştı (iki kez)", !mhsErr, mhsErr ? mhsErr.message : "");
const qResp = await asUser(A, async () => (await one(
  `insert into public.salary_garnishments (client_id, employee_name, payday, status, responsible_ids)
   values ($1, 'Sorumlulu Çalışan', extract(day from current_date)::int, 'Devam ediyor', array['${U}']::uuid[]) returning id`,
  [employer],
)).id);
const qNone = await asUser(A, async () => (await one(
  `insert into public.salary_garnishments (client_id, employee_name, payday, status)
   values ($1, 'Sorumsuz Çalışan', extract(day from current_date)::int, 'Devam ediyor') returning id`,
  [employer],
)).id);
await one(`select app.cron_salary_payday_reminders() n`);
const notifTo = async (qidX) => (await q(
  `select user_id from public.notifications where dedupe_key like 'maas-payday:' || $1 || ':%'`, [qidX],
)).map((x) => x.user_id);
const toResp = await notifTo(qResp);
ok("maaş haczi: sorumlu varsa yalnızca ona gider", toResp.length === 1 && toResp[0] === U, JSON.stringify(toResp));
const toNone = await notifTo(qNone);
ok("maaş haczi: sorumlu yoksa yöneticiye gider", toNone.includes(A) && !toNone.includes(U), JSON.stringify(toNone));

// ── "İşlem Yapılmayacak": durum listesine girer, süre üretmez
let naErr = null;
try {
  for (const f of ["20261016180000_bank_89_chain.sql", "20261027120000_islem_yapilmayacak.sql"]) {
    const sql = readFileSync(fileURLToPath(new URL(`../migrations/${f}`, import.meta.url)), "utf8");
    await db.exec(sql); await db.exec(sql);
  }
} catch (e) { naErr = e; }
ok("işlem yapılmayacak migration'ı çalıştı (iki kez)", !naErr, naErr ? naErr.message : "");
const naList = (await asUser(A, () => one(`select enforcement_statuses s from public.org_settings`))).s;
ok("işlem yapılmayacak: durum listesinde 'Kapalı'dan hemen sonra, bir kez",
  naList.filter((x) => x === "İşlem Yapılmayacak").length === 1 && naList[naList.indexOf("Kapalı") + 1] === "İşlem Yapılmayacak", JSON.stringify(naList));
await db.exec(`update public.enforcement_events set data = null where id='${bev}'`);
const bfDl = async () => (await asUser(S, () => q(`select 1 from public.v_icra_deadlines where enforcement_id=$1`, [bf.id]))).length;
const naBefore = await bfDl();
await db.exec(`update public.enforcements set status='İşlem Yapılmayacak' where id='${bf.id}'`);
ok("işlem yapılmayacak: dosyanın süresi listelenmez", naBefore === 1 && (await bfDl()) === 0, String(naBefore));

// ── Saklama 30 gün: bildirimler ve tamamlanan ajanda kayıtları
let s30Err = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261027130000_saklama_30_gun.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { s30Err = e; }
ok("saklama 30 gün migration'ı çalıştı (iki kez)", !s30Err, s30Err ? s30Err.message : "");
const org30 = (await one(`select org_id from public.enforcements where id=$1`, [bf.id])).org_id;
await db.exec(`
  insert into public.notifications (org_id, user_id, title, type, created_at) values
    ('${org30}', '${A}', 's30-eski', 'Test', now() - interval '31 days'),
    ('${org30}', '${A}', 's30-yeni', 'Test', now() - interval '29 days');
  insert into public.reminders (org_id, title, type, date, assignee_id, status, updated_at) values
    ('${org30}', 's30-bitti-eski', 'Diğer', current_date - 40, '${A}', 'Tamamlandı', now() - interval '31 days'),
    ('${org30}', 's30-bitti-yeni', 'Diğer', current_date - 40, '${A}', 'İptal', now() - interval '29 days'),
    ('${org30}', 's30-bekliyor', 'Diğer', current_date - 40, '${A}', 'Bekliyor', now() - interval '60 days');
`);
await one(`select app.cron_retention() r`);
const n30 = (await q(`select title from public.notifications where title like 's30-%'`)).map((x) => x.title);
ok("saklama: 30 günden eski bildirim (okunmamış da) silinir, yenisi kalır", n30.length === 1 && n30[0] === "s30-yeni", JSON.stringify(n30));
const r30 = (await q(`select title from public.reminders where title like 's30-%' order by title`)).map((x) => x.title);
ok("saklama: 30 gün önce biten ajanda kaydı silinir; yenisi ve bekleyen kalır",
  r30.length === 2 && r30.includes("s30-bitti-yeni") && r30.includes("s30-bekliyor"), JSON.stringify(r30));

// ── Kilitli ayar değerleri sunucuda da silinemez
let lockErr = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261027140000_kilitli_ayarlar.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { lockErr = e; }
ok("kilitli ayarlar migration'ı çalıştı (iki kez)", !lockErr, lockErr ? lockErr.message : "");
const lk = await asUser(A, () => one(
  `update public.org_settings set enforcement_statuses = '{Derdest}', case_statuses = '{}', fee_kinds = '{Danışmanlık}',
     enforcement_close_reasons = '{}', enforcement_event_types = '{Diğer}'
   returning enforcement_statuses s, case_statuses c, fee_kinds f, enforcement_close_reasons r, enforcement_event_types t`));
ok("kilitli: icra durumları silinemez, kilitsiz değer silinebilir",
  ["Açık", "Durdurulmuş", "Kapalı", "İşlem Yapılmayacak", "Tahsil edildi"].every((x) => lk.s.includes(x)) && lk.s.includes("Derdest") && !lk.s.includes("Haciz"), JSON.stringify(lk.s));
ok("kilitli: dosya durumları, aylık ücret, İnfaz geri gelir",
  lk.c.includes("Açık") && lk.c.includes("Kapalı") && lk.f.includes("Aylık ücret") && lk.f.includes("Danışmanlık") && lk.r.includes("İnfaz"), JSON.stringify(lk));
ok("kilitli: süre hesabındaki işlem türleri silinemez",
  lk.t.length === 11 && lk.t.includes("Ödeme emri tebliği") && lk.t.includes("89/3 haciz ihbarnamesi") && lk.t.includes("Diğer"), JSON.stringify(lk.t));
let lk2Err = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261028150000_kilitli_ayarlar_2.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { lk2Err = e; }
ok("kilitli ayarlar 2 migration'ı çalıştı (iki kez)", !lk2Err, lk2Err ? lk2Err.message : "");
const lk2 = await asUser(A, () => one(
  `update public.org_settings set case_statuses = '{Açık,Kapalı,Karar}', reminder_types = '{Toplantı}'
   returning case_statuses c, reminder_types r`));
ok("kilitli: Derdest / Kanun yolu ve Duruşma / Keşif / Diğer silinemez, kilitsiz değer silinebilir",
  ["Derdest", "Kanun yolu"].every((x) => lk2.c.includes(x)) && lk2.c.includes("Karar")
  && ["Duruşma", "Keşif", "Diğer", "Toplantı"].every((x) => lk2.r.includes(x)) && !lk2.r.includes("Süre sonu"), JSON.stringify(lk2));

// ── Duruşma katılımı seçenekleri (Mazeret, Mazeret (hakim yokluğu), büronun ekledikleri)
let haErr = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261028160000_durusma_katilim.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { haErr = e; }
ok("duruşma katılımı migration'ı çalıştı (iki kez)", !haErr, haErr ? haErr.message : "");
const ha0 = (await asUser(A, () => one(`select hearing_attendance h from public.org_settings`))).h;
ok("duruşma katılımı: mevcut büroda varsayılan seçenekler", ha0.includes("Mazeret") && ha0.includes("Mazeret (hakim yokluğu)"), JSON.stringify(ha0));
await setAs(U, { "settings_categories.view": true, "settings_categories.create": true, "settings_categories.delete": true });
const ha1 = await tryUpd(U, `update public.org_settings set hearing_attendance = '{Tevkil,E-duruşma}' returning hearing_attendance h`);
ok("duruşma katılımı: kategori izniyle avukat ekler / siler, Mazeret silinemez",
  ha1.length === 1 && ["Tevkil", "E-duruşma", "Mazeret"].every((x) => ha1[0].h.includes(x)) && !ha1[0].h.includes("Mazeret (hakim yokluğu)"), JSON.stringify(ha1));
await setAs(U, { "settings_categories.view": true });
ok("duruşma katılımı: izni olmayan ekleyemez", (await tryUpd(U, `update public.org_settings set hearing_attendance = hearing_attendance || '{X}' returning org_id`)).length === 0
  && !(await asUser(A, () => one(`select hearing_attendance h from public.org_settings`))).h.includes("X"));
await setAs(U, {});

// ── Hukuk / ceza / idare dosya listeleri: türler, durumlar, vekalet ücreti durumu
let dlErr = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261028170000_dosya_listeleri.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { dlErr = e; }
ok("dosya listeleri migration'ı çalıştı (iki kez)", !dlErr, dlErr ? dlErr.message : "");
const dl0 = await asUser(A, () => one(`select case_types t, case_statuses s, case_fee_statuses f from public.org_settings`));
ok("dosya listeleri: Hukuk / Ceza / İdare ve İstinafta / Temyizde mevcut büroya eklendi, ücret durumları hazır",
  ["Hukuk", "Ceza", "İdare"].every((x) => dl0.t.includes(x)) && ["İstinafta", "Temyizde"].every((x) => dl0.s.includes(x))
  && dl0.f.includes("Vekalet ücreti icrada"), JSON.stringify(dl0));
const dl1 = await asUser(A, () => one(`update public.org_settings set case_types = '{Danışmanlık}' returning case_types t`));
ok("dosya listeleri: Hukuk / Ceza / İdare silinemez", ["Hukuk", "Ceza", "İdare", "Danışmanlık"].every((x) => dl1.t.includes(x)), JSON.stringify(dl1));
const dlCase = "aaaaaaaa-bbbb-cccc-ffff-000000000001";
const dlRes = await asUser(A, async () => (await one(`select public.import_batch($1::jsonb) r`, [JSON.stringify({ cases: [{
  id: dlCase, no: "2026/DL1", title: "Ankara 9. Sulh Hukuk Mahkemesi", type: "Hukuk", status: "İstinafta",
  court: "Ankara 9. Sulh Hukuk Mahkemesi", esas_no: "2026/515", opening_date: "2026-01-01", responsible_ids: [],
  fee_status: "Vekalet ücreti icrada", note: "Listedeki durum: İSTİNAFTA",
}] })])).r);
const dlRow = await one(`select status, fee_status, type from public.cases where id=$1`, [dlCase]);
ok("dosya listeleri: aktarım vekalet ücreti durumunu yazar", dlRes.cases === 1 && dlRow.fee_status === "Vekalet ücreti icrada" && dlRow.status === "İstinafta", JSON.stringify(dlRow));
await setAs(U, { "settings_categories.view": true, "settings_categories.create": true });
ok("dosya listeleri: kategori izniyle vekalet ücreti durumu eklenir",
  (await tryUpd(U, `update public.org_settings set case_fee_statuses = case_fee_statuses || '{"Yarısı alındı"}' returning org_id`)).length === 1);
await setAs(U, {});

// ── Toplu aktarım: Ajanda (duruşma listesi) tek RPC'de
let ajErr = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261028120000_import_batch_ajanda.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { ajErr = e; }
ok("import_batch ajanda migration'ı çalıştı (iki kez)", !ajErr, ajErr ? ajErr.message : "");
const ajRows = Array.from({ length: 3 }, (_, i) => ({
  id: `aaaaaaaa-bbbb-cccc-eeee-00000000000${i + 1}`, title: `Duruşma · 2026/${i + 1} E.`, type: "Duruşma",
  date: "2026-11-02", time: `1${i}:30`, location: "İstanbul 3. Asliye Hukuk", assignee_id: U, status: "Bekliyor",
}));
const ajRes = await asUser(A, async () => (await one(`select public.import_batch($1::jsonb) r`, [JSON.stringify({ reminders: ajRows })])).r);
ok("import_batch ajanda: 3 duruşma tek çağrıda eklendi, sorumluya atandı", ajRes.reminders === 3 && ajRes.total === 3
  && (await one(`select count(*)::int c from public.reminders where title like 'Duruşma · 2026/%' and assignee_id='${U}' and time is not null`)).c === 3, JSON.stringify(ajRes));
ok("import_batch ajanda: başka büronun kullanıcısına atanamaz", await fails(() => asUser(A, () => q(
  `select public.import_batch($1::jsonb)`, [JSON.stringify({ reminders: [{ ...ajRows[0], id: "aaaaaaaa-bbbb-cccc-eeee-000000000099", assignee_id: B }] })],
)), /foreign key|violates/i));
await setAs(U, { "reminders.create": false });
ok("import_batch ajanda: izinsiz kullanıcı aktaramaz", await fails(() => asUser(U, () => q(
  `select public.import_batch($1::jsonb)`, [JSON.stringify({ reminders: [{ ...ajRows[0], id: "aaaaaaaa-bbbb-cccc-eeee-000000000098" }] })],
)), /yetkiniz yok|42501/i));
await setAs(U, {});

// ── Ajanda: duruşma bilgileri (dosya no, müvekkil / sıfat, mazeret)
let dbErr = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261028140000_ajanda_durusma_bilgileri.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { dbErr = e; }
ok("ajanda duruşma bilgileri migration'ı çalıştı (iki kez)", !dbErr, dbErr ? dbErr.message : "");
await asUser(A, () => one(`select public.import_batch($1::jsonb) r`, [JSON.stringify({ reminders: [{
  ...ajRows[0], case_no: "2026/1", parties: "Birgül Aktay (Davacı)", excuse: "Başka duruşma",
}] })]));
const dbRow = await one(`select case_no, parties, excuse from public.reminders where id=$1`, [ajRows[0].id]);
ok("ajanda: aktarım dosya no, müvekkil / sıfat ve mazereti yazar",
  dbRow.case_no === "2026/1" && dbRow.parties === "Birgül Aktay (Davacı)" && dbRow.excuse === "Başka duruşma", JSON.stringify(dbRow));
await asUser(U, () => q(`update public.reminders set excuse = null where id=$1`, [ajRows[0].id]));
ok("ajanda: katılacak avukat mazereti kaldırabilir", (await one(`select excuse from public.reminders where id=$1`, [ajRows[0].id])).excuse === null);

// ── Dosya aktarımı: değişmeyen satır yeniden yazılmaz
let daErr = null;
try { const sql = readFileSync(fileURLToPath(new URL("../migrations/20261028180000_dosya_aktarim_tek_sorgu.sql", import.meta.url)), "utf8"); await db.exec(sql); await db.exec(sql); } catch (e) { daErr = e; }
ok("dosya aktarımı tek sorgu migration'ı çalıştı (iki kez)", !daErr, daErr ? daErr.message : "");
const sameCase = {
  id: dlCase, no: "2026/DL1", title: "Ankara 9. Sulh Hukuk Mahkemesi", type: "Hukuk", status: "İstinafta",
  court: "Ankara 9. Sulh Hukuk Mahkemesi", esas_no: "2026/515", opening_date: "2026-01-01", responsible_ids: [],
  fee_status: "Vekalet ücreti icrada", note: "Listedeki durum: İSTİNAFTA",
};
const beforeStamp = (await one(`select updated_at from public.cases where id=$1`, [dlCase])).updated_at;
await asUser(A, () => one(`select public.import_batch($1::jsonb) r`, [JSON.stringify({ cases: [sameCase] })]));
const afterStamp = (await one(`select updated_at from public.cases where id=$1`, [dlCase])).updated_at;
ok("dosya aktarımı: aynı dosya yeniden yüklenince satır yazılmaz", String(beforeStamp) === String(afterStamp), `${beforeStamp} → ${afterStamp}`);
await asUser(A, () => one(`select public.import_batch($1::jsonb) r`, [JSON.stringify({ cases: [{ ...sameCase, status: "Kapalı" }] })]));
ok("dosya aktarımı: değişen durum yazılır", (await one(`select status from public.cases where id=$1`, [dlCase])).status === "Kapalı");

console.log(R.join("\n"));
console.log(`\nPASS: ${R.filter((x) => x.startsWith("PASS")).length}  FAIL: ${R.filter((x) => x.startsWith("FAIL")).length}`);
process.exit(R.some((x) => x.startsWith("FAIL")) ? 1 : 0);

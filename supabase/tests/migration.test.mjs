/* eslint-disable */
import { PGlite } from "@electric-sql/pglite";
process.on("uncaughtException", (e) => { console.log(R.join("\n")); console.log("\nHATA:", String(e.message).slice(0, 400), e.detail ? "| " + String(e.detail).slice(0, 300) : ""); process.exit(2); });
import { readFileSync } from "node:fs";

// Migration, gerçek bir PostgreSQL (PGlite) üzerinde çalıştırılıp RLS, izinler ve iş fonksiyonları sınanır.
// Çalıştırma: npm run test:db
const MIGRATION = new URL("../migrations/20261012000000_lexkasa_init.sql", import.meta.url).pathname;
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
ok("avukat aktiviteyi göremez", (await asUser(S, () => q(`select * from public.activities`))).length === 0);
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
ok("kapatma aktivite kaydı", (await asUser(A, () => q(`select * from public.activities where entity='Dosya' and detail like 'Dosya kapatıldı%'`))).length === 1);

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

console.log(R.join("\n"));
console.log(`\nPASS: ${R.filter((x) => x.startsWith("PASS")).length}  FAIL: ${R.filter((x) => x.startsWith("FAIL")).length}`);
process.exit(R.some((x) => x.startsWith("FAIL")) ? 1 : 0);

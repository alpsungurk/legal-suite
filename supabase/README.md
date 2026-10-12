# LexKasa — Supabase kurulumu

Tek migration: [`migrations/20261012000000_lexkasa_init.sql`](migrations/20261012000000_lexkasa_init.sql)
(şema + RLS + iş fonksiyonları + zamanlanmış işler + Storage + keepalive).

> **Durum:** Arayüz Supabase Auth + tablolara bağlıdır. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 1. Kurulum (bir kerelik)

1. [supabase.com](https://supabase.com) → proje (önerilen bölge: **Frankfurt**).
2. **Database → Extensions:** `pg_cron` ve `pg_net` açın.
3. Migration'ı uygulayın (`npx supabase db push` veya SQL Editor).
4. **Authentication → Providers → Email:** açık. Confirm email ilk kurulumda kapalı tutulabilir.
   **Minimum password: 8.** Sign-ups: ilk bürodan sonra kapatın (yeni kullanıcı = davet).
5. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:5173` (canlıda domain)
   - Redirect URLs: `http://localhost:5173/**`, `http://localhost:5173/sifre-sifirla`
6. Keepalive (uyku engeli) — SQL Editor'de [`keepalive-setup.sql`](keepalive-setup.sql) çalıştırın.
7. Edge Function (kullanıcı daveti):
   ```bash
   npx supabase login
   npx supabase link --project-ref cflkynimfesmztxfurxl
   npx supabase functions deploy invite-user
   ```
8. Doğrulama:
   ```sql
   select jobname, schedule from cron.job;  -- 4 iş (keepalive dahil)
   select * from storage.buckets where id = 'attachments';
   select app.cron_keepalive();
   ```

## 2. Zamanlanmış işler (pg_cron)

Saatler UTC; Türkiye (UTC+3) yanlarında.

| İş | Ne zaman (TR) | Cron (UTC) | Ne yapar |
| ---- | ------------- | ---------- | -------- |
| `lexkasa-aylik-ucret` | Her **Pazartesi** 00:10 | `10 21 * * 0` | Aylık ücret tahakkuku |
| `lexkasa-bildirimler` | Her **Pazartesi** 08:00 | `0 5 * * 1` | Geciken / yaklaşan uyarılar |
| `lexkasa-saklama` | Her **Pazartesi** 03:30 | `30 0 * * 1` | Eski bildirim/aktivite + arşiv |
| `lexkasa-keepalive` | 5 günde bir 09:00 | `0 6 */5 * *` | Uyku önleyici ping |

Saatler sabittir; **Ayarlar → Zamanlama** yalnızca görüntüler. Kurulum: [`keepalive-setup.sql`](keepalive-setup.sql). View UNRESTRICTED uyarısı için: [`fix-views-cron.sql`](fix-views-cron.sql).

## 3. Auth akışları (arayüz)

| Akış | Nasıl |
|------|--------|
| Giriş | `resolve_login` → `signInWithPassword` |
| Büro kaydı | `signUp` → `create_organization` |
| Şifremi unuttum | `resetPasswordForEmail` → `/sifre-sifirla` |
| Avukat ekleme | Edge Function `invite-user` |

## 4. Yetkiler (RLS)

Her tablo `org_id` taşır. İzinler `my_permissions()` / `app.can` ile sunucuda zorunludur.
`anon` yalnızca `resolve_login` ve `keepalive` çağırabilir.

Görünümler: `v_account_balances` / `v_installments` / `v_client_balances` → `security_invoker`.
Hesap seçimi: `account_options()` RPC (eski `v_account_options` view kaldırıldı).

## 5. Test

```bash
npm run test:db
```

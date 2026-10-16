# Avukat geri bildirimi: Excel dosyaları ve icra listeleri

**Tarih:** 16.10.2026


## 1. Kısa özet

- Büro icra dosyalarını **Excel'de** tutuyor. **Alacaklı olduğumuz** ve **borçlu olduğumuz** dosyalar ayrı listelerde duruyor. Bizim için **asıl önemli olan alacaklı listesi**.
- **Borçlu olduğumuz dosyalar** aynı sütunlarla tutuluyor. Tek fark sütun sırası: alacaklı listesinde "Alacaklı" solda, borçlu listesinde "Borçlu" solda.
- **Şirket listeleri:** 5–6 müvekkil şirketin icra listeleri ayrı tutulmak isteniyor. Her şirket müvekkil için ayrı liste gerekmiyor. Büro bu şirket listelerini gerektiğinde **kendisi çoğaltabilmeli**.
- **Dosya durumları:** Açık, Kapalı, Durdurulmuş. Durdurulma sebeplerini avukat Excel'de yazacak.
- **Takip çıkış rakamı tek tutar olarak kalacak.** Asıl alacak / faiz / masraf ayrımı gerekmiyor.
- **Son haciz tarihinden 2 hafta önce hatırlatma** isteniyor.
- **Takip bilgileri** dosyaya özgü, **serbest metin** bir alan olmalı. Hazır liste olmamalı.
- **Müvekkiller için hazır bir Excel yok.** Vekaletler Drive'da duruyor ama liste hâlinde değil. Müvekkil aktarımında uygulamanın kendi şablonu kullanılacak.
- Avukat, bir icra dosyasının başlangıcından sonuçlanmasına kadar yapılan işlemleri **notlarıyla birlikte çıkaracak**. Liste yapısı buna göre birlikte son hâline getirilecek. Şu anki yapıyı "çok parça parça" buluyor. Bunun için **zamana ihtiyacı var**.

---

## 2. Avukatın talepleri

| # | Talep | Avukatın sözü | Uygulamadaki durum |
|---|-------|---------------|--------------------|
| T1 | Alacaklı ve borçlu olunan dosyalar ayrı listelerde | "Alacaklı ve borçlu olduklarımızı ayrı listelerde tutuyoruz normalde" | İcra modülü yalnızca **alacaklı** tarafı modelliyor (`clientId` = alacaklı müvekkil). Borçlu olunan dosya için bir alan ya da sayfa yok. |
| T2 | Borçlu olunan dosyalar için aynı yapı, ayrı sayfada | "farklı bir arayüzde ya da sayfada kullanabilirsek karışıklık olmamış olur" / aynı sütunlar, yalnızca Borçlu sütunu solda | Yok. |
| T3 | Belirli şirketlerin icra listelerini ayırmak | "Temelde 5-6 tane şirketin icra listeleri önem arz ediyor" / "Bu şirket listelerini gerektiğinde bizim çoğaltmamız da mümkün olursa iyi olur" | Dosyalar müvekkile bağlı, ama şirket bazında ayrı bir liste ya da görünüm yok. |
| T4 | Müvekkil aktarımı için şablon | "o şekilde excel yok" / vekaletler Drive'da, liste hâlinde değil | Uygulamada hazır müvekkil şablonu var (Excel ile toplu aktar → Müvekkiller). Ek iş yok. |
| T5 | İcra sürecinin baştan sona adımlarını listeye yansıtmak | "başlangıçtan sonuca kadar yaşanabilecek süreçleri sıralayıp…" | Avukattan süreç notları bekleniyor (bkz. bölüm 6). |
| T6 | Son haciz tarihinden önce hatırlatma | "Son haciz tarihinden 2 hafta önce hatırlatma uygun olur" | Son haciz tarihi alanı ve hatırlatması yok. |
| T7 | Dosyaya özgü "Takip bilgileri" alanı | "içeriğini de her dosya özelinde ayrı ayrı yazabileyim, matbu olmasın" | Yok. |

---

## 3. Excel dosyalarının incelemesi

### 3.1 Genel yapı

- Her iki dosyada tek sayfa var: **"Alacaklı olduğumuz dosyalar"**. Borçlu olunan dosyalar ayrı bir listede, aynı sütunlarla tutuluyor (T1, T2).
- **Boş şablon:** Yalnızca başlık satırı dolu. 724 satır biçimlendirilmiş ama içleri boş.
- **Örnek liste:** Başlık + **3 dolu satır** var (2 açık, 1 kapalı dosya).
- **Liste doğrulaması yok:** Hücrelerde açılır liste kullanılmıyor, değerler serbest yazılmış.

### 3.2 Sütunlar ve uygulamadaki karşılıkları

| Excel sütunu | Örnek değer | Uygulamadaki alan | Karar / uyum |
|---|---|---|---|
| A · Dosya Durumu | `Açık`, `Kapalı`, `Durdurulmuş` | `status` (Durum) | ⚠️ Büro **Açık / Kapalı / Durdurulmuş** kullanıyor. Liste zaten dinamik (**Ayarlar → Kategoriler → İcra durumları**), bu üç değer eklenmeli. Durdurulma sebepleri avukattan gelecek. |
| B · Alacaklı | `AD SOYAD` | `clientId` (Alacaklı müvekkil) | ⚠️ İsim serbest metin. Müvekkil kaydıyla eşleşmesi gerekiyor. Müvekkil yoksa aktarım takılır. Borçlu listesinde bu sütun sağa geçiyor. |
| C · Borçlu | `1- BORÇLU A 2- BORÇLU B` | `debtorIds` (Borçlular, birden çok) | ⚠️ Birden çok borçlu **tek hücrede**, `1- … 2- …` biçiminde. Ayrıştırılması gerekiyor. Borçlu listesinde bu sütun sola geçiyor. |
| D · Birim | `Ankara 5. Genel İcra Dairesi` | `office` (İcra dairesi) | ✅ Uyumlu. Bazı değerlerin sonunda boşluk var, kırpılmalı. |
| E · Dosya No | `2026/101 E.` | `no` (İcra dosya no) | ⚠️ `E.` = **Esas**. Nadiren talimat dosyası da olur. Ek yazılmasa da olur. Yazılırsa biçim sabit olmalı (bkz. 3.4). |
| F · Takip Türü | `İlamsız Takip` | `type` (Takip türü: İlamsız, İlamlı, Kambiyo…) | ⚠️ Yazım farklı ("İlamsız Takip" ≠ "İlamsız"). Liste dinamik (**Ayarlar → Kategoriler → Takip türleri**). Aktarımda eşleme ya da listeye ekleme gerekiyor. |
| G · Takip Bilgileri | `Araç Mahrumiyet Bedeli Alacağı`, `Kambiyo Alacağı` | — | ❌ **Karşılığı yok.** Dosyaya özgü **serbest metin** olarak eklenecek, hazır liste olmayacak (bkz. 3.5). |
| H · Takip Çıkış Rakamı | `10677.34`, `41786.300000000003` | `principal` + `interest` + `costs` | ⚠️ Takip talebindeki alacak kalemlerinin **toplamı**: asıl alacak + takip tarihine kadar işleyen faiz + duruma göre masraflar. Ayrım önemli değil, **tek tutar olarak kalacak**. Bazı değerlerde ondalık hatası var (`…300000000003`), yuvarlanmalı. |
| I · Açıklamalar | `15.04.2026 - … Ödeme emri tebliğ edilmiş. 24.04.2026 Ödeme son. …` | `note` (Not) | ⚠️ Çok uzun, **tarih sıralı işlem geçmişi**. Borçlu bazında olaylar tek hücrede birikmiş (ayrıntı 3.3'te). |
| J · Son Haciz Tarihi | `46202` (Excel tarih sayısı) | — | ❌ **Karşılığı yok.** Hücrede Excel'in tarih sayısı duruyor (46202 ≈ 29.06.2026). Aktarımda tarihe çevrilmeli. **2 hafta önce hatırlatma** üretilecek. |

**Excel'de olmayan, uygulamanın beklediği alanlar:**

- **Takip tarihi:** Açıklamalardaki ilk tarihten tahmin edilebilir, ayrı sütun yok.
- **Sorumlu avukat**
- **İlgili dava dosyası:** Avukat ilgili dosyayı şu an "Takip bilgileri" alanına yazıyor.

### 3.3 Açıklamalar sütunu (en kritik veri)

Bu sütun aslında bir **icra süreç günlüğü**. Örnek satırlarda geçen olay türleri:

- Ödeme emri tebliği / iadesi (borçlu bazında)
- Ödeme süresinin sonu
- Takibe / ödeme emrine **itiraz**, takibin durması, "itirazın iptali?" notu
- **Kesinleştirme** talebi ve kabulü
- **Sorgu** sonuçları (avukatın netleştirdiği **7 sorgu türü**):
  1. Araç
  2. Taşınmaz
  3. Alacaklı olduğu icra dosyası
  4. Banka
  5. SGK (maaş)
  6. SGK Mosip (şirketler için)
  7. Firma sorgu
- **Haciz** gönderimi: araç, taşınmaz, maaş, banka
- **Banka cevapları** (banka bazında olumlu/olumsuz ve tutar, ör. "X Bankası: … TL var")
- İşverenin borçlu olarak eklenmesi talebi

Bu bilgiler şu an serbest metin. Uygulamada tarih, olay türü ve ilgili borçluya göre **ayrı kayıtlar** olarak tutulursa şunlar mümkün olur:

- süre ve vade takibi,
- "kesinleştirme bekleyenler", "haczi düşecekler" gibi listeler,
- hatırlatmalar.

Bu yapı T5 ile doğrudan bağlantılı. Avukatın hazırlayacağı süreç notları olay türlerini netleştirecek.

> **Avukatın dönüşü:** Bu bölümü açıklayıcı buldu. Sorgu türlerini yukarıdaki 7 madde olarak netleştirdi.

### 3.4 Dosya numarası biçimi

- `E.` = **Esas**. Nadiren talimat dosyaları da oluyor.
- Ek yazılmasa da olur. Yazılırsa biçim **`2026/101 E.`** olmalı:
  - sayılar ve `/` arasında **boşluk yok**,
  - sayı ile harf arasında **bir boşluk** var,
  - harften sonra nokta var.
- **Neden önemli:** Avukat listede dosyaları Ctrl+F ile numarayla arıyor. Biçim tutarsızsa arama bulamıyor.
- **Uygulamaya etkisi:**
  - Dosya no girişinde ve Excel aktarımında bu biçime **otomatik düzeltme** yapılmalı. Örnek: `2026/101e.` → `2026/101 E.`
  - Mükerrer kontrolü ekli ve eksiz biçimi aynı dosya saymalı.
  - Uygulama içi arama ekten bağımsız çalışmalı.

### 3.5 Takip bilgileri alanı (dosyaya özgü serbest metin)

- Bu alan **olaya özgü** bir ayrım. Örnek: çek ve bono takipleri aynı takip yoluyla (**örnek 10**) açılıyor. Ama avukat her takibin ayrıntısını yazmak istiyor, böylece ileride açacağı takiplerde örnek alabiliyor.
- Avukat bu alana **ilgili olduğu dosyayı** da yazıyor.
- **Karar:** Alan **çok satırlı serbest metin** olacak. **Hazır liste (matbu) olmayacak.** Her dosyada ayrı ayrı yazılacak.
- Excel aktarımında ve dışa aktarımda bu sütun **mutlaka** yer alacak.

### 3.6 Karar: seçim listeleri dinamik olacak

Seçilen ya da sonradan eklenebilecek her değer **sabit kodlanmayacak**. Büro bu değerleri **Ayarlar → Kategoriler** sayfasından ekleyip çıkarabilecek. Dosya türleri ve masraf türleri bugün nasıl yönetiliyorsa bunlar da öyle yönetilecek. Aşağıdaki değerler yalnızca **varsayılan başlangıç listesi**.

| Liste | Varsayılan değerler | Durum |
|---|---|---|
| İcra durumları | **Açık, Kapalı, Durdurulmuş** (+ mevcut: Derdest, Haciz, Satış, Ödeme planı, Tahsil edildi, Kapandı) | ✅ Zaten dinamik; üç değer eklenecek |
| **Durdurulma sebepleri** | Avukatın Excel'iyle gelecek | 🆕 Eklenecek |
| Takip türleri | İlamsız, İlamlı, Kambiyo, Rehin, Kira, Diğer | ✅ Zaten dinamik |
| İcra daireleri | Kullanıldıkça eklenir | ✅ Zaten dinamik |
| **Sorgu türleri** | Araç, Taşınmaz, Alacaklı olduğu icra dosyası, Banka, SGK (maaş), SGK Mosip (şirketler için), Firma sorgu | 🆕 Eklenecek |
| **Haciz türleri** | Araç, Taşınmaz, Maaş, Banka | 🆕 Eklenecek |
| **Sorgu / haciz sonucu** | Olumlu, Olumsuz, Düşük miktar, Cevap bekleniyor | 🆕 Eklenecek |
| **İcra işlem türleri** (süreç günlüğü) | Ödeme emri tebliği, Ödeme emri iadesi, İtiraz, Kesinleştirme talebi, Sorgu, Haciz, Banka cevabı, Borçlu ekleme talebi | 🆕 Eklenecek; avukatın süreç notlarıyla kesinleşecek |

**Takip bilgileri** bu tabloda yok, çünkü liste değil, serbest metin (bkz. 3.5).

Bir değer listeden çıkarılırsa, o değerle girilmiş **eski kayıtlar silinmez ve değişmez**. Değer yalnızca yeni kayıtlarda seçilemez olur.

### 3.7 Şirket listeleri

- Kastedilen, şirket olan her müvekkil değil. **Belirli 5–6 müvekkil şirketin** icra listeleri.
- Gerekirse şirket isimleri avukattan alınıp onlar üzerinden ilerlenecek.
- Her şirket listesinde **alacaklı ve borçlu olunan dosyalar ayrı** gösterilebilirse iyi olur. Olmazsa şirketin tüm dosyaları tek listede durabilir.
- Büro yeni bir şirket listesini **kendisi ekleyebilmeli (çoğaltabilmeli)**. Yeni liste için kod değişikliği gerekmemeli.

---

## 4. Önerilen yapılacaklar

Öncelik sırasıyla:

1. **İcra dosyasına "taraf" ayrımı (T1, T2):**
   - "Alacaklı olduğumuz" ve "Borçlu olduğumuz" için bir alan eklenir.
   - Menüde iki ayrı liste olur. Varsayılan ve öne çıkan liste alacaklı listesi.
   - Borçlu listesinde "Borçlu" sütunu solda, "Alacaklı" sütunu sağda gösterilir.
   - Mevcut kayıtlar "alacaklı" kabul edilir, böylece veri kaybı olmaz.
2. **Excel aktarımını büronun listesine uydurmak (bölüm 3.2):**
   - Sütun başlıkları tanınmalı: Dosya Durumu, Alacaklı, Borçlu, Birim, Dosya No, Takip Türü, Takip Bilgileri, Takip Çıkış Rakamı, Açıklamalar, Son Haciz Tarihi.
   - Alacaklı ve borçlu listelerindeki farklı sütun sırası sorun olmamalı. Sütunlar başlığa göre tanınmalı.
   - `1- X 2- Y` biçimindeki borçlu hücresi ayrıştırılmalı.
   - "İlamsız Takip" → "İlamsız" eşlenmeli. "Açık" / "Kapalı" / "Durdurulmuş" doğrudan alınmalı.
   - Dosya no `2026/101 E.` biçimine getirilmeli (3.4).
   - Excel tarih sayısı tarihe çevrilmeli. Ondalık hataları yuvarlanmalı. Baştaki ve sondaki boşluklar kırpılmalı.
   - Alacaklı müvekkil kayıtlı değilse aktarım sırasında oluşturulması önerilmeli.
3. **Alan değişiklikleri:**
   - **Takip çıkış rakamı:** Asıl alacak / faiz / masraf yerine **tek tutar** alanı.
   - **Takip bilgileri:** Çok satırlı serbest metin (3.5).
   - **Son haciz tarihi** ve **2 hafta önce otomatik hatırlatma** (T6).
   - **Durdurulma sebebi:** Durum "Durdurulmuş" olduğunda seçilir.
4. **Dinamik listeler (3.6):** Sorgu türleri, haciz türleri, sonuçlar ve durdurulma sebepleri **Ayarlar → Kategoriler**'e eklenir.
5. **Şirket listeleri (T3, 3.7):**
   - Büro, seçtiği müvekkil şirketler için kendi listelerini oluşturur.
   - Her listede alacaklı ve borçlu dosyalar ayrı sekmelerde gösterilir.
   - Yeni liste eklemek için kod değişikliği gerekmez.
6. **Açıklamaları işlem geçmişine çevirmek (T5):** Avukatın süreç notları geldikten sonra olay türleri belirlenir. İlk aşamada mevcut açıklama metni "not" olarak aynen korunur.

---

## 5. Avukatın cevapları

| # | Soru | Cevap |
|---|---|---|
| 1 | Borçlu olunan dosyalar aynı sütunlarla mı? | Evet. Yalnızca sütun yeri değişiyor: borçlu listesinde "Borçlu" solda, "Alacaklı" sağda. |
| 2 | Dosya durumları neler? | Açık, Kapalı, Durdurulmuş. Durdurulma sebepleri Excel'de yazılacak. |
| 3 | Dosya no sonundaki "e." ne? | Esas. Nadiren talimat da olur. Yazılmasa da olur. Yazılırsa `2026/101 E.` biçiminde olmalı, Ctrl+F ile aranabilsin diye. |
| 4 | Takip çıkış rakamı neyi kapsıyor? | Takip talebindeki alacak kalemlerinin toplamı: asıl alacak + takip tarihine kadar faiz + duruma göre masraflar. Ayrım önemli değil, tek tutar olarak kalabilir. |
| 5 | Son haciz tarihi için hatırlatma? | Evet, **2 hafta önce**. |
| 6 | Şirket listeleri ne demek? | Belirli 5–6 müvekkil şirketin icra listeleri. Her şirket müvekkil için değil. Listeler içinde alacaklı ve borçlu ayrılabilirse iyi olur. Büro bu listeleri kendisi çoğaltabilmeli. |
| + | Ek | **Takip bilgileri** alanı dosyaya özgü, serbest metin olmalı (bkz. 3.5). |

---

## 6. Bekleyenler

- **Avukattan:**
  - Bir icra dosyasının başlangıçtan sonuçlanmaya kadar olan işlem adımları, notlarıyla birlikte. Avukat "biraz zaman lazım" dedi.
  - **Durdurulma sebepleri** (düzenlediği Excel'de).
  - Ayrı listesi tutulacak **5–6 şirketin isimleri** (gerekirse).
- **Bizden:** Bölüm 4'teki 1–4. maddeler. Bunlar avukatın süreç notlarını beklemeden başlanabilir. 5. madde için şirket isimleri, 6. madde için süreç notları gerekiyor.

---

## 7. Uygulamada yapılanlar (16.10.2026)

| Talep | Ne yapıldı | Nereden kullanılır |
|---|---|---|
| T1, T2 · Alacaklı / borçlu ayrımı | Her icra dosyasında **taraf** alanı var. İki ayrı sayfa: **Alacaklı olduğumuz** (eski icra listesi) ve **Borçlu olduğumuz**. Borçlu listesinde müvekkil (borçlu) solda, karşı taraf (alacaklı) sağda. Borçlu olduğumuz dosyalarda tahsilat, ödeme sözü ve taksit yok; büro carisine karışmaz. Mevcut bütün dosyalar "alacaklı olduğumuz" sayıldı, veri değişmedi. | Menü → İcra → Alacaklı olduğumuz / Borçlu olduğumuz |
| T3 · Şirket listeleri | Büro istediği kadar liste açar, her listeye müvekkil seçer. Her liste menüde ayrı görünür; içinde alacaklı ve borçlu dosyalar ayrı sekmede. Liste silmek dosyalara dokunmaz. | Ayarlar → Şirket listeleri |
| T6 · Son haciz hatırlatması | Dosyada **Son haciz tarihi** alanı. Haczin düşeceği tarih = son haciz + **12 ay**; bu tarihten **14 gün** önce ve **düşme günü** dosya sorumlularına (yoksa yöneticilere) birer bildirim gider; aynı hatırlatma iki kez gönderilmez. Her gün 08:00'de çalışan **cron job** (`lexkasa-haciz`). Ay ve gün sayısı değiştirilebilir. Panelde ve listede de yaklaşan haciz kırmızı görünür. | Ayarlar → Kategoriler → İcra → Haciz süresi |
| T7 · Takip bilgileri | Dosyaya özgü, çok satırlı **serbest metin**; hazır liste değil. | İcra dosyası formu, detay sayfası, Excel |
| §3.2 · Durumlar | **Açık / Durdurulmuş / Kapalı** ana durumlar (silinemez); yeni takip "Açık" başlar. Durdurulmuş seçilince **durdurulma sebebi** sorulur. Eski durumlar (Derdest, Haciz…) listede kaldı, istenirse silinir. | Ayarlar → Kategoriler → İcra |
| §3.4 · Dosya no biçimi | Kaydederken ve Excel aktarımında `2026/101 E.` biçimine getirilir. Arama ve mükerrer kontrolü ekten bağımsız (`2026/101e` = `2026/101 E.`). Eski kayıtlar otomatik değiştirilmedi; düzenlenip kaydedilen kayıt düzelir. | — |
| §3.2 · Takip çıkış rakamı | Asıl / faiz / masraf yerine **tek tutar**. Eski kayıtta düzenlerken toplam gösterilir; toplam korunur. | İcra dosyası formu |
| §3.3, T5 · İşlem geçmişi | Her dosyada **İşlem geçmişi**: tarih, işlem türü, borçlu, sorgu türü / haciz türü, sonuç, tutar, not. **Haciz** kaydı girilince son haciz tarihi kendiliğinden ileri alınır. | İcra dosyası detayı → İşlem ekle |
| §3.6 · Dinamik listeler | Ayarlar → Kategoriler'e eklendi: **durdurulma sebepleri, işlem türleri, sorgu türleri (7 madde), haciz türleri, sorgu/haciz sonuçları**. Hepsi eklenip çıkarılabilir; çıkarılan değer eski kayıtlarda kalır. | Ayarlar → Kategoriler |
| §4.2 · Excel aktarımı | Büronun Excel'i **olduğu gibi** yüklenir: Dosya Durumu, Alacaklı, Borçlu, Birim, Dosya No, Takip Türü, Takip Bilgileri, Takip Çıkış Rakamı, Açıklamalar, Son Haciz Tarihi başlıkları tanınır; sütun sırası önemli değil. "1- A 2- B" borçlular ayrılır, "İlamsız Takip" → İlamsız, Excel tarih sayısı tarihe, ondalık hatası yuvarlanır, açıklamalardaki satır sonları korunur. Kayıtlı olmayan müvekkil ve borçlular otomatik oluşturulur (A.Ş., Ltd. Şti. → Kurumsal). Borçlu olduğumuz dosyalar için ayrı aktarım türü var. Excel'e dışa aktarım da aynı sütun sırasıyla. | İcra listeleri → Excel ile aktar / Excel |

| Veri güvenliği · Kapalı dava dosyaları | Dava dosyası kapatılınca artık **hemen silinmiyor**: kayıtlarıyla birlikte **12 ay** (ayarlanabilir) kapalı olarak saklanıyor, bu sürede yeniden açılabiliyor. Süre dolunca bir sonraki ay başında (her ayın 1'i 03:45'te çalışan `lexkasa-kapali-dosya` işi) dosyayı siliyor; müvekkilde toplam alacak / verecek ve ücret toplamları, yıllık özette tutarlar kalıyor, kasa bakiyesi değişmiyor. İstenirse "Şimdi kalıcı sil" ile beklemeden silinebiliyor. | Ayarlar → Kategoriler → Dosyalar → Kapalı dosyaların saklanma süresi; dosya sayfası → Dosyayı kapat / Yeniden aç |

| Menü · İcra accordion'u | Soldaki menüde **İcra** açılır kapanır bir bölüm oldu: Alacaklı olduğumuz, Borçlu olduğumuz, **Şirket listeleri** (kendi içinde açılır; açılınca hemen altında **arama kutusu**, sonra listeler) ve Borçlular. Her şirket listesinin menüde kendi **ikonu** var. Menüye **Bildirimler** sayfası da eklendi (okunmamış sayısıyla); haciz hatırlatmaları buraya ve üstteki zile düşer. | Menü → İcra; Ayarlar → Şirket listeleri → Menü ikonu |
| Şirket listesinde yeni takip | Şirket listesi sayfasında **Yeni takip** ve **Excel ile aktar** düğmeleri var; listede tek şirket varsa yeni takip doğrudan o şirkete açılır. Listeye bir dosya girince (şirket müvekkili o listedeyse) kendiliğinden o listede görünür. | Menü → İcra → Şirket listeleri → liste |

| Ayarlar'ı avukata verme | Ayarlar → İzinler'de **Ayarlar sayfası** tablosu (üstteki izin tablosuyla aynı biçimde): Büro bilgileri (Görüntüle / Düzenle), Kategoriler ve Şirket listeleri (Görüntüle / Ekle / Düzenle / Sil), Kullanıcılar (Görüntüle / Ekle / Düzenle) ve Yedekleme (Görüntüle) ayrı ayrı verilir; tüm avukatlar için ya da tek bir avukat için ayarlanır. Örneğin bir avukat kategorilere değer ekleyebilir ama silemez. Kural veritabanında da zorunlu (arayüzü atlayarak değiştirmek mümkün değil). **İzinler sekmesi, Zamanlama ve arşivleme yalnızca Admin'de kalır.** İsteğe bağlı **"Kullanıcı ekleme ve düzenleme"** izni de verilebilir; ama bu izinle avukat sadece avukat rolünde kullanıcı ekler / düzenler / pasife alır / geçici şifre verir. Admin hesaplarına dokunamaz, kimseyi Admin yapamaz, izin veremez, e-posta değiştiremez, kendini pasife alamaz (veritabanında zorunlu). | Ayarlar → İzinler → Ayarlar sayfası |

### 7.1 "İcra Örnek Liste Talimat.xlsx" (avukatın ikinci dosyası)

Avukat örnek listeye **Takip Şekli** sütununu ekledi ve her sütunun seçeneklerini, takip şekline göre hangi gün ne hatırlatılacağını yazdı.

| Talimat | Ne yapıldı | Nereden kullanılır |
|---|---|---|
| Dosya durumu biçimi | Durum seçenekleri talimattaki gibi: **Açık**, **Açık (Durdurulmuş : sebep)**, **Kapalı (sebep)**. Durdurulma sebepleri: Takibe İtiraz, İcra Mahkemesine İtiraz, İhtiyati Tedbir, Tehir-i İcra Kararı, Diğer. Kapanış sebepleri: Yetkisizlik, Takipsizlik, Vazgeçme/Feragat, Takibin İptali, İnfaz, Haricen Tahsil. Excel'e bu biçimde yazılır, Excel'den bu biçimde okunur. | İcra dosyası formu → Dosya durumu |
| Otomatik "Kapalı (İnfaz)" | Tahsilatlar takip çıkış rakamına ulaşınca dosya kendiliğinden **Kapalı (İnfaz)** olur. | Tahsilat gir |
| Takip Şekli (Örnek No) | Yeni alan: Örnek No: 2, 3, 4-5, 6, 7, 8, 9, 10, 11, 12, 13, 13 (hasılat kirası), 14, 44. Her birinin **gün sayısı** ve süre dolunca **ne yapılacağı** (kesinleştirme / tahliye) ayarlardan değiştirilebilir. | İcra dosyası formu; Ayarlar → Kategoriler → Takip şekilleri ve süreleri |
| Kesinleştirme / tahliye hatırlatması | "Ödeme emri tebliği" işlemi girilince: tebliğ + takip şeklinin günü dolduktan **sonraki gün** hatırlatılır (Örnek 7: 30.09 tebliğ → 08.10 kesinleştirme; Örnek 10: 11. gün; Örnek 14: 16. gün tahliye). "Kesinleşme" / "Tahliye talebi" işlemi girilince süre kapanır. | İcra → **Süreler** |
| 89/1 → 89/2 | "89/1 haciz ihbarnamesi" işlemine **bankalar** ve her bankanın cevabı (Hacizli, Rehinli, Olumsuz, Tahsil edilebilir; birden fazla seçilebilir) girilir. **13 gün** sonra cevap vermeyen banka varsa 89/2 hatırlatılır. | İşlem ekle → 89/1 haciz ihbarnamesi |
| Maaş haczi | "Maaş haczi tebliği" işleminden **30 gün** sonra işverenin borçlu olarak eklenmesi hatırlatılır; "Borçlu ekleme talebi" girilince kapanır. | İcra → Süreler |
| Sorgu sonuçları (7 başlık) | "Sorgu" işleminde tek tür yerine 7 başlığın hepsi bir arada: Araç (adet), Taşınmaz (adet), Alacaklı olduğu icra dosyası (adet), Banka (adet ve hangi bankalar), SGK maaş (aktif/pasif), SGK Mosip (aktif/pasif), Firma (aktif firma sayısı). | İşlem ekle → Sorgu |
| Takip bilgileri | Hazır seçenekler (Çek Alacağı, Kira Alacağı, Fatura Alacağı…) listeden seçilir, listede olmayan elle yazılır ve listeye eklenir. | İcra dosyası formu |
| Süreler sayfası | Menü → İcra → **Süreler**: bütün dosyaların kesinleştirme, tahliye, 89/2, işveren, haciz yenileme ve taksit günleri tek listede. Gecikmiş / Bugün / Bu hafta sayıları, filtre, tarih aralığı, sıralama, Excel. **Tamamlandı** ile listeden düşer. Her sabah 08:00'de aynı kurallarla sorumlu avukata bildirim gider. | Menü → İcra → Süreler |
| Excel şablonu | Boş şablon talimattaki 11 sütunla (Takip Şekli dahil) yenilendi. Aktarımda "Takip Şekli" sütunu ("7" yazılsa da tanınır) ve "Kapalı (İnfaz)" gibi birleşik durumlar çözülür. | Excel ile aktar → Boş şablon |

**Test edildi:**
- Örnek listedeki 3 satırın hepsi hatasız ayrıştı. Durum metinleri ("Açık (Durdurulmuş : Takibe İtiraz)", "Kapalı (İnfaz)") ve takip şekli ("7", "Örnek 7", "Örnek No: 13 (hasılat kirası)") doğru eşlendi.
- Veritabanı testleri 186/186 geçti: yeni alanlar, işlem geçmişi yetkileri, haciz bildirimi, cron kurulumu, icra süreleri (tebliğ + 7 + 1 gün, 89/1 → 89/2, maaş → işveren, tamamlandı işareti, kapalı dosya, başka büro).
- Ekranlar tarayıcıda denenmedi.

## 8. Senin yapman gerekenler

1. **Yeni migration'ları sırayla çalıştır (zorunlu, önce bu):**
   - Supabase → SQL Editor'de önce `supabase/migrations/20261016000000_icra_geri_bildirim.sql`, sonra `supabase/migrations/20261016120000_kapali_dosya_saklama.sql`, sonra `supabase/migrations/20261016130000_ayarlar_izinleri.sql`, sonra `supabase/migrations/20261016140000_kullanici_yonetimi_devri.sql`, en son `supabase/migrations/20261016150000_icra_sureler.sql` dosyasının tamamını çalıştır. Alternatif: `npx supabase db push`.
   - Bu çalışmadan uygulama açılır, ama icra dosyası kaydetmek ve yeni ayarları kaydetmek **hata verir**.
2. **pg_cron açık mı kontrol et:**
   - Supabase → Database → Extensions → `pg_cron` açık olmalı.
   - Kapalıysa aç ve migration'ı bir kez daha çalıştır; tekrar çalıştırmak güvenli.
   - Sonra Ayarlar → Zamanlama'da **İcra süreleri ve haciz** işi görünmeli.
3. **`invite-user` fonksiyonunu yayınla** (önceki işten kalan adım, kullanıcı eklemek için gerekli): `npx supabase functions deploy invite-user`.
4. **Takip şekli günlerini avukatla teyit et.** Talimatta Örnek 7 (7 gün) ve Örnek 10 (11. gün) açıkça yazıyor; diğerlerinin günleri genel kurala göre girildi (Ayarlar → Kategoriler → Takip şekilleri ve süreleri'nden değiştirilebilir). 89/1 için 13 gün, maaş haczi için 30 gün de oradan değişir. Durdurulma sebepleri artık talimattaki listeyle geliyor.
5. **Ayarlar → Şirket listeleri**'nde 5–6 şirketi tanımla; şirket isimleri avukattan alınacak.
6. **12 ay / 14 gün kuralını avukatla teyit et.** Farklıysa Ayarlar → Kategoriler → Haciz süresi'nden değiştir.
7. **Avukatın icra süreç notları gelince** işlem türlerini Kategoriler'den güncelle.
8. **Gerçek listeyi denemeden önce yedek al** (Ayarlar → Yedekleme). Sonra Excel ile aktar → İcra – alacaklı olduğumuz ile avukatın listesini yükle; önizlemede hatalı satır kalmamalı.

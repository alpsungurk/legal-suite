# Avukat Yönetim Paneli · Yenilikler

**Tarih:** 16.10.2026

Geri bildirimleriniz doğrultusunda panele eklenenler ve değişenler aşağıda. Her başlıkta özelliğin **ne işe yaradığı** ve **nereden kullanılacağı** yazıyor. Sonda sizden beklediğimiz birkaç bilgi var.

---

## İçindekiler

1. [Giriş, çıkış ve görünüm](#1-giriş-çıkış-ve-görünüm)
2. [Kullanıcılar ve şifreler](#2-kullanıcılar-ve-şifreler)
3. [İcra: alacaklı ve borçlu olduğumuz dosyalar](#3-icra-alacaklı-ve-borçlu-olduğumuz-dosyalar)
4. [İcra dosyası formu](#4-icra-dosyası-formu)
5. [İşlem geçmişi](#5-işlem-geçmişi)
6. [Haciz süresi ve hatırlatmalar](#6-haciz-süresi-ve-hatırlatmalar)
7. [Şirket listeleri](#7-şirket-listeleri)
8. [Excel ile toplu aktarım](#8-excel-ile-toplu-aktarım)
9. [Excel'e dışa aktarım ve yazdırma](#9-excele-dışa-aktarım-ve-yazdırma)
10. [Ayarlar → Kategoriler](#10-ayarlar--kategoriler)
11. [Kapalı dava dosyaları](#11-kapalı-dava-dosyaları)
12. [Bildirimler ve "Dikkat gerektirenler"](#12-bildirimler-ve-dikkat-gerektirenler)
13. [Cari hesap ve silme işlemleri](#13-cari-hesap-ve-silme-işlemleri)
14. [İzinler: kim neyi görür, ne yapar](#14-izinler-kim-neyi-görür-ne-yapar)
15. [Menü](#15-menü)
16. [Sizden beklediklerimiz](#16-sizden-beklediklerimiz)

---

## 1. Giriş, çıkış ve görünüm

- **Kullanıcı adı veya e-posta ile giriş:** Giriş ekranında ikisinden biri yazılabilir.
- **Beni hatırla:**
  - **İşaretli değilse:** Tarayıcı kapanınca oturum kapanır, panel bir sonraki açılışta giriş ekranıyla gelir.
  - **İşaretliyse:** Bu bilgisayarda oturum açık kalır. Ortak kullanılan bilgisayarlarda işaretlemeyin.
- **Çıkış:** "Çıkış yap"a basınca oturum hemen kapanır ve giriş ekranına dönülür. Açık olan diğer sekmeler de çıkış yapar.
- **Hatalı giriş:** Kullanıcı adı veya şifre yanlışsa ekranın köşesinde uyarı çıkar. Pasife alınmış bir hesap da aynı uyarıyı görür, yani hesabın pasif olduğu belli edilmez.
- **Şifremi unuttum:** Şimdilik kapalı. Butona basınca "yakında" uyarısı çıkar. Şifresini unutan kullanıcıya yönetici geçici şifre verebilir (bkz. bölüm 2).
- **Açık / koyu tema:** Giriş ekranının ve panelin sağ üstünde Açık / Koyu / Sistem seçimi var. "Sistem" seçiliyse bilgisayarınızın temasına uyar.
- **Daha büyük yazılar:** Paneldeki bütün yazılar biraz büyütüldü, küçük yazılar daha okunur hâle geldi.
- **Panel adı:** Sekme başlıklarında ve giriş ekranında "Avukat Yönetim Paneli" yazıyor.

## 2. Kullanıcılar ve şifreler

**Nereden:** Ayarlar → Kullanıcılar

- **Kullanıcı ekleme:**
  - Ad soyad, rol (Admin / Avukat), ünvan, kullanıcı adı, e-posta, telefon ve **geçici şifre** girilir.
  - Kullanıcı geçici şifreyle ilk girdiğinde, panel açılmadan önce **kendi şifresini belirlemesi istenir**. Yeni şifre geçici şifreyle aynı olamaz.
- **Şifre sıfırlama:**
  - Şifresini unutan kullanıcının satırındaki menüden **"Şifre sıfırla"** seçilip yeni bir geçici şifre verilir.
  - Kullanıcı bununla girince yine kendi şifresini belirler.
- **Pasife alma:**
  - Bir kullanıcıyı silmek yerine **pasife alabilirsiniz**. Pasif kullanıcı giriş yapamaz ama girdiği kayıtlar ve geçmiş silinmez.
  - İstediğiniz zaman yeniden etkinleştirebilirsiniz.
- **Kendi bilgileriniz:** Ad, ünvan, telefon ve şifrenizi sağ üstteki kullanıcı menüsünden **"Hesabım ve şifre"** sayfasından değiştirirsiniz. Kullanıcılar listesindeki kendi satırınız da sizi bu sayfaya götürür.
- **E-posta değişmez:** Bir kullanıcının e-postası sonradan değiştirilemez, çünkü giriş hesabı bu e-postayla açılır.

## 3. İcra: alacaklı ve borçlu olduğumuz dosyalar

**Nereden:** Menü → İcra

- **Alacaklı olduğumuz:** Müvekkilimizin alacaklı olduğu takipler. Daha önce girilen bütün icra dosyaları buraya geçti, hiçbir veri değişmedi.
- **Borçlu olduğumuz:** Müvekkilimizin borçlu olduğu takipler, ayrı bir sayfada.
  - Listede sizin Excel'inizdeki gibi **"Borçlu" sütunu solda, "Alacaklı" sağda** durur.
  - Bu dosyalarda tahsilat, ödeme sözü ve taksit tutulmaz, müvekkilin carisine karışmaz.
- **Liste sütunları:** Excel listenizle aynı sırada:
  - Dosya durumu
  - Alacaklı → Borçlu
  - Birim / Dosya no
  - Takip türü
  - Takip çıkış rakamı
  - Haczin düşeceği tarih
  - Tahsilat ve sorumlu
- **Liste araçları:**
  - **Arama:** Dosya no, birim, alacaklı, borçlu veya takip bilgisinde arar. `2026/101 E.` ile `2026/101` aynı dosyayı bulur.
  - **Filtreler:** Durum, takip türü, durdurulma sebebi ve takip tarihi aralığı.
  - **Kartlar:** Üstte takipteki alacak, tahsil edilen, **haczi düşecek dosya sayısı** ve tutulmayan ödeme sözleri.
- **Borçlular sayfası:** Yalnızca borçlu olduğumuz dosyalarda karşı taraf olan kişi ve şirketler Borçlular listesinde görünmez, karışıklık olmaz.

## 4. İcra dosyası formu

**Nereden:** İcra → Yeni takip ya da bir dosyada **Düzenle**

| Alan | Açıklama |
|---|---|
| **Taraf** | En üstte "Alacaklı olduğumuz / Borçlu olduğumuz". Seçime göre alan adları değişir: "Alacaklı (müvekkilimiz) / Borçlular" ya da "Borçlu (müvekkilimiz) / Alacaklı (karşı taraf)". |
| **Dosya no** | Kaydederken kendiliğinden **`2026/101 E.`** biçimine getirilir: sayılar ve "/" arasında boşluk yok, harften önce bir boşluk, sonra nokta. Ctrl+F ile ararken hep aynı biçimi bulursunuz. Ek yazılmasa da olur. |
| **Birim** | İcra dairesi. Listede yoksa yazılır, listeye eklenir. |
| **Dosya durumu** | **Açık / Durdurulmuş / Kapalı** ana durumlar. Yeni takip "Açık" başlar. |
| **Durdurulma sebebi** | Yalnızca durum "Durdurulmuş" seçilince çıkar. Listeden seçilir ya da yazılır. |
| **Takip çıkış rakamı** | Asıl alacak, faiz ve masraf ayrımı kaldırıldı, **tek tutar** girilir. Eski dosyalarda bu üçünün toplamı gösterilir, toplam korunur. |
| **Takip tarihi** | Takibin açıldığı tarih. |
| **Son haciz tarihi** | Haczin düşeceği tarih otomatik hesaplanır ve alanın altında yazar (bkz. bölüm 6). |
| **Takip bilgileri** | **Dosyaya özgü serbest metin**, hazır liste değil. Alacağın niteliği (çek, bono, örnek 10…), ileride örnek alınacak ayrıntılar, ilgili dosya buraya yazılır. Çok satırlı yazılabilir. |
| **Açıklamalar** | Genel notlar. |
| Sorumlu avukat, ilgili dava dosyası | Eskisi gibi. |

## 5. İşlem geçmişi

**Nereden:** Bir icra dosyasının sayfası → **İşlem ekle**

Dosyada yapılan her adım tarihiyle ayrı bir kayıt olarak tutulur ve sayfada zaman çizelgesi olarak görünür.

- **İşlem türleri:**
  - Ödeme emri tebliği
  - Ödeme emri iadesi
  - İtiraz
  - Kesinleştirme talebi
  - Sorgu
  - Haciz
  - Banka cevabı
  - Borçlu ekleme talebi
  - Diğer
- **Sorgu türü:** İşlem "Sorgu" ise sorgu türü seçilir. Sizin belirttiğiniz 7 tür:
  1. Araç
  2. Taşınmaz
  3. Alacaklı olduğu icra dosyası
  4. Banka
  5. SGK (maaş)
  6. SGK Mosip (şirketler için)
  7. Firma sorgu
- **Haciz türü:** İşlem "Haciz" ise haciz türü seçilir: Araç, Taşınmaz, Maaş, Banka.
- **Sonuç:** Olumlu / Olumsuz / Düşük miktar / Cevap bekleniyor.
- **Diğer alanlar:** Hangi borçluya ait olduğu, varsa tutar (örneğin bankada bulunan para) ve not.
- **Haciz kaydı:** Bir **Haciz** işlemi eklendiğinde, tarih daha yeniyse dosyanın **son haciz tarihi kendiliğinden güncellenir**. Ayrıca elle girmeniz gerekmez.

Bütün bu listeler (işlem, sorgu, haciz türleri ve sonuçlar) Ayarlar → Kategoriler'den değiştirilebilir. Süreç notlarınız gelince birlikte son hâline getirebiliriz.

## 6. Haciz süresi ve hatırlatmalar

- **Haczin düşeceği tarih:** Son haciz tarihi + **12 ay**.
- **Hatırlatmalar:** Dosyanın sorumlu avukatına (sorumlu yoksa yöneticilere) iki bildirim gider:
  - Haczin düşmesinden **14 gün önce**: "Haczin düşmesine X gün kaldı"
  - **Düşme günü:** "Haciz bugün düşüyor"
- **Kontrol saati:** Her sabah 08:00'de otomatik yapılır. Aynı hatırlatma ikinci kez gönderilmez. Son haciz tarihi değişirse hatırlatmalar yeni tarihe göre baştan başlar.
- **Panelde ve listede:** Haczi yaklaşan ya da süresi dolmuş dosyalar kırmızı görünür ve "Dikkat gerektirenler"de listelenir.
- **Ajanda:** Haczin düşeceği tarihler takvimde turuncu **"Haciz düşüyor"** kaydı olarak kendiliğinden görünür.
- **Süreyi değiştirmek:** Ayarlar → Kategoriler → **Haciz süresi ve hatırlatma** bölümünden yapılır. 12 ay ve 14 gün değiştirilebilir.
- **Kapsam:** Borçlu olduğumuz dosyalar ve kapalı dosyalar için hatırlatma gönderilmez.

## 7. Şirket listeleri

**Nereden:** Ayarlar → Şirket listeleri (oluşturma), Menü → İcra → Şirket listeleri (görüntüleme)

Önemli şirket müvekkillerin icra dosyalarını ayrı listelerde görmek için.

- **Liste oluşturma:** Bir liste açın, adını verin, içine bir ya da birden fazla müvekkil seçin. Her şirkete ayrı liste de açabilirsiniz.
- **İkon:** Her listeye menüde görünecek bir ikon seçebilirsiniz (bina, fabrika, kamyon, mağaza…).
- **Liste sayfası:** **Alacaklı olduğumuz** ve **Borçlu olduğumuz** dosyalar ayrı sekmelerde durur.
- **Yeni takip:** Listede tek şirket varsa "Yeni takip" doğrudan o şirketle açılır.
- **Otomatik:** Listedeki şirketlere ait yeni bir icra dosyası açıldığında, dosya kendiliğinden o listede görünür.
- **Silme:** Bir listeyi silmek yalnızca görünümü kaldırır, icra dosyaları silinmez.
- **Müvekkil kaydı şart:** Şirketin müvekkil olarak kayıtlı olması gerekir. Excel'den aktarılan alacaklı şirketler kendiliğinden müvekkil olarak açılır.

## 8. Excel ile toplu aktarım

**Nereden:** İcra → Alacaklı olduğumuz (ya da Borçlu olduğumuz) → **Excel ile aktar**

- **Şablon:** "Şablon" düğmesi **sizin gönderdiğiniz İcra Boş Şablon.xlsx dosyasının aynısını** indirir.
  - Borçlu olduğumuz dosyalar için aynı şablonun "Borçlu solda, Alacaklı sağda" hâli iner.
  - Mevcut Excel listenizi de doğrudan yükleyebilirsiniz.
- **Sütun sırası:** Önemli değil, sütunlar başlıklarına göre tanınır. Tanınan başlıklar: Dosya Durumu, Alacaklı, Borçlu, Birim, Dosya No, Takip Türü, Takip Bilgileri, Takip Çıkış Rakamı, Açıklamalar, Son Haciz Tarihi.
- **Yüklerken kendiliğinden yapılanlar:**
  - **Birden fazla borçlu:** Tek hücredeki "1- Ali Veli 2- Ayşe Kaya" ikiye ayrılır.
  - **Takip türü:** "İlamsız Takip" → İlamsız, "Kambiyo Takibi" → Kambiyo olarak eşlenir. Listede olmayan bir tür yazılmışsa yeni tür olarak eklenir.
  - **Dosya no:** `2026/26534 e.` → `2026/26534 E.` biçimine getirilir.
  - **Tarihler:** Excel'in tarih sayıları doğru tarihe çevrilir. Takip tarihi yazılmamışsa açıklamadaki ilk tarih alınır.
  - **Tutarlar:** Küsurat hataları düzeltilir (ör. 41786,300000003 → 41.786,30).
  - **Yazım:** Açıklamalardaki ve takip bilgilerindeki satır sonları korunur.
  - **Kayıtsız müvekkil ve borçlular:** Otomatik oluşturulur. Adında A.Ş., Ltd., Şti. gibi ifadeler geçenler "Kurumsal" açılır.
  - **Tekrar yükleme:** Aynı dosya iki kez yüklenirse ikinci kez eklenmez, "zaten kayıtlı" diye atlanır.
- **Önizleme:** Aktarmadan önce her satır ekranda kontrol edilir. Hatalı satırlar kırmızıdır ve hücreleri orada düzeltebilirsiniz.
- **Sorumlu avukat:** Önizlemede her satıra bir ya da birden fazla sorumlu avukat seçilebilir.
- **Toplu uygula** (Excel'deki "aşağı doldur" gibi):
  - Bir sütun ve değer seçip ekrandaki bütün satırlara tek seferde yazabilirsiniz. Örneğin bütün dosyalara aynı sorumlu avukat, aynı birim ya da aynı durum.
  - **"Kendim"** düğmesi sorumlu olarak sizi seçer.
  - **"Yalnızca boş olanlar"** işaretlenirse dolu hücrelere dokunulmaz.
- **Uyarı:** Toplu aktarım tek tuşla geri alınamaz. Gerçek listeyi yüklemeden önce 2–3 satırla deneme yapmanızı öneririz.

## 9. Excel'e dışa aktarım ve yazdırma

- **Dışa aktarım:** İcra listesinin **Excel** düğmesi, dosyaları sizin listenizdeki sütun sırasıyla indirir. Ardından haczin düşeceği tarih, tahsil edilen, kalan, durdurulma sebebi ve sorumlu sütunları gelir.
- **Ekstre ve döküm:** "Ekstre yazdır" ve "Masraf dökümü" yeni sekmede açılır. Daha önce bu sekme giriş ekranına atıyordu, düzeltildi.

## 10. Ayarlar → Kategoriler

Formlardaki bütün açılır listeler buradan yönetilir. Değer ekleyebilir, silebilirsiniz. Silinen değer eski kayıtlarda olduğu gibi kalır.

- **İcra durumları:** Açık, Durdurulmuş, Kapalı ve Tahsil edildi silinemez, çünkü program bunları kendisi kullanır. Derdest, Haciz gibi eski durumlar listede duruyor, isterseniz silebilirsiniz.
- **Durdurulma sebepleri:** Şimdilik geçici değerler var: Borçlu itirazı, Şikâyet, Tedbir kararı, Diğer.
- **İcra işlem geçmişi listeleri:** İşlem türleri, sorgu türleri, haciz türleri ve sorgu/haciz sonuçları.
- **Haciz süresi ve hatırlatma:** Haciz süresi (ay) ve kaç gün önce hatırlatılacağı.
- **Kapalı dosyaların saklanma süresi:** Bkz. bölüm 11.

## 11. Kapalı dava dosyaları

- **Önceden:** Bir dava dosyası kapatılınca **hemen** siliniyordu.
- **Şimdi:**
  - Dosya kapatılınca bütün kayıtlarıyla (masraf, tahsilat, belge, ajanda) **12 ay** kapalı olarak saklanır.
  - Bu sürede dosya sayfasından **"Yeniden aç"** ile geri açılabilir.
  - Süre dolunca, sonraki **ayın 1'inde** otomatik silinir. Dosya sayfasında kayıtların hangi tarihte silineceği yazar.
- **Silinince kalanlar:** Müvekkil kartında toplam alacak / verecek ve ücret toplamları, yıllık raporlarda tutarlar kalır. Kasa ve banka bakiyeleri değişmez.
- **Beklemeden silmek:** Kapalı bir dosyada **"Şimdi kalıcı sil"** düğmesi var (yalnızca silme yetkisi olanlarda).
- **Süreyi değiştirmek:** Ayarlar → Kategoriler → Dosyalar'dan 1 ile 120 ay arası seçilebilir.
- **İcra dosyaları:** Kapatılınca silinmez, kapalı olarak listede kalır.

## 12. Bildirimler ve "Dikkat gerektirenler"

**Bildirimler** (Menü → Genel → Bildirimler):
- **Liste:** Size gelen bütün bildirimler. Haciz hatırlatmaları, size atanan işler, taksit ve ajanda hatırlatmaları burada.
- **Sayılar:** Üstte okunmamış, bugün, son 7 gün ve toplam bildirim sayısı. Toplam kartında en çok gelen türler yazar.
- **Filtre ve sıralama:**
  - Durum (okunmamış / okundu), tür ve tarih aralığı filtreleri.
  - Arama.
  - Sütun başlıklarına tıklayarak sıralama. Varsayılan en yeni en üstte.
- **Okundu sayma:** Bir bildirime tıklayınca ilgili kayıt açılır ve bildirim okundu sayılır. Birden fazla bildirimi seçip toplu "Okundu say" yapabilirsiniz.
- **Dikkat gerektirenler düğmesi:** Sağ üstte, sayı rozetiyle. Tıklayınca ilk uyarılar açılır, "Tümü" tam listeye götürür.

**Dikkat gerektirenler** (Bildirimler → sağ üst → Tümü):
- **Kapsam:** Geciken ya da yaklaşan taksitler, ödeme sözleri, bugün ve yarınki ajanda, haczi düşmek üzere olan dosyalar.
- **Sayılar:** Üstte toplam ve acil sayısı, ayrıca Taksit, Ödeme sözü, Ajanda ve Haciz için ayrı sayılar.
- **Filtre ve sıralama:** Öncelik (Acil / Yaklaşan / Bilgi), tür ve tarih filtreleri, arama, sıralama.
- **Kendiliğinden kalkar:** Liste anlık hesaplanır. İlgili kayıt düzelince (taksit ödenince, yeni haciz girilince…) uyarı listeden kalkar.

**Zil bildirimleri:** Taksit ve ajanda bildirimleri her **Pazartesi 08:00**'de, haciz hatırlatmaları **her gün 08:00**'de gelir.

## 13. Cari hesap ve silme işlemleri

- **Cari hesap hareketleri:**
  - Cari hesap sayfasında bir müvekkilin satırına tıklayınca hareketleri yan panelde açılır: masraf, ücret, tahsilat, icra tahsilatı, müvekkile aktarım.
  - Her hareketin menüsünden **"Kaydın sayfasına git"** ya da **"Sil"** seçilebilir. Aynı şey Müvekkil → Ekstre sekmesinden de yapılabilir.
  - Silinen hareket asıl kaydından silinir ve müvekkilin bakiyesi buna göre değişir.
- **Yeni silinebilenler** (silme yetkisi olanlar için):
  - **İcra dosyası:** Silinince ödeme sözleri, işlem geçmişi, görüşme notları, belgeler ve ajanda kayıtları da silinir. Masraflar kalır. **Tahsilatı olan icra dosyası silinemez**, çünkü kasa ve cari bakiye bozulurdu. Önce tahsilatları silin ya da dosyayı "Kapalı" yapın.
  - **Borçlu:** Bir icra dosyasında geçiyorsa ya da ödeme sözü / tahsilatı varsa silinemez.
  - **Ödeme sözü / taksit** ve **görüşme notu.**
  - **Cari hareketler:** Yukarıda anlatıldığı gibi. Tahsilatı olan bir ücret planı silinemez, önce tahsilatlar geri alınır.
- **Onay:** Her silmede neyin silineceğini yazan bir onay penceresi çıkar. Silme geri alınamaz.
- **Kullanıcılar:** Kullanıcılar silinmez, pasife alınır (bkz. bölüm 2).

## 14. İzinler: kim neyi görür, ne yapar

**Nereden:** Ayarlar → İzinler (yalnızca Admin)

- **İzin tablosu:** Her alan için Görüntüle / Ekle / Düzenle / Sil ayrı ayrı açılıp kapanır.
- **Kapsam:** İzinleri bütün avukatlar için birlikte ya da tek bir avukat için ayrıca belirleyebilirsiniz.
- **Ekstre ve döküm yazdırma:** Yeni bir izin satırı. Avukatlarda varsayılan olarak kapalı.
- **Ayarlar sayfası:**
  - Sağ üstteki anahtarla avukata **Ayarlar sayfası açılabilir** ya da tamamen kapatılabilir.
  - Açılınca her bölüm ayrı ayrı verilir:

| Bölüm | Görüntüle | Ekle | Düzenle | Sil |
|---|---|---|---|---|
| Büro bilgileri | görür | — | değiştirir | — |
| Kategoriler | görür | değer ekler | haciz ve saklama sürelerini değiştirir | değer siler |
| Şirket listeleri | görür | liste açar | ad, müvekkil, ikon değiştirir | listeyi siler |
| Kullanıcılar | listeyi görür | avukat ekler | düzenler, pasife alır, geçici şifre verir | — |
| Yedekleme | görür, yedeği indirir | — | — | — |

- **Kullanıcılar izni olan avukat:** Admin hesaplarına dokunamaz, kimseyi Admin yapamaz ve izin veremez.
- **Her zaman yalnızca Admin'de kalanlar:** İzinler sekmesi, zamanlanmış işler ve eski yılları arşivleme.
- **Güvenlik:** Bu kurallar yalnızca ekranda değil, veritabanında da zorunlu. Ekranı atlayarak izin dışı bir işlem yapılamaz.

## 15. Menü

- **Bildirimler:** Genel bölümüne eklendi, okunmamış sayısıyla.
- **İcra:** Açılır kapanır bir bölüm oldu. İçinde Alacaklı olduğumuz, Borçlu olduğumuz, **Şirket listeleri** ve Borçlular var.
- **Şirket listeleri:** Kendi içinde açılır. Hemen altında listeler arasında arama yapılacak **arama kutusu**, sonra her biri kendi ikonuyla listeler gelir.
- **Hiyerarşi:** Alt başlıklar içeride ve küçük yazıyla gösterilir, hangisinin neyin altında olduğu net görünür.

---

## 16. Sizden beklediklerimiz

1. **Durdurulma sebepleri:** Kullandığınız sebepleri iletirseniz Kategoriler'e ekleyelim. Şu an geçici değerler var.
2. **Şirket listeleri:** Ayrı listesi tutulacak 5–6 şirketin isimleri.
3. **Haciz süresi:** "Son haciz + 12 ay, 14 gün önce ve düşme günü hatırlatma" kuralı sizin için uygun mu?
4. **Kapalı dava dosyaları:** Kapatıldıktan sonra 12 ay saklanıp silinmesi uygun mu? Yasal bir saklama süresi varsa ona göre ayarlarız.
5. **İcra süreç notları:** Bir icra dosyasının başlangıçtan sonuçlanmaya kadarki adımlarını notlarınızla gönderdiğinizde, işlem türlerini ve listeyi birlikte son hâline getirebiliriz.

Kullanırken takıldığınız ya da farklı olmasını istediğiniz her şeyi iletebilirsiniz.

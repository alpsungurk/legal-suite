# LexKasa nasıl çalışır? (adım adım)

Bu belge LexKasa'yı hiç kullanmamış birine göre yazıldı. Her bölümde **neyi, nereden, hangi sırayla** yapacağın ve **bir adımı atlarsan neyin çalışmayacağı** yazıyor.

---

## 0. Başlamadan önce bilmen gereken 4 şey

1. **İki tür kullanıcı var: Admin (büro sahibi) ve Avukat.**
   - Admin her şeyi görür ve yapar: para, kasa, raporlar, ayarlar.
   - Avukat **varsayılan olarak** dosya, müvekkil, masraf, ajanda ve icra ile çalışır; parayı (tahsilat, kasa, cari) görmez.
   - **Avukatın neyi görüp neyi yapacağını sen belirlersin:** Ayarlar → **İzinler** (bölüm 1.6).
2. **Her büro ayrı bir çalışma alanıdır.** Bir büronun kullanıcısı başka büronun hiçbir kaydını göremez.
3. **Kullanıcı adları bütün bürolarda tektir.** Başka bir büroda "admin" varsa sen "admin" alamazsın.
4. **Veriler Supabase (sunucu) üzerindedir.**
   - Aynı büro hesabıyla farklı bilgisayarlardan giriş yapılabilir.
   - İzinler veritabanında (RLS) zorunludur; arayüz gizlemesi yalnızca kolaylıktır.
   - Yine de düzenli yedek alın (bkz. bölüm 14).

---

## 1. İlk kurulum (büro sahibi, sadece bir kere)

Bu adımları sırayla yap. Atlarsan sonraki bölümlerde takılırsın.

### 1.1 Büro hesabını aç

1. Giriş sayfasında **"Yeni büro hesabı oluşturun"** bağlantısına tıkla.
2. Büro adı, adın, kullanıcı adın, e-postan ve şifreni (en az 8 karakter) yaz.
3. **"Büro hesabını oluştur"**a bas. Doğrudan panele girersin; **sen Admin olursun.**

> Büronun içinde hazır olarak **Büro Kasası** ve **Barokart** hesapları gelir.

### 1.2 Büro bilgilerini doldur

**Ayarlar → Büro** sekmesi.

- Üstte **Organizasyon** kartı var: büro adı, organizasyon kodu, kuruluş tarihi, kullanıcı sayısı.
- Altta adres, telefon, vergi no, IBAN, logo ve ekstre notu var. Bunlar müvekkile verdiğin **PDF ekstrede** görünür.
- Değiştirince altta çıkan **"Değişiklikleri kaydet"**e bas.

> ⚠️ Büro adını değiştirmek istersen **"Kısa ad"** alanını değiştir. Sol menüdeki ad da değişir.

### 1.3 Kasa ve banka hesaplarını kontrol et

**Banka & Kasa** sayfası.

- Büro Kasası ve Barokart zaten var. Banka hesabın varsa **"Yeni hesap"** ile ekle.
- Hesapta para varsa **açılış bakiyesini** gir, yoksa kasa bakiyesi yanlış görünür.

> ⚠️ **Masraflar sadece Büro Kasası veya Barokart'tan ödenebilir.** Bu ikisini silersen ya da pasif yaparsan masraf girerken hesap seçemezsin.

### 1.4 Kategorileri ayarla

**Ayarlar → Kategoriler** sekmesi. Formlardaki **bütün açılır listeler** buradan gelir; istediğin değeri ekler, istemediğini silersin:

| Grup               | Listeler                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Dosyalar           | Dosya türleri, **dosya durumları**, **mahkemeler**, belge kategorileri, ajanda türleri       |
| Masraf ve tahsilat | Masraf türleri, **ücret türleri**, **ödeme yöntemleri**                                      |
| İcra               | **İcra durumları** (Haciz, Satış…), **takip türleri**, **icra daireleri**, görüşme kanalları |

- Kutuya yaz, **"Ekle"**ye bas → hemen bütün formlarda çıkar.
- Değerin yanındaki **×** ile silersin. Eski kayıtlarda o değer olduğu gibi kalır.
- Yanında **🔒 kilit** olan değerler silinemez, çünkü program onları kendisi kullanır:
  - Dosya durumu **"Kapalı"** → dosyayı kapatır; **"Açık"** → yeni dosyanın durumu.
  - İcra durumu **"Derdest"**, **"Tahsil edildi"**, **"Kapandı"** → otomatik kullanılır.
  - Ücret türü **"Aylık ücret"** → aylık ücretin otomatik oluşturulması.
- Aktif / Pasif, Bireysel / Kurumsal gibi sabit seçimler listede yoktur, değişmez.

> ⚠️ Bir değer burada yoksa, ne formda seçebilirsin ne de Excel'den aktarabilirsin. Önce buraya ekle. (Mahkeme ve icra dairesi hariç: onları formda yazınca kendiliğinden eklenir.)

### 1.5 Avukatları ekle

**Ayarlar → Kullanıcılar → "Kullanıcı ekle"**.

1. Ad soyad, rol (**Avukat**), kullanıcı adı, e-posta ve şifre yaz.
2. Kaydet. Avukata kullanıcı adını ve şifresini ver; giriş sayfasından girer.

> ⚠️ "Bu kullanıcı adı alınmış" diyorsa o ad başka bir büroda kullanılıyor. Başka bir ad seç.
>
> Avukat şifresini unutursa: Ayarlar → Kullanıcılar → kişinin satırı → **"Düzenle / şifre"**.

### 1.6 Avukatların izinlerini ayarla (Ayarlar → İzinler)

Her avukat için "bunu görsün, bunu yapsın, bunu değiştiremesin" diye tek tek karar verirsin. Sidebar'daki (soldaki) menü de buna göre değişir.

**Önce herkes için varsayılanı ayarla:**

1. **Ayarlar → İzinler**. Üstte **"Tüm avukatlar (varsayılan)"** seçili gelir.
2. Tabloda her satır bir alandır (Müvekkiller, Dosyalar, Masraflar, Tahsilatlar, Banka ve kasa…). Dört sütun var:
   **Görüntüle · Ekle · Düzenle · Sil**. Anahtarı aç ya da kapat; **anında** geçerli olur.
3. Ya da hazır ayar seç: **Sadece görüntüleme**, **Standart avukat**, **Tam yetki**, **Hepsini kapat**.

**Sonra istersen tek bir avukat için istisna yap:**

1. Üstte o avukatın adına tıkla (ör. "Av. Selin Aras").
2. Anahtarları değiştir. Rolün varsayılanından farklı olanların yanında **turuncu nokta** çıkar; avukatın adının yanında **"özel"** rozeti yazar.
3. Bu değişiklik **sadece o kişiyi** etkiler. Diğer avukatlar "Tüm avukatlar" ayarını izlemeye devam eder.
4. İstisnaları silmek için **"Rolün varsayılanına dön"**.

**Neyi kapatırsan ne olur?**

| Kapattığın izin                 | Sonuç                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Görüntüle** (ör. Müvekkiller) | Menüden kalkar, adresi yazsa da açılmaz, aramada (Ctrl+K) çıkmaz. O alanın Ekle / Düzenle / Sil izinleri de otomatik kapanır. |
| **Ekle**                        | "Yeni …" düğmeleri, hızlı ekleme menüsü ve Excel ile aktarım o alan için kalkar.                                              |
| **Düzenle**                     | "Düzenle" düğmeleri ve satır menüsündeki düzenleme kalkar.                                                                    |
| **Sil**                         | Silme düğmeleri kalkar. (Dosyalarda "Sil" = dosyayı kapatma.)                                                                 |

- Bir şeyi **Ekle / Düzenle / Sil** açarsan **Görüntüle** de kendiliğinden açılır (görmediği şeyi değiştiremez).
- **Masraflar** ve **Ajanda**'da "Görüntüle" özeldir: açıksa **başkalarının** masraflarını / ajandasını da görür. Kapalıyken avukat **kendi girdiği masrafı** ve **kendine atanan işleri** yine görür ve düzenler.
- **Admin** için hiçbir şey kapatılamaz. **Kullanıcılar, ayarlar, yedek ve arşiv** yalnızca Admin'dedir; avukata verilemez.
- Tablonun altında **"yan menüde şunları görür"** kutusu, seçili kişinin menüsünü gösterir.

> ⚠️ Avukat bir sayfaya adresle girmeye çalışırsa "Bu sayfaya erişim yetkiniz yok" yazar.
>
> İzinler hem ekranda hem veritabanında (RLS) uygulanır.

---

## 2. Altın kural: kayıtların sırası

Her şey **müvekkile** bağlıdır. Doğru sıra şöyle:

```
Müvekkil  →  Dosya (dava)        →  Masraf, Tahsilat planı, Ajanda, Belge
          →  İcra dosyası        →  Borçlu, Taksit, Ödeme sözü, Tahsilat, Masraf
```

| Bunu yapmak istiyorsan     | Önce bu olmalı        | Olmazsa ne olur?                                            |
| -------------------------- | --------------------- | ----------------------------------------------------------- |
| Dosya açmak                | Müvekkil              | Dosya formunda "Müvekkil" zorunlu, kaydedemezsin            |
| Dosyaya masraf girmek      | Dosya                 | Dosya listede çıkmaz; masrafı sadece müvekkile girebilirsin |
| Tahsilat planı yapmak      | Müvekkil              | Plan kaydedilmez                                            |
| İcra takibi açmak          | Müvekkil (alacaklı)   | İcra formu kaydedilmez                                      |
| Borçluya taksit tanımlamak | İcra dosyası + borçlu | Taksit formunda seçecek şey olmaz                           |
| Excel'den dosya aktarmak   | Müvekkiller sistemde  | Satırlar "Müvekkil bulunamadı" hatası verir                 |

---

## 3. Müvekkil ekleme

**Müvekkiller → "Yeni müvekkil"** (ya da üstteki **Yeni** menüsünden **Müvekkil**).

1. Tür seç: **Bireysel** veya **Kurumsal**.
2. Ad / ünvan zorunlu. TC / vergi no, telefon, e-posta, adres isteğe bağlı.
3. Kurumsal müvekkil sana her ay sabit ücret ödüyorsa **Aylık ücret**i yaz (bkz. bölüm 7.3).

> İpucu: TC / vergi no yazarsan Excel aktarımında aynı isimli iki müvekkili karıştırmazsın.

---

## 4. Dosya açma

**Dosyalar → "Yeni dosya"**.

1. **Büro dosya no** otomatik gelir (ör. 2026/005). İstersen değiştir.
2. Dosya türü, konu, **müvekkil** (zorunlu), esas no, karşı taraf.
3. **Mahkeme:** Kutuya tıkla, listeden seç. Listede yoksa adını yaz, **"“…” ekle"**ye bas. Bir dahaki sefere listede hazır olur (Ayarlar → Kategoriler → Mahkemeler).
4. **Sorumlu avukatları** seç.
5. Anlaşılan vekalet ücretini yazabilirsin (bilgi amaçlı).

> ⚠️ **Sorumlu avukat seçmezsen** o avukatın panelindeki "Dosyalarım" listesinde dosya **görünmez.** Avukatın Dosyalar sayfası da varsayılan olarak "Benim dosyalarım"ı gösterir.
>
> **Mahkemeyi mutlaka seç.** Masraf girerken dosya listesinde "dosya no · mahkeme" görünür; mahkeme yoksa dosya konusu görünür.

---

## 5. Masraf girme (avukat da büro sahibi de yapabilir)

### 5.1 Nereden açılır?

Üçünden biri, hepsi aynı formu açar:

- **Masraflar → "Yeni masraf"**
- Dosyanın sayfası → **Ekle → Masraf** (dosya hazır seçili gelir)
- İcra dosyasının sayfası → **"Masraf ekle"** (icra dosyası hazır seçili gelir)
- Telefonda: sağ alttaki **+** düğmesi → Masraf

### 5.2 Formu doldurma, adım adım

1. **Masraf kime ait?**
   - **Müvekkil / dosya masrafı:** Bir davanın, icranın ya da müvekkilin masrafı.
   - **Büro gideri:** Kırtasiye, kira, kargo gibi büronun kendi gideri.
2. **Dosya** (isteğe bağlı): Listede hem dava dosyaları ("2026/128 · İstanbul 3. Asliye Hukuk") hem icra dosyaları ("İcra 2026/4521 E. · İstanbul 14. İcra Dairesi") var. **Birini seç ya da boş bırak.** Seçince müvekkil kendiliğinden gelir.
3. **Müvekkil** (zorunlu, müvekkil masrafında): Dosya seçtiysen zaten dolu.
4. **Masraf türü, açıklama, tutar, tarih** (hepsi zorunlu).
5. **Ödemeyi kim yaptı?**
   - **Büro ödedi (müvekkile yansır):** Para büro kasasından / Barokart'tan çıktı. Müvekkil bu parayı büroya borçlanır.
   - **Müvekkil kendisi ödedi:** Para büronun cebinden çıkmadı. Kayıt sadece bilgi içindir.
6. **Ödendiği hesap:** Büro Kasası veya Barokart. (Sadece büro ödediyse sorulur.)
7. **Makbuz / belge:** Makbuzun fotoğrafını veya PDF'ini ekle.
8. **Kaydet.**

### 5.3 Seçimine göre ne olur?

| Kime ait                           | Kim ödedi | Kasa / Barokart | Müvekkilin carisi      | Listede durum |
| ---------------------------------- | --------- | --------------- | ---------------------- | ------------- |
| Müvekkil                           | Büro      | Para **çıkar**  | Müvekkil **borçlanır** | Ödendi        |
| Müvekkil                           | Müvekkil  | Değişmez        | Değişmez               | Ödendi        |
| Büro gideri                        | Büro      | Para **çıkar**  | Değişmez               | Ödendi        |
| Büro ödedi ama hesap boş bırakıldı | —         | Değişmez        | Borçlanır              | **Bekliyor**  |

> ⚠️ **Hesap seçmeden "büro ödedi" dersen** kasa bakiyesi düşmez ve masraf listede **"Bekliyor"** görünür. Kasa tutmuyorsa ilk buna bak.
>
> ⚠️ **Makbuz eklemezsen** masraf "Belgesiz" sayılır; Masraflar sayfasındaki "Belgesiz" kutusunda kırmızı görünür.

### 5.4 Avukat masraf girince ne olur?

- Avukat kaydeder → **büro sahibine bildirim gider:** "Av. X masraf girdi" (sağ üstteki zil).
- Avukat **Masraflar** sayfasında **sadece kendi girdiklerini** görür ve onları düzeltebilir.
- Avukat sadece **kendi girdiği** masrafı düzenleyip silebilir. Başkasının masrafına dokunamaz; onu Admin yapar.

---

## 6. Büro sahibi masrafları nereden görür?

| Nerede                               | Ne görürsün                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gösterge paneli**                  | Bu ayın toplam masrafı, cari bakiyesi en yüksek müvekkiller, uyarılar                                                                       |
| **Masraflar**                        | Herkesin masrafı. "Tüm masraflar / Benim girdiklerim", "Dosya masrafı / Büro gideri" düğmeleri; tür, tarih, belge filtreleri; Excel'e indir |
| **Dosya sayfası → Masraflar**        | O dosyanın masrafları. **"Masraf dökümü"** ile PDF çıktı                                                                                    |
| **İcra dosyası sayfası → Masraflar** | O icra dosyasının masrafları                                                                                                                |
| **Müvekkil sayfası**                 | "Yansıyan masraf" kutusu ve **Cari ekstre** sekmesi                                                                                         |
| **Cari hesap**                       | Tüm müvekkillerin borç / alacak durumu tek tabloda                                                                                          |
| **Banka & Kasa**                     | Masrafın hangi hesaptan, ne zaman çıktığı                                                                                                   |
| **Raporlar**                         | Aylık gelir-gider grafikleri                                                                                                                |

---

## 7. Ücret ve tahsilat (sadece Admin)

Her şey tek yerde: sol menüde **Tahsilatlar**. Yanındaki kırmızı sayı, vadesi geçmiş taksit sayısıdır.

```
Tahsilatlar
├─ Bekleyen            → ödenmesi beklenen taksitler   ──"Tahsil et"──┐
├─ Tahsil edilenler    → alınan ödemeler              ◄──────────────┘  (kendiliğinden geçer)
├─ Borçlu ödemeleri    → icrada borçlunun taksitleri ve ödeme sözleri
└─ Planlar             → tahsilat planlarının listesi
```

### 7.1 Tahsilat planı (vekalet ücreti)

**Tahsilatlar → "Yeni tahsilat planı"** ya da dosya sayfası → Ekle → Tahsilat planı.

1. Müvekkil ve (varsa) dosya, ücret türü, açıklama, **toplam tutar**, anlaşma tarihi.
2. **Ödeme şekli:** Tek seferde veya Taksitli. Taksitliyse peşinat, taksit sayısı, ilk vade ve sıklık. Alttaki tabloda vadeleri ve tutarları tek tek değiştirebilirsin.
3. Para o an alındıysa **"İlk taksit / peşinat şimdi alındı"** kutusunu işaretle:
   - **"Ne kadar alındı?"** kutusuna gerçekten alınan tutarı yaz. Fazlası sıradaki taksitlere dağıtılır.
   - **Ödeme yöntemini** seç (boş gelir, **seçmeden kaydedemezsin**).
   - Paranın girdiği hesabı seç.
4. Kaydedince taksitler **Bekleyen** sekmesine düşer.

> ⚠️ Taksitlerin toplamı toplam tutara eşit değilse kaydedemezsin. Tablonun üstünde "fark" yazar; **"Farkı son taksite ekle"** düğmesi bunu düzeltir.

### 7.2 Taksiti görmek ve tahsil etmek

1. **Tahsilatlar → Bekleyen**. En üstte vadesi en yakın olan var. "Gecikmiş / Bu hafta / Bu ay / Tümü" düğmeleriyle süz.
2. Ödeme gelen satırda **"Tahsil et"**e bas.
3. Tutar (kalan tutar hazır yazılı), tarih, yöntem ve hesabı kontrol et → **"Tahsil et"**.
4. Taksit **kendiliğinden** Bekleyen'den çıkar, **Tahsil edilenler**'e geçer. Kasa / banka bakiyesi ve müvekkilin carisi de kendiliğinden güncellenir.

- Fazla tutar girersen sıradaki taksitlere otomatik dağıtılır.
- Eksik tutar girersen taksit Bekleyen'de kalır, "kalan" tutarı düşer.
- Yanlış girdiysen: **Tahsil edilenler** → satırın **⋯** menüsü → **"Geri al"**. Taksit kendiliğinden Bekleyen'e döner.

### 7.3 Aylık ücret (kurumsal müvekkiller) — otomatik

Müvekkilin kartında **Aylık ücret** yazıyorsa, **her ayın ilk girişinde o ayın ücreti kendiliğinden oluşur** ve Bekleyen'e düşer. Sana bir bildirim çıkar ("X müvekkil için bu ayın aylık ücreti oluşturuldu"). Bir şeye basman gerekmez.

> ⚠️ Müvekkil **Bireysel** ise ya da **Pasif** ise aylık ücret oluşmaz.

---

## 8. İcra takibi

### 8.1 İcra dosyası aç

**İcra dosyaları → "Yeni takip"** ya da dava dosyası sayfası → Ekle → İcra takibi başlat.

- İcra dosya no, takip türü, **alacaklı müvekkil**, **borçlular**, asıl alacak, faiz, masraf.
- **İcra dairesi:** listeden seç; yoksa yaz, **"“…” ekle"**ye bas, bir dahaki sefere listede olur.
- Borçlu kayıtlı değilse önce **Borçlular → "Yeni borçlu"** ile ekle (Excel'den aktarırsan otomatik oluşur).

### 8.2 İcra dosyasının sayfasında yapabileceklerin

| Düğme              | Ne işe yarar                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Görüşme notu**   | Borçluyla yapılan telefon / yüz yüze görüşmeyi yazarsın                                                |
| **Taksit tanımla** | Borçluyla anlaştın: toplam, peşinat, taksit sayısı, sıklık. Taksitler "Taksitler" bölümünde listelenir |
| **Masraf ekle**    | Bu icra dosyasına masraf girer (bölüm 5)                                                               |
| **Ödeme sözü**     | Borçlu tek seferlik "şu tarihte öderim" dediyse                                                        |
| **Tahsilat gir**   | Borçludan para geldiğinde                                                                              |

### 8.3 Borçlu taksiti ödeyince

1. İcra dosyasının sayfasındaki **Taksitler** bölümünde ya da **Tahsilatlar → Borçlu ödemeleri** sekmesinde o taksitin yanındaki **"Ödendi"**ye bas.
2. Açılan tahsilat formunda tutar, tarih ve hesabı kontrol et, kaydet.
3. Taksit kendiliğinden **"Tutuldu"** olur ve "Sonuçlanan"a geçer.
4. Borçlunun ödediği toplam alacağa ulaşınca icra dosyasının durumu **kendiliğinden "Tahsil edildi"** olur.

> ⚠️ Vadesi geçen ve ödenmeyen taksit kırmızı **"Gecikmiş"** görünür ve panelde uyarı çıkar.

### 8.4 Tahsil edilen parayı müvekkile göndermek

İcrada toplanan para müvekkilindir. **Banka & Kasa** sayfasında **"Müvekkile aktarılacak icra tahsilatları"** listesi çıkar; parayı gönderince oradan aktarımı kaydet.

> ⚠️ Aktarımı kaydetmezsen icra sayfasındaki **"Müvekkile aktarılacak"** tutarı düşmez ve müvekkilin carisi yanlış görünür.

---

## 9. Ajanda ve bildirimler

- **Ajanda → "Yeni kayıt"**: duruşma, süre sonu, toplantı… Bir **sorumlu** seç.
- Sorumluya **bildirim gider**. Bugün / yarın olan işler panelde uyarı olarak çıkar.
- Gösterge panelindeki ajanda kutusunda **Bugün / Bu hafta** seçimi var.

> ⚠️ Sorumlu kişi yanlış seçilirse uyarı yanlış kişiye gider; avukatın "Ajandam"ında görünmez. (Ajanda sayfasında "Benim / Tüm büro" düğmesiyle herkesinkine bakılabilir.)

---

## 10. Dosyayı kapatma (sadece Admin, geri alınamaz)

Dosya sayfası → **"Dosyayı kapat"** (ya da dosyayı düzenleyip durumu **"Kapalı"** yapmak).

**Ne silinir:** Dosya, masrafları (makbuzlarıyla birlikte), tahsilat planları, belgeleri, ajanda kayıtları.

**Ne kalır:** Müvekkil kalır. Müvekkil sayfasında **"Kapanan dosyalar"** kutusunda yalnızca sayılar durur: dosya sayısı, toplam ücret, **toplam alacak**, **toplam verecek**. Cari bakiye ve kasa bakiyeleri bozulmaz.

> ⚠️ **Kapatmadan önce gerekiyorsa "Masraf dökümü" PDF'ini al ve yedek al.** Silinen makbuzlar geri gelmez.

---

## 11. Excel ile toplu aktarım

Elindeki eski kayıtları tek tek girmek yerine Excel'den yükleyebilirsin.

### 11.1 Nereden?

Müvekkiller, Dosyalar, Masraflar, Borçlular, İcra dosyaları sayfalarında **"Excel ile aktar"** düğmesi. Ya da üstteki **Yeni** menüsünde **"Excel ile toplu aktar"**.

### 11.2 Adımlar

1. **"Şablon"**a bas, Excel dosyası iner. İçinde 3 sayfa var:
   - **Veri:** doldurduğun yer. `*` olan sütunlar zorunlu.
   - **Listeler:** açılır listelerin değerleri (masraf türleri, müvekkiller, dosyalar…).
   - **Açıklama:** her sütun ne demek.
2. Her satıra bir kayıt yaz. Listeli hücrelerde hücrenin yanındaki oku kullan.
3. Kaydet, ekranda dosyayı seç ya da sürükle bırak.
4. Önizleme gelir. Her satır şöyle işaretlenir:
   - **Hazır** (yeşil): sorunsuz.
   - **Hatalı** (kırmızı): sebebi yazar. Hücreyi ekranda düzelt, listeden seç veya çöp kutusuyla satırı çıkar.
   - **Atlanacak** (sarı): sistemde zaten var gibi görünüyor. Yine de istersen **"Kayıtlı görünenleri de aktar"**ı işaretle.
5. Hatalar çoksa **"Hatalıları Excel'e indir"** ile sadece hatalı satırları indir, düzelt, tekrar yükle.
6. **"X kaydı aktar"**a bas. Sadece **hazır** satırlar eklenir.

### 11.3 ⚠️ Sıra önemli

```
1) Müvekkiller  →  2) Dosyalar  →  3) Masraflar
1) Müvekkiller  →  2) İcra dosyaları (borçlular otomatik oluşur)  →  3) Masraflar
```

Müvekkiller yokken dosya aktarırsan hepsi **"Müvekkil bulunamadı"** hatası verir.

### 11.4 Sık hatalar

| Hata                                                    | Sebep                                 | Çözüm                                              |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Müvekkil bulunamadı                                     | İsim sistemdekiyle birebir aynı değil | Listeden seç ya da TC / vergi no yaz               |
| Bu isimde birden fazla müvekkil var                     | Aynı isimli iki müvekkil              | TC / vergi no yaz                                  |
| Listeden seçin                                          | Masraf türü Ayarlar'da yok            | Listeden seç ya da Ayarlar → Kategoriler'e ekle    |
| Masraflar yalnızca Büro Kasası veya Barokart'tan ödenir | Hesap sütununa banka yazılmış         | Büro Kasası veya Barokart seç                      |
| Dosya / icra dosyası ile müvekkil uyuşmuyor             | Dosya başka müvekkilin                | Müvekkil hücresini boşalt; dosyadan otomatik gelir |
| Tarih GG.AA.YYYY biçiminde olmalı                       | Tarih tanınmadı                       | 12.10.2026 gibi yaz                                |
| Bu dosya no zaten kayıtlı                               | Aynı dosya iki kez yüklendi           | O satırı çıkar                                     |
| Kapalı dosya aktarılamaz                                | Durum "Kapalı" yazılmış               | Durumu Açık / Derdest yap                          |

> Tarih (12.10.2026, 2026-10-12) ve tutar (1.250,50 / 1250.5 / ₺1.500) farklı biçimlerde yazılabilir, hepsi tanınır. **.xls (eski Excel) okunmaz**, Excel'de "Farklı kaydet → .xlsx" yap.

---

## 12. Kendiliğinden (otomatik) olanlar

Bunlar için bir şeye basman gerekmez:

| Sen bunu yapınca                            | Program kendiliğinden bunu yapar                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Taksiti tahsil edersin                      | Taksit "Tahsil edilenler"e geçer, plan durumu, kasa / banka ve müvekkil carisi güncellenir |
| Fazla tutar tahsil edersin                  | Fazlası sıradaki taksitlere dağıtılır                                                      |
| Ayın ilk günü yönetici giriş yapar          | Aylık ücretli müvekkillerin o ayki ücreti oluşur                                           |
| Borçlu taksitine "Ödendi" dersin            | Taksit "Tutuldu" olur, tahsilat icra dosyasına yazılır                                     |
| Borçlu alacağın tamamını öder               | Tahsilat kaydı oluşur; dosyayı kapatmak elle yapılır (otomatik kapanmaz)                   |
| Masrafı "Müvekkil kendisi ödedi" girersin   | Masraf "Ödendi" görünür, kasadan para çıkmaz                                               |
| Masrafı "Büro ödedi" girersin               | Kasadan / Barokart'tan düşer, müvekkilin carisine borç yazılır                             |
| Avukat masraf girer                         | Büro sahibine bildirim gider                                                               |
| Ajandaya iş atarsın                         | Sorumlu kişiye bildirim gider; günü gelince panelde uyarı çıkar                            |
| Taksitin vadesi geçer                       | "Gecikmiş" olur, panelde kırmızı uyarı çıkar                                               |
| Formda yeni mahkeme / icra dairesi yazarsın | Listeye eklenir, bir dahaki sefere seçilir                                                 |
| Dosyayı kapatırsın                          | Dosyanın parası müvekkilde ve yıllık özette toplam olarak kalır                            |

---

## 13. Eski yılları arşivleme (veri dolunca)

Yıllar geçtikçe kayıtlar birikir. Eski yılların **ayrıntısını** silip **sadece toplam parasını** tutabilirsin.

1. Önce **yedek al** (bölüm 14).
2. **Ayarlar → Yedekleme → "Eski yılları arşivle"**.
3. Yılı seç (ör. 2024). **O yıl ve öncesi** arşivlenir; içinde bulunduğun yıl arşivlenemez.
4. Altta neyin kaç tane silineceği yazar. **"X kaydı arşivle"** → onayla.

**Ne silinir:** O yılların masrafları (makbuzlarıyla), bitmiş tahsilat planları, müvekkile aktarılmış icra tahsilatları, kasa / banka hareketleri, biten ajanda kayıtları, sonuçlanan ödeme sözleri, görüşme notları, eski bildirimler.

**Ne kalır:**

- Her yılın parası: **Raporlar → Yıllık özet** tablosunda "2024: ücret tahsilatı şu kadar, masraf şu kadar, net şu kadar" diye durur, yanında **"arşiv"** yazar.
- Kasa / banka bakiyeleri ve müvekkillerin cari bakiyeleri **kuruşu kuruşuna aynı** kalır.
- Müvekkiller, dosyalar, icra dosyaları, borçlular ve belgeler silinmez.
- Hâlâ ödenmesi beklenen taksitler, aktarılmamış icra parası ve bekleyen işler silinmez.

> ⚠️ Arşivleme geri alınamaz. Açık bir dosyanın eski yıla ait masrafları da silinir; o dosyanın "toplam masraf"ı düşer ama yıllık özette ve müvekkilin carisinde tutar kalır.

---

## 14. Yedek alma (çok önemli)

**Ayarlar → Yedekleme → "Yedeği indir (.zip)"**. İçinde bütün kayıtlar ve makbuz / belge dosyaları var.

- **Haftada en az bir kere** al ve bilgisayar dışında bir yerde sakla.
- Geri yüklemek için aynı sayfada **"Yedekten geri yükle"**. Mevcut verinin **yerine geçer.**

> ⚠️ Yedek almazsan tarayıcı verisi silindiğinde ya da bilgisayar değiştiğinde **her şey gider.**

---

## 15. "Çalışmıyor" dediğinde bak

| Belirti                                 | Büyük ihtimalle sebep                                                       | Çözüm                                                               |
| --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Başka bilgisayarda kayıtlar yok         | Farklı büro / kullanıcı ile giriş                                           | Aynı kullanıcı adı ve şifreyle girin                                |
| Avukat tahsilatları / kasayı göremiyor  | Avukat rolü para görmez                                                     | Normal. Görmesi gerekiyorsa rolünü Admin yap                        |
| Avukat bir dosyayı göremiyor            | Sorumlu avukat olarak seçilmemiş                                            | Dosyayı düzenle, avukatı ekle (ya da "Tüm dosyalar"a geçsin)        |
| Masraf girerken hesap listesi boş       | Kasa / Barokart pasif                                                       | Banka & Kasa'dan hesabı aktif yap                                   |
| Kasa bakiyesi tutmuyor                  | Masrafta hesap boş bırakılmış ("Bekliyor") ya da açılış bakiyesi girilmemiş | Masrafı düzenleyip hesabı seç; hesabın açılış bakiyesini gir        |
| Masraf türü listede yok                 | Kategorilerde tanımlı değil                                                 | Ayarlar → Kategoriler                                               |
| Kullanıcı adı alınmış                   | Başka büroda aynı ad var                                                    | Farklı ad seç                                                       |
| Tahsilat planı kaydedilmiyor            | Taksit toplamı tutmuyor ya da ödeme yöntemi seçilmemiş                      | "Farkı son taksite ekle" / ödeme yöntemini seç                      |
| İcrada "Müvekkile aktarılacak" düşmüyor | Aktarım kaydedilmemiş                                                       | Banka & Kasa → Müvekkile aktarılacak listesi                        |
| Kapatılan dosya yok oldu                | Kapatma dosyayı siler                                                       | Tasarım böyle; toplamlar müvekkil sayfasında                        |
| Panelde uyarı / bildirim gelmiyor       | Ajandada sorumlu yanlış ya da vade girilmemiş                               | Kaydı düzenle                                                       |
| "Taksitler" menüsü yok                  | Taksitler artık Tahsilatlar'ın içinde                                       | Tahsilatlar → Bekleyen                                              |
| Tahsil ettim, taksit hâlâ Bekleyen'de   | Taksitin tamamı değil bir kısmı tahsil edildi                               | Kalan tutarı da tahsil et                                           |
| Mahkeme / icra dairesi listede yok      | Daha önce hiç yazılmamış                                                    | Kutuya yaz, "“…” ekle"ye bas                                        |
| Bir durum / tür listede yok             | Kategorilerde yok ya da silinmiş                                            | Ayarlar → Kategoriler'den ekle                                      |
| Bir değeri silemiyorum (🔒)             | Program o değeri kullanıyor                                                 | Silinemez; kullanmayabilirsin                                       |
| Aylık ücret oluşmadı                    | Müvekkil Bireysel / Pasif ya da aylık ücret boş                             | Müvekkili düzenle; ya da Tahsilatlar'daki "Aylık ücretleri oluştur" |
| Eski yıl raporda yok                    | O yılda hiç kayıt yok                                                       | —                                                                   |

---

## 16. Kim neyi görür, ne yapar?

**Admin** her şeyi yapar. **Avukat** için aşağıdakiler **varsayılandır**; hepsini Ayarlar → İzinler'den değiştirirsin (bölüm 1.6).

|                                                  | Admin (büro sahibi) |              Avukat (varsayılan)              |
| ------------------------------------------------ | :-----------------: | :-------------------------------------------: |
| Müvekkil / dosya / belge ekleme, düzenleme       |         ✅          |                      ✅                       |
| Masraf girme                                     |         ✅          |                      ✅                       |
| Herkesin masrafını görme                         |         ✅          |           ❌ (sadece kendininkini)            |
| Kendi girdiği masrafı düzenleme / silme          |         ✅          |                      ✅                       |
| Müvekkil / dosya silme, dosya kapatma            |         ✅          |                      ❌                       |
| Tahsilat planı, tahsilat, taksitler              |         ✅          |                      ❌                       |
| Cari hesap, Banka & Kasa, Raporlar, Aktivite     |         ✅          |                      ❌                       |
| İcra, borçlu, taksit tanımlama, görüşme notu     |         ✅          |                      ✅                       |
| Ajanda                                           |    ✅ (herkesin)    |         ✅ (sadece kendine atananlar)         |
| Excel ile toplu aktarım                          |         ✅          | ✅ (yalnızca "Ekle" izni olduğu alanlar için) |
| Ayarlar, kullanıcılar, **izinler**, yedek, arşiv |         ✅          |     ❌ (sadece kendi profili ve şifresi)      |

---

## 17. Güvenlik: bu site özel kullanım için

- **Arama motorları bulamaz:** Google, Bing vb. dizinlemez; `robots.txt` tüm botları engeller, sayfalarda "noindex" var, bağlantı önizlemesi (WhatsApp / sosyal medya kartı) oluşmaz. Siteye **sadece linki bilen** girebilir; giriş için yine kullanıcı adı ve şifre gerekir.
- **Giriş denemesi sınırı:** Üst üste 5 hatalı şifreden sonra giriş **30 saniye** kilitlenir; her yanlış denemede süre ikiye katlanır (en çok 15 dakika). Doğru şifre girilince sıfırlanır.
- **Otomatik çıkış:** 8 saat hiçbir işlem yapılmazsa oturum kapanır. Bir sekmede çıkış yapınca diğer sekmeler de kapanır.
- **Canlıda demo hesabı yok:** Yayındaki sitede hazır "admin / 123456" gibi hesap ve ipucu düğmeleri **yoktur**. İlk açılışta "Yeni büro hesabı oluşturun" ile kendi büronu kurarsın. (Demo yalnızca geliştirirken açıktır.)
- **Tehlikeli dosyalar açılmaz:** Yüklenen belgelerden yalnızca PDF ve resimler tarayıcıda açılır. HTML, SVG gibi içinde kod çalıştırabilen dosyalar sadece **indirilir**.
- **Tarayıcı güvenlik başlıkları:** Başka sitelerin içine gömülemez, dışarıdan kod yüklenmez, sayfalar önbelleğe alınmaz, tarayıcı izinleri (kamera, mikrofon, konum) kapalıdır.
- **Şifreler:** Düz metin saklanmaz; tuzlanmış PBKDF2 ile saklanır.
- **Excel ve yedek dosyaları:** Aşırı büyük açılan ("zip bombası") dosyalar reddedilir.

> Ortak bilgisayarda işiniz bitince **çıkış yapın**. Şifre ve izinler sunucuda doğrulanır; yine de oturumu açık bırakmayın.
>
> ⚠️ Yeni büro hesabı oluşturmak şu an herkese açık. Sunucuya geçerken sadece davetle kayıt olacak şekilde kapatılacak.

---

## 18. Ekranlar telefonda nasıl görünür?

Kartlar (özet kutuları) ekran genişliğine göre kendini ayarlar: telefonda 2'şer (çok dar telefonlarda tek) sütun, tutar yazısı kutuya sığacak şekilde küçülür, uzun yazılar alt satıra geçer. Tablolar yan kaydırmalıdır, sayfa yana taşmaz.

**Ajanda (takvim):** Bir güne birden fazla kayıt düşerse hücrede ilki görünür, altında **"+N daha…"** yazar; günün tamamı için güne tıkla, sağda (telefonda altta) liste açılır.

---

## 19. Hataları görmek: Sentry

Uygulamada beklenmedik bir hata olursa (ekran beyaz kalır, sayfa yüklenmez vb.) **sen** haberdar olursun, kullanıcı yazmak zorunda kalmaz.

**Kurulum (bir kerelik):**

1. [sentry.io](https://sentry.io) → ücretsiz hesap → **Create Project** → platform **React**.
2. Verilen **DSN** adresini kopyala.
3. Projenin ortam değişkenlerine ekle: `VITE_SENTRY_DSN=<dsn>` (yerelde `.env` dosyası). `.env.example` örnek verir.
4. Sentry → **Alerts** → "yeni hata olunca e-posta" kuralını aç.
5. Doğrula: **Ayarlar → Yedekleme → Hata izleme → "Test hatası gönder"**. Sentry panelinde birkaç saniyede görünür.

**Gizlilik (özel hukuk verisi):** Sentry'ye giden her şey önce temizlenir: ad, e-posta, **TC / vergi no, IBAN, telefon maskelenir**; istek içeriği, çerez, tıklanan yazılar, konsol çıktıları ve adres sorgusu **gönderilmez**. Hatayı alan kişi yalnızca kimlik numarası, rolü ve büro kodu ile görünür.

> Sentry'yi açmak zorunda değilsin: `VITE_SENTRY_DSN` boşsa tamamen kapalıdır (Ayarlar'da "Kapalı" yazar).

---

## 20. Veritabanı (Supabase) ve otomatik işler

Uygulama Supabase'e bağlıdır (Auth + tablolar + Storage). Kurulum: [`supabase/README.md`](supabase/README.md).

**Şifremi unuttum:** Giriş ekranından e-posta / kullanıcı adı ile sıfırlama bağlantısı gönderilir; `/sifre-sifirla` sayfasında yeni şifre belirlenir.

**Veritabanı kendi kendine neler yapar? (pg_cron)** — saatler sabittir (uygulamadan değiştirilmez; disk I/O için seyrek tutulur).

| Ne zaman            | Ne yapar                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Her Pazartesi 00:10** | Aylık ücretli müvekkillerin **bu ayın** ücretini yoksa oluşturur (ayın 5'i vadeli). Aynı ay iki kez oluşmaz. |
| **Her Pazartesi 08:00** | Geciken / yaklaşan taksit, ajanda ve ödeme sözü için **bildirim** üretir (aynı uyarı tekrar etmez). |
| **Her Pazartesi 03:30** | Eski bildirim/aktivite temizliği; ayarlıysa otomatik arşiv. |
| **5 günde bir 09:00**   | Proje uykuya girmesin diye `keepalive` ping’i; veri yazmaz. |

**"Bir süre sonra silsin" (otomatik arşiv):** varsayılan **kapalıdır**, çünkü silme geri alınamaz. Açarsan ("son N tam yılı tut"), her Ocak'ta daha eski yılların ayrıntısı silinir; **yıllık para toplamları, kasa/banka bakiyeleri ve müvekkil cari bakiyeleri aynen kalır** (elle arşivlemeyle aynı mantık, test edildi). Açma komutu `supabase/README.md`'de.

**RLS (kim neyi görür):** İzinler tablosu veritabanında da zorunludur: bir avukat arayüzü atlayıp doğrudan veritabanına sorsa bile izni olmayan satırı göremez/değiştiremez; başka bürodaki hiçbir kayıt görünmez. Son yönetici silinemez.

**Test:** `npm run test:db` — gerçek PostgreSQL üzerinde 108 kontrol (izolasyon, izinler, bakiyelerin korunması, cron vb.).

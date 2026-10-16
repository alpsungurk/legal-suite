# Avukat Yönetim Paneli · Son eklenenler

**Tarih:** 16.10.2026

Bu belge, bir önceki "Yenilikler" belgesinden sonra eklenenleri içerir: "İcra Örnek Liste Talimat" dosyanızdaki istekler ve son geri bildirimleriniz.

---

## 1. Dosya durumu (talimat dosyanızdaki biçim)

- **Açık**
- **Açık (Durdurulmuş : sebep):** Takibe İtiraz, İcra Mahkemesine İtiraz, İhtiyati Tedbir, Tehir-i İcra Kararı, Diğer
- **Kapalı (sebep):** Yetkisizlik, Takipsizlik, Vazgeçme/Feragat, Takibin İptali, İnfaz, Haricen Tahsil
- Formda durum "Kapalı" seçilince **kapanış sebebi** sorulur.
- Listede ve Excel'de durum aynı biçimde görünür; Excel'den aktarırken de bu biçim okunur.
- **Otomatik kapatma yok:** Tahsilat takip çıkışına ulaşsa bile dosya kendiliğinden kapanmaz; borç tamamen bittiğinde büro durumu elle **Kapalı (İnfaz)** (veya başka sebep) yapar.

## 2. Takip şekli (Örnek No)

- İcra dosyası formunda yeni alan: Örnek No: 2, 3, 4-5, 6, 7, 8, 9, 10, 11, 12, 13, 13 (hasılat kirası), 14, 44.
- Seçince altında kuralı yazar, örneğin "Ödeme emri tebliğinden 7 gün sonra, 8. gün kesinleştirme hatırlatılır".
- Listede takip türünün altında, Excel'de ayrı sütun olarak görünür; filtrelenebilir.
- Her Örnek No'nun gün sayısı ve süre dolunca yapılacak işlem (kesinleştirme / tahliye) **Ayarlar → Kategoriler → Takip şekilleri ve süreleri**'nden değiştirilebilir. Gün boşsa hatırlatma yapılmaz.

## 3. Hangi gün ne hatırlatılır

| İşlem | Hatırlatma | Ne zaman kapanır |
|---|---|---|
| Ödeme emri tebliği (alacaklı olduğumuz) | Takip şeklinin süresi dolduktan sonraki gün **kesinleştirme**; Örnek 14'te **tahliye**. Örnek: 30.09.2026 tebliğ, Örnek No: 7 → 08.10.2026 | "Kesinleşme" ya da "Tahliye talebi" girilince |
| Ödeme emri tebliği (**borçlu olduğumuz**) | **İtiraz / ödeme süresi**: son gün = tebliğ + takip şeklinin günü; **son günden 2 gün önce** ve son gün | "Tamamlandı" denince |
| 89/1 haciz ihbarnamesi | 13 gün sonra cevap vermeyen banka varsa **89/2** | Bütün bankaların cevabı girilince ya da 89/2 girilince |
| Maaş haczi tebliği | 30 gün sonra **işverenin borçlu olarak eklenmesi** | "Borçlu ekleme talebi" girilince |
| Son haciz | 12 ay dolmadan 14 gün önce ve düşme günü **haciz yenileme** | Yeni haciz girilince |
| Taksit / ödeme sözü | Ödeme günü | Tahsilat girilince |

- Hatırlatmalar her sabah 08:00'de dosyanın sorumlu avukatına **bildirim** olarak gider ve "Dikkat gerektirenler"de görünür.
- Alacaklı tarafına özgü süreler (kesinleştirme, 89/2, maaş, haciz, taksit) borçlu olduğumuz dosyalarda çıkmaz.

## 4. İcra → Süreler sayfası

- Menüde İcra'nın altında, bekleyen süre sayısıyla.
- Bütün dosyaların süreleri tek listede: **Gecikmiş, Bugün, Bu hafta, Tamamlanan** sayıları.
- Filtreler: durum, süre türü, "benim dosyalarım". Tarih aralığı, sıralama ve Excel'e aktarım var.
- **Tamamlandı** ile süre listeden düşer, istenirse **Yeniden aç**.
- Dosya sayfasının üstünde de o dosyanın **Bekleyen süreler** kutusu çıkar.

## 5. İşlem ekle

- **Sorgu:** 7 başlık bir arada girilir: Araç, Taşınmaz, Alacaklı olduğu icra dosyası, Banka (adet ve hangi bankalar), SGK maaş (aktif/pasif), SGK Mosip (aktif/pasif), Firma (aktif firma sayısı). İşlem geçmişinde renkli etiketlerle görünür.
- **89/1 haciz ihbarnamesi:** Bankalar tek tek eklenir. Her bankanın cevabı Hacizli, Rehinli, Olumsuz, Tahsil edilebilir seçeneklerinden bir ya da birkaçı olarak işaretlenir. Cevabı boş banka "cevap bekleniyor" sayılır.
- Tarih alanının altında, işlemin doğuracağı hatırlatmanın günü yazar.

## 6. Takip bilgileri

- Hazır seçenekler: Araç Mahrumiyet Bedeli, Dekont, Kira, Çek, Senet, Bono, Fatura, Ürün Bedeli, İlam Vekalet Ücreti Alacağı.
- Listede olmayan elle yazılır ve listeye eklenir.

## 7. Ayarlar → Kategoriler

- Yeni listeler: **Kapanış sebepleri**, **Takip bilgileri**, **Banka cevapları (89/1)**.
- **Takip şekilleri ve süreleri:** gün sayısı ve süre dolunca yapılacak işlem değiştirilebilir, yeni takip şekli eklenebilir.
- **Banka ve maaş haczi süreleri:** 89/1 için 13 gün, maaş haczi için 30 gün; değiştirilebilir.
- Süre hesabında kullanılan işlem türleri (Ödeme emri tebliği, Kesinleşme, 89/1, 89/2, Maaş haczi tebliği, Borçlu ekleme talebi, Tahliye talebi, Sorgu, Haciz) kilitlidir, silinemez.

## 8. Excel

- Boş şablonlar talimat dosyanızdaki 11 sütunla (Takip Şekli dahil) yenilendi; alacaklı ve borçlu olduğumuz için ayrı şablon var.
- Aktarımda "Takip Şekli" sütunu tanınır; "7" ya da "Örnek 7" yazılsa da olur.
- "Açık (Durdurulmuş : Takibe İtiraz)", "Kapalı (İnfaz)" gibi durumlar ayrıştırılır.
- Hücrede "1- Ali Veli 2- Ayşe Kaya" gibi birden fazla borçlu varsa **tek icra dosyası** oluşur, o dosyaya iki borçlu bağlanır; dosya ikiye bölünmez.

## 9. Kapalı dava dosyaları artık silinmez

- Dosya kapatılınca bütün kayıtlarıyla (masraf, tahsilat, belge, ajanda) kapalı olarak saklanır ve **siz kalıcı olarak silmedikçe silinmez**.
- İstediğiniz zaman "Yeniden aç" ile geri açılır.
- Silmek isterseniz kapalı dosyada **"Şimdi kalıcı sil"** düğmesi vardır; yalnızca siz basarsanız çalışır.
- İsterseniz Ayarlar → Kategoriler → Dosyalar'dan otomatik silme süresi (1–120 ay) verebilirsiniz. Varsayılan **0: hiç silinmesin**.



## Sizden beklediklerimiz

1. **Takip şekli günleri:** Talimatta Örnek 7 (8. gün) ve Örnek 10 (11. gün) açıkça yazıyordu. Diğerleri genel kurala göre girildi: 2, 4-5 ve 8'de 7–15 gün; 6, 9 ve 13'te 30 gün; hasılat kirasında 60 gün; 14'te 15 gün sonra tahliye; 3, 11, 12 ve 44'te hatırlatma yok. Ayarlar → Kategoriler'den kontrol edip gerekirse düzeltin.
2. **Borçlu dosyalarda uyarı günü:** Son günden 2 gün önce hatırlatıyoruz. Daha erken ya da geç olmasını isterseniz söyleyin.
3. **Banka (13 gün) ve maaş haczi (30 gün) süreleri** sizin uygulamanıza uygun mu?

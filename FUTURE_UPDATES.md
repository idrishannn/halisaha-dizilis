# Gelecek güncellemeler

MVP'ye girmeyen, sonraki sürümlerde yapılacak özelliklerin listesi.
Yeni fikirler buraya eklenir; bir özellik başlarken detayları burada netleştirilir.

---

## v1.1 — Taktik tahtası (MVP sonrası ilk güncelleme)

Takımın hücum / savunma planlarını çizip 3–5 saniyelik animasyonla oynatabildiği ekran.

**Nasıl çalışır (adım adım model)**
- Taktik tahtası açılınca oyuncular mevcut kadro dizilişinde durur, sahaya bir top eklenir.
- Kullanıcı oyuncuları ve topu sürükleyerek **Adım 1**'i kurar; hareket okları otomatik çizilir.
- En fazla **3 adım** eklenebilir. Her adım ~1,5 sn sürer, toplam 3–5 sn.
- **Oynat**: oyuncular ve top adımlar arasında akıcı şekilde hareket eder.
- Bir takımın birden fazla taktiği olabilir (ör. "Kontra atak", "Korner savunması").

**Kim görür / kim düzenler**
- Taktikleri **sadece takım** görür, rakip görmez.
- Bunun için yeni bir kavram: **takım linki** (maç linkinden ayrı).
  - Maç linki: rakibi maça çağırır, taktiklere erişim **vermez**.
  - Takım linki: kendi oyuncularına atılır; açan kişi takımın taktiklerini görür.
- Düzenleme: yönetici + yöneticinin izin verdiği kişiler. Diğer üyeler sadece izler.
- Değişiklikler takımda uygulamayı açan herkese anında yansır (Firestore realtime).
- Erişim kontrolü Firebase güvenlik kurallarıyla yapılır (rakip okuyamaz) — kurallar test edilir.

**Bilerek sonraya bırakılanlar**
- Serbest çizim (parmakla rota çizme)
- Taktiği video/GIF olarak dışa aktarma

**Tasarım notu:** alt menüde "Kadro" sekmesinin yanına "Taktik" sekmesi eklenecek.
Veri modeli MVP'de buna göre kurulur (takım alt koleksiyonu: `teams/{id}/tactics`).

---

## Sonraki adaylar (öncelik sırası netleşmedi)

- **"Kim geliyor?" katılım listesi** — maç için oyuncuların gelip gelmeyeceğini işaretlemesi.
- **Gol atanlar ve oyuncu istatistikleri** — maç sonucunda golcüleri işaretleme, oyuncu bazlı sayılar.
- **"Google ile kaydet"** — anonim hesabı Google hesabına bağlama (telefon değişince veri kaybolmasın).
- **Skor onayı** — bir takım girer, diğeri onaylar; itiraz durumu. (MVP'de iki taraf da düzenleyebilir.)
- **Fotoğrafların sunucuya yüklenmesi** — rakibin de oyuncu fotoğraflarını görmesi (KVKK + içerik denetimi gerekir).
- **iOS sürümü**

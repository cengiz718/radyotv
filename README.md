# Radyo Kutu — Mi Box TV & Web Radyo Oynatıcısı

Xiaomi Mi Box (Android TV) ve masaüstü tarayıcılar için tasarlanmış, kumanda (D-Pad) uyumlu, sade arayüzlü canlı radyo ve Türksat 4A TV oynatıcısı.

## Özellikler

- **6.500+ Canlı Radyo Kanalı:** İlahi (en başta), Türkçe, Kürtçe, Arabesk, Özgün, Türkü, Pop, Slow, Haber ve Dünya kategorileri.
- **Türksat 4A Ulusal TV:** Kanal D, Star TV, TV8, TRT Haber, TRT Kurdî, TRT Türk, TRT Müzik, Diyanet TV, NTV, Habertürk TV, Halk TV ve daha fazlası için HLS canlı TV oynatıcısı.
- **5.000+ Full HD Arka Plan Manzarası & Şömine Modu:** Otomatik değişen Full HD doğa manzaraları, canlı kıvılcımlı şömine modu ve tek tıklamayla dönülebilen **Saf Manzara Modu**.
- **Canlı Ses Dalgası Görselleştiricisi:** Web Audio API (`AnalyserNode`) ile müziğe senkronize minimalist ses dalgası.
- **Mi Box Kumanda Desteği:**
  - `← → ↑ ↓` : Kanallar arasında gezinme
  - `OK / Enter` : Kanal çalma
  - `0–9` : Numara tuşlarıyla hızlı kanal değiştirme
  - `N / P` : Sonraki / Önceki kanal
  - `M` : Sessize alma
  - `ESC` : Saf Manzara Modundan tek tuşla çıkış
- **Ek Araçlar:** Favoriler, Son Dinlenenler geçmişi, Uyku Zamanlayıcısı (15/30/60 dk), Web'den kanal arama ve `.m3u` çalma listesi dışa aktarma.

## Kurulum ve Çalıştırma

```bash
npm install
npm run dev
```

Üretim derlemesi için:

```bash
npm run build
npm start
```

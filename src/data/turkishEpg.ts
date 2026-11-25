import type {
  ChannelEpgGuide,
  EpgProgramItem,
  EpgProgramType,
  StationCategory,
  TvCategory,
} from '../types.ts';

interface RawSlot {
  start: string;
  end: string;
  title: string;
  category: EpgProgramType;
  description: string;
}

const CHANNEL_SCHEDULES: Record<string, RawSlot[]> = {
  'kanal d': [
    { start: '00:00', end: '07:00', title: 'Gece Sineması & Tekrar Kuşağı', category: 'dizi', description: 'Sevilen yerli dizilerden seçme bölümler.' },
    { start: '07:00', end: '09:00', title: 'Neler Oluyor Hayatta?', category: 'sohbet', description: 'Gündemin sıcak başlıkları ve canlı yorumlar.' },
    { start: '09:00', end: '13:00', title: 'Gündüz Kuşağı Programı', category: 'eglence', description: 'Yarışma, yaşam ve stüdyo konukları.' },
    { start: '13:00', end: '16:00', title: 'Gelinim Mutfakta', category: 'eglence', description: 'Günlük yemek ve rekabet programı.' },
    { start: '16:00', end: '19:00', title: 'Arka Sokaklar (Özel Bölüm)', category: 'dizi', description: 'Polisiye dram dizisi.' },
    { start: '19:00', end: '20:00', title: 'Kanal D Ana Haber', category: 'haber', description: 'Türkiye ve dünyadan günün öne çıkan gelişmeleri.' },
    { start: '20:00', end: '23:59', title: 'Prime Time Yerli Dizi', category: 'dizi', description: 'Yeni bölüm ve akşam kuşağı yayını.' },
  ],
  'star tv': [
    { start: '00:00', end: '07:00', title: 'Gece Kuşağı Yerli Dizi', category: 'dizi', description: 'Arşivden sevilen bölümler.' },
    { start: '07:00', end: '09:45', title: 'Sabah Haberleri', category: 'haber', description: 'Güne başlarken son dakika haberleri.' },
    { start: '09:45', end: '13:30', title: 'Sabahın Sultanı Seda Sayan', category: 'eglence', description: 'Gündüz kuşağı sohbet ve müzik.' },
    { start: '13:30', end: '16:30', title: 'Zahide Yetiş ile Yeniden Başlasak', category: 'sohbet', description: 'Hayata dair hikâyeler ve konuklar.' },
    { start: '16:30', end: '19:00', title: 'Kiralık Aşk / Dizi Kuşağı', category: 'dizi', description: 'Akşamüstü dizi yayını.' },
    { start: '19:00', end: '20:00', title: 'Star Ana Haber', category: 'haber', description: 'Günün sıcak haber bülteni.' },
    { start: '20:00', end: '23:59', title: 'Akşam Kuşağı Özel Dizi', category: 'dizi', description: 'Yüksek çözünürlüklü akşam yayını.' },
  ],
  'tv8': [
    { start: '00:00', end: '07:15', title: 'Gece Yarışması Özeti', category: 'eglence', description: 'Günün öne çıkan yarışma anları.' },
    { start: '07:15', end: '08:30', title: '8’de Sağlık', category: 'sohbet', description: 'Uzman doktorlarla sağlık rehberi.' },
    { start: '08:30', end: '12:30', title: 'Aramızda Kalmasın', category: 'sohbet', description: 'Magazin ve yaşam sohbetleri.' },
    { start: '12:30', end: '16:00', title: 'Zuhal Topal’la Yemekteyiz', category: 'eglence', description: 'Mutfak ve puanlama yarışması.' },
    { start: '16:00', end: '20:00', title: 'Survivor / MasterChef Ekstra', category: 'eglence', description: 'Yarışma değerlendirmeleri.' },
    { start: '20:00', end: '23:59', title: 'MasterChef Türkiye / Büyük Yarışma', category: 'eglence', description: 'Prime time yarışma heyecanı.' },
  ],
  'trt haber': [
    { start: '00:00', end: '06:00', title: 'Gece Bakışı & Haber Bülteni', category: 'haber', description: '24 saat kesintisiz haber yayını.' },
    { start: '06:00', end: '09:00', title: 'TRT Haber Günaydın', category: 'haber', description: 'Sabah gazeteleri, hava durumu ve trafik.' },
    { start: '09:00', end: '12:00', title: 'Haber Ajandası & Ekonomi', category: 'haber', description: 'Piyasalar ve canlı bağlantılar.' },
    { start: '12:00', end: '15:00', title: 'Öğle Ana Haber', category: 'haber', description: 'Yurt içi ve yurt dışı gelişmeler.' },
    { start: '15:00', end: '18:00', title: 'Dünya Gündemi & Analiz', category: 'sohbet', description: 'Uzman konuklarla dış politika ve gündem.' },
    { start: '18:00', end: '20:30', title: 'TRT Ana Haber', category: 'haber', description: 'Günün kapsamlı haber bülteni.' },
    { start: '20:30', end: '23:59', title: 'Özel Dosya & Gece Bülteni', category: 'sohbet', description: 'Derinlemesine gündem tartışmaları.' },
  ],
  'trt 1': [
    { start: '00:00', end: '06:30', title: 'Gece Sineması & Belgesel', category: 'belgesel', description: 'TRT arşivinden seçkin belgeseller.' },
    { start: '06:30', end: '10:30', title: 'Alişan ile Hayata Gülümse', category: 'sohbet', description: 'Sabah kuşağı sohbet ve müzik.' },
    { start: '10:30', end: '13:00', title: 'Seksenler / Aile Kuşağı', category: 'dizi', description: 'Nostaljik aile komedisi.' },
    { start: '13:00', end: '16:30', title: 'Gündüz Kuşağı & Yarışma', category: 'eglence', description: 'Bilgi ve aile yarışması.' },
    { start: '16:30', end: '19:00', title: 'Lingo Türkiye', category: 'eglence', description: 'Kelime ve zeka yarışması.' },
    { start: '19:00', end: '20:00', title: 'TRT 1 Ana Haber', category: 'haber', description: 'Günün resmi haber bülteni.' },
    { start: '20:00', end: '23:59', title: 'Tarihi Dizi & Büyük Yapım', category: 'dizi', description: 'TRT 1 prime time dizi yayını.' },
  ],
  'trt müzik': [
    { start: '00:00', end: '08:00', title: 'Gece Nağmeleri & Türk Sanat Müziği', category: 'muzik', description: 'Klasik Türk müziğinden seçmeler.' },
    { start: '08:00', end: '12:00', title: 'Sabah Türküleri', category: 'muzik', description: 'Anadolu’nun dört bir yanından türküler.' },
    { start: '12:00', end: '16:00', title: 'TRT Arşivinden Konserler', category: 'muzik', description: 'Usta sanatçılardan canlı performanslar.' },
    { start: '16:00', end: '20:00', title: 'Gönülden Dökülenler', category: 'muzik', description: 'Akşamüstü fasıl ve özgün müzik.' },
    { start: '20:00', end: '23:59', title: 'Akşam Sefası & Özel Konser', category: 'muzik', description: 'Canlı müzik ve özel sahne yayınları.' },
  ],
  'diyanet tv': [
    { start: '00:00', end: '06:00', title: 'Kur’an-ı Kerim Tilaveti', category: 'dini', description: 'Hafızlardan kesintisiz Kur’an tilaveti.' },
    { start: '06:00', end: '09:00', title: 'Sabahın Bereketi & İlmihal', category: 'dini', description: 'Güne manevi başlangıç ve dua.' },
    { start: '09:00', end: '12:30', title: 'Diyanet’e Soralım', category: 'sohbet', description: 'İzleyici soruları ve fıkıh cevapları.' },
    { start: '12:30', end: '15:30', title: 'Anadolu’nun Maneviyat Durakları', category: 'belgesel', description: 'Tarihi camiler ve kültür belgeseli.' },
    { start: '15:30', end: '18:30', title: 'Gençlerle Değerler Sohbeti', category: 'dini', description: 'Ahlak, hadis ve siyer sohbetleri.' },
    { start: '18:30', end: '21:00', title: 'Günün Ayet & Hadis Tefsiri', category: 'dini', description: 'Akşam tefsir ve irşat programı.' },
    { start: '21:00', end: '23:59', title: 'İlahiler ve Tasavvuf Musikisi', category: 'muzik', description: 'Huzur veren ilahi ve ney dinletisi.' },
  ],
  'dost tv': [
    { start: '00:00', end: '07:00', title: 'Gece Kur’an ve Meal Kuşağı', category: 'dini', description: 'Türkçe mealli Kur’an tilaveti.' },
    { start: '07:00', end: '12:00', title: 'Sabah Risale & Siyer Okumaları', category: 'dini', description: 'İman ve tefekkür dersleri.' },
    { start: '12:00', end: '16:00', title: 'Gönül Sohbetleri', category: 'sohbet', description: 'Aile ve maneviyat üzerine söyleşiler.' },
    { start: '16:00', end: '20:00', title: 'Tarih ve Medeniyet Belgeseli', category: 'belgesel', description: 'İslam tarihi ve kültür mirası.' },
    { start: '20:00', end: '23:59', title: 'Akşam İlahi & Tefekkür Vakti', category: 'dini', description: 'Akşam sohbeti ve ilahiler.' },
  ],
  'tgrt belgesel': [
    { start: '00:00', end: '08:00', title: 'Doğanın İzinde & Gece Belgeseli', category: 'belgesel', description: 'Yaban hayatı ve doğa belgeselleri.' },
    { start: '08:00', end: '13:00', title: 'Anadolu Lezzetleri ve Kültür', category: 'belgesel', description: 'Türkiye şehir rehberi ve gezi.' },
    { start: '13:00', end: '18:00', title: 'Tarihin Derinlikleri', category: 'belgesel', description: 'Osmanlı ve Anadolu tarihi.' },
    { start: '18:00', end: '23:59', title: 'Bilim, Uzay ve Keşif Kuşağı', category: 'belgesel', description: 'Bilimsel ve coğrafi belgeseller.' },
  ],
  'trt spor': [
    { start: '00:00', end: '07:00', title: 'Gece Spor & Maç Özetleri', category: 'spor', description: 'Süper Lig ve Avrupa liglerinden özet görüntüler.' },
    { start: '07:00', end: '10:30', title: 'İlk Baskı Spor', category: 'spor', description: 'Günün spor manşetleri ve canlı bağlantılar.' },
    { start: '10:30', end: '14:30', title: 'Spor Stüdyosu', category: 'spor', description: 'Futbol ve tüm branşlardan son gelişmeler.' },
    { start: '14:30', end: '18:30', title: 'Gün Ortası & Takım Analizi', category: 'spor', description: 'Antrenman görüntüleri ve teknik değerlendirmeler.' },
    { start: '18:30', end: '21:00', title: 'Spor Merkezi & Canlı Müsabaka', category: 'spor', description: 'Günün öne çıkan karşılaşmaları ve skorlar.' },
    { start: '21:00', end: '23:59', title: 'Stadyum & Spor Analiz', category: 'spor', description: 'Uzman yorumcularla maç sonu değerlendirmeleri.' },
  ],
  'trt spor yıldız': [
    { start: '00:00', end: '08:00', title: 'Olimpik Branşlar & Tekrar Kuşağı', category: 'spor', description: 'Voleybol, basketbol ve atletizm arşiv yayınları.' },
    { start: '08:00', end: '13:00', title: 'Sabah Sporu & Salon Sporları', category: 'spor', description: 'Türkiye liglerinden basketbol ve voleybol.' },
    { start: '13:00', end: '18:00', title: 'Canlı Müsabaka Kuşağı', category: 'spor', description: 'Millî takımlar ve kulüp karşılaşmaları.' },
    { start: '18:00', end: '23:59', title: 'Akşam Özel Karşılaşmalar', category: 'spor', description: 'Canlı spor yayınları ve günün özetleri.' },
  ],
  'a spor': [
    { start: '00:00', end: '07:00', title: 'Gece Spor Gündemi', category: 'spor', description: 'Transfer gelişmeleri ve maç tekrarları.' },
    { start: '07:00', end: '11:00', title: 'Sabah Sporu', category: 'spor', description: 'Gazete manşetleri ve canlı stüdyo yorumları.' },
    { start: '11:00', end: '15:00', title: 'Spor Ajansı', category: 'spor', description: 'Kulüplerden sıcak haberler ve canlı bağlantılar.' },
    { start: '15:00', end: '19:00', title: 'Gün Ortası & Futbol Saati', category: 'spor', description: 'Süper Lig ve Türkiye Kupası gündemi.' },
    { start: '19:00', end: '23:59', title: 'Takım Oyunu & Transfer Raporu', category: 'spor', description: 'Usta yorumcularla derin futbol analizi.' },
  ],
  'ht spor': [
    { start: '00:00', end: '08:00', title: 'Gece Spor Özetleri', category: 'spor', description: 'Günün tüm branşlarından öne çıkan anlar.' },
    { start: '08:00', end: '13:00', title: 'Spor Masası', category: 'spor', description: 'Sabah bülteni ve lig gündemi.' },
    { start: '13:00', end: '18:30', title: 'Canlı Spor & Röportajlar', category: 'spor', description: 'Stadyum bağlantıları ve özel söyleşiler.' },
    { start: '18:30', end: '23:59', title: 'Akşam Spor Analiz', category: 'spor', description: 'Canlı tartışma ve maç değerlendirmeleri.' },
  ],
  'trt 2': [
    { start: '00:00', end: '08:00', title: 'Gece Sineması Seçkisi', category: 'dizi', description: 'Dünya ve Türk sinemasından ödüllü filmler.' },
    { start: '08:00', end: '13:00', title: 'Sinema Tarihi & Kültür', category: 'belgesel', description: 'Yönetmen sohbetleri ve sanat belgeselleri.' },
    { start: '13:00', end: '18:00', title: 'Gündüz Film Kuşağı', category: 'dizi', description: 'Aileye uygun seçkin yerli ve Türkçe dublaj filmler.' },
    { start: '18:00', end: '21:30', title: 'Sanat & Edebiyat Kuşağı', category: 'sohbet', description: 'Tiyatro, edebiyat ve sinema üzerine programlar.' },
    { start: '21:30', end: '23:59', title: 'TRT 2 Akşam Sineması', category: 'dizi', description: 'Günün özel sinema filmi (Türkçe).' },
  ],
  'tv4': [
    { start: '00:00', end: '07:00', title: 'Gece Yeşilçam Kuşağı', category: 'dizi', description: 'Unutulmaz klasik Türk filmleri.' },
    { start: '07:00', end: '12:00', title: 'Sabah Aile Dizisi', category: 'dizi', description: 'Sevilen yerli aile dizileri.' },
    { start: '12:00', end: '17:00', title: 'Öğle Sineması', category: 'dizi', description: 'Komedi ve dram türünden yerli filmler.' },
    { start: '17:00', end: '20:30', title: 'Akşamüstü Dizi Kuşağı', category: 'dizi', description: 'Türkçe dizi ve sinema seçkisi.' },
    { start: '20:30', end: '23:59', title: 'Prime Time Türk Sineması', category: 'dizi', description: 'Yerli sinema akşam özel yayını.' },
  ],
};

const CATEGORY_DEFAULT_SCHEDULES: Record<Exclude<TvCategory, 'all' | 'recent'>, RawSlot[]> = {
  ulusal: [
    { start: '00:00', end: '07:00', title: 'Gece Sineması & Tekrar Kuşağı', category: 'dizi', description: 'Seçme yerli yapımlar ve sinema.' },
    { start: '07:00', end: '10:00', title: 'Sabah Gündemi', category: 'haber', description: 'Güne başlarken haberler ve gazeteler.' },
    { start: '10:00', end: '14:00', title: 'Gündüz Yaşam ve Sohbet', category: 'sohbet', description: 'Stüdyo konukları ve gündelik yaşam.' },
    { start: '14:00', end: '18:30', title: 'Öğleden Sonra Dizi & Eğlence', category: 'eglence', description: 'Yarışma ve aile kuşağı.' },
    { start: '18:30', end: '20:00', title: 'Akşam Ana Haber Bülteni', category: 'haber', description: 'Günün önemli haber başlıkları.' },
    { start: '20:00', end: '23:59', title: 'Prime Time Dizi / Özel Yayın', category: 'dizi', description: 'Akşam kuşağı ana programı.' },
  ],
  spor: [
    { start: '00:00', end: '07:30', title: 'Gece Spor Özeti & Tekrar', category: 'spor', description: 'Günün maç özetleri ve öne çıkan anlar.' },
    { start: '07:30', end: '12:00', title: 'Sabah Spor Gündemi', category: 'spor', description: 'Spor basını manşetleri ve canlı yorumlar.' },
    { start: '12:00', end: '17:00', title: 'Gün Ortası Canlı Spor', category: 'spor', description: 'Kulüp haberleri ve müsabaka analizleri.' },
    { start: '17:00', end: '20:30', title: 'Akşam Spor Kuşağı', category: 'spor', description: 'Canlı karşılaşmalar ve stüdyo bağlantıları.' },
    { start: '20:30', end: '23:59', title: 'Prime Time Spor Analiz', category: 'spor', description: 'Günün maçlarının detaylı değerlendirmesi.' },
  ],
  sinema: [
    { start: '00:00', end: '07:30', title: 'Gece Sineması & Nostalji', category: 'dizi', description: 'Türkçe sinema ve sevilen klasik yapımlar.' },
    { start: '07:30', end: '12:30', title: 'Sabah Aile Dizi Kuşağı', category: 'dizi', description: 'Aileye uygun Türkçe dizi bölümleri.' },
    { start: '12:30', end: '17:30', title: 'Gündüz Türk Sineması', category: 'dizi', description: 'Seçkin yerli film ve diziler.' },
    { start: '17:30', end: '20:30', title: 'Akşamüstü Dizi & Sinema', category: 'dizi', description: 'Türkçe dizi ve sinema keyfi.' },
    { start: '20:30', end: '23:59', title: 'Prime Time Film & Dizi Gecesi', category: 'dizi', description: 'Akşam özel film ve dizi kuşağı.' },
  ],
  haber: [
    { start: '00:00', end: '06:30', title: 'Gece Bülteni & Manşetler', category: 'haber', description: 'Son dakika haberleri ve özetler.' },
    { start: '06:30', end: '10:00', title: 'Sabah Haberleri & Ekonomi', category: 'haber', description: 'Piyasalar, hava ve günün ajandası.' },
    { start: '10:00', end: '14:00', title: 'Gün Ortası Canlı Yayın', category: 'haber', description: 'Muhabir bağlantıları ve sıcak gelişmeler.' },
    { start: '14:00', end: '18:00', title: 'Haber Masası & Analiz', category: 'sohbet', description: 'Ekonomi ve gündem yorumları.' },
    { start: '18:00', end: '20:30', title: 'Ana Haber Bülteni', category: 'haber', description: 'Günün detaylı haber özeti.' },
    { start: '20:30', end: '23:59', title: 'Akşam Tartışma & Siyaset', category: 'sohbet', description: 'Canlı stüdyo tartışma programı.' },
  ],
  dini: [
    { start: '00:00', end: '06:30', title: 'Kur’an-ı Kerim & Dua Vakti', category: 'dini', description: 'Kesintisiz Kur’an tilaveti ve meali.' },
    { start: '06:30', end: '11:00', title: 'Sabah İlahileri ve Sohbet', category: 'dini', description: 'Maneviyat ve günlük nasihatler.' },
    { start: '11:00', end: '15:00', title: 'Fıkıh & İlmihal Soruları', category: 'sohbet', description: 'İzleyicilerden gelen soruların yanıtları.' },
    { start: '15:00', end: '19:00', title: 'Tarih ve Vakıf Medeniyeti', category: 'belgesel', description: 'Kültür ve tarih belgeseli.' },
    { start: '19:00', end: '23:59', title: 'Akşam İlahi & Tefsir Kuşağı', category: 'dini', description: 'İlahiler, kasideler ve sohbet.' },
  ],
  kultur: [
    { start: '00:00', end: '08:00', title: 'Gece Müzik & Belgesel Seçkisi', category: 'belgesel', description: 'Kültür, sanat ve müzik yayını.' },
    { start: '08:00', end: '13:00', title: 'Anadolu Kültür ve Gezi', category: 'belgesel', description: 'Türkiye’den şehirler ve doğa.' },
    { start: '13:00', end: '18:00', title: 'Müzik & Konser Kuşağı', category: 'muzik', description: 'Türk müziği ve halk ezgileri.' },
    { start: '18:00', end: '23:59', title: 'Özel Belgesel & Sahne', category: 'belgesel', description: 'Akşam kültür ve sanat kuşağı.' },
  ],
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function getIstanbulNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return toMinutes(parts);
}

function pickScheduleSlots(
  channelName: string,
  category: Exclude<TvCategory, 'all' | 'recent'>,
): RawSlot[] {
  const lower = channelName.toLowerCase();
  for (const [key, slots] of Object.entries(CHANNEL_SCHEDULES)) {
    if (lower.includes(key)) return slots;
  }
  if (lower.includes('spor') || lower.includes('tjk') || lower.includes('fb tv') || lower.includes('gs tv') || lower.includes('bjk')) {
    return CATEGORY_DEFAULT_SCHEDULES.spor;
  }
  if (lower.includes('sinema') || lower.includes('film') || lower.includes('dizi') || lower.includes('tv4') || lower.includes('trt 2') || lower.includes('cnbc')) {
    return CATEGORY_DEFAULT_SCHEDULES.sinema;
  }
  if (lower.includes('haber') || lower.includes('cnn') || lower.includes('ntv') || lower.includes('bloomberg') || lower.includes('halk') || lower.includes('tele1') || lower.includes('sözcü') || lower.includes('krt')) {
    return CATEGORY_DEFAULT_SCHEDULES.haber;
  }
  if (lower.includes('diyanet') || lower.includes('dost') || lower.includes('semerkand') || lower.includes('lalegül') || lower.includes('rehber')) {
    return CATEGORY_DEFAULT_SCHEDULES.dini;
  }
  if (lower.includes('müzik') || lower.includes('muzik') || lower.includes('belgesel') || lower.includes('kral')) {
    return CATEGORY_DEFAULT_SCHEDULES.kultur;
  }
  return CATEGORY_DEFAULT_SCHEDULES[category] ?? CATEGORY_DEFAULT_SCHEDULES.ulusal;
}

export function buildChannelEpgGuide(
  channelKey: string,
  channelName: string,
  category: Exclude<TvCategory, 'all' | 'recent'>,
): ChannelEpgGuide {
  const rawSlots = pickScheduleSlots(channelName, category);
  const nowMins = getIstanbulNowMinutes();

  let currentIdx = rawSlots.findIndex((s) => {
    const start = toMinutes(s.start);
    const end = s.end === '23:59' ? 24 * 60 : toMinutes(s.end);
    return nowMins >= start && nowMins < end;
  });
  if (currentIdx === -1) currentIdx = 0;

  const schedule: EpgProgramItem[] = rawSlots.map((s, idx) => {
    const start = toMinutes(s.start);
    const end = s.end === '23:59' ? 24 * 60 : toMinutes(s.end);
    const isLive = idx === currentIdx;
    const progress = isLive
      ? Math.max(4, Math.min(98, Math.round(((nowMins - start) / Math.max(1, end - start)) * 100)))
      : undefined;

    return {
      title: s.title,
      startTime: s.start,
      endTime: s.end,
      category: s.category,
      description: s.description,
      isLive,
      progress,
    };
  });

  const current = schedule[currentIdx];
  const next = schedule[(currentIdx + 1) % schedule.length];

  return {
    channelKey,
    channelName,
    current,
    next,
    schedule,
  };
}

export function getRadioCurrentProgram(
  category: StationCategory,
  stationName: string,
): { title: string; programType: EpgProgramType } {
  const nowMins = getIstanbulNowMinutes();
  const hour = Math.floor(nowMins / 60);
  const part =
    hour < 10 ? 'Sabah' : hour < 14 ? 'Öğle' : hour < 18 ? 'İkindi' : hour < 22 ? 'Akşam' : 'Gece';

  const lower = stationName.toLowerCase();
  if (lower.includes('kuran') || lower.includes("kur'an") || lower.includes('meal')) {
    return { title: `${part} Kur’an-ı Kerim Tilaveti & Meal`, programType: 'dini' };
  }

  switch (category) {
    case 'ilahi':
      return { title: `${part} İlahi, Tasavvuf & Sohbet Kuşağı`, programType: 'dini' };
    case 'haber':
      return { title: `${part} Canlı Haber & Gündem Bülteni`, programType: 'haber' };
    case 'turku':
      return { title: `${part} Anadolu Türküleri Kuşağı`, programType: 'muzik' };
    case 'arabesk':
      return { title: `${part} Damar & Arabesk Seçkisi`, programType: 'muzik' };
    case 'ozgun':
      return { title: `${part} Özgün Müzik & Sanat Eserleri`, programType: 'muzik' };
    case 'slow':
      return { title: `${part} Akustik & Slow Dinleti`, programType: 'muzik' };
    case 'pop':
    default:
      return { title: `${part} Türkçe Hit & Canlı Yayın`, programType: 'eglence' };
  }
}

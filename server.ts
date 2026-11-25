import express from 'express';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_STATIONS, LANDSCAPE_SCENES } from './src/data/stations.ts';
import { isAdultContentText, isForeignLanguageText } from './src/data/contentSafety.ts';
import { loadLiveMatchSchedule } from './src/data/matchSchedule.ts';
import { buildChannelEpgGuide } from './src/data/turkishEpg.ts';
import { TURKSAT_TV_CHANNELS } from './src/data/tvChannels.ts';
import type {
  DailyWisdomData,
  DiyanetCity,
  DiyanetDistrict,
  LandscapeItem,
  MatchScheduleResponse,
  PrayerTimesData,
  RadioStation,
  StationCategory,
  StationLanguage,
  TvChannel,
  YouTubeArtistResult,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const APP_VERSION = '2.4.0';
const CATALOG_TTL_MS = 1000 * 60 * 30; // 30 dakika otomatik güncelleme aralığı

interface RawRadioBrowserStation {
  stationuuid: string;
  name: string;
  url_resolved?: string;
  url: string;
  language?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  country?: string;
  countrycode?: string;
}

let cachedCatalog: RadioStation[] = [...DEFAULT_STATIONS];
let catalogLoadedAt = 0;
let catalogPromise: Promise<RadioStation[]> | null = null;
let catalogVersion = `v-${Date.now()}`;

let cachedLandscapes: LandscapeItem[] = LANDSCAPE_SCENES.map((s) => ({
  id: s.id,
  title: s.title,
  imageUrl: s.imageUrl,
  source: 'local',
}));
let landscapesLoadedAt = 0;
let landscapesPromise: Promise<LandscapeItem[]> | null = null;

let cachedTvChannels: TvChannel[] = [...TURKSAT_TV_CHANNELS];
let tvLoadedAt = 0;
let tvPromise: Promise<TvChannel[]> | null = null;

const MATCH_TTL_MS = 1000 * 60 * 5;
let cachedMatchSchedule: MatchScheduleResponse | null = null;
let matchScheduleLoadedAt = 0;
let matchSchedulePromise: Promise<MatchScheduleResponse> | null = null;

async function getMatchScheduleCached(force = false): Promise<MatchScheduleResponse> {
  const now = Date.now();
  if (!force && cachedMatchSchedule && now - matchScheduleLoadedAt < MATCH_TTL_MS) {
    return cachedMatchSchedule;
  }
  if (matchSchedulePromise) return matchSchedulePromise;

  matchSchedulePromise = (async () => {
    try {
      const channels = await loadTvChannels();
      const data = await loadLiveMatchSchedule(channels);
      cachedMatchSchedule = data;
      matchScheduleLoadedAt = Date.now();
      return data;
    } finally {
      matchSchedulePromise = null;
    }
  })();

  return matchSchedulePromise;
}

let cachedDiyanetCities: DiyanetCity[] = [];
const cachedDiyanetDistricts = new Map<string, DiyanetDistrict[]>();
const cachedPrayerTimes = new Map<string, { data: PrayerTimesData; fetchedAt: number }>();

const AYAH_KEYS = [
  '2:255', '2:286', '3:139', '3:159', '13:28', '14:7', '16:90', '17:23',
  '24:35', '29:69', '31:17', '39:53', '49:13', '55:13', '65:3', '94:5',
  '94:6', '103:1', '103:2', '103:3',
];

const SURAH_TR_NAMES: Record<number, string> = {
  2: 'Bakara Suresi',
  3: 'Âl-i İmrân Suresi',
  13: 'Ra’d Suresi',
  14: 'İbrâhîm Suresi',
  16: 'Nahl Suresi',
  17: 'İsrâ Suresi',
  24: 'Nûr Suresi',
  29: 'Ankebût Suresi',
  31: 'Lokmân Suresi',
  39: 'Zümer Suresi',
  49: 'Hucurât Suresi',
  55: 'Rahmân Suresi',
  65: 'Talâk Suresi',
  94: 'İnşirâh Suresi',
  103: 'Asr Suresi',
};

const HADITH_NUMBERS = [1, 2, 6, 7, 13, 14, 15, 29, 32, 33, 50, 52, 65, 99, 100];

const FALLBACK_WISDOM: DailyWisdomData = {
  ayah: {
    turkish: 'Bilesiniz ki, kalpler ancak Allah’ı anmakla huzur bulur.',
    reference: 'Ra’d Suresi, 28. Ayet',
    source: 'Diyanet İşleri Meali',
  },
  hadith: {
    text: 'Ameller niyetlere göredir ve herkes için ancak niyet ettiğinin karşılığı vardır.',
    reference: 'Sahîh-i Buhârî, Bed’ü’l-Vahy, 1',
    source: 'Hadis-i Şerif',
  },
};

function isSafePublicUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    // URL.hostname IPv6 adreslerini köşeli parantezle verir: "[::1]"
    const bareHost = host.replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^0\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      bareHost === '::' ||
      bareHost === '::1' ||
      /^f[cd]/.test(bareHost) ||
      /^fe[89ab]/.test(bareHost) ||
      bareHost.startsWith('::ffff:')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isAllowedBackdropHost(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  return (
    host === 'www.bing.com' ||
    host === 'cn.bing.com' ||
    host === 'www.gstatic.com' ||
    host.endsWith('.googleusercontent.com') ||
    host === 'upload.wikimedia.org'
  );
}

const NON_TURKISH_TERMS = [
  'kurd',
  'kurdî',
  'dengbej',
  'dengbêj',
  'rojava',
  'govend',
  'botan',
  'şivan',
  'sivan perwer',
  'arabic',
  'arabi',
  'al jazeera',
  'english',
  'russian',
  'deutsch',
  'german',
  'french',
  'persian',
  'farsi',
  'greek',
  'armenian',
  'turk world',
  'trt world',
  'trt arab',
  'trt kurd',
  'trt avaz',
];

function isStrictlyTurkish(raw: RawRadioBrowserStation): boolean {
  const nameLower = raw.name.toLowerCase();
  const tagsLower = (raw.tags || '').toLowerCase();
  const langLower = (raw.language || '').toLowerCase();
  const cc = (raw.countrycode || '').toUpperCase();
  const combined = `${nameLower} ${tagsLower}`;

  if (isAdultContentText(`${combined} ${langLower}`)) {
    return false;
  }

  if (NON_TURKISH_TERMS.some((term) => combined.includes(term) || langLower.includes(term))) {
    return false;
  }

  // If language metadata is explicitly non-Turkish (and doesn't include turkish), exclude
  if (langLower && !langLower.includes('turk') && cc !== 'TR') {
    return false;
  }

  if (
    langLower.includes('turk') ||
    cc === 'TR' ||
    combined.includes('türk') ||
    combined.includes('turk') ||
    combined.includes('arabesk') ||
    combined.includes('ozgun') ||
    combined.includes('özgün') ||
    combined.includes('damar') ||
    combined.includes('ilahi') ||
    combined.includes('ilahî') ||
    combined.includes('diyanet') ||
    combined.includes('tasavvuf') ||
    combined.includes('lalegül') ||
    combined.includes('lalegul') ||
    combined.includes('erkam') ||
    combined.includes('akra') ||
    combined.includes('istanbul') ||
    combined.includes('ankara') ||
    combined.includes('izmir') ||
    combined.includes('konya') ||
    combined.includes('bursa') ||
    combined.includes('antalya') ||
    combined.includes('adana') ||
    combined.includes('karadeniz') ||
    combined.includes('anadolu') ||
    combined.includes('radyo')
  ) {
    // Reject if language field explicitly names another language like arabic/english only
    if (
      langLower &&
      !langLower.includes('turk') &&
      ['arabic', 'english', 'german', 'french', 'russian', 'spanish', 'greek', 'kurdish', 'persian'].some((l) =>
        langLower.includes(l),
      )
    ) {
      return false;
    }
    return true;
  }

  return false;
}

function classifyStation(raw: RawRadioBrowserStation): {
  language: StationLanguage;
  category: StationCategory;
  genreLabel: string;
} {
  const nameLower = raw.name.toLowerCase();
  const tagsLower = (raw.tags || '').toLowerCase();
  const combined = `${nameLower} ${tagsLower}`;

  let category: StationCategory = 'pop';

  if (
    combined.includes('ilahi') ||
    combined.includes('ilahî') ||
    combined.includes('islamic') ||
    combined.includes('islam') ||
    combined.includes('quran') ||
    combined.includes('kuran') ||
    combined.includes("kur'an") ||
    combined.includes('meal') ||
    combined.includes('tasavvuf') ||
    combined.includes('diyanet') ||
    combined.includes('semerkand') ||
    combined.includes('lalegül') ||
    combined.includes('lalegul') ||
    combined.includes('erkam') ||
    combined.includes('akra') ||
    combined.includes('moral fm') ||
    combined.includes('enderun') ||
    combined.includes('gözyaşı') ||
    combined.includes('gozyasi') ||
    combined.includes('ribat') ||
    combined.includes('mekke') ||
    combined.includes('medine') ||
    combined.includes('ezan') ||
    combined.includes('risalet') ||
    combined.includes('dost fm') ||
    combined.includes('radyo 7') ||
    combined.includes('nebi') ||
    combined.includes('fitrat') ||
    combined.includes('fıtrat') ||
    combined.includes('ihya') ||
    combined.includes('isra fm') ||
    combined.includes('religion') ||
    combined.includes('religious')
  ) {
    category = 'ilahi';
  } else if (
    combined.includes('arabesk') ||
    combined.includes('damar') ||
    combined.includes('fantezi') ||
    combined.includes('kral fm') ||
    combined.includes('baba radyo') ||
    combined.includes('taverna') ||
    combined.includes('efkar') ||
    combined.includes('aşk') ||
    combined.includes('ask fm')
  ) {
    category = 'arabesk';
  } else if (
    combined.includes('türkü') ||
    combined.includes('turku') ||
    combined.includes('halk') ||
    combined.includes('bağlama') ||
    combined.includes('baglama') ||
    combined.includes('folk') ||
    combined.includes('halay') ||
    combined.includes('bozlak') ||
    combined.includes('ankara havalar') ||
    combined.includes('yöresel') ||
    combined.includes('karadeniz') ||
    combined.includes('kemençe')
  ) {
    category = 'turku';
  } else if (
    combined.includes('özgün') ||
    combined.includes('ozgun') ||
    combined.includes('anadolu rock') ||
    combined.includes('protest') ||
    combined.includes('şiir') ||
    combined.includes('siir') ||
    combined.includes('sanat') ||
    combined.includes('nağme') ||
    combined.includes('nagme') ||
    combined.includes('fasıl') ||
    combined.includes('fasil') ||
    combined.includes('klasik') ||
    combined.includes('indie') ||
    combined.includes('alternatif') ||
    combined.includes('acoustic') ||
    combined.includes('caz') ||
    combined.includes('jazz')
  ) {
    category = 'ozgun';
  } else if (
    combined.includes('haber') ||
    combined.includes('news') ||
    combined.includes('talk') ||
    combined.includes('spor') ||
    combined.includes('ntv') ||
    combined.includes('cnn') ||
    combined.includes('trt 1') ||
    combined.includes('trt radyo 1') ||
    combined.includes('radyo 1')
  ) {
    category = 'haber';
  } else if (
    combined.includes('slow') ||
    combined.includes('chill') ||
    combined.includes('lounge') ||
    combined.includes('ambient') ||
    combined.includes('relax') ||
    combined.includes('akustik') ||
    combined.includes('romantic')
  ) {
    category = 'slow';
  } else {
    category = 'pop';
  }

  const categoryTitles: Record<StationCategory, string> = {
    ilahi: "İlahi · Kur'an & Tasavvuf",
    arabesk: 'Arabesk & Damar',
    ozgun: 'Özgün & Sanat Müziği',
    turku: 'Türkü & Halk Müziği',
    pop: 'Türkçe Pop & Hit',
    slow: 'Türkçe Slow & Akustik',
    haber: 'Haber & Sohbet',
  };

  const cleanTags = raw.tags
    ? raw.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t && !NON_TURKISH_TERMS.some((term) => t.toLowerCase().includes(term)))
        .slice(0, 2)
        .join(' · ')
    : '';

  return {
    language: 'turkish',
    category,
    genreLabel: cleanTags || categoryTitles[category],
  };
}

function mapRawStation(raw: RawRadioBrowserStation): RadioStation | null {
  const streamUrl = (raw.url_resolved || raw.url || '').trim();
  if (!streamUrl || !isSafePublicUrl(streamUrl)) return null;
  const name = raw.name.trim();
  if (!name) return null;
  if (!isStrictlyTurkish(raw)) return null;

  const { language, category, genreLabel } = classifyStation(raw);
  const isHls = streamUrl.toLowerCase().includes('.m3u8');

  return {
    id: `rb-${raw.stationuuid}`,
    name,
    language,
    category,
    genre: genreLabel,
    city: raw.country === 'Türkiye' || raw.country === 'Turkey' ? 'Türkiye' : raw.country || 'Türkiye',
    streamUrl,
    format: isHls ? 'HLS' : raw.codec?.toUpperCase().includes('AAC') ? 'AAC' : 'MP3',
    bitrate: raw.bitrate || undefined,
    needsProxy: streamUrl.startsWith('http://'),
  };
}

async function fetchRadioBrowser(queryString: string): Promise<RawRadioBrowserStation[]> {
  try {
    const res = await fetch(
      `https://de1.api.radio-browser.info/json/stations/search?${queryString}`,
      { headers: { 'User-Agent': 'RadyoKutu/2.4' } },
    );
    if (!res.ok) return [];
    return (await res.json()) as RawRadioBrowserStation[];
  } catch {
    return [];
  }
}

async function loadCatalog(force = false): Promise<RadioStation[]> {
  const now = Date.now();
  if (!force && cachedCatalog.length > DEFAULT_STATIONS.length && now - catalogLoadedAt < CATALOG_TTL_MS) {
    return cachedCatalog;
  }
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const [
        trReligion,
        ilahiName,
        kuranName,
        trLang,
        trCountry,
        arabeskTag,
        turkuName,
        slowName,
        popTr,
        radyoName,
      ] = await Promise.all([
        fetchRadioBrowser('tag=religion&countrycode=TR&hidebroken=true&limit=400'),
        fetchRadioBrowser('name=ilahi&hidebroken=true&limit=250'),
        fetchRadioBrowser('name=kuran&hidebroken=true&limit=200'),
        fetchRadioBrowser('language=turkish&hidebroken=true&order=votes&reverse=true&limit=2500'),
        fetchRadioBrowser('countrycode=TR&hidebroken=true&order=votes&reverse=true&limit=2500'),
        fetchRadioBrowser('tag=arabesk&hidebroken=true&limit=500'),
        fetchRadioBrowser('name=turku&hidebroken=true&limit=300'),
        fetchRadioBrowser('name=slow&countrycode=TR&hidebroken=true&limit=250'),
        fetchRadioBrowser('tag=pop&countrycode=TR&hidebroken=true&order=votes&reverse=true&limit=1000'),
        fetchRadioBrowser('name=radyo&hidebroken=true&order=votes&reverse=true&limit=1500'),
      ]);

      const seenUrls = new Set<string>();
      const seenNames = new Set<string>();
      const merged: RadioStation[] = [];

      const addStation = (s: RadioStation) => {
        const normUrl = s.streamUrl.trim();
        const normName = s.name.trim().toLowerCase();
        if (seenUrls.has(normUrl)) return;
        if (seenNames.has(normName) && s.id.startsWith('rb-')) return;
        seenUrls.add(normUrl);
        seenNames.add(normName);
        merged.push(s);
      };

      // 1. Flagship curated Turkish stations first (İlahi stations at index 0)
      for (const s of DEFAULT_STATIONS) {
        addStation(s);
      }

      // 2. Strictly Turkish Radio Browser pools
      const priorityRaw = [
        ...trReligion,
        ...ilahiName,
        ...kuranName,
        ...trLang,
        ...trCountry,
        ...arabeskTag,
        ...turkuName,
        ...slowName,
        ...popTr,
        ...radyoName,
      ];

      for (const raw of priorityRaw) {
        const mapped = mapRawStation(raw);
        if (mapped) addStation(mapped);
      }

      if (merged.length > DEFAULT_STATIONS.length) {
        cachedCatalog = merged;
        catalogLoadedAt = Date.now();
        catalogVersion = `v-${catalogLoadedAt}`;
      }
      return cachedCatalog;
    } finally {
      catalogPromise = null;
    }
  })();

  return catalogPromise;
}

async function loadLandscapes(force = false): Promise<LandscapeItem[]> {
  const now = Date.now();
  if (!force && cachedLandscapes.length >= 5000 && now - landscapesLoadedAt < CATALOG_TTL_MS) {
    return cachedLandscapes;
  }
  if (landscapesPromise) return landscapesPromise;

  landscapesPromise = (async () => {
    try {
      const [chromecast, earthview, niumooMd, ...bingRegions] = await Promise.all([
        fetch('https://raw.githubusercontent.com/dconnolly/chromecast-backgrounds/master/backgrounds.json')
          .then((r) => (r.ok ? (r.json() as Promise<Array<{ url: string; author?: string }>>) : []))
          .catch(() => []),
        fetch('https://raw.githubusercontent.com/limhenry/earthview/master/earthview.json')
          .then((r) =>
            r.ok
              ? (r.json() as Promise<Array<{ image: string; country?: string; region?: string }>>)
              : [],
          )
          .catch(() => []),
        fetch('https://raw.githubusercontent.com/niumoo/bing-wallpaper/main/bing-wallpaper.md')
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => ''),
        ...['en-US', 'de-DE', 'ja-JP', 'fr-FR', 'en-GB', 'zh-CN', 'es-ES', 'it-IT'].map((loc) =>
          fetch(`https://raw.githubusercontent.com/zkeq/Bing-Wallpaper-Action/main/data/${loc}_all.json`)
            .then((r) =>
              r.ok
                ? (r.json() as Promise<{
                    data?: Array<{ url: string; title?: string; copyright?: string }>;
                  }>)
                : { data: [] },
            )
            .catch(() => ({ data: [] })),
        ),
      ]);

      const seenUrls = new Set<string>();
      const items: LandscapeItem[] = [];

      const pushItem = (item: LandscapeItem) => {
        if (seenUrls.has(item.imageUrl)) return;
        seenUrls.add(item.imageUrl);
        items.push(item);
      };

      // Local Full HD studio landscapes first (instant 0ms load)
      for (const s of LANDSCAPE_SCENES) {
        pushItem({
          id: s.id,
          title: s.title,
          imageUrl: s.imageUrl,
          source: 'local',
        });
      }

      // Chromecast 1920x1080 Full HD landscapes
      chromecast.forEach((c, idx) => {
        if (!c?.url) return;
        pushItem({
          id: `cc-${idx}`,
          title: c.author ? `Manzara · ${c.author}` : `Full HD Manzara #${idx + 1}`,
          imageUrl: c.url,
          source: 'chromecast',
        });
      });

      // Bing Full HD 1920x1080 wallpapers across regional archives
      let bingIdx = 0;
      for (const reg of bingRegions) {
        for (const entry of reg.data ?? []) {
          if (!entry?.url) continue;
          const fullUrl = entry.url.startsWith('http')
            ? entry.url
            : `https://www.bing.com${entry.url}`;
          // Normalize to clean 1920x1080 Full HD URL
          const cleanId = fullUrl.split('&')[0];
          const title = entry.title || entry.copyright?.split('(')[0]?.trim() || 'Full HD Doğa Manzarası';
          pushItem({
            id: `bing-${bingIdx++}`,
            title,
            imageUrl: cleanId,
            source: 'bing',
          });
        }
      }

      // Niumoo Bing markdown archive (normalized to 1920x1080)
      const niumooMatches = niumooMd.match(/https?:\/\/cn\.bing\.com\/th\?id=[^\s\)]+/g) || [];
      niumooMatches.forEach((rawUrl, idx) => {
        const cleanUrl = rawUrl
          .replace('cn.bing.com', 'www.bing.com')
          .replace('_UHD.jpg', '_1920x1080.jpg')
          .split('&')[0];
        pushItem({
          id: `bmd-${idx}`,
          title: `Doğa Manzarası · Full HD`,
          imageUrl: cleanUrl,
          source: 'bing',
        });
      });

      // Google Earth View Full HD aerial landscapes
      earthview.forEach((ev, idx) => {
        if (!ev?.image) return;
        const place = [ev.region, ev.country].filter(Boolean).join(', ');
        pushItem({
          id: `ev-${idx}`,
          title: place ? `Yeryüzü · ${place}` : `Yeryüzü Manzarası #${idx + 1}`,
          imageUrl: ev.image,
          source: 'earthview',
        });
      });

      if (items.length > LANDSCAPE_SCENES.length) {
        cachedLandscapes = items;
        landscapesLoadedAt = Date.now();
      }
      return cachedLandscapes;
    } finally {
      landscapesPromise = null;
    }
  })();

  return landscapesPromise;
}

interface IptvOrgChannel {
  id: string;
  name: string;
  country?: string;
  languages?: string[];
  categories?: string[];
  is_nsfw?: boolean;
}

interface IptvOrgStream {
  channel?: string | null;
  url?: string;
  quality?: string | null;
}

const BLOCKED_TV_HOSTS_OR_TERMS = [
  'geo-blocked',
  'bein',
  's sport',
  'ssport',
  'tivibu spor',
  'exxen',
  'vavoo.to',
  'playhdnewjj',
  '190.93.224.42',
  '217.174.229.138',
  'bnyusuf67-crypto',
  'moviesmart',
];

function isValidTurkishSafeTvChannel(
  name: string,
  metaText: string,
  streamUrl: string,
  languages?: string[],
  isNsfw?: boolean,
): boolean {
  if (isNsfw) return false;
  const combined = `${name} ${metaText}`;
  const lower = `${combined} ${streamUrl}`.toLowerCase();

  if (isAdultContentText(combined) || isAdultContentText(streamUrl)) return false;
  if (isForeignLanguageText(combined)) return false;
  if (NON_TURKISH_TERMS.some((term) => combined.toLowerCase().includes(term))) return false;
  if (BLOCKED_TV_HOSTS_OR_TERMS.some((term) => lower.includes(term))) return false;

  if (Array.isArray(languages) && languages.length > 0 && !languages.includes('tur')) {
    return false;
  }

  return true;
}

function normalizeTvNameKey(name: string): string {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyTvCategory(name: string, categoriesOrGroup: string): TvChannel['category'] {
  const lower = `${name} ${categoriesOrGroup}`.toLowerCase();
  if (
    lower.includes('sports') ||
    lower.includes('spor') ||
    lower.includes('futbol') ||
    lower.includes('tjk') ||
    lower.includes('fb tv') ||
    lower.includes('gs tv') ||
    lower.includes('bjk')
  ) {
    return 'spor';
  }
  if (
    lower.includes('movies') ||
    lower.includes('series') ||
    lower.includes('classic') ||
    lower.includes('sinema') ||
    lower.includes('film') ||
    lower.includes('dizi') ||
    lower.includes('drama') ||
    lower.includes('yeşilçam') ||
    lower.includes('yesilcam') ||
    lower.includes('tv4') ||
    lower.includes('trt 2') ||
    lower.includes('teve2') ||
    lower.includes('cnbc-e') ||
    lower.includes('a2tv') ||
    lower.includes('cine 1') ||
    lower === 'fx' ||
    lower.startsWith('fx ') ||
    lower.startsWith('now ') ||
    lower === 'now' ||
    lower.startsWith('atv ') ||
    lower === 'atv' ||
    lower.includes('euro d')
  ) {
    return 'sinema';
  }
  if (
    lower.includes('religious') ||
    lower.includes('diyanet') ||
    lower.includes('dost') ||
    lower.includes('semerkand') ||
    lower.includes('lalegul') ||
    lower.includes('lalegül') ||
    lower.includes('rehber')
  ) {
    return 'dini';
  }
  if (lower.includes('news') || lower.includes('haber') || lower.includes('business')) {
    return 'haber';
  }
  if (
    lower.includes('culture') ||
    lower.includes('music') ||
    lower.includes('education') ||
    lower.includes('documentary') ||
    lower.includes('belgesel') ||
    lower.includes('müzik') ||
    lower.includes('muzik') ||
    lower.includes('kids')
  ) {
    return 'kultur';
  }
  return 'ulusal';
}

async function loadTvChannels(force = false): Promise<TvChannel[]> {
  const now = Date.now();
  if (!force && cachedTvChannels.length > TURKSAT_TV_CHANNELS.length && now - tvLoadedAt < CATALOG_TTL_MS) {
    return cachedTvChannels;
  }
  if (tvPromise) return tvPromise;

  tvPromise = (async () => {
    try {
      const [channelsJson, streamsJson, m3uText] = await Promise.all([
        fetch('https://iptv-org.github.io/api/channels.json', { signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? (r.json() as Promise<IptvOrgChannel[]>) : []))
          .catch(() => []),
        fetch('https://iptv-org.github.io/api/streams.json', { signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? (r.json() as Promise<IptvOrgStream[]>) : []))
          .catch(() => []),
        fetch('https://iptv-org.github.io/iptv/countries/tr.m3u', { signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => ''),
      ]);

      const merged: TvChannel[] = [...TURKSAT_TV_CHANNELS];
      const seenUrls = new Set(merged.map((c) => c.streamUrl));
      const seenNames = new Set(merged.map((c) => normalizeTvNameKey(c.name)));

      // 1. Online JSON databases (channels.json + streams.json) for Turkish Sports, Cinema/Series & TV
      const streamByChannel = new Map<string, IptvOrgStream>();
      for (const st of streamsJson) {
        if (!st?.channel || !st?.url) continue;
        if (!isSafePublicUrl(st.url)) continue;
        if (!streamByChannel.has(st.channel)) {
          streamByChannel.set(st.channel, st);
        }
      }

      const turkishJsonChannels = channelsJson.filter(
        (ch) =>
          ch &&
          !ch.is_nsfw &&
          (ch.country === 'TR' || (Array.isArray(ch.languages) && ch.languages.includes('tur'))),
      );

      for (const ch of turkishJsonChannels) {
        const st = streamByChannel.get(ch.id);
        if (!st?.url) continue;
        const cleanName = ch.name.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
        if (!cleanName) continue;
        const catsText = (ch.categories || []).join(' ');
        if (!isValidTurkishSafeTvChannel(cleanName, catsText, st.url, ch.languages, ch.is_nsfw)) {
          continue;
        }
        const nameKey = normalizeTvNameKey(cleanName);
        if (seenUrls.has(st.url) || seenNames.has(nameKey)) continue;

        const category = classifyTvCategory(cleanName, catsText);
        merged.push({
          id: `trjson-${merged.length}`,
          name: cleanName,
          category,
          resolution: st.quality || 'HD',
          streamUrl: st.url,
          needsProxy: true,
          satellite: 'Türksat 4A',
        });
        seenUrls.add(st.url);
        seenNames.add(nameKey);
      }

      // 2. Fallback/Additional channels from tr.m3u
      const lines = m3uText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('#EXTINF')) continue;
        const rawName = lines[i].split(',').pop()?.trim() || '';
        const group = (lines[i].match(/group-title="([^"]*)"/) || [])[1] || '';
        const url = (lines[i + 1] || '').trim();
        if (!rawName || !url || !isSafePublicUrl(url)) continue;

        const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
        if (!cleanName) continue;
        if (!isValidTurkishSafeTvChannel(cleanName, group, url)) continue;
        const nameKey = normalizeTvNameKey(cleanName);
        if (seenUrls.has(url) || seenNames.has(nameKey)) continue;

        const category = classifyTvCategory(cleanName, group);
        const resMatch = rawName.match(/\((1080p|720p|576p|480p)\)/i);
        merged.push({
          id: `trtv-${merged.length}`,
          name: cleanName,
          category,
          resolution: resMatch ? resMatch[1] : 'HD',
          streamUrl: url,
          needsProxy: true,
          satellite: 'Türksat 4A',
        });
        seenUrls.add(url);
        seenNames.add(nameKey);
      }

      cachedTvChannels = merged;
      tvLoadedAt = Date.now();
      return cachedTvChannels;
    } finally {
      tvPromise = null;
    }
  })();

  return tvPromise;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Warm up strictly Turkish radios, Full HD landscapes, and Türksat 4A TV list
  loadCatalog().then((list) => {
    console.log(`Cengiz TV & Radyo Turkish radio catalog ready: ${list.length} channels.`);
  });
  loadLandscapes().then((list) => {
    console.log(`Cengiz TV & Radyo Full HD landscapes ready: ${list.length} scenes.`);
  });
  loadTvChannels().then((list) => {
    console.log(`Cengiz TV & Radyo Türksat 4A Turkish TV ready: ${list.length} channels.`);
  });

  // Background automatic self-update scheduler every 30 minutes
  setInterval(() => {
    Promise.all([loadCatalog(true), loadTvChannels(true)]).catch(() => {});
  }, CATALOG_TTL_MS);

  // Automatic self-update & live catalog version check endpoints
  app.get('/api/system/status', (_req, res) => {
    res.json({
      appVersion: APP_VERSION,
      catalogVersion,
      radioCount: cachedCatalog.length,
      tvCount: cachedTvChannels.length,
      landscapeCount: cachedLandscapes.length,
      lastUpdatedAt: new Date(catalogLoadedAt || Date.now()).toISOString(),
    });
  });

  // Manuel yenileme: en az 60 saniyede bir ve aynı anda tek istek çalışabilir.
  const REFRESH_COOLDOWN_MS = 60 * 1000;
  let lastRefreshAt = 0;
  let refreshInFlight: Promise<unknown> | null = null;

  app.post('/api/system/refresh', async (_req, res) => {
    if (refreshInFlight) {
      res.status(429).json({ error: 'Yenileme zaten devam ediyor.' });
      return;
    }
    const wait = REFRESH_COOLDOWN_MS - (Date.now() - lastRefreshAt);
    if (wait > 0) {
      res.status(429).set('Retry-After', String(Math.ceil(wait / 1000))).json({
        error: 'Çok sık yenileme isteği. Lütfen biraz bekleyin.',
      });
      return;
    }

    lastRefreshAt = Date.now();
    refreshInFlight = (async () => {
      const [radios, tvs, scenes] = await Promise.all([
        loadCatalog(true),
        loadTvChannels(true),
        loadLandscapes(false),
      ]);
      catalogVersion = `v-${Date.now()}`;
      return { radios, tvs, scenes };
    })();

    try {
      const { radios, tvs, scenes } = (await refreshInFlight) as {
        radios: RadioStation[];
        tvs: TvChannel[];
        scenes: LandscapeItem[];
      };
      res.json({
        appVersion: APP_VERSION,
        catalogVersion,
        radioCount: radios.length,
        tvCount: tvs.length,
        landscapeCount: scenes.length,
        lastUpdatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Katalog yenileme hatası:', error);
      res.status(502).json({ error: 'Katalog yenilenemedi. Daha sonra tekrar deneyin.' });
    } finally {
      refreshInFlight = null;
    }
  });

  // Paginated, low-RAM Turkish channel catalog endpoint (default 24 per page)
  app.get('/api/stations', async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : 'ilahi';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(60, Math.max(12, Number(req.query.limit) || 24));

    const catalog = await loadCatalog();

    const categoryCounts: Record<string, number> = {
      ilahi: 0,
      all: catalog.length,
      arabesk: 0,
      ozgun: 0,
      turku: 0,
      pop: 0,
      slow: 0,
      haber: 0,
    };

    for (const s of catalog) {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    }

    const filtered = catalog.filter((s) => {
      if (category !== 'all' && s.category !== category) {
        return false;
      }

      if (q) {
        return (
          s.name.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const stations = filtered.slice(start, start + limit);

    res.json({
      stations,
      total,
      catalogTotal: catalog.length,
      page: safePage,
      limit,
      totalPages,
      categoryCounts,
      catalogVersion,
    });
  });

  // 5000+ Full HD Landscape Catalog
  app.get('/api/landscapes', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 30));
    const list = await loadLandscapes();
    const start = (page - 1) * limit;
    res.json({
      items: list.slice(start, start + limit),
      total: list.length,
      page,
      limit,
    });
  });

  app.get('/api/landscapes/random', async (_req, res) => {
    const list = await loadLandscapes();
    const idx = Math.floor(Math.random() * list.length);
    res.json({ item: list[idx], index: idx, total: list.length });
  });

  // Safe same-origin proxy for Full HD landscape photographs
  app.get('/api/backdrop', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const targetUrl = isSafePublicUrl(rawUrl);

    if (!targetUrl || !isAllowedBackdropHost(targetUrl)) {
      res.status(400).json({ error: 'Geçersiz manzara adresi.' });
      return;
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      const upstream = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': `RadyoKutuTV/${APP_VERSION}`,
          Accept: 'image/jpeg,image/webp,image/*,*/*',
        },
        redirect: 'follow',
      });

      if (!upstream.ok || !upstream.body) {
        res.status(502).end();
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('stream/web').ReadableStream,
      );
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(502).end();
    }
  });

  // Türksat 4A Turkish National TV channels (strictly Turkish, 18+ blocked)
  app.get('/api/tv-channels', async (req, res) => {
    const categoryFilter = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const allChannels = await loadTvChannels();
    const channels =
      categoryFilter && categoryFilter !== 'all'
        ? allChannels.filter((c) => c.category === categoryFilter)
        : allChannels;
    res.json({
      channels,
      total: channels.length,
      turkishOnly: true,
      adultBlocked: true,
    });
  });

  // Electronic Program Guide (EPG Yayın Akışı) for Turkish TV channels
  app.get('/api/epg', async (req, res) => {
    const channelId = typeof req.query.channelId === 'string' ? req.query.channelId.trim() : '';
    const channels = await loadTvChannels();

    if (channelId) {
      const ch = channels.find((c) => c.id === channelId);
      if (ch) {
        res.json({ guide: buildChannelEpgGuide(ch.id, ch.name, ch.category) });
        return;
      }
      const nameParam = typeof req.query.name === 'string' ? req.query.name.trim() : channelId;
      res.json({ guide: buildChannelEpgGuide(channelId, nameParam, 'ulusal') });
      return;
    }

    const guides = channels.map((ch) => buildChannelEpgGuide(ch.id, ch.name, ch.category));
    res.json({
      updatedAt: new Date().toISOString(),
      timeZone: 'Europe/Istanbul',
      guides,
    });
  });

  // Canlı ve Günün Maç Rehberi ("Hangi Kanalda Hangi Maç Var, Saat Kaçta?")
  app.get('/api/match-schedule', async (req, res) => {
    try {
      const force = req.query.refresh === '1';
      const sportFilter =
        typeof req.query.sport === 'string' ? req.query.sport.trim().toLowerCase() : 'all';
      const channelFilter =
        typeof req.query.channel === 'string'
          ? req.query.channel.trim().toLocaleLowerCase('tr-TR')
          : '';
      const q =
        typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase('tr-TR') : '';

      if (q && isAdultContentText(q)) {
        res.json({
          updatedAt: new Date().toISOString(),
          todayDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }),
          todayLabel: 'Bugün',
          matches: [],
          channelHighlights: [],
          turkishOnly: true,
          adultBlocked: true,
        });
        return;
      }

      const data = await getMatchScheduleCached(force);
      const allowedSports = new Set(['futbol', 'basketbol', 'voleybol', 'diger']);

      const filteredMatches = data.matches.filter((m) => {
        if (sportFilter !== 'all' && allowedSports.has(sportFilter) && m.sport !== sportFilter) {
          return false;
        }
        if (channelFilter && !m.channelName.toLocaleLowerCase('tr-TR').includes(channelFilter)) {
          return false;
        }
        if (q) {
          const hay = `${m.title} ${m.league} ${m.channelName}`.toLocaleLowerCase('tr-TR');
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      res.json({
        ...data,
        matches: filteredMatches,
      });
    } catch {
      res.status(502).json({ error: 'Maç rehberi şu anda güncellenemedi.' });
    }
  });

  // HLS (.m3u8 + segments) proxy so NO-CORS TV channels (Kanal D, Star TV, TV8, NTV) play smoothly
  app.get('/api/hls', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const targetUrl = isSafePublicUrl(rawUrl);

    if (!targetUrl) {
      res.status(400).json({ error: 'Geçersiz TV yayın adresi.' });
      return;
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      const upstream = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': `Mozilla/5.0 (compatible; RadyoKutuTV/${APP_VERSION})`,
          Accept: '*/*',
        },
        redirect: 'follow',
      });

      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: `TV yayını alınamadı (${upstream.status}).` });
        return;
      }

      const finalUrl = upstream.url || targetUrl.toString();
      const contentType = upstream.headers.get('content-type') || '';
      const isPlaylist =
        finalUrl.toLowerCase().includes('.m3u8') ||
        contentType.toLowerCase().includes('mpegurl') ||
        contentType.toLowerCase().includes('x-mpegurl');

      if (isPlaylist) {
        const text = await upstream.text();
        const rewritten = text
          .split('\n')
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith('#')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_m, uri) => {
                try {
                  const abs = new URL(uri, finalUrl).toString();
                  return `URI="/api/hls?url=${encodeURIComponent(abs)}"`;
                } catch {
                  return `URI="${uri}"`;
                }
              });
            }
            try {
              const abs = new URL(trimmed, finalUrl).toString();
              return `/api/hls?url=${encodeURIComponent(abs)}`;
            } catch {
              return line;
            }
          })
          .join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(rewritten);
        return;
      }

      res.setHeader('Content-Type', contentType || 'video/mp2t');
      res.setHeader('Cache-Control', 'no-store');
      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('stream/web').ReadableStream,
      );
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && !res.headersSent) {
        res.status(502).json({ error: 'TV yayın bağlantısı kesildi.' });
      }
    }
  });

  // Proxy live HTTP/CORS-restricted radio audio streams safely over same-origin HTTPS
  app.get('/api/stream', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const targetUrl = isSafePublicUrl(rawUrl);

    if (!targetUrl) {
      res.status(400).json({ error: 'Geçersiz yayın adresi.' });
      return;
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      const upstream = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RadyoKutu/2.0 (VLC compatible)',
          Accept: '*/*',
        },
        redirect: 'follow',
      });

      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: `Yayın kaynağı yanıt vermedi (${upstream.status}).` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('stream/web').ReadableStream,
      );
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && !res.headersSent) {
        res.status(502).json({ error: 'Radyo yayınına bağlanılamadı.' });
      }
    }
  });

  // Live strictly Turkish Radio Browser search endpoint for SearchModal
  app.get('/api/stations/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    try {
      const params = new URLSearchParams({
        hidebroken: 'true',
        language: 'turkish',
        order: 'votes',
        reverse: 'true',
        limit: '30',
      });

      if (q) params.set('name', q);

      const rawStations = await fetchRadioBrowser(params.toString());
      const stations = rawStations
        .map(mapRawStation)
        .filter((s): s is RadioStation => s !== null)
        .map((s) => ({ ...s, isCustom: true }));

      res.json({ stations });
    } catch {
      res.status(502).json({ error: 'İstasyon araması sırasında bir hata oluştu.' });
    }
  });

  // 1. Diyanet Takvimine Göre Türkiye İlleri, İlçeleri ve Namaz Vakitleri
  app.get('/api/prayer/cities', async (_req, res) => {
    try {
      if (cachedDiyanetCities.length === 0) {
        const upstream = await fetch('https://ezanvakti.emushaf.net/sehirler/2', {
          signal: AbortSignal.timeout(6000),
        });
        if (upstream.ok) {
          const rows = (await upstream.json()) as Array<{ SehirAdi: string; SehirID: string }>;
          cachedDiyanetCities = rows.map((r) => ({ SehirAdi: r.SehirAdi, SehirID: r.SehirID }));
        }
      }
      res.json({ cities: cachedDiyanetCities });
    } catch {
      res.json({
        cities: [
          { SehirAdi: 'İSTANBUL', SehirID: '539' },
          { SehirAdi: 'ANKARA', SehirID: '506' },
          { SehirAdi: 'İZMİR', SehirID: '540' },
          { SehirAdi: 'BURSA', SehirID: '520' },
          { SehirAdi: 'KONYA', SehirID: '552' },
        ],
      });
    }
  });

  app.get('/api/prayer/districts', async (req, res) => {
    const cityId = typeof req.query.cityId === 'string' ? req.query.cityId.trim() : '539';
    if (!/^\d+$/.test(cityId)) {
      res.status(400).json({ error: 'Geçersiz il kodu.' });
      return;
    }
    try {
      let list = cachedDiyanetDistricts.get(cityId);
      if (!list) {
        const upstream = await fetch(`https://ezanvakti.emushaf.net/ilceler/${cityId}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (upstream.ok) {
          const rows = (await upstream.json()) as Array<{ IlceAdi: string; IlceID: string }>;
          list = rows.map((r) => ({ IlceAdi: r.IlceAdi, IlceID: r.IlceID }));
          cachedDiyanetDistricts.set(cityId, list);
        }
      }
      res.json({ districts: list ?? [] });
    } catch {
      res.json({ districts: [] });
    }
  });

  app.get('/api/prayer/times', async (req, res) => {
    const districtId = typeof req.query.districtId === 'string' ? req.query.districtId.trim() : '9541';
    const cityName = typeof req.query.cityName === 'string' ? req.query.cityName.trim() : 'İSTANBUL';
    const districtName =
      typeof req.query.districtName === 'string' ? req.query.districtName.trim() : 'İSTANBUL';

    const cacheKey = `${districtId}-${new Date().toISOString().slice(0, 10)}`;
    const cached = cachedPrayerTimes.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 1000 * 60 * 60 * 6) {
      res.json(cached.data);
      return;
    }

    try {
      if (/^\d+$/.test(districtId)) {
        const upstream = await fetch(`https://ezanvakti.emushaf.net/vakitler/${districtId}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (upstream.ok) {
          const rows = (await upstream.json()) as Array<{
            MiladiTarihUzun?: string;
            MiladiTarihKisaIso8601?: string;
            HicriTarihUzun?: string;
            Imsak: string;
            Gunes: string;
            Ogle: string;
            Ikindi: string;
            Aksam: string;
            Yatsi: string;
          }>;
          const todayTr = new Date().toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Europe/Istanbul',
          });
          const match = rows.find((r) => r.MiladiTarihKisaIso8601 === todayTr) ?? rows[0];
          if (match) {
            const payload: PrayerTimesData = {
              city: cityName,
              district: districtName,
              miladiDate: match.MiladiTarihUzun || todayTr,
              hicriDate: match.HicriTarihUzun || '',
              source: 'Diyanet İşleri Başkanlığı Takvimi',
              timings: {
                Imsak: match.Imsak,
                Gunes: match.Gunes,
                Ogle: match.Ogle,
                Ikindi: match.Ikindi,
                Aksam: match.Aksam,
                Yatsi: match.Yatsi,
              },
            };
            cachedPrayerTimes.set(cacheKey, { data: payload, fetchedAt: Date.now() });
            res.json(payload);
            return;
          }
        }
      }
    } catch {
      // Fallback to Aladhan method=13 (Diyanet Turkey)
    }

    try {
      const aladhan = await fetch(
        `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=Turkey&method=13`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (aladhan.ok) {
        const body = (await aladhan.json()) as {
          data?: {
            timings?: Record<string, string>;
            date?: { readable?: string; hijri?: { day?: string; month?: { en?: string }; year?: string } };
          };
        };
        const t = body.data?.timings;
        if (t) {
          const payload: PrayerTimesData = {
            city: cityName,
            district: districtName,
            miladiDate: body.data?.date?.readable || new Date().toLocaleDateString('tr-TR'),
            hicriDate: body.data?.date?.hijri
              ? `${body.data.date.hijri.day} ${body.data.date.hijri.month?.en} ${body.data.date.hijri.year}`
              : '',
            source: 'Diyanet Hesaplama Yöntemi',
            timings: {
              Imsak: t.Imsak || t.Fajr,
              Gunes: t.Sunrise,
              Ogle: t.Dhuhr,
              Ikindi: t.Asr,
              Aksam: t.Maghrib,
              Yatsi: t.Isha,
            },
          };
          cachedPrayerTimes.set(cacheKey, { data: payload, fetchedAt: Date.now() });
          res.json(payload);
          return;
        }
      }
    } catch {
      // ignore
    }

    res.status(502).json({ error: 'Namaz vakitleri şu anda alınamadı.' });
  });

  // 2. Günün Ayeti (Diyanet Meali) & Sahih Hadis-i Şerif Köşesi
  app.get('/api/daily-wisdom', async (req, res) => {
    const seedParam = Number(req.query.seed);
    const dayIndex = Number.isFinite(seedParam)
      ? Math.abs(Math.floor(seedParam))
      : Math.floor(Date.now() / (1000 * 60 * 60 * 24));

    const ayahKey = AYAH_KEYS[dayIndex % AYAH_KEYS.length];
    const hadithNum = HADITH_NUMBERS[dayIndex % HADITH_NUMBERS.length];

    try {
      const [ayahRes, hadithRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/ayah/${ayahKey}/tr.diyanet`, {
          signal: AbortSignal.timeout(5000),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(
          `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/tur-bukhari/${hadithNum}.json`,
          { signal: AbortSignal.timeout(5000) },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const ayahData = ayahRes?.data as
        | { text?: string; surah?: { number?: number; englishName?: string }; numberInSurah?: number }
        | undefined;
      const hadithItem = hadithRes?.hadiths?.[0] as
        | { text?: string; hadithnumber?: number }
        | undefined;

      const surahNum = Number(ayahKey.split(':')[0]);
      const surahTitle =
        SURAH_TR_NAMES[surahNum] ??
        (ayahData?.surah?.englishName ? `${ayahData.surah.englishName} Suresi` : ayahKey);

      const wisdom: DailyWisdomData = {
        ayah: ayahData?.text
          ? {
              turkish: ayahData.text,
              reference: `${surahTitle} · ${ayahData.numberInSurah ?? ayahKey.split(':')[1]}. Ayet`,
              source: 'Diyanet İşleri Meali',
            }
          : FALLBACK_WISDOM.ayah,
        hadith: hadithItem?.text
          ? {
              text: hadithItem.text.replace(/\s*Tekrar:.*$/s, '').trim(),
              reference: `Sahîh-i Buhârî, Hadis No: ${hadithItem.hadithnumber ?? hadithNum}`,
              source: 'Hadis-i Şerif',
            }
          : FALLBACK_WISDOM.hadith,
      };

      res.json(wisdom);
    } catch {
      res.json(FALLBACK_WISDOM);
    }
  });

  // 3. Sanatçı Adına Göre Kanal / YouTube İlahi & Türkü & Arabesk Arama
  app.get('/api/artist-search', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : 'Müslüm Gürses';
    const style = typeof req.query.style === 'string' ? req.query.style.trim() : 'all';
    const q = rawQ || 'Müslüm Gürses';

    if (isAdultContentText(q)) {
      res.json({
        query: q,
        youtubeResults: [],
        radioMatches: [],
      });
      return;
    }

    const styleSuffix =
      style === 'ilahi'
        ? ' ilahi'
        : style === 'turku'
          ? ' türkü'
          : style === 'arabesk'
            ? ' arabesk şarkıları'
            : style === 'ozgun'
              ? ' özgün müzik'
              : '';

    const ytQuery = `${q}${styleSuffix}`;

    const catalog = await loadCatalog();
    const qLower = q.toLowerCase();
    const radioMatches = catalog
      .filter(
        (s) =>
          !isAdultContentText(`${s.name} ${s.genre}`) &&
          (s.name.toLowerCase().includes(qLower) ||
            s.genre.toLowerCase().includes(qLower) ||
            (style !== 'all' && s.category === style && s.name.toLowerCase().includes(qLower.split(' ')[0]))),
      )
      .slice(0, 12);

    let youtubeResults: YouTubeArtistResult[] = [];
    try {
      const ytHtml = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}&sp=EgIQAQ%253D%253D`,
        {
          signal: AbortSignal.timeout(6500),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'tr-TR,tr;q=0.9',
          },
        },
      ).then((r) => (r.ok ? r.text() : ''));

      const match = ytHtml.match(/var ytInitialData = (\{.*?\});<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]) as {
          contents?: {
            twoColumnSearchResultsRenderer?: {
              primaryContents?: {
                sectionListRenderer?: {
                  contents?: Array<{
                    itemSectionRenderer?: {
                      contents?: Array<{
                        videoRenderer?: {
                          videoId?: string;
                          title?: { runs?: Array<{ text?: string }> };
                          ownerText?: { runs?: Array<{ text?: string }> };
                          lengthText?: { simpleText?: string };
                        };
                      }>;
                    };
                  }>;
                };
              };
            };
          };
        };

        const items =
          data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
            ?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

        youtubeResults = items
          .filter((item) => item.videoRenderer?.videoId)
          .map((item) => {
            const v = item.videoRenderer!;
            return {
              videoId: v.videoId!,
              title: v.title?.runs?.[0]?.text || ytQuery,
              channel: v.ownerText?.runs?.[0]?.text || 'YouTube',
              duration: v.lengthText?.simpleText || 'Canlı / Liste',
              thumbnailUrl: `https://i.ytimg.com/vi/${v.videoId!}/hqdefault.jpg`,
            };
          })
          .filter((item) => !isAdultContentText(`${item.title} ${item.channel}`))
          .slice(0, 16);
      }
    } catch {
      youtubeResults = [];
    }

    res.json({
      query: q,
      youtubeResults,
      radioMatches,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cengiz TV & Radyo server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

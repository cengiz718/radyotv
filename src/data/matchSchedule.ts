import type {
  MatchScheduleItem,
  MatchScheduleResponse,
  MatchSportType,
  TvChannel,
} from '../types.ts';
import { isAdultContentText } from './contentSafety.ts';

const ISTANBUL_TZ = 'Europe/Istanbul';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function getIstanbulDateStr(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: ISTANBUL_TZ });
}

function getIstanbulTimeStr(ms: number): string {
  return new Date(ms).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ISTANBUL_TZ,
  });
}

function formatDateLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const dayPart = d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      timeZone: ISTANBUL_TZ,
    });
    return `Bugün · ${dayPart}`;
  }
  if (dateStr === tomorrowStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const dayPart = d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      timeZone: ISTANBUL_TZ,
    });
    return `Yarın · ${dayPart}`;
  }
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: ISTANBUL_TZ,
  });
}

function detectSport(text: string): MatchSportType {
  const lower = text.toLocaleLowerCase('tr-TR');
  if (
    lower.includes('voleybol') ||
    lower.includes('cev ') ||
    lower.includes('sultanlar') ||
    lower.includes('efeler') ||
    lower.includes('set sayısı')
  ) {
    return 'voleybol';
  }
  if (
    lower.includes('basketbol') ||
    lower.includes('euroleague') ||
    lower.includes('nba') ||
    lower.includes('eurocup') ||
    lower.includes('bsl') ||
    lower.includes('kangoeroes')
  ) {
    return 'basketbol';
  }
  if (
    lower.includes('futbol') ||
    lower.includes('şampiyonlar ligi') ||
    lower.includes('avrupa ligi') ||
    lower.includes('konferans ligi') ||
    lower.includes('süper lig') ||
    lower.includes('1. lig') ||
    lower.includes('türkiye kupası') ||
    lower.includes('premier') ||
    lower.includes('la liga') ||
    lower.includes('bundesliga') ||
    lower.includes('serie a') ||
    lower.includes('ligue 1') ||
    /\s-\s/.test(text)
  ) {
    return 'futbol';
  }
  return 'diger';
}

function isActualMatchTitle(title: string): boolean {
  const clean = title.trim();
  if (!clean) return false;
  const lower = clean.toLocaleLowerCase('tr-TR');

  // Exclude studio/talk/magazine/re-run filler programs unless they clearly carry two opponents
  const nonMatchStudioWords = [
    'istiklal marşı',
    'haber bülteni',
    'spor bülteni',
    'spor manşet',
    'ilk baskı',
    'son sayfa',
    'sabah sporu',
    'spor ajansı',
    'gün ortası',
    'spor gündemi',
    'ana haber',
    'özetler',
    'özeti',
    'golleri',
    'raporu',
    'magazin',
    'belgeseli',
    'ikonları',
    'futbolun en büyük sahnesi',
    'bizim ligler',
    'contenders',
    'ortak yayın',
    'olimpiyat yıldızları',
    'gündem futbol',
    'set sayısı',
    'maç özel',
  ];

  const hasTeamsSeparator =
    /[a-zçğıöşü]{2,}[a-zçğıöşü0-9.\s'\/]*\s*[-–]\s*[a-zçğıöşü0-9.\s'\/]*[a-zçğıöşü]{2,}/i.test(clean) &&
    !lower.includes('özet') &&
    !lower.includes('golleri') &&
    !lower.includes('raporu') &&
    !lower.includes('belgesel') &&
    !lower.includes('ortak yayın') &&
    !lower.includes('sea to sky');

  if (hasTeamsSeparator) return true;
  if (nonMatchStudioWords.some((w) => lower.includes(w))) return false;

  return (
    lower.includes('karşılaşması') ||
    lower.includes('canlı maç') ||
    lower.includes('şampiyonlar ligi futbol') ||
    lower.includes('türkiye kupası')
  );
}

const TURKISH_I_WORDS = new Set([
  'YILDIZ',
  'YILDIZI',
  'KADINLAR',
  'ERKEKLER',
  'KUPASI',
  'TAKIMLARI',
  'KASIMPAŞA',
  'KIRKLARELİ',
  'DİYARBAKIR',
  'BATMAN',
  'ALTINORDU',
  'AYDINSPOR',
  'ŞANLIURFA',
  'KARŞIYAKA',
  'BAĞCILAR',
  'AKHİSAR',
  'KIZILCABÖLÜK',
  'IĞDIR',
  'ISPARTA',
  'ANTALYASPOR',
  'ALANYASPOR',
  'HATAYSPOR',
]);

function smartTitleCaseWord(word: string): string {
  if (!word) return word;
  const upper = word.toLocaleUpperCase('tr-TR');
  const useTrLower =
    TURKISH_I_WORDS.has(upper) || /[ÇĞÖŞÜİ]/.test(word) && !/[QXW]/.test(upper);
  const lower = useTrLower ? word.toLocaleLowerCase('tr-TR') : word.toLowerCase();
  return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
}

function cleanTrtMatchTitleAndLeague(rawTitle: string): { title: string; league: string } {
  let work = rawTitle.replace(/\s+/g, ' ').trim();
  let league = 'Spor Yayını';

  if (work.includes('|')) {
    const [left, right] = work.split('|').map((s) => s.trim());
    if (left && right) {
      work = left;
      league = right;
    }
  }

  const prefixes: Array<[RegExp, string]> = [
    [/^UEFA ŞAMPİYONLAR LİGİ FUTBOL KARŞILAŞMASI\s*/i, 'UEFA Şampiyonlar Ligi'],
    [/^UEFA AVRUPA LİGİ FUTBOL KARŞILAŞMASI\s*/i, 'UEFA Avrupa Ligi'],
    [/^UEFA KONFERANS LİGİ FUTBOL KARŞILAŞMASI\s*/i, 'UEFA Konferans Ligi'],
    [/^CEV KADINLAR ŞAMPİYONLAR LİGİ VOLEYBOL KARŞILAŞMASI\s*/i, 'CEV Kadınlar Şampiyonlar Ligi'],
    [/^CEV VOLEYBOL KADINLAR ŞAMPİYONLAR LİGİ\s*/i, 'CEV Kadınlar Şampiyonlar Ligi'],
    [/^KADINLAR EUROLEAGUE\s*/i, 'Kadınlar EuroLeague'],
    [/^EUROLEAGUE\s*/i, 'EuroLeague Basketbol'],
    [/^TRENDYOL SÜPER LİG\s*/i, 'Trendyol Süper Lig'],
    [/^TRENDYOL 1\.?\s*LİG\s*/i, 'Trendyol 1. Lig'],
    [/^ZİRAAT TÜRKİYE KUPASI\s*/i, 'Ziraat Türkiye Kupası'],
    [/^TÜRKİYE SİGORTA BASKETBOL SÜPER LİGİ\s*/i, 'Basketbol Süper Ligi'],
    [/^VODAFONE SULTANLAR LİGİ\s*/i, 'Sultanlar Ligi'],
  ];

  for (const [rx, label] of prefixes) {
    if (rx.test(work)) {
      work = work.replace(rx, '').trim();
      league = label;
      break;
    }
  }

  // Title-case ALL-CAPS team strings cleanly without turning Latin "I" into Turkish dotless "ı" on foreign clubs
  const letters = work.replace(/[^A-ZÇĞIİÖŞÜa-zçğıöşü]/g, '');
  if (letters.length > 4 && letters === letters.toLocaleUpperCase('tr-TR')) {
    work = work
      .replace(/\s*-\s*/g, ' - ')
      .replace(/[A-ZÇĞIİÖŞÜa-zçğıöşü]+/g, (w) => {
        if (w === 'PSG' || w === 'PSV' || w === 'FK' || w === 'SK' || w === 'FC') return w;
        return smartTitleCaseWord(w);
      });
  }

  return { title: work, league };
}

function normalizeMatchCompareKey(title: string): string {
  return title
    .toLocaleLowerCase('tr-TR')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/\b(fk|sk|fc|cf|bsc|t\.|a\.|m\.|medicana|peron|çağdaş|faktoring)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findPlayableChannelId(channelName: string, tvChannels: TvChannel[]): string | undefined {
  const lower = channelName.toLocaleLowerCase('tr-TR');
  const targets: Array<[string, string[]]> = [
    ['trt 1', ['trt 1']],
    ['trt spor yıldız', ['trt spor yıldız', 'trt spor yildiz']],
    ['trt spor', ['trt spor']],
    ['a spor', ['a spor', 'aspor']],
    ['ht spor', ['ht spor']],
    ['fb tv', ['fb tv']],
    ['tjk tv 2', ['tjk tv 2']],
    ['tjk tv', ['tjk tv']],
    ['atv', ['atv']],
    ['tv8', ['tv8']],
    ['now', ['now']],
  ];

  for (const [needle, aliases] of targets) {
    if (lower.includes(needle)) {
      const found = tvChannels.find((ch) => {
        const chName = ch.name.toLocaleLowerCase('tr-TR');
        return aliases.some((a) => chName === a || chName.startsWith(a));
      });
      if (found) return found.id;
    }
  }
  return undefined;
}

const TEAM_TR_DISPLAY: Record<string, string> = {
  Besiktas: 'Beşiktaş',
  Fenerbahce: 'Fenerbahçe',
  Galatasaray: 'Galatasaray',
  Trabzonspor: 'Trabzonspor',
  Basaksehir: 'Başakşehir FK',
  'Istanbul Basaksehir': 'Başakşehir FK',
  'Caykur Rizespor': 'Çaykur Rizespor',
  Kasimpasa: 'Kasımpaşa',
  Goztepe: 'Göztepe',
  Samsunspor: 'Samsunspor',
  Konyaspor: 'Konyaspor',
  Alanyaspor: 'Alanyaspor',
  Antalyaspor: 'Antalyaspor',
  Kayserispor: 'Kayserispor',
  Gaziantep: 'Gaziantep FK',
  Eyupspor: 'Eyüpspor',
  'Fatih Karagumruk': 'Fatih Karagümrük',
  Genclerbirligi: 'Gençlerbirliği',
  Kocaelispor: 'Kocaelispor',
};

function trTeamName(raw: string): string {
  return TEAM_TR_DISPLAY[raw] || raw;
}

export async function loadLiveMatchSchedule(tvChannels: TvChannel[]): Promise<MatchScheduleResponse> {
  const nowMs = Date.now();
  const todayStr = getIstanbulDateStr(nowMs);
  const tomorrowStr = getIstanbulDateStr(nowMs + 24 * 60 * 60 * 1000);
  const todayLabel = formatDateLabel(todayStr, todayStr, tomorrowStr);

  const collected: MatchScheduleItem[] = [];

  // 1. Official TRT EPG (TRT 1, TRT Spor, TRT Spor Yıldız, Tabii Spor)
  const trtTask = fetch('https://www.trt.net.tr/api/epg', {
    signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': 'CengizTVRadyo/2.4' },
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ epg?: Array<{ date: string; tvChannels?: Array<Record<string, unknown>> }> }>) : null))
    .catch(() => null);

  // 2. Official A Spor schedule
  const asporTask = fetch('https://www.aspor.com.tr/yayin-akisi', {
    signal: AbortSignal.timeout(5500),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CengizTVRadyo/2.4)' },
  })
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '');

  // 3. Official beIN Sports schedules (1..4 + Haber)
  const beinChannels: Array<{ slug: string; label: string }> = [
    { slug: 'beinsports', label: 'beIN Sports 1' },
    { slug: 'beinsports-2', label: 'beIN Sports 2' },
    { slug: 'beinsports-3', label: 'beIN Sports 3' },
    { slug: 'beinsports-4', label: 'beIN Sports 4' },
    { slug: 'bein-sports-haber', label: 'beIN Sports Haber' },
  ];
  const beinTasks = Promise.all(
    beinChannels.map(async ({ slug, label }) => {
      try {
        const html = await fetch(`https://beinsports.com.tr/yayin-akisi/${slug}`, {
          signal: AbortSignal.timeout(5500),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CengizTVRadyo/2.4)' },
        }).then((r) => (r.ok ? r.text() : ''));
        const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (!nextMatch) return [];
        const parsed = JSON.parse(nextMatch[1]) as {
          props?: {
            pageProps?: {
              data?: {
                event_date?: string;
                listTvGuides?: Array<{
                  id?: number;
                  event_time?: string;
                  name?: string;
                  is_week_match?: boolean;
                }>;
              };
            };
          };
        };
        const eventDate = parsed.props?.pageProps?.data?.event_date || todayStr;
        const rows = parsed.props?.pageProps?.data?.listTvGuides || [];
        return rows.map((row) => ({ label, eventDate, row }));
      } catch {
        return [];
      }
    }),
  );

  // 4. ESPN public live football & NBA scoreboards (real fixtures + live scores)
  const espnFeeds: Array<{ slug: string; league: string; defaultChannel: string; sport: MatchSportType }> = [
    { slug: 'soccer/tur.1', league: 'Trendyol Süper Lig', defaultChannel: 'beIN Sports 1', sport: 'futbol' },
    { slug: 'soccer/uefa.champions', league: 'UEFA Şampiyonlar Ligi', defaultChannel: 'TRT 1 / Tabii Spor', sport: 'futbol' },
    { slug: 'soccer/uefa.europa', league: 'UEFA Avrupa Ligi', defaultChannel: 'TRT 1 / TRT Spor / Tabii Spor', sport: 'futbol' },
    { slug: 'soccer/uefa.europa.conf', league: 'UEFA Konferans Ligi', defaultChannel: 'TRT Spor / Tabii Spor', sport: 'futbol' },
    { slug: 'soccer/eng.1', league: 'İngiltere Premier Lig', defaultChannel: 'beIN Sports 3', sport: 'futbol' },
    { slug: 'soccer/esp.1', league: 'İspanya La Liga', defaultChannel: 'S Sport / Tivibu Spor', sport: 'futbol' },
    { slug: 'soccer/ita.1', league: 'İtalya Serie A', defaultChannel: 'S Sport 2 / Tivibu Spor', sport: 'futbol' },
    { slug: 'soccer/ger.1', league: 'Almanya Bundesliga', defaultChannel: 'beIN Sports 4 / Tivibu Spor', sport: 'futbol' },
    { slug: 'soccer/fra.1', league: 'Fransa Ligue 1', defaultChannel: 'beIN Sports 4', sport: 'futbol' },
    { slug: 'basketball/nba', league: 'NBA Basketbol', defaultChannel: 'S Sport / S Sport+', sport: 'basketbol' },
  ];

  const espnTasks = Promise.all(
    espnFeeds.map(async (feed) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${feed.slug}/scoreboard`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as {
          events?: Array<{
            id?: string;
            date?: string;
            name?: string;
            status?: {
              type?: { state?: string; shortDetail?: string; description?: string };
              displayClock?: string;
            };
            competitions?: Array<{
              competitors?: Array<{
                homeAway?: 'home' | 'away';
                score?: string;
                team?: { shortDisplayName?: string; displayName?: string };
              }>;
            }>;
          }>;
        };
        return (json.events || []).map((ev) => ({ feed, ev }));
      } catch {
        return [];
      }
    }),
  );

  const [trtData, asporHtml, beinRowsNested, espnNested] = await Promise.all([
    trtTask,
    asporTask,
    beinTasks,
    espnTasks,
  ]);

  // Process TRT official EPG
  const trtTargetTitles = new Set(['TRT 1', 'TRT SPOR', 'TRT SPOR YILDIZ', 'TABİİ SPOR', 'TABII SPOR']);
  const trtDisplayChannel: Record<string, string> = {
    'TRT 1': 'TRT 1',
    'TRT SPOR': 'TRT Spor',
    'TRT SPOR YILDIZ': 'TRT Spor Yıldız',
    'TABİİ SPOR': 'Tabii Spor',
    'TABII SPOR': 'Tabii Spor',
  };

  for (const dayBlock of trtData?.epg || []) {
    for (const ch of dayBlock.tvChannels || []) {
      const chTitleUpper = String(ch.title || '').trim().toLocaleUpperCase('tr-TR');
      if (!trtTargetTitles.has(chTitleUpper)) continue;
      const channelName = trtDisplayChannel[chTitleUpper] || String(ch.title || '').trim();
      const playableChannelId = findPlayableChannelId(channelName, tvChannels);

      const items = [
        ...((ch.past as Array<Record<string, unknown>>) || []),
        ...(ch.current ? [ch.current as Record<string, unknown>] : []),
        ...((ch.upcoming as Array<Record<string, unknown>>) || []),
      ];

      for (const prog of items) {
        const rawTitle = typeof prog?.title === 'string' ? decodeHtmlEntities(prog.title) : '';
        const startIso = typeof prog?.starttime === 'string' ? prog.starttime : '';
        const endIso = typeof prog?.endtime === 'string' ? prog.endtime : '';
        if (!rawTitle || !startIso) continue;
        if (!isActualMatchTitle(rawTitle)) continue;

        const startMs = Date.parse(startIso);
        const endMs = endIso ? Date.parse(endIso) : startMs + 2 * 60 * 60 * 1000;
        if (!Number.isFinite(startMs)) continue;

        const dateStr = getIstanbulDateStr(startMs);
        if (dateStr < todayStr) continue;

        const { title, league } = cleanTrtMatchTitleAndLeague(rawTitle);
        if (isAdultContentText(`${title} ${league}`)) continue;

        const status: MatchScheduleItem['status'] =
          nowMs >= startMs && nowMs < endMs
            ? 'live'
            : nowMs >= endMs
              ? 'finished'
              : 'upcoming';

        collected.push({
          id: `trt-${channelName}-${startMs}-${normalizeMatchCompareKey(title).slice(0, 14)}`,
          title,
          league,
          sport: detectSport(`${rawTitle} ${league}`),
          channelName,
          playableChannelId,
          isFreeToAir: channelName !== 'Tabii Spor',
          dateStr,
          dateLabel: formatDateLabel(dateStr, todayStr, tomorrowStr),
          startTime: getIstanbulTimeStr(startMs),
          endTime: Number.isFinite(endMs) ? getIstanbulTimeStr(endMs) : undefined,
          startTimestamp: startMs,
          status,
          source: 'TRT Resmi Yayın Akışı',
        });
      }
    }
  }

  // Process A Spor HTML items
  if (asporHtml) {
    const asporMatches = [
      ...asporHtml.matchAll(
        /<li[^>]*data-time-start="([^"]+)"[^>]*data-time-end="([^"]+)"[^>]*class="tmd-broadcastList__programItem"[\s\S]*?aria-label="([^"]+)"/g,
      ),
    ];
    const playableId = findPlayableChannelId('A Spor', tvChannels);
    for (const m of asporMatches) {
      const startLocal = m[1];
      const endLocal = m[2];
      const rawTitle = decodeHtmlEntities(m[3]);
      if (!isActualMatchTitle(rawTitle)) continue;
      if (isAdultContentText(rawTitle)) continue;

      const startMs = Date.parse(`${startLocal}+03:00`);
      const endMs = Date.parse(`${endLocal}+03:00`);
      if (!Number.isFinite(startMs)) continue;
      const dateStr = startLocal.slice(0, 10);
      if (dateStr < todayStr) continue;

      const { title, league } = cleanTrtMatchTitleAndLeague(rawTitle);
      const status: MatchScheduleItem['status'] =
        nowMs >= startMs && nowMs < endMs ? 'live' : nowMs >= endMs ? 'finished' : 'upcoming';

      collected.push({
        id: `aspor-${startMs}-${normalizeMatchCompareKey(title).slice(0, 12)}`,
        title,
        league: league === 'Spor Yayını' ? 'A Spor Canlı Yayın' : league,
        sport: detectSport(rawTitle),
        channelName: 'A Spor',
        playableChannelId: playableId,
        isFreeToAir: true,
        dateStr,
        dateLabel: formatDateLabel(dateStr, todayStr, tomorrowStr),
        startTime: startLocal.slice(11, 16),
        endTime: endLocal.slice(11, 16),
        startTimestamp: startMs,
        status,
        source: 'A Spor Yayın Akışı',
      });
    }
  }

  // Process beIN Sports schedules
  for (const entries of beinRowsNested) {
    for (const { label, eventDate, row } of entries) {
      const name = typeof row.name === 'string' ? decodeHtmlEntities(row.name) : '';
      const timeStr = typeof row.event_time === 'string' ? row.event_time.slice(0, 5) : '';
      if (!name || !timeStr) continue;
      if (!row.is_week_match && !isActualMatchTitle(name)) continue;
      if (isAdultContentText(name)) continue;

      const startMs = Date.parse(`${eventDate}T${timeStr}:00+03:00`);
      if (!Number.isFinite(startMs)) continue;
      const endMs = startMs + 115 * 60 * 1000;
      const status: MatchScheduleItem['status'] =
        nowMs >= startMs && nowMs < endMs ? 'live' : nowMs >= endMs ? 'finished' : 'upcoming';

      const league =
        label === 'beIN Sports 3'
          ? 'İngiltere Premier Lig / Futbol'
          : label === 'beIN Sports 4'
            ? 'Fransa Ligue 1 / Avrupa Futbol'
            : /beşiktaş|fenerbahçe|galatasaray|trabzon|başakşehir|konyaspor/i.test(name)
              ? 'Trendyol Süper Lig'
              : 'beIN Sports Futbol';

      collected.push({
        id: `bein-${label}-${startMs}-${normalizeMatchCompareKey(name).slice(0, 12)}`,
        title: name,
        league,
        sport: detectSport(`${name} ${league}`),
        channelName: label,
        isFreeToAir: false,
        dateStr: eventDate,
        dateLabel: formatDateLabel(eventDate, todayStr, tomorrowStr),
        startTime: timeStr,
        startTimestamp: startMs,
        status,
        source: 'beIN Sports Yayın Akışı',
      });
    }
  }

  // Process ESPN live & upcoming fixtures (and enrich matching channel broadcasts with scores)
  const scoreByMatchKey = new Map<string, { scoreText: string; status: MatchScheduleItem['status'] }>();
  const espnStandalone: MatchScheduleItem[] = [];

  for (const entries of espnNested) {
    for (const { feed, ev } of entries) {
      if (!ev.date) continue;
      const startMs = Date.parse(ev.date);
      if (!Number.isFinite(startMs)) continue;

      const dateStr = getIstanbulDateStr(startMs);
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c) => c.homeAway === 'away');
      const homeName = trTeamName(home?.team?.shortDisplayName || home?.team?.displayName || '');
      const awayName = trTeamName(away?.team?.shortDisplayName || away?.team?.displayName || '');
      const title =
        homeName && awayName
          ? `${homeName} - ${awayName}`
          : decodeHtmlEntities(ev.name || '');

      if (!title || isAdultContentText(`${title} ${feed.league}`)) continue;

      const state = ev.status?.type?.state;
      const status: MatchScheduleItem['status'] =
        state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming';
      const scoreText =
        home && away && (state === 'in' || state === 'post')
          ? `${home.score ?? '0'} - ${away.score ?? '0'}${
              state === 'in' && ev.status?.displayClock ? ` (${ev.status.displayClock})` : ''
            }`
          : undefined;

      const key = normalizeMatchCompareKey(title);
      if (scoreText) {
        scoreByMatchKey.set(key, { scoreText, status });
      }

      // Include today & next 2 days of key fixtures so users also see upcoming Süper Lig / Europe matches
      const maxHorizonMs = nowMs + 72 * 60 * 60 * 1000;
      if (dateStr < todayStr || startMs > maxHorizonMs) continue;

      const playableChannelId = findPlayableChannelId(feed.defaultChannel, tvChannels);

      espnStandalone.push({
        id: `espn-${feed.slug}-${ev.id || startMs}`,
        title,
        league: feed.league,
        sport: feed.sport,
        channelName: feed.defaultChannel,
        playableChannelId,
        isFreeToAir: Boolean(playableChannelId) && !feed.defaultChannel.includes('beIN'),
        dateStr,
        dateLabel: formatDateLabel(dateStr, todayStr, tomorrowStr),
        startTime: getIstanbulTimeStr(startMs),
        startTimestamp: startMs,
        status,
        scoreText,
        source: 'Resmi Lig Fikstürü & Canlı Skor',
      });
    }
  }

  // Enrich TV guide entries with ESPN live score & status when matched
  const existingKeys = new Set<string>();
  for (const item of collected) {
    const key = normalizeMatchCompareKey(item.title);
    existingKeys.add(`${item.dateStr}-${key}`);
    const matchScore = scoreByMatchKey.get(key);
    if (matchScore) {
      item.scoreText = matchScore.scoreText;
      item.status = matchScore.status;
    }
  }

  // Merge non-duplicate ESPN fixtures (prioritizing exact TV guide entries first)
  for (const item of espnStandalone) {
    const key = `${item.dateStr}-${normalizeMatchCompareKey(item.title)}`;
    if (!existingKeys.has(key)) {
      collected.push(item);
      existingKeys.add(key);
    }
  }

  // Deduplicate exact same match + channel + startTimestamp
  const dedupedMap = new Map<string, MatchScheduleItem>();
  for (const m of collected) {
    const dedupeKey = `${m.channelName}-${m.startTimestamp}-${normalizeMatchCompareKey(m.title)}`;
    if (!dedupedMap.has(dedupeKey)) {
      dedupedMap.set(dedupeKey, m);
    }
  }

  const statusOrder: Record<MatchScheduleItem['status'], number> = {
    live: 0,
    upcoming: 1,
    finished: 2,
  };

  const sorted = [...dedupedMap.values()].sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.startTimestamp - b.startTimestamp;
  });

  const channelHighlights = Array.from(new Set(sorted.map((m) => m.channelName))).slice(0, 12);

  return {
    updatedAt: new Date().toISOString(),
    todayDate: todayStr,
    todayLabel,
    matches: sorted,
    channelHighlights,
    turkishOnly: true,
    adultBlocked: true,
  };
}

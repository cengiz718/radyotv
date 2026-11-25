import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  SkipBack,
  SkipForward,
  Sliders,
  Star,
  Trash2,
  Trophy,
  Tv,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AmbientBackdrop } from './components/AmbientBackdrop.tsx';
import { ArtistFinderView } from './components/ArtistFinderView.tsx';
import { AudioWaveVisualizer } from './components/AudioWaveVisualizer.tsx';
import {
  CengizBrandEmblem,
  ChannelLogo,
  ProgramTypeIcon,
} from './components/ChannelIcons.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { SearchModal } from './components/SearchModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import {
  SpiritualCornerView,
  SpiritualSummaryStrip,
} from './components/SpiritualCornerView.tsx';
import { TvPlayerView } from './components/TvPlayerView.tsx';
import { VoiceSearchButton } from './components/VoiceSearchButton.tsx';
import {
  RADIO_CATEGORY_THEMES,
  SURFACE_TONE_STYLES,
  TV_CATEGORY_THEMES,
  resolveCustomTheme,
} from './data/categoryThemes.ts';
import { DEFAULT_STATIONS, LANDSCAPE_SCENES } from './data/stations.ts';
import { getRadioCurrentProgram } from './data/turkishEpg.ts';
import { useAutoUpdater } from './hooks/useAutoUpdater.ts';
import { useRadioPlayer } from './hooks/useRadioPlayer.ts';
import { playGentlePrayerChime } from './utils/prayerAlarmSound.ts';
import type {
  AppSettings,
  AppView,
  BackgroundMode,
  DiyanetDistrict,
  FilterTab,
  LandscapeItem,
  LandscapesResponse,
  PrayerTimesData,
  RadioStation,
  StationsResponse,
  TvChannel,
} from './types.ts';

const FAVORITES_KEY = 'radyokutu_favorite_stations_v3';
const RECENT_KEY = 'radyokutu_recent_stations_v2';
const RECENT_TV_KEY = 'cengiztv_recent_tv_v1';
const CUSTOM_STATIONS_KEY = 'radyokutu_custom_stations_v2';
const LAST_STATION_KEY = 'radyokutu_last_station_v2';
const BG_MODE_KEY = 'radyokutu_bg_mode';
const SETTINGS_KEY = 'radyokutu_app_settings_v1';
const FIRED_PRAYERS_KEY = 'cengiztv_fired_prayer_alarms_v1';
const PAGE_LIMIT = 24;

const DEFAULT_SETTINGS: AppSettings = {
  cityId: '501',
  cityName: 'ADIYAMAN',
  districtId: '',
  districtName: 'ADIYAMAN',
  showSpiritualStrip: true,
  enableDailyWisdomPopup: true,
  enableVisualizer: true,
  enableFireplaceEmbers: true,
  enablePrayerAlarm: true,
  enablePrayerAlarmSound: true,
  lowBandwidthMode: false,
  themeMode: 'auto',
  surfaceTone: 'default',
};

const PRAYER_ALARM_KEYS: Array<{ key: keyof PrayerTimesData['timings']; label: string }> = [
  { key: 'Imsak', label: 'İmsak' },
  { key: 'Gunes', label: 'Güneş' },
  { key: 'Ogle', label: 'Öğle' },
  { key: 'Ikindi', label: 'İkindi' },
  { key: 'Aksam', label: 'Akşam' },
  { key: 'Yatsi', label: 'Yatsı' },
];

// İlahi kategorisi en başta, sadece Türkçe kategoriler
const CATEGORY_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'ilahi', label: 'İlahi' },
  { id: 'all', label: 'Tümü' },
  { id: 'arabesk', label: 'Arabesk' },
  { id: 'ozgun', label: 'Özgün' },
  { id: 'turku', label: 'Türkü' },
  { id: 'pop', label: 'Pop' },
  { id: 'slow', label: 'Slow' },
  { id: 'haber', label: 'Haber' },
  { id: 'favorites', label: 'Favoriler' },
  { id: 'recent', label: 'Son Dinlenen' },
];

const INITIAL_LANDSCAPES: LandscapeItem[] = LANDSCAPE_SCENES.map((s) => ({
  id: s.id,
  title: s.title,
  imageUrl: s.imageUrl,
  source: 'local',
}));

function isTurkishStationSafe(s: RadioStation): boolean {
  return (s.language as string) === 'turkish';
}

function formatSleepCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const [appView, setAppView] = useState<AppView>('radio');

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        // Eski varsayılan İstanbul kaydını ilk açılışta Adıyaman'a taşı.
        if (parsed.cityId === '539' && parsed.cityName === 'İSTANBUL') {
          return { ...DEFAULT_SETTINGS, ...parsed, cityId: '501', cityName: 'ADIYAMAN', districtId: '', districtName: 'ADIYAMAN' };
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // İlk kurulumda Adıyaman merkez ilçesinin Diyanet kimliğini API'den bul.
  useEffect(() => {
    if (settings.cityId !== '501' || settings.districtId) return;
    let cancelled = false;
    fetch('/api/prayer/districts?cityId=501')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { districts?: DiyanetDistrict[] } | null) => {
        if (cancelled || !Array.isArray(data?.districts) || data.districts.length === 0) return;
        const center = data.districts.find((d) => /ADIYAMAN/i.test(d.IlceAdi)) ?? data.districts[0];
        setSettings((prev) => prev.cityId === '501' && !prev.districtId
          ? { ...prev, districtId: center.IlceID, districtName: center.IlceAdi }
          : prev);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [settings.cityId, settings.districtId]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const [customStations, setCustomStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_STATIONS_KEY);
      if (!saved) return [];
      return (JSON.parse(saved) as RadioStation[]).filter(isTurkishStationSafe);
    } catch {
      return [];
    }
  });

  const [favoriteStations, setFavoriteStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) return (JSON.parse(saved) as RadioStation[]).filter(isTurkishStationSafe);
      return DEFAULT_STATIONS.filter((s) =>
        ['diyanet-radyo', 'akra-fm', 'trt-fm', 'trt-turku', 'kral-fm'].includes(s.id),
      );
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<FilterTab>('ilahi');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [serverData, setServerData] = useState<StationsResponse>({
    stations: DEFAULT_STATIONS.filter((s) => s.category === 'ilahi'),
    total: DEFAULT_STATIONS.filter((s) => s.category === 'ilahi').length,
    catalogTotal: DEFAULT_STATIONS.length,
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
    categoryCounts: {},
  });
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [bgMode, setBgMode] = useState<BackgroundMode>(() => {
    const saved = localStorage.getItem(BG_MODE_KEY);
    if (saved === 'fireplace' || saved === 'dark' || saved === 'landscapes') return saved;
    return 'landscapes';
  });
  const [landscapes, setLandscapes] = useState<LandscapeItem[]>(INITIAL_LANDSCAPES);
  const [landscapeTotal, setLandscapeTotal] = useState<number>(INITIAL_LANDSCAPES.length);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [autoScenicOnPlay, setAutoScenicOnPlay] = useState<boolean>(() => {
    return localStorage.getItem('radyokutu_auto_scenic') === 'true';
  });
  const [recentStations, setRecentStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (!saved) return [];
      return (JSON.parse(saved) as RadioStation[]).filter(isTurkishStationSafe);
    } catch {
      return [];
    }
  });
  const [recentTvChannels, setRecentTvChannels] = useState<TvChannel[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_TV_KEY);
      if (!saved) return [];
      return JSON.parse(saved) as TvChannel[];
    } catch {
      return [];
    }
  });
  const [pendingTvChannelId, setPendingTvChannelId] = useState<string | null>(null);
  const [requestedTvSourceMode, setRequestedTvSourceMode] = useState<
    'turksat' | 'epg' | 'matches' | null
  >(null);
  const [radioVoiceStatus, setRadioVoiceStatus] = useState<string | null>(null);
  const [numericBuffer, setNumericBuffer] = useState('');
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  );
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesData | null>(null);
  const [dailyWisdomPopup, setDailyWisdomPopup] = useState<import('./types.ts').DailyWisdomData | null>(null);
  const [prayerAlert, setPrayerAlert] = useState<{
    label: string;
    time: string;
    district: string;
    isTest?: boolean;
  } | null>(null);

  const handleCatalogUpdated = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const {
    needRefresh,
    checking: checkingUpdate,
    systemStatus,
    updateBanner,
    applyAppUpdate,
    checkAndUpdateNow,
  } = useAutoUpdater({ onCatalogUpdated: handleCatalogUpdated });

  // Uygulama her açıldığında günün ayet ve hadisini getir; metin uzunluğuna göre popup süresi belirle.
  useEffect(() => {
    if (!settings.enableDailyWisdomPopup) return;
    let cancelled = false;
    fetch('/api/daily-wisdom')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: import('./types.ts').DailyWisdomData | null) => {
        if (!cancelled && data?.ayah?.turkish && data?.hadith?.text) setDailyWisdomPopup(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dailyWisdomPopup) return;
    const chars = dailyWisdomPopup.ayah.turkish.length + dailyWisdomPopup.hadith.text.length;
    const durationMs = Math.min(26000, Math.max(9000, 6500 + chars * 42));
    const timer = window.setTimeout(() => setDailyWisdomPopup(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [dailyWisdomPopup]);

  const baseTheme =
    appView === 'tv'
      ? TV_CATEGORY_THEMES.all
      : appView === 'artist'
        ? RADIO_CATEGORY_THEMES.arabesk
        : appView === 'spiritual'
          ? RADIO_CATEGORY_THEMES.ilahi
          : RADIO_CATEGORY_THEMES[activeTab];

  const activeTheme = resolveCustomTheme(settings.themeMode, baseTheme);
  const activeSurface = SURFACE_TONE_STYLES[settings.surfaceTone] ?? SURFACE_TONE_STYLES.default;

  // Trigger CSS palette cross-fade whenever category/view/theme changes
  const [paletteTransition, setPaletteTransition] = useState<{
    currTint: string;
    prevTint: string | null;
    nonce: number;
  }>(() => ({
    currTint: activeTheme.tintBg,
    prevTint: null,
    nonce: 0,
  }));

  useEffect(() => {
    setPaletteTransition((prev) => {
      if (prev.currTint === activeTheme.tintBg) return prev;
      return {
        currTint: activeTheme.tintBg,
        prevTint: prev.currTint,
        nonce: prev.nonce + 1,
      };
    });
  }, [activeTheme.tintBg]);

  useEffect(() => {
    if (!paletteTransition.prevTint) return;
    const timer = window.setTimeout(() => {
      setPaletteTransition((prev) => ({ ...prev, prevTint: null }));
    }, 680);
    return () => window.clearTimeout(timer);
  }, [paletteTransition.nonce, paletteTransition.prevTint]);

  const triggerPrayerAlert = useCallback(
    (label: string, time: string, isTest = false) => {
      setPrayerAlert({
        label,
        time,
        district: prayerTimes?.district || settings.districtName,
        isTest,
      });
      if (settings.enablePrayerAlarmSound) {
        playGentlePrayerChime();
      }
    },
    [prayerTimes?.district, settings.districtName, settings.enablePrayerAlarmSound],
  );

  // Fetch Diyanet prayer times for alarm monitoring
  useEffect(() => {
    const params = new URLSearchParams({
      districtId: settings.districtId,
      cityName: settings.cityName,
      districtName: settings.districtName,
    });
    fetch(`/api/prayer/times?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PrayerTimesData | null) => {
        if (data?.timings) setPrayerTimes(data);
      })
      .catch(() => {});
  }, [settings.cityName, settings.districtId, settings.districtName]);

  // Monitor Türkiye local prayer times and trigger the alarm once per prayer per day
  useEffect(() => {
    if (!settings.enablePrayerAlarm || !prayerTimes?.timings) return;

    const checkPrayerTime = () => {
      const now = new Date();
      const nowHHMM = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      const todayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      for (const item of PRAYER_ALARM_KEYS) {
        if (prayerTimes.timings[item.key] !== nowHHMM) continue;
        const firedId = `${todayKey}-${item.key}`;
        let firedList: string[] = [];
        try {
          firedList = JSON.parse(localStorage.getItem(FIRED_PRAYERS_KEY) || '[]') as string[];
        } catch {
          firedList = [];
        }
        if (firedList.includes(firedId)) continue;

        const nextList = [...firedList.slice(-24), firedId];
        localStorage.setItem(FIRED_PRAYERS_KEY, JSON.stringify(nextList));
        triggerPrayerAlert(item.label, nowHHMM, false);
        break;
      }
    };

    checkPrayerTime();
    const timer = window.setInterval(checkPrayerTime, 15000);
    return () => window.clearInterval(timer);
  }, [prayerTimes, settings.enablePrayerAlarm, triggerPrayerAlert]);

  useEffect(() => {
    if (!prayerAlert) return;
    const timer = window.setTimeout(() => setPrayerAlert(null), 45000);
    return () => window.clearTimeout(timer);
  }, [prayerAlert]);

  // Debounce inline search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Persist user preferences
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteStations));
  }, [favoriteStations]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_STATIONS_KEY, JSON.stringify(customStations));
  }, [customStations]);

  useEffect(() => {
    localStorage.setItem(BG_MODE_KEY, bgMode);
  }, [bgMode]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentStations));
  }, [recentStations]);

  useEffect(() => {
    localStorage.setItem(RECENT_TV_KEY, JSON.stringify(recentTvChannels));
  }, [recentTvChannels]);

  const recordRecentTvChannel = useCallback((channel: TvChannel) => {
    setRecentTvChannels((prev) => {
      const filtered = prev.filter((c) => c.id !== channel.id);
      return [channel, ...filtered].slice(0, 16);
    });
  }, []);

  // Live TV clock updated every 30s
  useEffect(() => {
    const updateClock = () => {
      setClockText(
        new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      );
    };
    const timer = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Fetch Full HD landscapes in compact batches (30 items)
  const loadLandscapePage = useCallback((pageNum: number) => {
    fetch(`/api/landscapes?page=${pageNum}&limit=30`)
      .then((r) => r.json())
      .then((data: LandscapesResponse) => {
        if (Array.isArray(data.items) && data.items.length > 0) {
          setLandscapeTotal(data.total);
          setLandscapes((prev) => {
            const seen = new Set(prev.map((p) => p.imageUrl));
            const next = [...prev];
            for (const item of data.items) {
              if (!seen.has(item.imageUrl)) {
                seen.add(item.imageUrl);
                next.push(item);
              }
            }
            return next.slice(-180);
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLandscapePage(1);
  }, [loadLandscapePage]);

  const nextLandscape = useCallback(() => {
    setSceneIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= landscapes.length - 4) {
        const nextBatchPage = Math.floor(landscapes.length / 30) + 1;
        loadLandscapePage(nextBatchPage);
      }
      return nextIdx % Math.max(1, landscapes.length);
    });
  }, [landscapes.length, loadLandscapePage]);

  const pickRandomLandscape = useCallback(() => {
    fetch('/api/landscapes/random')
      .then((r) => r.json())
      .then((data: { item?: LandscapeItem; total?: number }) => {
        if (data.item) {
          if (data.total) setLandscapeTotal(data.total);
          setLandscapes((prev) => {
            const existingIdx = prev.findIndex((p) => p.imageUrl === data.item!.imageUrl);
            if (existingIdx !== -1) {
              setSceneIndex(existingIdx);
              return prev;
            }
            const next = [...prev.slice(-179), data.item!];
            setSceneIndex(next.length - 1);
            return next;
          });
        } else {
          nextLandscape();
        }
      })
      .catch(() => nextLandscape());
  }, [nextLandscape]);

  useEffect(() => {
    if (bgMode !== 'landscapes' || appView === 'tv') return;
    const interval = window.setInterval(() => {
      if (!document.hidden) nextLandscape();
    }, 25000);
    return () => window.clearInterval(interval);
  }, [appView, bgMode, nextLandscape]);

  // Fetch paginated Turkish channel catalog (24 per page)
  useEffect(() => {
    if (activeTab === 'favorites' || activeTab === 'recent') return;

    let cancelled = false;
    setCatalogLoading(true);

    const params = new URLSearchParams({
      category: activeTab,
      q: debouncedQuery,
      page: String(page),
      limit: String(PAGE_LIMIT),
    });

    fetch(`/api/stations?${params.toString()}`)
      .then((res) => res.json())
      .then((data: StationsResponse) => {
        if (!cancelled && Array.isArray(data.stations)) {
          setServerData(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedQuery, page, reloadNonce]);

  useEffect(() => {
    if (serverData.catalogTotal >= 500) return;
    const timer = window.setTimeout(() => {
      setReloadNonce((n) => n + 1);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [serverData.catalogTotal]);

  const favoriteIds = useMemo(
    () => new Set(favoriteStations.map((s) => s.id)),
    [favoriteStations],
  );

  const displayedStations = useMemo(() => {
    if (activeTab === 'favorites' || activeTab === 'recent') {
      const source = activeTab === 'favorites' ? favoriteStations : recentStations;
      const q = debouncedQuery.toLowerCase();
      return q
        ? source.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.genre.toLowerCase().includes(q) ||
              s.city.toLowerCase().includes(q),
          )
        : source;
    }

    if (
      page === 1 &&
      customStations.length > 0 &&
      !debouncedQuery &&
      (activeTab === 'all' || activeTab === 'ilahi')
    ) {
      const existing = new Set(serverData.stations.map((s) => s.streamUrl));
      const uniqueCustom = customStations.filter(
        (c) => !existing.has(c.streamUrl) && (activeTab === 'all' || c.category === 'ilahi'),
      );
      return [...uniqueCustom, ...serverData.stations];
    }

    return serverData.stations;
  }, [
    activeTab,
    customStations,
    debouncedQuery,
    favoriteStations,
    page,
    recentStations,
    serverData.stations,
  ]);

  const initialStation = useMemo(() => {
    try {
      const saved = localStorage.getItem(LAST_STATION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as RadioStation;
        if (isTurkishStationSafe(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_STATIONS[0];
  }, []);

  const {
    currentStation,
    status,
    errorMessage,
    volume,
    muted,
    sleepMinutes,
    sleepSecondsLeft,
    analyserRef,
    setVolume,
    setMuted,
    playStation: basePlayStation,
    togglePlayPause,
    stepStation,
    cycleSleepTimer,
  } = useRadioPlayer({
    stations: displayedStations.length > 0 ? displayedStations : DEFAULT_STATIONS,
    initialStationId: initialStation.id,
    lowBandwidthMode: settings.lowBandwidthMode,
  });

  const playStation = useCallback(
    (station: RadioStation) => {
      try {
        localStorage.setItem(LAST_STATION_KEY, JSON.stringify(station));
      } catch {
        // ignore
      }
      setRecentStations((prev) => {
        const filtered = prev.filter((s) => s.id !== station.id);
        return [station, ...filtered].slice(0, 24);
      });
      basePlayStation(station);
      if (autoScenicOnPlay) {
        setImmersiveMode(true);
      }
    },
    [autoScenicOnPlay, basePlayStation],
  );

  useEffect(() => {
    localStorage.setItem('radyokutu_auto_scenic', String(autoScenicOnPlay));
  }, [autoScenicOnPlay]);

  const pauseRadioIfActive = useCallback(() => {
    if (status === 'playing' || status === 'loading') {
      togglePlayPause();
    }
  }, [status, togglePlayPause]);

  const existingUrls = useMemo(
    () =>
      new Set([
        ...displayedStations.map((s) => s.streamUrl),
        ...customStations.map((s) => s.streamUrl),
      ]),
    [customStations, displayedStations],
  );

  const toggleFavorite = useCallback((station: RadioStation) => {
    setFavoriteStations((prev) =>
      prev.some((s) => s.id === station.id)
        ? prev.filter((s) => s.id !== station.id)
        : [station, ...prev],
    );
  }, []);

  const handleAddStation = useCallback(
    (station: RadioStation, playImmediately: boolean) => {
      setCustomStations((prev) => {
        if (prev.some((s) => s.streamUrl === station.streamUrl)) return prev;
        return [station, ...prev];
      });
      if (playImmediately) {
        setAppView('radio');
        playStation(station);
      }
    },
    [playStation],
  );

  const handleRemoveCustom = useCallback((stationId: string) => {
    setCustomStations((prev) => prev.filter((s) => s.id !== stationId));
    setFavoriteStations((prev) => prev.filter((s) => s.id !== stationId));
  }, []);

  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Mi Box TV D-Pad & keyboard remote navigation
  useEffect(() => {
    if (searchModalOpen || settingsOpen) return;

    const getColumnCount = () => {
      const first = cardRefs.current[0];
      if (!first) return 1;
      const firstTop = first.getBoundingClientRect().top;
      let cols = 0;
      for (const el of cardRefs.current) {
        if (!el) continue;
        if (Math.abs(el.getBoundingClientRect().top - firstTop) < 12) cols++;
        else break;
      }
      return Math.max(1, cols);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && immersiveMode) {
        e.preventDefault();
        setImmersiveMode(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.getAttribute('role') === 'slider';

      if (isInput) return;
      if (appView !== 'radio') return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setNumericBuffer((prev) => (prev + e.key).slice(-3));
        return;
      }

      const list = displayedStations.length > 0 ? displayedStations : DEFAULT_STATIONS;

      if (e.key === ' ' || e.key === 'MediaPlayPause') {
        if (target?.tagName !== 'BUTTON') {
          e.preventDefault();
          togglePlayPause();
          return;
        }
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMuted((m) => !m);
        return;
      }
      if (e.key === 'n' || e.key === 'N' || e.key === 'ChannelUp' || e.key === 'MediaTrackNext') {
        e.preventDefault();
        stepStation(1, list);
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'ChannelDown' || e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        stepStation(-1, list);
        return;
      }

      if (immersiveMode) return;

      const activeIdx = cardRefs.current.findIndex((el) => el === document.activeElement);
      // Mi Box'ta ilk yön tuşu da listeye odaklansın; kullanıcı önce fare/ekran dokunuşu yapmak zorunda kalmasın.
      if (activeIdx === -1 && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
        const firstCard = cardRefs.current.find((el) => el && !el.disabled);
        if (firstCard) { e.preventDefault(); firstCard.focus(); firstCard.scrollIntoView({ block: 'nearest' }); return; }
      }
      if (activeIdx !== -1) {
        const cols = getColumnCount();
        let nextIdx = activeIdx;
        if (e.key === 'ArrowRight') nextIdx = Math.min(displayedStations.length - 1, activeIdx + 1);
        else if (e.key === 'ArrowLeft') nextIdx = Math.max(0, activeIdx - 1);
        else if (e.key === 'ArrowDown')
          nextIdx = Math.min(displayedStations.length - 1, activeIdx + cols);
        else if (e.key === 'ArrowUp') nextIdx = Math.max(0, activeIdx - cols);
        else return;

        if (nextIdx !== activeIdx) {
          e.preventDefault();
          cardRefs.current[nextIdx]?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    appView,
    displayedStations,
    immersiveMode,
    searchModalOpen,
    settingsOpen,
    setMuted,
    stepStation,
    togglePlayPause,
  ]);

  useEffect(() => {
    if (!numericBuffer) return;
    const timer = window.setTimeout(() => {
      const targetNum = Number(numericBuffer);
      if (targetNum >= 1 && targetNum <= displayedStations.length) {
        playStation(displayedStations[targetNum - 1]);
      }
      setNumericBuffer('');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [displayedStations, numericBuffer, playStation]);

  const activeList = displayedStations.length > 0 ? displayedStations : DEFAULT_STATIONS;
  const activeLandscape = landscapes[sceneIndex % landscapes.length] ?? INITIAL_LANDSCAPES[0];

  const statusText =
    status === 'playing'
      ? 'Canlı Yayında'
      : status === 'loading'
        ? 'Bağlanıyor...'
        : status === 'error'
          ? 'Bağlantı Hatası'
          : 'Hazır';

  const getCategoryCount = (tabId: FilterTab): number | null => {
    if (tabId === 'favorites') return favoriteStations.length;
    if (tabId === 'recent') return recentStations.length;
    const count = serverData.categoryCounts[tabId];
    return typeof count === 'number' ? count : null;
  };

  return (
    <div
      className="aero-ui min-h-screen relative isolate text-[#F4F5F7] flex flex-col palette-smooth"
      style={
        {
          backgroundColor: activeSurface.pageBg,
          '--theme-accent': activeTheme.accentHex,
          '--theme-accent-light': activeTheme.accentLightHex,
          '--theme-glow': activeTheme.glowRgba,
        } as React.CSSProperties
      }
    >
      {/* Full HD Landscapes or Cozy Fireplace Backdrop */}
      <AmbientBackdrop
        mode={bgMode}
        immersive={immersiveMode}
        activeLandscape={activeLandscape}
        paused={appView === 'tv' || appView === 'artist'}
        enableEmbers={settings.enableFireplaceEmbers}
        pageBg={activeSurface.pageBg}
      />

      {/* Colorful Dynamic Category Ambient Wash with CSS Cross-Fade */}
      {!immersiveMode && (
        <>
          {paletteTransition.prevTint && (
            <div
              key={`tint-out-${paletteTransition.nonce}`}
              className="fixed inset-0 z-[1] pointer-events-none palette-crossfade-out"
              style={{ background: paletteTransition.prevTint }}
              aria-hidden="true"
            />
          )}
          <div
            key={`tint-in-${paletteTransition.nonce}`}
            className="fixed inset-0 z-[1] pointer-events-none palette-crossfade-in"
            style={{ background: paletteTransition.currTint }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Pure Unobstructed Scenic Mode */}
      {immersiveMode ? (
        <div
          onClick={() => setImmersiveMode(false)}
          className="relative z-10 min-h-screen w-full cursor-pointer flex flex-col justify-between p-6 sm:p-10"
          role="button"
          tabIndex={0}
          aria-label="Ana sayfaya dönmek için herhangi bir yere tıklayın"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              e.preventDefault();
              setImmersiveMode(false);
            }
          }}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImmersiveMode(false);
              }}
              className={`min-h-[44px] px-5 rounded-xl bg-black/75 border border-white/20 text-sm font-semibold text-white hover:bg-black/90 focus-visible:outline-none focus-visible:ring-3 ${activeTheme.ringClass} transition-colors flex items-center gap-2 whitespace-nowrap shrink-0`}
            >
              <Minimize2 className={`w-4 h-4 ${activeTheme.textAccent}`} />
              <span>Ana Sayfaya Dön</span>
            </button>
          </div>

          <div className="flex items-end justify-between gap-4 pointer-events-none">
            <div className="px-3.5 py-2 rounded-xl bg-black/65 text-xs sm:text-sm text-white/90">
              <span>{currentStation?.name ?? 'Cengiz TV & Radyo'}</span>
              <span aria-hidden="true"> · </span>
              <span>
                {bgMode === 'fireplace'
                  ? 'Şömine'
                  : bgMode === 'landscapes'
                    ? activeLandscape.title
                    : 'Koyu Zemin'}
              </span>
            </div>
            {prayerAlert && (
              <div className="pointer-events-auto px-4 py-2.5 rounded-xl bg-emerald-950/95 border border-emerald-400/70 text-xs sm:text-sm text-emerald-100 flex items-center gap-3 shadow-lg">
                <Bell className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  <strong>{prayerAlert.label} Vakti Girdi</strong> · {prayerAlert.time} (
                  {prayerAlert.district})
                </span>
                <button
                  type="button"
                  onClick={() => setPrayerAlert(null)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 text-[#07130E] font-semibold text-xs"
                >
                  Tamam
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Top Bar Contract: 3 zones separated by gap-8 on desktop, clean 2-row on narrow mobile */}
          <header
            className="sm:sticky top-0 z-30 border-b border-white/10 transition-colors duration-300"
            style={{ backgroundColor: activeSurface.headerBg }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-4 md:gap-8">
              {/* Zone 1: Custom Broadcast Brand Emblem + Wordmark */}
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  setAppView('radio');
                }}
                className="flex items-center gap-2.5 text-base sm:text-xl font-bold tracking-tight text-[#F4F5F7] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md px-1"
              >
                <CengizBrandEmblem accentHex={activeTheme.accentHex} className="w-8 h-8 shrink-0" />
                <span>Cengiz TV &amp; Radyo</span>
              </a>

              {/* Zone 3 (ordered second on mobile row 1, third on desktop): Primary Settings CTA */}
              <div className="shrink-0 md:order-last">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className={`min-h-[42px] md:min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white transition-colors duration-300 whitespace-nowrap shrink-0 ${activeTheme.ctaBg}`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Ayarlar</span>
                </button>
              </div>

              {/* Zone 2: Clean Single-Line App Views */}
              <nav
                aria-label="Ana Bölümler"
                className="w-full md:w-auto flex items-center justify-between md:justify-center gap-3 sm:gap-7 overflow-x-auto border-t border-white/8 pt-1 md:border-t-0 md:pt-0"
              >
                <button
                  type="button"
                  onClick={() => setAppView('radio')}
                  className={`min-h-[42px] md:min-h-[44px] px-1 text-xs sm:text-base font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    appView === 'radio'
                      ? `${activeTheme.textAccent} border-current`
                      : 'text-[#B5BBC7] border-transparent hover:text-white'
                  }`}
                >
                  Canlı Radyo
                </button>

                <button
                  type="button"
                  onClick={() => setAppView('tv')}
                  className={`min-h-[42px] md:min-h-[44px] px-1 text-xs sm:text-base font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                    appView === 'tv'
                      ? 'text-red-400 border-red-400'
                      : 'text-[#B5BBC7] border-transparent hover:text-white'
                  }`}
                >
                  Canlı TV
                </button>

                <button
                  type="button"
                  onClick={() => setAppView('artist')}
                  className={`min-h-[42px] md:min-h-[44px] px-1 text-xs sm:text-base font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                    appView === 'artist'
                      ? 'text-rose-400 border-rose-400'
                      : 'text-[#B5BBC7] border-transparent hover:text-white'
                  }`}
                >
                  Sanatçı &amp; YouTube
                </button>

                <button
                  type="button"
                  onClick={() => setAppView('spiritual')}
                  className={`min-h-[42px] md:min-h-[44px] px-1 text-xs sm:text-base font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    appView === 'spiritual'
                      ? 'text-emerald-400 border-emerald-400'
                      : 'text-[#B5BBC7] border-transparent hover:text-white'
                  }`}
                >
                  Vakit &amp; Hadis
                </button>
              </nav>
            </div>
          </header>

          {/* Main Workspace */}
          <main
            id="top"
            className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-5 sm:py-7 space-y-6"
          >
            {/* Prayer Time Alarm Notification Banner */}
            {prayerAlert && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-emerald-950/95 border border-emerald-400/70 text-sm text-emerald-100 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {prayerAlert.label} Vakti Girdi · {prayerAlert.time}
                      {prayerAlert.isTest ? ' (Test Bildirimi)' : ''}
                    </p>
                    <p className="text-xs text-emerald-200">
                      Diyanet Namaz Vakitleri · {prayerAlert.district}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrayerAlert(null)}
                  className="min-h-[38px] px-4 rounded-xl bg-emerald-500 text-[#07130E] font-semibold text-xs hover:bg-emerald-400 flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tamam</span>
                </button>
              </div>
            )}

            {/* App & Catalog Self-Update Notice */}
            {(needRefresh || updateBanner) && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#16231D] border border-emerald-400/50 text-sm text-emerald-200"
              >
                <span>
                  {needRefresh
                    ? 'Yeni sürüm indirildi! Programı şimdi güncellemek için tıklayın.'
                    : updateBanner}
                </span>
                {needRefresh && (
                  <button
                    type="button"
                    onClick={applyAppUpdate}
                    className="min-h-[40px] px-4 rounded-xl bg-emerald-500 text-[#07130E] font-semibold text-xs hover:bg-emerald-400 transition-colors"
                  >
                    Şimdi Güncelle
                  </button>
                )}
              </div>
            )}

            {appView === 'tv' ? (
              <TvPlayerView
                onStartTvPlayback={pauseRadioIfActive}
                onSwitchToRadio={() => setAppView('radio')}
                activeRadioName={currentStation?.name}
                lowBandwidthMode={settings.lowBandwidthMode}
                onToggleLowBandwidth={() =>
                  updateSettings({ lowBandwidthMode: !settings.lowBandwidthMode })
                }
                recentChannels={recentTvChannels}
                onRecordRecentChannel={recordRecentTvChannel}
                pendingChannelId={pendingTvChannelId}
                onClearPendingChannel={() => setPendingTvChannelId(null)}
                requestedSourceMode={requestedTvSourceMode}
                onClearRequestedSourceMode={() => setRequestedTvSourceMode(null)}
                cardBg={activeSurface.cardBg}
                activeTheme={activeTheme}
              />
            ) : appView === 'artist' ? (
              <ArtistFinderView
                onBeforePlayYouTube={pauseRadioIfActive}
                onPlayRadioStation={(st) => {
                  setAppView('radio');
                  playStation(st);
                }}
                cardBg={activeSurface.cardBg}
              />
            ) : appView === 'spiritual' ? (
              <SpiritualCornerView
                settings={settings}
                onOpenSettings={() => setSettingsOpen(true)}
                onTogglePrayerAlarm={() =>
                  updateSettings({ enablePrayerAlarm: !settings.enablePrayerAlarm })
                }
                onTestPrayerAlarm={() => triggerPrayerAlert('Öğle', clockText, true)}
                cardBg={activeSurface.cardBg}
              />
            ) : (
              <>
                {/* Decluttered Now Playing Card */}
                <section
                  aria-label="Şu An Çalan"
                  className="border border-white/12 rounded-2xl p-4 sm:p-6 space-y-4 palette-smooth"
                  style={{
                    backgroundColor: activeSurface.cardBg,
                    boxShadow: `0 12px 36px -18px ${activeTheme.glowRgba}`,
                  }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    {/* Station Info with Channel Badge Icon & Live Program Icon */}
                    <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                      <div className="relative shrink-0">
                        <ChannelLogo
                          name={currentStation?.name ?? 'Cengiz Radyo'}
                          kind="radio"
                          category={currentStation?.category ?? 'ilahi'}
                          size="lg"
                        />
                        {status === 'playing' && (
                          <div
                            className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-[#0D0F12] border border-white/20 flex items-end gap-0.5 h-4"
                            aria-hidden="true"
                          >
                            <span
                              className="w-1 h-full rounded-sm eq-bar-1"
                              style={{ backgroundColor: activeTheme.accentHex }}
                            />
                            <span
                              className="w-1 h-full rounded-sm eq-bar-2"
                              style={{ backgroundColor: activeTheme.accentHex }}
                            />
                            <span
                              className="w-1 h-full rounded-sm eq-bar-3"
                              style={{ backgroundColor: activeTheme.accentHex }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#B5BBC7]">
                          <span
                            className={
                              status === 'playing' ? `${activeTheme.textAccent} font-medium` : ''
                            }
                          >
                            {statusText}
                          </span>
                          {currentStation && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Türkçe</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{currentStation.genre}</span>
                              {currentStation.bitrate && (
                                <>
                                  <span aria-hidden="true" className="hidden sm:inline">
                                    ·
                                  </span>
                                  <span className="hidden sm:inline font-mono tabular-nums">
                                    {currentStation.bitrate} kbps
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 truncate">
                          {currentStation ? currentStation.name : 'Bir Türkçe Kanal Seçin'}
                        </h1>

                        {currentStation && (() => {
                          const prog = getRadioCurrentProgram(
                            currentStation.category,
                            currentStation.name,
                          );
                          return (
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#D1D5DB]">
                              <ProgramTypeIcon type={prog.programType} size="xs" />
                              <span className="truncate">{prog.title}</span>
                            </div>
                          );
                        })()}

                        {errorMessage && (
                          <div className="flex flex-wrap items-center gap-3 mt-1" role="alert">
                            <p className="text-sm text-rose-400">{errorMessage}</p>
                            <button
                              type="button"
                              onClick={() => stepStation(1, activeList)}
                              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold ${activeTheme.ctaBg}`}
                            >
                              Sonraki Kanala Geç
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => stepStation(-1, activeList)}
                        className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-[#0D0F12] border border-white/12 text-[#E2E5EB] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 ${activeTheme.ringClass}`}
                        aria-label="Önceki Kanal"
                        title="Önceki Kanal (P)"
                      >
                        <SkipBack className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={togglePlayPause}
                        className={`min-h-[50px] px-6 sm:px-7 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white transition-colors duration-300 whitespace-nowrap shrink-0 ${activeTheme.ctaBg}`}
                      >
                        {status === 'playing' || status === 'loading' ? (
                          <>
                            <Pause className="w-5 h-5 fill-current" />
                            <span>Duraklat</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-5 h-5 fill-current" />
                            <span>Dinle</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => stepStation(1, activeList)}
                        className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-[#0D0F12] border border-white/12 text-[#E2E5EB] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 ${activeTheme.ringClass}`}
                        aria-label="Sonraki Kanal"
                        title="Sonraki Kanal (N)"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={cycleSleepTimer}
                        className={`min-h-[48px] px-4 rounded-xl border text-sm font-medium flex items-center gap-2 focus-visible:outline-none focus-visible:ring-3 ${activeTheme.ringClass} transition-colors whitespace-nowrap shrink-0 ${
                          sleepMinutes
                            ? `bg-white/12 border-current ${activeTheme.textAccent}`
                            : 'bg-[#0D0F12] border-white/12 text-[#D1D5DB] hover:bg-white/10'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span className="font-mono tabular-nums">
                          {sleepSecondsLeft !== null
                            ? formatSleepCountdown(sleepSecondsLeft)
                            : 'Zamanlayıcı'}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 bg-[#0D0F12] border border-white/12 rounded-xl px-3 min-h-[48px]">
                        <button
                          type="button"
                          onClick={() => setMuted((m) => !m)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#D1D5DB] hover:text-white rounded-lg"
                          aria-label={muted ? 'Sesi Aç' : 'Sessize Al'}
                        >
                          {muted || volume === 0 ? (
                            <VolumeX className="w-5 h-5 text-rose-400" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={muted ? 0 : volume}
                          onChange={(e) => {
                            const nextVol = Number(e.target.value);
                            setVolume(nextVol);
                            if (nextVol > 0 && muted) setMuted(false);
                          }}
                          aria-label="Ses Seviyesi"
                          className="w-20 sm:w-24 cursor-pointer"
                          style={{ accentColor: activeTheme.accentHex }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Centered Minimalist Audio Wave Visualizer */}
                  {settings.enableVisualizer && (status === 'playing' || status === 'loading') && (
                    <div className="pt-2 border-t border-white/8">
                      <AudioWaveVisualizer
                        analyserRef={analyserRef}
                        isPlaying={status === 'playing'}
                        variant="compact"
                        stationName={currentStation?.name}
                        accentHex={activeTheme.accentHex}
                        accentLightHex={activeTheme.accentLightHex}
                      />
                    </div>
                  )}

                  {/* Clean Quick Actions Row (Full controls live neatly in Ayarlar Modülü) */}
                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBgMode((m) => (m === 'fireplace' ? 'landscapes' : 'fireplace'))
                        }
                        className="min-h-[40px] px-3.5 rounded-xl bg-[#0D0F12] border border-white/12 text-xs sm:text-sm font-medium text-[#D1D5DB] hover:text-white hover:bg-white/10 flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        {bgMode === 'fireplace' ? (
                          <>
                            <ImageIcon className="w-4 h-4 text-emerald-400" />
                            <span>Manzaraya Geç</span>
                          </>
                        ) : (
                          <>
                            <Flame className="w-4 h-4 text-amber-400" />
                            <span>Şömine Modu</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setImmersiveMode(true)}
                        className="min-h-[40px] px-3.5 rounded-xl bg-[#0D0F12] border border-white/12 text-xs sm:text-sm font-medium text-[#D1D5DB] hover:text-white hover:bg-white/10 flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <Maximize2 className={`w-4 h-4 ${activeTheme.textAccent}`} />
                        <span>Sadece Manzara</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          pauseRadioIfActive();
                          setRequestedTvSourceMode('matches');
                          setAppView('tv');
                        }}
                        className="min-h-[40px] px-3.5 rounded-xl bg-emerald-500/18 border border-emerald-400/55 text-xs sm:text-sm font-semibold text-emerald-200 hover:bg-emerald-500/28 flex items-center gap-2 whitespace-nowrap shrink-0 palette-smooth"
                      >
                        <Trophy className="w-4 h-4 text-emerald-400" />
                        <span>Maç Rehberi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          pauseRadioIfActive();
                          setAppView('tv');
                        }}
                        className="min-h-[40px] px-3.5 rounded-xl bg-red-500/18 border border-red-400/55 text-xs sm:text-sm font-semibold text-red-200 hover:bg-red-500/28 flex items-center gap-2 whitespace-nowrap shrink-0 palette-smooth"
                      >
                        <Tv className="w-4 h-4 text-red-400" />
                        <span>Canlı TV’ye Geç</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSearchModalOpen(true)}
                        className="min-h-[40px] px-3.5 rounded-xl bg-[#0D0F12] border border-white/12 text-xs sm:text-sm font-medium text-[#D1D5DB] hover:text-white hover:bg-white/10 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Plus className={`w-4 h-4 ${activeTheme.textAccent}`} />
                        <span>Radyo Ekle</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* Diyanet Namaz Vakitleri & Ayet/Hadis Özeti */}
                {settings.showSpiritualStrip && (
                  <SpiritualSummaryStrip
                    settings={settings}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onOpenFullView={() => setAppView('spiritual')}
                    onTogglePrayerAlarm={() =>
                      updateSettings({ enablePrayerAlarm: !settings.enablePrayerAlarm })
                    }
                    onTestPrayerAlarm={() => triggerPrayerAlert('Öğle', clockText, true)}
                    cardBg={activeSurface.cardBg}
                  />
                )}

                {/* Recently Listened & Watched Quick-Resume Strip */}
                {(recentStations.length > 0 || recentTvChannels.length > 0) && (
                  <section
                    aria-label="Son Dinlenen ve İzlenenler"
                    className="rounded-2xl border border-white/10 p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-3 palette-smooth"
                    style={{ backgroundColor: activeSurface.cardBg }}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-teal-300 shrink-0">
                      <Clock className="w-4 h-4" />
                      <span>Son Dinlenen &amp; İzlenen</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1">
                      {recentTvChannels.slice(0, 4).map((ch) => (
                        <button
                          key={`home-recent-tv-${ch.id}`}
                          type="button"
                          onClick={() => {
                            pauseRadioIfActive();
                            setPendingTvChannelId(ch.id);
                            setAppView('tv');
                          }}
                          className="min-h-[38px] px-3 rounded-xl bg-[#0D0F12]/90 border border-white/10 hover:border-red-400/60 text-xs font-medium text-[#E5E7EB] hover:text-white flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                          title="Son İzlenen TV Kanalını Aç"
                        >
                          <Tv className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{ch.name}</span>
                        </button>
                      ))}
                      {recentStations.slice(0, 5).map((st) => {
                        const isPlayingNow = currentStation?.id === st.id && status === 'playing';
                        return (
                          <button
                            key={`home-recent-radio-${st.id}`}
                            type="button"
                            onClick={() => playStation(st)}
                            className={`min-h-[38px] px-3 rounded-xl border text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                              isPlayingNow
                                ? 'bg-teal-400/18 border-teal-300 text-teal-200'
                                : 'bg-[#0D0F12]/90 border-white/10 hover:border-emerald-400/60 text-[#E5E7EB] hover:text-white'
                            }`}
                            title="Son Dinlenen Radyoyu Çal"
                          >
                            <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{st.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Colorful Category Tabs (İlahi First) + Search */}
                <section aria-label="Türkçe Radyo Kategorileri ve Arama" className="space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {CATEGORY_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const count = getCategoryCount(tab.id);
                        const tabTheme = RADIO_CATEGORY_THEMES[tab.id];
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(tab.id);
                              setPage(1);
                            }}
                            className={`min-h-[44px] px-3.5 rounded-xl text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0 border focus-visible:outline-none focus-visible:ring-2 ${tabTheme.ringClass} flex items-center gap-2 ${
                              isActive
                                ? tabTheme.tabActive
                                : 'bg-[#141820]/90 text-[#D1D5DB] border-white/10 hover:bg-[#1E2430]'
                            }`}
                          >
                            <span>{tab.label}</span>
                            {count !== null && (
                              <span
                                className={`text-xs font-mono tabular-nums ${
                                  isActive ? 'opacity-80' : 'text-[#8C93A3]'
                                }`}
                              >
                                {count.toLocaleString('tr-TR')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1 w-full lg:w-80 shrink-0">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#9BA1AE] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (radioVoiceStatus) setRadioVoiceStatus(null);
                          }}
                          placeholder="Türkçe kanal ara (ilahi, kuran, türkü...)"
                          aria-label="Türkçe Kanal Ara"
                          className="w-full min-h-[44px] pl-11 pr-12 rounded-xl bg-[#141820]/95 border border-white/12 text-sm text-white placeholder:text-[#8C93A3] focus:outline-none focus:ring-2 focus:ring-white/60"
                        />
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                          <VoiceSearchButton
                            onResult={(txt) => setSearchQuery(txt)}
                            onListeningChange={(active) =>
                              setRadioVoiceStatus(
                                active ? 'Dinleniyor... Kanal adını söyleyin.' : null,
                              )
                            }
                            onError={(msg) => setRadioVoiceStatus(msg)}
                          />
                        </div>
                      </div>
                      {radioVoiceStatus && (
                        <p className="text-xs text-amber-300" role="status">
                          {radioVoiceStatus}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Channel Summary Line */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#B5BBC7]">
                    <div
                      key={`cat-head-${activeTab}-${settings.themeMode}`}
                      className="palette-badge-swap"
                    >
                      <h2
                        className="text-lg font-semibold text-white pb-1 border-b-2 palette-smooth inline-block"
                        style={{ borderColor: activeTheme.accentHex }}
                      >
                        {CATEGORY_TABS.find((t) => t.id === activeTab)?.label ?? 'Kanallar'}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 font-mono tabular-nums text-xs sm:text-sm">
                      <span>
                        {activeTab === 'favorites'
                          ? `${displayedStations.length} favori`
                          : activeTab === 'recent'
                            ? `${displayedStations.length} son dinlenen`
                            : `${serverData.total.toLocaleString('tr-TR')} Türkçe kanal`}
                      </span>
                      {activeTab !== 'favorites' &&
                        activeTab !== 'recent' &&
                        serverData.catalogTotal > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Toplam {serverData.catalogTotal.toLocaleString('tr-TR')} radyo
                            </span>
                          </>
                        )}
                      <span aria-hidden="true">·</span>
                      <span>{clockText}</span>
                    </div>
                  </div>

                  {/* Low-RAM Station Grid */}
                  {catalogLoading &&
                  activeTab !== 'favorites' &&
                  activeTab !== 'recent' &&
                  displayedStations.length === 0 ? (
                    <div className="bg-[#141820]/94 border border-white/10 rounded-2xl p-10 text-center text-[#B5BBC7]">
                      Türkçe kanallar yükleniyor...
                    </div>
                  ) : displayedStations.length === 0 ? (
                    <div className="bg-[#141820]/94 border border-white/10 rounded-2xl p-10 text-center space-y-3">
                      <p className="text-base text-[#D1D5DB]">
                        {activeTab === 'favorites'
                          ? 'Henüz favori kanalınız yok.'
                          : activeTab === 'recent'
                            ? 'Henüz dinlenen bir kanal geçmişi yok.'
                            : 'Aramanıza uygun Türkçe kanal bulunamadı.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('ilahi');
                          setSearchQuery('');
                          setPage(1);
                        }}
                        className={`min-h-[44px] px-5 rounded-xl text-sm font-semibold transition-colors ${RADIO_CATEGORY_THEMES.ilahi.ctaBg}`}
                      >
                        İlahi Kanallarını Göster
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      key={`${activeTab}-${page}`}
                      initial={{ opacity: 0.35, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5"
                    >
                      {displayedStations.map((station, index) => {
                        const isSelected = currentStation?.id === station.id;
                        const isPlaying = isSelected && status === 'playing';
                        const isLoading = isSelected && status === 'loading';
                        const isFav = favoriteIds.has(station.id);
                        const globalIndex =
                          activeTab === 'favorites' || activeTab === 'recent'
                            ? index + 1
                            : (serverData.page - 1) * serverData.limit + index + 1;

                        return (
                          <div
                            key={station.id}
                            className={`group relative rounded-2xl border transition-colors duration-150 ${
                              isSelected
                                ? activeTheme.cardBorder
                                : 'border-white/10 hover:border-white/25 hover:bg-[#1B202C]'
                            }`}
                            style={!isSelected ? { backgroundColor: activeSurface.cardBg } : undefined}
                          >
                            <button
                              ref={(el) => {
                                cardRefs.current[index] = el;
                              }}
                              type="button"
                              onClick={() => playStation(station)}
                              className={`w-full text-left p-4 pr-14 rounded-2xl focus-visible:outline-none focus-visible:ring-3 ${activeTheme.ringClass} focus-visible:bg-[#1E2432] min-h-[118px] flex flex-col justify-between`}
                            >
                              <div className="flex items-start gap-3">
                                <ChannelLogo
                                  name={station.name}
                                  kind="radio"
                                  category={station.category}
                                  size="md"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#9BA1AE]">
                                    <span className="font-mono tabular-nums text-[#8C93A3]">
                                      {String(globalIndex).padStart(2, '0')}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>Türkçe</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono">{station.format}</span>
                                  </div>
                                  <h3 className="text-base font-semibold text-white truncate mt-0.5">
                                    {station.name}
                                  </h3>
                                  <p className="text-xs text-[#B5BBC7] mt-0.5 truncate">
                                    {station.genre}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between text-xs">
                                {isPlaying ? (
                                  <span
                                    className={`font-medium flex items-center gap-2 ${activeTheme.textAccent}`}
                                  >
                                    <span
                                      className="inline-flex items-end gap-0.5 h-3"
                                      aria-hidden="true"
                                    >
                                      <span
                                        className="w-1 h-full eq-bar-1"
                                        style={{ backgroundColor: activeTheme.accentHex }}
                                      />
                                      <span
                                        className="w-1 h-full eq-bar-2"
                                        style={{ backgroundColor: activeTheme.accentHex }}
                                      />
                                      <span
                                        className="w-1 h-full eq-bar-3"
                                        style={{ backgroundColor: activeTheme.accentHex }}
                                      />
                                    </span>
                                    Çalıyor
                                  </span>
                                ) : isLoading ? (
                                  <span className={`${activeTheme.textAccent} font-medium`}>
                                    Bağlanıyor...
                                  </span>
                                ) : (
                                  <span className="text-[#8C93A3] truncate">{station.city}</span>
                                )}
                              </div>
                            </button>

                            <div className="absolute top-3 right-3 flex items-center gap-1">
                              {station.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustom(station.id)}
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8C93A3] hover:text-rose-400 hover:bg-black/40"
                                  aria-label={`${station.name} kanalını sil`}
                                  title="Kanalı Sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleFavorite(station)}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9BA1AE] hover:text-amber-400 hover:bg-black/40"
                                aria-label={
                                  isFav
                                    ? `${station.name} favorilerden çıkar`
                                    : `${station.name} favorilere ekle`
                                }
                              >
                                <Star
                                  className={`w-5 h-5 ${
                                    isFav ? 'text-amber-400 fill-amber-400' : 'text-[#7C8394]'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Pagination Bar */}
                  {activeTab !== 'favorites' &&
                    activeTab !== 'recent' &&
                    serverData.totalPages > 1 && (
                      <div className="pt-4 flex items-center justify-between gap-4">
                        <button
                          type="button"
                          disabled={serverData.page <= 1}
                          onClick={() => {
                            setPage((p) => Math.max(1, p - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`min-h-[46px] px-5 rounded-xl bg-[#141820]/94 border border-white/12 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2`}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Önceki</span>
                        </button>

                        <span className="text-sm font-mono tabular-nums text-[#B5BBC7]">
                          Sayfa {serverData.page} / {serverData.totalPages}
                        </span>

                        <button
                          type="button"
                          disabled={serverData.page >= serverData.totalPages}
                          onClick={() => {
                            setPage((p) => Math.min(serverData.totalPages, p + 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`min-h-[46px] px-5 rounded-xl bg-[#141820]/94 border border-white/12 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2`}
                        >
                          <span>Sonraki</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                </section>
              </>
            )}
          </main>

          {/* Quiet Footer */}
          <footer
            className="relative z-10 border-t border-white/10 py-4 px-4 sm:px-8 transition-colors duration-300"
            style={{ backgroundColor: activeSurface.headerBg }}
          >
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#9BA1AE]">
              <span>
                Cengiz TV &amp; Radyo {systemStatus ? `v${systemStatus.appVersion}` : 'v2.4.0'} · Hazırlayan: Mehmet Cengiz Akdağ
              </span>
              <span>
                Kumanda: ← → ↑ ↓ Gezin · OK Çal · N Sonraki · P Önceki · M Sessiz · ESC Liste
              </span>
            </div>
          </footer>
        </>
      )}

      {/* Numeric TV Remote Channel Zap OSD */}
      {numericBuffer && (
        <div
          className="fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl bg-black/90 border border-white/25 font-mono text-2xl font-bold tabular-nums shadow-xl"
          style={{ color: activeTheme.accentHex }}
          role="status"
          aria-live="polite"
        >
          Kanal {numericBuffer}
        </div>
      )}

      {dailyWisdomPopup && settings.enableDailyWisdomPopup && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] w-[min(92vw,620px)] rounded-2xl border border-amber-300/35 bg-slate-950/95 p-3 sm:p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs font-bold tracking-wide text-amber-300">✦ GÜNÜN AYETİ VE HADİSİ</div>
            <button type="button" onClick={() => setDailyWisdomPopup(null)} className="min-h-8 min-w-8 rounded-lg text-slate-300 hover:bg-white/10" aria-label="Bilgilendirmeyi kapat">×</button>
          </div>
          <div className="space-y-2 text-[11px] sm:text-xs leading-relaxed text-slate-100">
            <p><strong className="text-amber-300">AYET · {dailyWisdomPopup.ayah.reference}</strong><br />{dailyWisdomPopup.ayah.turkish}</p>
            <div className="h-px bg-white/10" />
            <p><strong className="text-emerald-300">HADİS · {dailyWisdomPopup.hadith.reference}</strong><br />{dailyWisdomPopup.hadith.text}</p>
          </div>
        </div>
      )}

      <OfflineIndicator />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        bgMode={bgMode}
        onChangeBgMode={setBgMode}
        autoScenicOnPlay={autoScenicOnPlay}
        onToggleAutoScenic={() => setAutoScenicOnPlay((v) => !v)}
        onPickRandomLandscape={pickRandomLandscape}
        landscapeTotal={landscapeTotal}
        settings={settings}
        onUpdateSettings={updateSettings}
        onTestPrayerAlarm={() => triggerPrayerAlert('Öğle', clockText, true)}
        checkingUpdate={checkingUpdate}
        systemStatus={systemStatus}
        onCheckUpdate={checkAndUpdateNow}
        onOpenAddChannel={() => setSearchModalOpen(true)}
        exportableStations={favoriteStations.length > 0 ? favoriteStations : DEFAULT_STATIONS}
      />

      <SearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        existingUrls={existingUrls}
        exportableStations={favoriteStations.length > 0 ? favoriteStations : DEFAULT_STATIONS}
        onAddStation={handleAddStation}
      />
    </div>
  );
}

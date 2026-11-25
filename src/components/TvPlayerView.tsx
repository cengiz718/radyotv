import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarClock,
  Clock,
  ListChecks,
  ListVideo,
  Maximize2,
  Minimize2,
  Monitor,
  Pause,
  Play,
  Radio,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Trophy,
  Tv,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { TV_CATEGORY_THEMES, type CategoryTheme } from '../data/categoryThemes.ts';
import { isFamilySafeTurkishContent } from '../data/contentSafety.ts';
import { buildChannelEpgGuide } from '../data/turkishEpg.ts';
import { TURKSAT_TV_CHANNELS } from '../data/tvChannels.ts';
import type { ChannelEpgGuide, TvCategory, TvChannel } from '../types.ts';
import { CengizBrandEmblem, ChannelBadgeIcon, ProgramTypeIcon } from './ChannelIcons.tsx';
import { MatchSchedulePanel } from './MatchSchedulePanel.tsx';
import { TvChannelListModal } from './TvChannelListModal.tsx';
import { VoiceSearchButton } from './VoiceSearchButton.tsx';

interface TvPlayerViewProps {
  onStartTvPlayback: () => void;
  onSwitchToRadio?: () => void;
  activeRadioName?: string;
  lowBandwidthMode?: boolean;
  onToggleLowBandwidth?: () => void;
  recentChannels?: TvChannel[];
  onRecordRecentChannel?: (channel: TvChannel) => void;
  pendingChannelId?: string | null;
  onClearPendingChannel?: () => void;
  requestedSourceMode?: 'turksat' | 'epg' | 'matches' | null;
  onClearRequestedSourceMode?: () => void;
  cardBg?: string;
  activeTheme?: CategoryTheme;
}

const TV_CATEGORIES: Array<{ id: TvCategory; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'ulusal', label: 'Ulusal Kanallar' },
  { id: 'spor', label: 'Spor' },
  { id: 'sinema', label: 'Sinema & Dizi' },
  { id: 'haber', label: 'Haber & Ekonomi' },
  { id: 'dini', label: 'Dini Kanallar' },
  { id: 'kultur', label: 'Müzik & Belgesel' },
  { id: 'recent', label: 'Son İzlenen' },
];

export function TvPlayerView({
  onStartTvPlayback,
  onSwitchToRadio,
  activeRadioName,
  lowBandwidthMode = false,
  onToggleLowBandwidth,
  recentChannels = [],
  onRecordRecentChannel,
  pendingChannelId,
  onClearPendingChannel,
  requestedSourceMode,
  onClearRequestedSourceMode,
  cardBg,
  activeTheme,
}: TvPlayerViewProps) {
  const [tvSourceMode, setTvSourceMode] = useState<'turksat' | 'epg' | 'matches'>(
    requestedSourceMode ?? 'turksat',
  );
  const [channels, setChannels] = useState<TvChannel[]>(TURKSAT_TV_CHANNELS);
  const [epgMap, setEpgMap] = useState<Record<string, ChannelEpgGuide>>({});

  const [category, setCategory] = useState<TvCategory>('all');
  const [search, setSearch] = useState('');
  const [tvVoiceStatus, setTvVoiceStatus] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<TvChannel | null>(null);

  const [tvStatus, setTvStatus] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>(
    'idle',
  );
  const [tvError, setTvError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [hlsLevels, setHlsLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState<number>(-1);
  const [activeHlsLabel, setActiveHlsLabel] = useState<string>('HLS Oto');

  // In-player overlay controls, channel list modal, seek timeline & display settings
  const [osdVisible, setOsdVisible] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [videoSettingsOpen, setVideoSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theaterFullscreen, setTheaterFullscreen] = useState(false);
  const [fullscreenHost, setFullscreenHost] = useState<HTMLElement | null>(null);
  const [zapBanner, setZapBanner] = useState<{
    channel: TvChannel;
    nonce: number;
  } | null>(null);

  // Video display & orientation settings
  const [orientationMode, setOrientationMode] = useState<'auto' | 'portrait' | 'landscape'>(() => {
    if (typeof window === 'undefined') return 'auto';
    try {
      const saved = window.localStorage.getItem('cengiztv_orientation_mode_v1');
      if (saved === 'portrait' || saved === 'landscape' || saved === 'auto') {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'auto';
  });
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  );
  const [videoFit, setVideoFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Video seekable buffer state
  const [seekState, setSeekState] = useState({
    current: 0,
    start: 0,
    end: 0,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const osdTimerRef = useRef<number | null>(null);
  const zapBannerTimerRef = useRef<number | null>(null);
  const autoEnteredRef = useRef<boolean>(false);
  const selectedHlsLevelRef = useRef<number>(-1);
  const prevLowBandwidthRef = useRef<boolean>(lowBandwidthMode);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const isAnyFullscreen = isFullscreen || theaterFullscreen;
  const effectiveOrientation: 'portrait' | 'landscape' =
    orientationMode === 'auto' ? (isPortraitViewport ? 'portrait' : 'landscape') : orientationMode;
  const isPortraitExpanded = isAnyFullscreen && effectiveOrientation === 'portrait';

  const theme = TV_CATEGORY_THEMES[category];
  const surfaceCardBg = cardBg ?? 'rgba(20, 24, 32, 0.94)';

  useEffect(() => {
    fetch('/api/tv-channels')
      .then((r) => r.json())
      .then((data: { channels?: TvChannel[] }) => {
        if (Array.isArray(data.channels) && data.channels.length > 0) {
          const safeList = data.channels.filter((ch) =>
            isFamilySafeTurkishContent(`${ch.name} ${ch.category} ${ch.streamUrl}`),
          );
          if (safeList.length > 0) {
            setChannels(safeList);
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadAllEpg = useCallback(() => {
    fetch('/api/epg')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { guides?: ChannelEpgGuide[] } | null) => {
        if (!Array.isArray(data?.guides)) return;
        const map: Record<string, ChannelEpgGuide> = {};
        for (const g of data.guides) {
          map[g.channelKey] = g;
        }
        setEpgMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAllEpg();
    const timer = window.setInterval(loadAllEpg, 60000);
    return () => window.clearInterval(timer);
  }, [loadAllEpg]);

  const getChannelEpg = useCallback(
    (ch: TvChannel): ChannelEpgGuide => {
      return epgMap[ch.id] ?? buildChannelEpgGuide(ch.id, ch.name, ch.category);
    },
    [epgMap],
  );

  const selectedEpg = useMemo(() => {
    if (activeChannel) return getChannelEpg(activeChannel);
    return channels[0] ? getChannelEpg(channels[0]) : null;
  }, [activeChannel, channels, getChannelEpg]);

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    const baseList =
      category === 'recent'
        ? recentChannels
            .map((rc) => channels.find((ch) => ch.id === rc.id) ?? rc)
            .filter(Boolean)
        : channels.filter((ch) => category === 'all' || ch.category === category);

    if (!q) return baseList;
    return baseList.filter((ch) => ch.name.toLowerCase().includes(q));
  }, [category, channels, recentChannels, search]);

  const revealOsd = useCallback((sticky = false) => {
    setOsdVisible(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
      osdTimerRef.current = null;
    }
    if (!sticky) {
      osdTimerRef.current = window.setTimeout(() => {
        setOsdVisible(false);
      }, 3600);
    }
  }, []);

  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setHlsLevels([]);
    setSelectedHlsLevel(-1);
    setActiveHlsLabel('HLS Oto');
    setSeekState({ current: 0, start: 0, end: 0 });
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, []);

  const triggerZapBanner = useCallback((channel: TvChannel) => {
    setZapBanner({ channel, nonce: Date.now() });
    if (zapBannerTimerRef.current) {
      window.clearTimeout(zapBannerTimerRef.current);
    }
    zapBannerTimerRef.current = window.setTimeout(() => {
      setZapBanner(null);
      zapBannerTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (zapBannerTimerRef.current) {
        window.clearTimeout(zapBannerTimerRef.current);
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const startChannel = useCallback(
    (channel: TvChannel, forceProxy = false) => {
      onStartTvPlayback();
      onRecordRecentChannel?.(channel);
      setActiveChannel(channel);
      setTvStatus('loading');
      setTvError(null);
      triggerZapBanner(channel);

      const video = videoRef.current;
      if (!video) return;

      cleanupHls();

      const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
      const isWeakNet =
        lowBandwidthMode ||
        Boolean(conn?.saveData) ||
        conn?.effectiveType === '2g' ||
        conn?.effectiveType === '3g' ||
        conn?.effectiveType === 'slow-2g';

      const useProxy = forceProxy || channel.needsProxy || channel.streamUrl.startsWith('http://');
      const sourceUrl = useProxy
        ? `/api/hls?url=${encodeURIComponent(channel.streamUrl)}`
        : channel.streamUrl;

      if (Hls.isSupported()) {
        let networkRecoveryTries = 0;
        let mediaRecoveryTries = 0;

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          capLevelToPlayerSize: true,
          startLevel: isWeakNet ? 0 : -1,
          abrEwmaDefaultEstimate: isWeakNet ? 180000 : 800000,
          maxBufferLength: isWeakNet ? 38 : 22,
          maxMaxBufferLength: isWeakNet ? 75 : 44,
          backBufferLength: 10,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 1200,
          levelLoadingMaxRetry: 4,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1200,
          fragLoadingTimeOut: 20000,
          startFragPrefetch: true,
        });
        hlsRef.current = hls;
        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_ev, data) => {
          const levels = data.levels.map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}k`,
          }));
          setHlsLevels(levels);

          if (isWeakNet && data.levels.length > 1) {
            hls.currentLevel = 0;
            selectedHlsLevelRef.current = 0;
            setSelectedHlsLevel(0);
            setActiveHlsLabel(`Düşük (${levels[0]?.label || 'SD'})`);
          } else {
            selectedHlsLevelRef.current = -1;
            setSelectedHlsLevel(-1);
            setActiveHlsLabel('HLS Oto');
          }
          video.play().catch(() => setTvStatus('paused'));
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_ev, data) => {
          const lvl = hls.levels[data.level];
          if (lvl) {
            const label = lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}k`;
            setActiveHlsLabel(
              isWeakNet || selectedHlsLevelRef.current === 0 ? `Düşük (${label})` : `HLS ${label}`,
            );
          }
        });
        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (!data.fatal) {
            if (isWeakNet && hls.levels.length > 1 && hls.currentLevel > 0) {
              hls.nextLevel = 0;
            }
            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!useProxy) {
              startChannel(channel, true);
              return;
            }
            if (networkRecoveryTries < 3) {
              networkRecoveryTries += 1;
              if (hls.levels.length > 1) {
                hls.currentLevel = 0;
                selectedHlsLevelRef.current = 0;
                setSelectedHlsLevel(0);
              }
              window.setTimeout(() => {
                if (hlsRef.current === hls) {
                  hls.startLoad();
                }
              }, 1000 * networkRecoveryTries);
              return;
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryTries < 2) {
            mediaRecoveryTries += 1;
            hls.recoverMediaError();
            return;
          }

          setTvStatus('error');
          setTvError(
            'Bu Türksat yayını şu an açılamadı. Sonraki kanala geçebilir veya Zayıf İnternet Modu’nu açabilirsiniz.',
          );
        });
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = sourceUrl;
        video.play().catch(() => setTvStatus('paused'));
      } else {
        setTvStatus('error');
        setTvError('Tarayıcınız canlı TV HLS yayınını desteklemiyor.');
      }
    },
    [cleanupHls, lowBandwidthMode, onStartTvPlayback, revealOsd],
  );

  useEffect(() => {
    selectedHlsLevelRef.current = selectedHlsLevel;
  }, [selectedHlsLevel]);

  // Apply lowBandwidthMode immediately when toggled on active HLS player
  useEffect(() => {
    const prev = prevLowBandwidthRef.current;
    prevLowBandwidthRef.current = lowBandwidthMode;
    if (prev === lowBandwidthMode) return;

    const hls = hlsRef.current;
    if (!hls || hls.levels.length <= 1) return;
    if (lowBandwidthMode) {
      hls.nextLevel = 0;
      selectedHlsLevelRef.current = 0;
      setSelectedHlsLevel(0);
    } else if (selectedHlsLevelRef.current === 0) {
      hls.nextLevel = -1;
      selectedHlsLevelRef.current = -1;
      setSelectedHlsLevel(-1);
    }
  }, [lowBandwidthMode]);

  const stepTvChannel = useCallback(
    (direction: 1 | -1) => {
      const list = filteredChannels.length > 0 ? filteredChannels : channels;
      if (list.length === 0) return;
      const idx = activeChannel ? list.findIndex((c) => c.id === activeChannel.id) : -1;
      const nextIdx = idx === -1 ? 0 : (idx + direction + list.length) % list.length;
      startChannel(list[nextIdx]);
    },
    [activeChannel, channels, filteredChannels, startChannel],
  );

  useEffect(() => {
    if (!pendingChannelId) return;
    const match =
      channels.find((ch) => ch.id === pendingChannelId) ??
      recentChannels.find((ch) => ch.id === pendingChannelId);
    if (match) {
      startChannel(match);
      onClearPendingChannel?.();
    }
  }, [channels, onClearPendingChannel, pendingChannelId, recentChannels, startChannel]);

  useEffect(() => {
    if (!requestedSourceMode) return;
    setTvSourceMode(requestedSourceMode);
    if (requestedSourceMode === 'matches') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setTheaterFullscreen(false);
    }
    onClearRequestedSourceMode?.();
  }, [onClearRequestedSourceMode, requestedSourceMode]);

  // Auto-start TV channel & enter fullscreen immediately when switching to TV view
  useEffect(() => {
    if (autoEnteredRef.current) return;
    autoEnteredRef.current = true;

    if (!pendingChannelId) {
      const initialCh = recentChannels[0] ?? channels[0];
      if (initialCh) {
        startChannel(initialCh);
      }
    }

    if (requestedSourceMode === 'matches') {
      return;
    }

    const el = playerBoxRef.current;
    if (el) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          setTheaterFullscreen(true);
        });
      } else {
        setTheaterFullscreen(true);
      }
    }
  }, [channels, pendingChannelId, recentChannels, requestedSourceMode, startChannel]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;
    if (video.paused) {
      video.play().catch(() => {});
      revealOsd(false);
    } else {
      video.pause();
      revealOsd(true);
    }
  }, [activeChannel, revealOsd]);

  const syncSeekState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const seekable = video.seekable;
    if (seekable && seekable.length > 0) {
      const start = seekable.start(0);
      const end = seekable.end(seekable.length - 1);
      setSeekState({
        current: video.currentTime,
        start,
        end,
      });
    } else {
      setSeekState({
        current: video.currentTime || 0,
        start: 0,
        end: Number.isFinite(video.duration) ? video.duration : video.currentTime || 0,
      });
    }
  }, []);

  const handleSeekBy = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video || !activeChannel) return;
      const seekable = video.seekable;
      let minT = 0;
      let maxT = Number.isFinite(video.duration) ? video.duration : video.currentTime;
      if (seekable && seekable.length > 0) {
        minT = seekable.start(0);
        maxT = seekable.end(seekable.length - 1);
      }
      if (maxT <= minT) return;
      const nextTime = Math.min(maxT, Math.max(minT, video.currentTime + deltaSeconds));
      video.currentTime = nextTime;
      syncSeekState();
      revealOsd(channelModalOpen || videoSettingsOpen || video.paused);
    },
    [activeChannel, channelModalOpen, revealOsd, syncSeekState, videoSettingsOpen],
  );

  const handleSeekTo = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      if (!video || !activeChannel) return;
      video.currentTime = targetTime;
      syncSeekState();
    },
    [activeChannel, syncSeekState],
  );

  const handleJumpLive = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;
    const seekable = video.seekable;
    if (seekable && seekable.length > 0) {
      const end = seekable.end(seekable.length - 1);
      video.currentTime = Math.max(seekable.start(0), end - 1);
    }
    if (video.playbackRate !== 1) {
      video.playbackRate = 1;
      setPlaybackRate(1);
    }
    if (video.paused) {
      video.play().catch(() => {});
    }
    syncSeekState();
  }, [activeChannel, syncSeekState]);

  const handleFullscreen = useCallback(() => {
    const el = playerBoxRef.current || videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setTheaterFullscreen(false);
    } else if (theaterFullscreen) {
      setTheaterFullscreen(false);
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        setTheaterFullscreen(true);
      });
    } else {
      setTheaterFullscreen(true);
    }
  }, [theaterFullscreen]);

  const handleChangeOrientation = useCallback((nextMode: 'auto' | 'portrait' | 'landscape') => {
    setOrientationMode(nextMode);
    try {
      window.localStorage.setItem('cengiztv_orientation_mode_v1', nextMode);
    } catch {
      // Ignore storage errors
    }
    const orientationApi = (
      screen as unknown as {
        orientation?: {
          lock?: (orientation: string) => Promise<void>;
          unlock?: () => void;
        };
      }
    ).orientation;
    try {
      if (nextMode === 'auto') {
        orientationApi?.unlock?.();
      } else {
        orientationApi?.lock?.(nextMode)?.catch?.(() => {});
      }
    } catch {
      // Ignore unsupported orientation lock errors
    }
  }, []);

  useEffect(() => {
    const syncViewportOrientation = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth);
    };
    syncViewportOrientation();
    window.addEventListener('resize', syncViewportOrientation);
    window.addEventListener('orientationchange', syncViewportOrientation);
    return () => {
      window.removeEventListener('resize', syncViewportOrientation);
      window.removeEventListener('orientationchange', syncViewportOrientation);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement;
      setIsFullscreen(Boolean(fsEl));
      setFullscreenHost(fsEl instanceof HTMLElement ? fsEl : null);
      if (!fsEl) {
        setTheaterFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, activeChannel]);

  useEffect(() => {
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (channelModalOpen) return;

      if (e.key === 'Escape') {
        if (videoSettingsOpen) {
          setVideoSettingsOpen(false);
          return;
        }
        if (theaterFullscreen && !document.fullscreenElement) {
          setTheaterFullscreen(false);
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT') return;

      if (e.key === 'ChannelUp' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        stepTvChannel(1);
        return;
      }
      if (e.key === 'ChannelDown' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        stepTvChannel(-1);
        return;
      }
      if ((e.key === ' ' || e.key === 'k' || e.key === 'K') && activeChannel && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        handleTogglePlay();
        return;
      }
      if ((e.key === 'j' || e.key === 'J') && activeChannel) {
        e.preventDefault();
        handleSeekBy(-10);
        return;
      }
      if ((e.key === 'l' || e.key === 'L') && activeChannel) {
        e.preventDefault();
        handleSeekBy(10);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setVideoSettingsOpen(false);
        setChannelModalOpen(true);
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFullscreen();
        return;
      }

      const activeIdx = cardRefs.current.findIndex((el) => el === document.activeElement);
      // Mi Box kumandasında ilk yön tuşu da kanal listesini odaklasın.
      if (activeIdx === -1 && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
        const firstChannel = cardRefs.current.find((el) => el && !el.disabled);
        if (firstChannel) {
          e.preventDefault();
          firstChannel.focus();
          firstChannel.scrollIntoView({ block: 'nearest' });
          return;
        }
      }
      if (activeIdx !== -1) {
        const cols = getColumnCount();
        let nextIdx = activeIdx;
        if (e.key === 'ArrowRight') nextIdx = Math.min(filteredChannels.length - 1, activeIdx + 1);
        else if (e.key === 'ArrowLeft') nextIdx = Math.max(0, activeIdx - 1);
        else if (e.key === 'ArrowDown')
          nextIdx = Math.min(filteredChannels.length - 1, activeIdx + cols);
        else if (e.key === 'ArrowUp') nextIdx = Math.max(0, activeIdx - cols);
        else return;

        if (nextIdx !== activeIdx) {
          e.preventDefault();
          cardRefs.current[nextIdx]?.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeChannel,
    channelModalOpen,
    filteredChannels.length,
    handleFullscreen,
    handleSeekBy,
    handleTogglePlay,
    stepTvChannel,
    theaterFullscreen,
    videoSettingsOpen,
  ]);

  useEffect(() => {
    return () => {
      if (osdTimerRef.current) window.clearTimeout(osdTimerRef.current);
      cleanupHls();
    };
  }, [cleanupHls]);

  const bufferDuration = Math.max(0, seekState.end - seekState.start);
  const liveDelaySec = Math.max(0, Math.round(seekState.end - seekState.current));
  const isAtLiveEdge = liveDelaySec <= 4;
  const videoFitClass =
    videoFit === 'cover' ? 'object-cover' : videoFit === 'fill' ? 'object-fill' : 'object-contain';
  const showPlayerOverlay =
    Boolean(activeChannel) &&
    (osdVisible || channelModalOpen || videoSettingsOpen || tvStatus === 'paused');

  return (
    <div className="space-y-6">
      {/* Mode Switcher: Türksat 4A Canlı Yayın vs EPG Yayın Akışı */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap p-1 rounded-xl border border-white/12 gap-1"
          style={{ backgroundColor: surfaceCardBg }}
        >
          <button
            type="button"
            onClick={() => setTvSourceMode('turksat')}
            className={`min-h-[40px] px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              tvSourceMode === 'turksat'
                ? 'bg-red-500 text-white'
                : 'text-[#B5BBC7] hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Türksat 4A Canlı Yayın</span>
          </button>

          <button
            type="button"
            onClick={() => setTvSourceMode('epg')}
            className={`min-h-[40px] px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              tvSourceMode === 'epg'
                ? 'bg-amber-500 text-[#120D05]'
                : 'text-[#B5BBC7] hover:text-white'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>EPG Yayın Akışı</span>
          </button>

          <button
            type="button"
            onClick={() => setTvSourceMode('matches')}
            className={`min-h-[40px] px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              tvSourceMode === 'matches'
                ? 'bg-emerald-500 text-[#06130C]'
                : 'text-[#B5BBC7] hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Maç Rehberi</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9BA1AE]">
          <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Sadece Türkçe · 18+ Kapalı</span>
          </span>
          <span aria-hidden="true" className="text-white/25">·</span>
          <span className="font-mono tabular-nums">
            {channels.length} Türksat 4A TV Kanalı
          </span>
        </div>
      </div>

      {/* 16:9 TV Screen + Selected Channel EPG Strip */}
      <section
        aria-label="Canlı TV Ekranı"
        className="border border-white/12 rounded-2xl p-4 sm:p-6 space-y-4 transition-colors duration-300"
        style={{ backgroundColor: surfaceCardBg }}
      >
        <div
          ref={playerBoxRef}
          onMouseMove={() => {
            if (activeChannel) {
              revealOsd(channelModalOpen || videoSettingsOpen || tvStatus === 'paused');
            }
          }}
          onClick={() => {
            if (!activeChannel) return;
            if (videoSettingsOpen) {
              setVideoSettingsOpen(false);
              return;
            }
            setChannelModalOpen(true);
          }}
          className={`${
            isPortraitExpanded
              ? `${
                  theaterFullscreen && !isFullscreen
                    ? 'fixed inset-0 z-40 w-screen h-dvh rounded-none'
                    : 'relative w-full h-full rounded-none'
                } flex flex-col bg-[#07090D]`
              : theaterFullscreen && !isFullscreen
                ? 'fixed inset-0 z-40 w-screen h-dvh rounded-none bg-black'
                : 'relative w-full aspect-video rounded-xl border border-white/10 bg-black'
          } overflow-hidden select-none cursor-pointer`}
        >
          {/* Video Stage (Top-docked in mobile portrait expanded mode so bottom channel sheet never covers playback) */}
          <div
            className={
              isPortraitExpanded
                ? 'relative w-full aspect-video max-h-[42dvh] shrink-0 bg-black mt-[env(safe-area-inset-top)] overflow-hidden border-b border-white/10'
                : 'relative w-full h-full'
            }
          >
            <video
              ref={videoRef}
              playsInline
              muted={muted}
              onPlaying={() => {
                setTvStatus('playing');
                setTvError(null);
                syncSeekState();
              }}
              onWaiting={() => setTvStatus('loading')}
              onPause={() => setTvStatus((s) => (s === 'idle' || s === 'error' ? s : 'paused'))}
              onTimeUpdate={syncSeekState}
              onProgress={syncSeekState}
              onLoadedMetadata={syncSeekState}
              onRateChange={() => {
                if (videoRef.current) setPlaybackRate(videoRef.current.playbackRate);
              }}
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
              }}
              className={`w-full h-full bg-black transition-all duration-200 ${videoFitClass}`}
            />

            {!activeChannel && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-4 sm:p-6 bg-gradient-to-t from-black/88 via-black/50 to-black/70 cursor-default"
              >
                <CengizBrandEmblem accentHex={theme.accentHex} className="w-12 h-12 sm:w-14 sm:h-14 mb-2 sm:mb-3" />
                <h1 className="text-xl sm:text-3xl font-bold text-white">
                  Cengiz TV · Türkçe Canlı Yayınlar
                </h1>
                <p className="text-xs sm:text-sm text-amber-300/90 font-medium mt-1">
                  Hazırlayan: Mehmet Cengiz Akdağ
                </p>
                <p className="text-xs sm:text-base text-[#B5BBC7] mt-2 max-w-lg hidden sm:block">
                  Türksat 4A kanallarını canlı EPG yayın akışıyla izleyebilir, ekrana tıklayarak kanal değiştirebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => startChannel(channels[0])}
                  className={`mt-4 sm:mt-5 min-h-[44px] sm:min-h-[48px] px-5 sm:px-6 rounded-xl font-semibold text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white transition-colors ${theme.ctaBg}`}
                >
                  {channels[0]?.name} İzlemeye Başla
                </button>
              </div>
            )}

            {/* Top Bar Over Active Video (Channel Name + Quick Buttons: Kanal Listesi & Video Ayarları) */}
            {activeChannel && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-2.5 sm:top-3 inset-x-2.5 sm:inset-x-3 z-20 flex items-center justify-between gap-2 transition-opacity duration-200 pointer-events-none ${
                  showPlayerOverlay || isPortraitExpanded ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
              >
                <div className="pointer-events-auto flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black/75 border border-white/15 backdrop-blur-sm min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-red-400 shrink-0">
                    {tvStatus === 'playing'
                      ? 'CANLI'
                      : tvStatus === 'paused'
                        ? 'DURAKLATILDI'
                        : 'YÜKLENİYOR'}
                  </span>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-[260px]">
                    {activeChannel.name}
                  </span>
                  <span className="hidden sm:inline text-[11px] font-mono text-amber-300 shrink-0">
                    · {activeHlsLabel}
                  </span>
                </div>

                <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {!isPortraitExpanded && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSettingsOpen(false);
                          setChannelModalOpen(true);
                        }}
                        className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm transition-colors ${
                          channelModalOpen
                            ? 'bg-amber-500 text-[#120D05] border-amber-400'
                            : 'bg-black/75 border-white/20 text-white hover:bg-black/90'
                        }`}
                        title="TV Kanal Listesini Aç (C)"
                      >
                        <ListVideo className="w-4 h-4" />
                        <span>Kanallar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChannelModalOpen(false);
                          setVideoSettingsOpen((prev) => {
                            const next = !prev;
                            revealOsd(next || tvStatus === 'paused');
                            return next;
                          });
                        }}
                        className={`min-h-[38px] min-w-[38px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm transition-colors ${
                          videoSettingsOpen
                            ? 'bg-sky-500 text-[#071219] border-sky-400'
                            : 'bg-black/75 border-white/20 text-white hover:bg-black/90'
                        }`}
                        aria-label="Video Gösterim Ayarları"
                        title="Video Gösterim ve Kalite Ayarları"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Görüntü</span>
                      </button>
                    </>
                  )}

                  {isAnyFullscreen && (
                    <button
                      type="button"
                      onClick={handleFullscreen}
                      className="min-h-[36px] sm:min-h-[38px] px-2.5 rounded-xl border bg-black/75 border-white/20 text-white hover:bg-black/90 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm transition-colors"
                      aria-label="Tam Ekrandan Çık"
                      title="Tam Ekrandan Çık (ESC)"
                    >
                      <Minimize2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Küçült</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeChannel && tvStatus === 'loading' && (
              <div className="absolute top-12 sm:top-14 left-3 z-10 px-3 py-1.5 rounded-lg bg-black/80 border border-white/15 text-xs text-white font-medium pointer-events-none">
                {activeChannel.name} yükleniyor...
              </div>
            )}

            {activeChannel && tvStatus === 'paused' && !channelModalOpen && !videoSettingsOpen && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/75 border border-white/25 flex items-center justify-center text-white shadow-xl">
                  <Pause className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
              </div>
            )}

            {tvError && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-3 sm:inset-x-4 bottom-3 sm:bottom-20 z-20 p-3 sm:p-4 rounded-xl bg-black/88 border border-rose-500/40 text-xs sm:text-sm text-rose-300 text-center flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 cursor-default"
                role="alert"
              >
                <span>{tvError}</span>
                <button
                  type="button"
                  onClick={() => stepTvChannel(1)}
                  className={`min-h-[38px] px-4 rounded-lg font-semibold text-xs ${theme.ctaBg}`}
                >
                  Sonraki Kanal
                </button>
              </div>
            )}
          </div>

          {/* 3-Second Broadcast Channel & EPG Overlay Card on Every Channel Switch */}
          <AnimatePresence>
            {zapBanner && (
              <motion.div
                key={`zap-${zapBanner.nonce}`}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`pointer-events-none absolute ${
                  isPortraitExpanded
                    ? 'bottom-4 left-3 right-3'
                    : showPlayerOverlay
                      ? 'bottom-28 sm:bottom-32 left-4 right-4 sm:left-8 sm:right-auto sm:w-[480px]'
                      : 'bottom-5 sm:bottom-8 left-4 right-4 sm:left-8 sm:right-auto sm:w-[480px]'
                } z-30 rounded-2xl bg-black/86 backdrop-blur-md border border-white/18 p-3.5 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden`}
                role="status"
                aria-live="polite"
              >
                {(() => {
                  const bannerEpg = getChannelEpg(zapBanner.channel);
                  const chIndex = channels.findIndex((c) => c.id === zapBanner.channel.id);
                  const chNo = String((chIndex >= 0 ? chIndex : 0) + 1).padStart(2, '0');
                  return (
                    <div className="space-y-2.5 sm:space-y-3">
                      <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                        <ChannelLogo
                          name={zapBanner.channel.name}
                          kind="tv"
                          category={zapBanner.channel.category}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-amber-300/90">
                            <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 font-bold text-amber-200">
                              CH {chNo}
                            </span>
                            <span className="text-[#CBD5E1]">{zapBanner.channel.resolution}</span>
                            <span aria-hidden="true" className="text-white/35">·</span>
                            <span className="text-red-400 font-bold">CANLI</span>
                          </div>
                          <h2 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-white truncate mt-0.5">
                            {zapBanner.channel.name}
                          </h2>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/12 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#9BA1AE]">
                          <span className="flex items-center gap-1.5 font-semibold text-emerald-300 uppercase tracking-wide">
                            <ProgramTypeIcon type={bannerEpg.current.category} size="xs" />
                            <span>Şu An Yayında</span>
                          </span>
                          <span className="font-mono tabular-nums text-white/80">
                            {bannerEpg.current.startTime} - {bannerEpg.current.endTime}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-amber-300 truncate">
                          {bannerEpg.current.title}
                        </p>
                        {bannerEpg.current.description && (
                          <p className="text-xs text-[#CBD5E1] line-clamp-1">
                            {bannerEpg.current.description}
                          </p>
                        )}
                        {typeof bannerEpg.current.progress === 'number' && (
                          <div className="w-full h-1.5 rounded-full bg-white/12 overflow-hidden mt-1">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-red-400"
                              style={{ width: `${bannerEpg.current.progress}%` }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-[#9BA1AE]">
                          <span className="truncate">
                            Sonraki: <strong className="text-white/90 font-medium">{bannerEpg.next.title}</strong>
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {bannerEpg.next.startTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Portrait Fullscreen Lower Control Deck (keeps video cleanly visible at top; bottom channel sheet slides over this deck) */}
          {isPortraitExpanded && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex flex-col justify-between overflow-y-auto p-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-b from-[#090C12] to-[#05070A] cursor-default space-y-3"
            >
              {/* Active Channel & EPG Card */}
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChannelLogo
                      name={activeChannel?.name || 'Cengiz TV'}
                      kind="tv"
                      category={activeChannel?.category || 'ulusal'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white truncate">
                        {activeChannel ? activeChannel.name : 'Kanal Seçilmedi'}
                      </h2>
                      <p className="text-[11px] text-[#9BA1AE] truncate">
                        {activeChannel ? `${activeChannel.resolution} · ${activeHlsLabel}` : 'Türksat 4A'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChangeOrientation('landscape')}
                    className="min-h-[34px] px-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-semibold text-white flex items-center gap-1.5 shrink-0"
                    title="Yatay Görünüme Geç"
                  >
                    <Monitor className="w-3.5 h-3.5 text-amber-300" />
                    <span>Yatay</span>
                  </button>
                </div>

                {activeChannel && selectedEpg && (
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-emerald-300 font-semibold truncate">
                        <ProgramTypeIcon type={selectedEpg.current.category} size="xs" />
                        <span className="truncate">{selectedEpg.current.title}</span>
                      </span>
                      <span className="font-mono text-[#9BA1AE] shrink-0">
                        {selectedEpg.current.startTime} - {selectedEpg.current.endTime}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9BA1AE] truncate">
                      Sonraki ({selectedEpg.next.startTime}): {selectedEpg.next.title}
                    </p>
                  </div>
                )}
              </div>

              {/* Timeline + Playback Controls */}
              <div className="space-y-3">
                {activeChannel && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleJumpLive}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase transition-colors ${
                        isAtLiveEdge
                          ? 'bg-red-600 text-white'
                          : 'bg-white/15 text-amber-300 hover:bg-amber-500 hover:text-black'
                      }`}
                    >
                      {isAtLiveEdge ? 'CANLI' : `CANLI (-${liveDelaySec}s)`}
                    </button>
                    <input
                      type="range"
                      min={seekState.start}
                      max={Math.max(seekState.start + 1, seekState.end)}
                      step={0.5}
                      value={Math.min(
                        Math.max(seekState.start + 1, seekState.end),
                        Math.max(seekState.start, seekState.current),
                      )}
                      onChange={(e) => handleSeekTo(Number(e.target.value))}
                      disabled={bufferDuration < 2}
                      aria-label="Yayın İleri Geri Çubuğu"
                      className="flex-1 h-1.5 accent-amber-400 cursor-pointer disabled:opacity-40"
                    />
                  </div>
                )}

                <div className="grid grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => stepTvChannel(-1)}
                    className="min-h-[42px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                    aria-label="Önceki Kanal"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSeekBy(-10)}
                    className="min-h-[42px] rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1"
                    aria-label="10 Saniye Geri Sar"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>-10</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className={`min-h-[42px] rounded-xl font-semibold text-xs flex items-center justify-center ${theme.ctaBg}`}
                    aria-label={tvStatus === 'playing' || tvStatus === 'loading' ? 'Durdur' : 'Oynat'}
                  >
                    {tvStatus === 'playing' || tvStatus === 'loading' ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSeekBy(10)}
                    className="min-h-[42px] rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1"
                    aria-label="10 Saniye İleri Sar"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>+10</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => stepTvChannel(1)}
                    className="min-h-[42px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                    aria-label="Sonraki Kanal"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoSettingsOpen(false);
                      setChannelModalOpen(true);
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-amber-500 text-[#120D05] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <ListVideo className="w-4 h-4" />
                    <span>Kanal Listesi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {muted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                    <span>{muted ? 'Sesi Aç' : 'Sessiz'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChannelModalOpen(false);
                      setVideoSettingsOpen((prev) => !prev);
                    }}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      videoSettingsOpen
                        ? 'bg-sky-500 text-[#071219]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Ayarlar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* In-Player Bottom OSD Control Bar (Normal & Landscape mode) */}
          {activeChannel && !isPortraitExpanded && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-200 cursor-default ${
                showPlayerOverlay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Seek / Buffer Timeline Bar */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <button
                  type="button"
                  onClick={handleJumpLive}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase transition-colors ${
                    isAtLiveEdge
                      ? 'bg-red-600 text-white'
                      : 'bg-white/15 text-amber-300 hover:bg-amber-500 hover:text-black'
                  }`}
                  title="Canlı yayın anına dön"
                >
                  {isAtLiveEdge ? 'CANLI' : `CANLIYA DÖN (-${liveDelaySec}s)`}
                </button>
                <input
                  type="range"
                  min={seekState.start}
                  max={Math.max(seekState.start + 1, seekState.end)}
                  step={0.5}
                  value={Math.min(
                    Math.max(seekState.start + 1, seekState.end),
                    Math.max(seekState.start, seekState.current),
                  )}
                  onChange={(e) => handleSeekTo(Number(e.target.value))}
                  disabled={bufferDuration < 2}
                  aria-label="Yayın İleri Geri Çubuğu"
                  className="flex-1 h-1.5 accent-amber-400 cursor-pointer disabled:opacity-40"
                />
                <span className="text-[11px] font-mono text-[#D1D5DB] shrink-0">
                  {bufferDuration >= 2 ? `${Math.round(bufferDuration)} sn tampon` : 'Canlı akış'}
                </span>
              </div>

              {/* OSD Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className={`min-h-[38px] px-3.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5 ${theme.ctaBg}`}
                    title="Durdur / Oynat (Boşluk)"
                  >
                    {tvStatus === 'playing' || tvStatus === 'loading' ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span className="hidden sm:inline">Durdur</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span className="hidden sm:inline">Oynat</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSeekBy(-10)}
                    className="min-h-[38px] px-2.5 rounded-xl bg-white/12 hover:bg-white/22 text-white text-xs font-semibold flex items-center gap-1"
                    title="10 Saniye Geri Sar (J)"
                    aria-label="10 Saniye Geri Sar"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>-10sn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSeekBy(10)}
                    className="min-h-[38px] px-2.5 rounded-xl bg-white/12 hover:bg-white/22 text-white text-xs font-semibold flex items-center gap-1"
                    title="10 Saniye İleri Sar (L)"
                    aria-label="10 Saniye İleri Sar"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>+10sn</span>
                  </button>

                  <div className="hidden md:flex items-center gap-1 pl-1 border-l border-white/15">
                    <button
                      type="button"
                      onClick={() => stepTvChannel(-1)}
                      className="min-h-[38px] min-w-[36px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                      title="Önceki Kanal"
                      aria-label="Önceki Kanal"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stepTvChannel(1)}
                      className="min-h-[38px] min-w-[36px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                      title="Sonraki Kanal"
                      aria-label="Sonraki Kanal"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-white/12 hover:bg-white/22 text-white flex items-center justify-center"
                    aria-label={muted ? 'Sesi Aç' : 'Sessize Al'}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setVolume(val);
                      if (val > 0 && muted) setMuted(false);
                    }}
                    aria-label="Ses Seviyesi"
                    className="hidden sm:block w-20 h-1.5 accent-white cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      handleChangeOrientation(
                        effectiveOrientation === 'portrait' ? 'landscape' : 'portrait',
                      )
                    }
                    className="min-h-[38px] px-2.5 rounded-xl bg-white/12 hover:bg-white/22 text-white text-xs font-semibold flex items-center gap-1"
                    title={
                      effectiveOrientation === 'portrait'
                        ? 'Yatay Görünüme Geç'
                        : 'Dikey Görünüme Geç'
                    }
                    aria-label="Yatay / Dikey Görünüm"
                  >
                    {effectiveOrientation === 'portrait' ? (
                      <Monitor className="w-4 h-4 text-amber-300" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-amber-300" />
                    )}
                    <span className="hidden lg:inline">
                      {effectiveOrientation === 'portrait' ? 'Yatay' : 'Dikey'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVideoSettingsOpen(false);
                      setChannelModalOpen(true);
                    }}
                    className="min-h-[38px] px-2.5 rounded-xl bg-white/12 hover:bg-white/22 text-white text-xs font-semibold flex items-center gap-1.5"
                    title="Kanal Listesini Aç"
                  >
                    <ListVideo className="w-4 h-4 text-amber-300" />
                    <span className="hidden sm:inline">Kanal Listesi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChannelModalOpen(false);
                      setVideoSettingsOpen((prev) => !prev);
                    }}
                    className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center transition-colors ${
                      videoSettingsOpen
                        ? 'bg-sky-500 text-[#071219]'
                        : 'bg-white/12 hover:bg-white/22 text-white'
                    }`}
                    aria-label="Video Gösterim Ayarları"
                    title="Video Gösterim Ayarları"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-white/12 hover:bg-white/22 text-white flex items-center justify-center"
                    aria-label={isAnyFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
                    title="Tam Ekran (F)"
                  >
                    {isAnyFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* In-Player Video Display & Quality Settings Popover */}
          {videoSettingsOpen && activeChannel && (
            <div
              onClick={(e) => e.stopPropagation()}
              aria-label="Video Gösterim Ayarları"
              className={`absolute z-30 overflow-y-auto rounded-2xl bg-[#0B0E14]/95 border border-white/18 backdrop-blur-md p-4 space-y-3.5 text-xs cursor-default shadow-2xl ${
                isPortraitExpanded
                  ? 'left-3 right-3 bottom-3 max-h-[52dvh]'
                  : 'right-3 bottom-24 w-[calc(100%-24px)] sm:w-80 max-h-[75%]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                  <span>Video Gösterim Ayarları</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVideoSettingsOpen(false)}
                  className="min-h-[28px] min-w-[28px] rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  aria-label="Ayarları Kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ekran Yönü: Otomatik / Yatay / Dikey */}
              <div className="space-y-1.5">
                <span className="text-[#9BA1AE] font-semibold block">Ekran Yönü (Yatay / Dikey)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'auto' as const, label: 'Otomatik' },
                    { id: 'landscape' as const, label: 'Yatay' },
                    { id: 'portrait' as const, label: 'Dikey' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChangeOrientation(opt.id)}
                      className={`py-1.5 px-2 rounded-lg border font-medium transition-colors ${
                        orientationMode === opt.id
                          ? 'bg-amber-500 text-[#120D05] border-amber-400 font-semibold'
                          : 'bg-white/5 border-white/12 text-[#D1D5DB] hover:bg-white/12'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ekran Sığdırma */}
              <div className="space-y-1.5">
                <span className="text-[#9BA1AE] font-semibold block">Ekran Sığdırma / Oran</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'contain' as const, label: 'Sığdır' },
                    { id: 'cover' as const, label: 'Doldur' },
                    { id: 'fill' as const, label: '16:9 Yay' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVideoFit(opt.id)}
                      className={`py-1.5 px-2 rounded-lg border font-medium transition-colors ${
                        videoFit === opt.id
                          ? 'bg-sky-500 text-[#071219] border-sky-400 font-semibold'
                          : 'bg-white/5 border-white/12 text-[#D1D5DB] hover:bg-white/12'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Görüntü Modu Hazır Ayarlar */}
              <div className="space-y-1.5">
                <span className="text-[#9BA1AE] font-semibold block">Görüntü Profili</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Normal', b: 100, c: 100, s: 100 },
                    { label: 'Canlı', b: 108, c: 115, s: 122 },
                    { label: 'Gece', b: 84, c: 96, s: 90 },
                    { label: 'Sinema', b: 95, c: 112, s: 105 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setBrightness(preset.b);
                        setContrast(preset.c);
                        setSaturate(preset.s);
                      }}
                      className={`py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                        brightness === preset.b && contrast === preset.c
                          ? 'bg-amber-500 text-[#120D05] border-amber-400 font-semibold'
                          : 'bg-white/5 border-white/12 text-[#D1D5DB] hover:bg-white/12'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parlaklık & Kontrast */}
              <div className="space-y-2">
                <label className="block space-y-1">
                  <div className="flex justify-between text-[#D1D5DB]">
                    <span>Parlaklık</span>
                    <span className="font-mono">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={140}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full h-1.5 accent-sky-400 cursor-pointer"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex justify-between text-[#D1D5DB]">
                    <span>Kontrast</span>
                    <span className="font-mono">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={75}
                    max={140}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full h-1.5 accent-sky-400 cursor-pointer"
                  />
                </label>
              </div>

              {/* Oynatma Hızı */}
              <div className="space-y-1.5">
                <span className="text-[#9BA1AE] font-semibold block">Oynatma Hızı</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0.5, 1, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setPlaybackRate(rate)}
                      className={`py-1.5 rounded-lg border font-mono text-[11px] transition-colors ${
                        playbackRate === rate
                          ? 'bg-emerald-500 text-[#051811] border-emerald-400 font-bold'
                          : 'bg-white/5 border-white/12 text-[#D1D5DB] hover:bg-white/12'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* HLS Yayın Kalitesi */}
              {hlsLevels.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[#9BA1AE] font-semibold block">HLS Çözünürlük</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedHlsLevel(-1);
                        if (hlsRef.current) hlsRef.current.nextLevel = -1;
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                        selectedHlsLevel === -1
                          ? 'bg-amber-500 text-[#120D05] border-amber-400 font-semibold'
                          : 'bg-white/5 border-white/12 text-[#D1D5DB]'
                      }`}
                    >
                      Oto
                    </button>
                    {hlsLevels.map((lvl) => (
                      <button
                        key={`set-lvl-${lvl.index}`}
                        type="button"
                        onClick={() => {
                          setSelectedHlsLevel(lvl.index);
                          if (hlsRef.current) hlsRef.current.nextLevel = lvl.index;
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                          selectedHlsLevel === lvl.index
                            ? 'bg-amber-500 text-[#120D05] border-amber-400 font-semibold'
                            : 'bg-white/5 border-white/12 text-[#D1D5DB]'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    handleChangeOrientation('auto');
                    setVideoFit('contain');
                    setBrightness(100);
                    setContrast(100);
                    setSaturate(100);
                    setPlaybackRate(1);
                  }}
                  className="text-[11px] text-[#9BA1AE] hover:text-white underline"
                >
                  Görüntüyü Sıfırla
                </button>
                {onToggleLowBandwidth && (
                  <button
                    type="button"
                    onClick={onToggleLowBandwidth}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                      lowBandwidthMode
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-white/8 border-white/15 text-[#D1D5DB]'
                    }`}
                  >
                    {lowBandwidthMode ? 'Zayıf Net: Açık' : 'Zayıf Net Modu'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* TV Player Controls Bar with Channel Badge + Current EPG Program */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <ChannelLogo
              name={activeChannel?.name || 'Cengiz TV'}
              kind="tv"
              category={activeChannel?.category || 'ulusal'}
              size="lg"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white truncate">
                  {activeChannel ? activeChannel.name : 'Kanal Seçilmedi'}
                </h2>
                {activeChannel && selectedEpg && (
                  <ProgramTypeIcon type={selectedEpg.current.category} showLabel size="xs" />
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#B5BBC7] truncate">
                {activeChannel && selectedEpg
                  ? `Yayında (${selectedEpg.current.startTime}-${selectedEpg.current.endTime}): ${selectedEpg.current.title} · Sonraki: ${selectedEpg.next.title}`
                  : `Türksat 4A · ${channels.length} canlı Türkçe TV kanalı hazır`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => stepTvChannel(-1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#0D0F12]/90 border border-white/12 text-white hover:bg-white/10"
              aria-label="Önceki TV Kanalı"
              title="Önceki TV Kanalı"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {activeChannel && (
              <>
                <button
                  type="button"
                  onClick={() => handleSeekBy(-10)}
                  className="min-h-[44px] px-3 flex items-center justify-center gap-1 rounded-xl bg-[#0D0F12]/90 border border-white/12 text-xs font-semibold text-white hover:bg-white/10"
                  aria-label="10 Saniye Geri Sar"
                  title="10 Saniye Geri Sar (J)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>-10sn</span>
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className={`min-h-[44px] px-4 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors ${theme.ctaBg}`}
                >
                  {tvStatus === 'playing' || tvStatus === 'loading' ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Durdur</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Oynat</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSeekBy(10)}
                  className="min-h-[44px] px-3 flex items-center justify-center gap-1 rounded-xl bg-[#0D0F12]/90 border border-white/12 text-xs font-semibold text-white hover:bg-white/10"
                  aria-label="10 Saniye İleri Sar"
                  title="10 Saniye İleri Sar (L)"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>+10sn</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => stepTvChannel(1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#0D0F12]/90 border border-white/12 text-white hover:bg-white/10"
              aria-label="Sonraki TV Kanalı"
              title="Sonraki TV Kanalı"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {activeChannel && (
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#0D0F12]/90 border border-white/12 text-white hover:bg-white/10"
                aria-label={muted ? 'Sesi Aç' : 'Sessize Al'}
              >
                {muted ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setVideoSettingsOpen(false);
                setChannelModalOpen(true);
              }}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                channelModalOpen
                  ? 'bg-amber-500 text-[#120D05] border-amber-400'
                  : 'bg-[#0D0F12]/90 border-white/12 text-white hover:bg-white/10'
              }`}
              title="Ekran üzeri Kanal Listesini Aç (C)"
            >
              <ListVideo className="w-4 h-4 text-amber-300" />
              <span>Kanal Listesi</span>
            </button>

            {activeChannel && (
              <button
                type="button"
                onClick={() => {
                  setChannelModalOpen(false);
                  setVideoSettingsOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      playerBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    return next;
                  });
                }}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                  videoSettingsOpen
                    ? 'bg-sky-500 text-[#071219] border-sky-400'
                    : 'bg-[#0D0F12]/90 border-white/12 text-white hover:bg-white/10'
                }`}
                aria-label="Video Gösterim Ayarları"
                title="Ekran Sığdırma, Parlaklık, Hız ve Kalite Ayarları"
              >
                <Settings className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Görüntü Ayarları</span>
              </button>
            )}

            {onToggleLowBandwidth && (
              <button
                type="button"
                onClick={onToggleLowBandwidth}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors ${
                  lowBandwidthMode
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-[#0D0F12]/90 border-white/12 text-[#D1D5DB] hover:bg-white/10'
                }`}
                title="Zayıf internette donmayı önlemek için düşük HLS veri modunu aç/kapat"
              >
                <Wifi className="w-4 h-4" />
                <span>{lowBandwidthMode ? 'Zayıf Net: Açık' : activeHlsLabel}</span>
              </button>
            )}

            {hlsLevels.length > 1 && (
              <select
                value={selectedHlsLevel}
                onChange={(e) => {
                  const lvl = Number(e.target.value);
                  selectedHlsLevelRef.current = lvl;
                  setSelectedHlsLevel(lvl);
                  if (hlsRef.current) {
                    hlsRef.current.nextLevel = lvl;
                  }
                }}
                aria-label="HLS Yayın Kalitesi"
                className="min-h-[44px] px-3 rounded-xl bg-[#0D0F12]/90 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value={-1}>Oto Kalite</option>
                {hlsLevels.map((lvl) => (
                  <option key={lvl.index} value={lvl.index}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            )}

            {onSwitchToRadio && (
              <button
                type="button"
                onClick={() => {
                  cleanupHls();
                  onSwitchToRadio();
                }}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-500/18 border border-emerald-400/60 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/28 flex items-center gap-2 transition-colors"
                title={activeRadioName ? `Radyoya geç (${activeRadioName})` : 'Canlı Radyoya Geç'}
              >
                <Radio className="w-4 h-4" />
                <span>Radyoya Geç</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                handleChangeOrientation(
                  orientationMode === 'auto'
                    ? effectiveOrientation === 'portrait'
                      ? 'landscape'
                      : 'portrait'
                    : orientationMode === 'landscape'
                      ? 'portrait'
                      : 'auto',
                )
              }
              className="min-h-[44px] px-3.5 rounded-xl bg-[#0D0F12]/90 border border-white/12 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
              title="Ekran Yönünü Değiştir (Otomatik / Yatay / Dikey)"
              aria-label="Ekran Yönünü Değiştir"
            >
              {effectiveOrientation === 'portrait' ? (
                <Smartphone className="w-4 h-4 text-amber-300" />
              ) : (
                <Monitor className="w-4 h-4 text-amber-300" />
              )}
              <span>
                {orientationMode === 'auto'
                  ? 'Oto Yön'
                  : orientationMode === 'landscape'
                    ? 'Yatay'
                    : 'Dikey'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              className="min-h-[44px] px-4 rounded-xl bg-[#0D0F12]/90 border border-white/12 text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
            >
              {isAnyFullscreen ? (
                <Minimize2 className={`w-4 h-4 ${theme.textAccent}`} />
              ) : (
                <Maximize2 className={`w-4 h-4 ${theme.textAccent}`} />
              )}
              <span>{isAnyFullscreen ? 'Çıkış' : 'Tam Ekran'}</span>
            </button>
          </div>
        </div>

        {/* Selected Channel Daily EPG Timeline Strip */}
        {selectedEpg && (
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs text-[#9BA1AE]">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                <span>
                  {selectedEpg.channelName} · Günlük EPG Yayın Akışı
                  {!activeChannel ? ' (Önizleme)' : ''}
                </span>
              </span>
              <span>TSİ · Programa özel simgeler</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {selectedEpg.schedule.slice(0, 4).map((slot, idx) => (
                <div
                  key={`${slot.startTime}-${idx}`}
                  className={`rounded-xl p-2.5 border flex flex-col justify-between gap-1.5 ${
                    slot.isLive
                      ? 'bg-amber-500/12 border-amber-400/60'
                      : 'bg-[#0D0F12]/80 border-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono tabular-nums text-[#B5BBC7]">
                      {slot.startTime} - {slot.endTime}
                    </span>
                    <ProgramTypeIcon type={slot.category} size="xs" />
                  </div>
                  <p className="text-xs font-semibold text-white line-clamp-1">{slot.title}</p>
                  {slot.isLive && typeof slot.progress === 'number' && (
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${slot.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {tvSourceMode === 'matches' ? (
        <MatchSchedulePanel
          channels={channels}
          onPlayChannel={(ch) => {
            startChannel(ch);
            playerBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }}
          surfaceCardBg={surfaceCardBg}
        />
      ) : tvSourceMode === 'epg' ? (
        <section aria-label="Tüm Kanallar EPG Yayın Akışı Rehberi" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">
                Canlı EPG Yayın Akışı Rehberi ({filteredChannels.length} Kanal)
              </h3>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#9BA1AE] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (tvVoiceStatus) setTvVoiceStatus(null);
                }}
                placeholder="EPG rehberinde kanal ara..."
                className="w-full min-h-[42px] pl-11 pr-12 rounded-xl bg-[#141820]/95 border border-white/12 text-sm text-white placeholder:text-[#8C93A3] focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <VoiceSearchButton
                  onResult={(txt) => setSearch(txt)}
                  onListeningChange={(active) =>
                    setTvVoiceStatus(active ? 'Dinleniyor... TV kanalı adını söyleyin.' : null)
                  }
                  onError={(msg) => setTvVoiceStatus(msg)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {filteredChannels.slice(0, 40).map((ch) => {
              const epg = getChannelEpg(ch);
              const isPlaying = activeChannel?.id === ch.id;
              return (
                <div
                  key={`epg-${ch.id}`}
                  className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${
                    isPlaying ? theme.cardBorder : 'border-white/10 hover:border-white/25'
                  }`}
                  style={!isPlaying ? { backgroundColor: surfaceCardBg } : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ChannelLogo name={ch.name} kind="tv" category={ch.category} size="md" />
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white truncate">{ch.name}</h4>
                        <p className="text-xs text-[#9BA1AE]">
                          {ch.satellite} · {ch.resolution}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startChannel(ch)}
                      className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 ${theme.ctaBg}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>İzle</span>
                    </button>
                  </div>

                  {/* Current + Next Programs with Program-Specific Icons */}
                  <div className="space-y-2 pt-2 border-t border-white/8">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProgramTypeIcon type={epg.current.category} size="xs" />
                        <span className="text-xs font-semibold text-white truncate">
                          {epg.current.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-300 shrink-0">
                        {epg.current.startTime} - {epg.current.endTime}
                      </span>
                    </div>
                    {typeof epg.current.progress === 'number' && (
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${epg.current.progress}%` }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-xs text-[#9BA1AE]">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProgramTypeIcon type={epg.next.category} size="xs" />
                        <span className="truncate">Sonraki: {epg.next.title}</span>
                      </div>
                      <span className="font-mono shrink-0">{epg.next.startTime}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-label="TV Kanal Listesi" className="space-y-4">
          {recentChannels.length > 0 && (
            <div
              className="rounded-2xl border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ backgroundColor: surfaceCardBg }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-300 shrink-0">
                <Clock className="w-4 h-4" />
                <span>Son İzlenen TV</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1">
                {recentChannels.slice(0, 6).map((rc) => {
                  const isCurrent = activeChannel?.id === rc.id;
                  return (
                    <button
                      key={`recent-tv-${rc.id}`}
                      type="button"
                      onClick={() => startChannel(rc)}
                      className={`min-h-[36px] px-3 rounded-xl border text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                        isCurrent
                          ? 'bg-teal-400/20 border-teal-300 text-teal-200'
                          : 'bg-[#0D0F12]/90 border-white/10 text-[#E5E7EB] hover:border-teal-400/60 hover:text-white'
                      }`}
                    >
                      <ChannelLogo name={rc.name} kind="tv" category={rc.category} size="sm" />
                      <span>{rc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {TV_CATEGORIES.map((cat) => {
                const catTheme = TV_CATEGORY_THEMES[cat.id];
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`min-h-[44px] px-4 rounded-xl text-sm font-medium border transition-colors duration-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 ${catTheme.ringClass} ${
                      isSelected
                        ? catTheme.tabActive
                        : 'bg-[#141820]/90 text-[#D1D5DB] border-white/10 hover:bg-[#1E2430]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1 w-full lg:w-80 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-[#9BA1AE] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (tvVoiceStatus) setTvVoiceStatus(null);
                  }}
                  placeholder="TV kanalı ara..."
                  className="w-full min-h-[44px] pl-11 pr-12 rounded-xl bg-[#141820]/95 border border-white/12 text-sm text-white placeholder:text-[#8C93A3] focus:outline-none focus:ring-2 focus:ring-white/60"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <VoiceSearchButton
                    onResult={(txt) => setSearch(txt)}
                    onListeningChange={(active) =>
                      setTvVoiceStatus(active ? 'Dinleniyor... TV kanalı adını söyleyin.' : null)
                    }
                    onError={(msg) => setTvVoiceStatus(msg)}
                  />
                </div>
              </div>
              {tvVoiceStatus && (
                <p className="text-xs text-amber-300" role="status">
                  {tvVoiceStatus}
                </p>
              )}
            </div>
          </div>

          {filteredChannels.length === 0 && (
            <div
              className="rounded-2xl border border-white/10 p-8 text-center space-y-3"
              style={{ backgroundColor: surfaceCardBg }}
            >
              <p className="text-sm text-[#D1D5DB]">
                {category === 'recent'
                  ? 'Henüz son izlenen TV kanalı yok.'
                  : 'Aramanıza uygun TV kanalı bulunamadı.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setSearch('');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-400"
              >
                Tüm TV Kanallarını Göster
              </button>
            </div>
          )}

          {category === 'spor' && (
            <div
              className="rounded-2xl border border-emerald-500/35 p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ backgroundColor: surfaceCardBg }}
            >
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#E5E7EB]">
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Bugün hangi kanalda hangi maç var ve saat kaçta başlıyor öğrenmek için Maç Rehberi’ni açın.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTvSourceMode('matches')}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#06130C] text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Maç Rehberini Aç</span>
              </button>
            </div>
          )}

          <motion.div
            key={category}
            initial={{ opacity: 0.35, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5"
          >
            {filteredChannels.map((ch, idx) => {
              const isSelected = activeChannel?.id === ch.id;
              const epg = getChannelEpg(ch);
              return (
                <button
                  key={ch.id}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => startChannel(ch)}
                  className={`relative text-left p-4 rounded-2xl border transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out transform-gpu motion-reduce:transition-none motion-reduce:focus-visible:scale-100 focus-visible:z-10 focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:shadow-xl focus-visible:ring-3 ${theme.ringClass} min-h-[136px] flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? `${theme.cardBorder} focus-visible:border-amber-300`
                      : 'border-white/10 hover:border-white/25 hover:bg-[#1B202C] focus-visible:border-white/80 focus-visible:bg-[#1E2636]'
                  }`}
                  style={!isSelected ? { backgroundColor: surfaceCardBg } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <ChannelLogo name={ch.name} kind="tv" category={ch.category} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#9BA1AE]">
                        <span className="font-mono tabular-nums text-[#8C93A3]">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{ch.resolution}</span>
                      </div>
                      <h3 className="text-base font-semibold text-white truncate mt-0.5">
                        {ch.name}
                      </h3>
                    </div>
                  </div>

                  {/* Live EPG Program Line with Program-Specific Icon */}
                  <div className="space-y-1.5 pt-2 border-t border-white/8 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <ProgramTypeIcon type={epg.current.category} size="xs" />
                      <span className="text-xs text-[#D1D5DB] truncate flex-1">
                        {epg.current.title}
                      </span>
                      <span className="text-[10px] font-mono text-[#9BA1AE] shrink-0">
                        {epg.current.startTime}
                      </span>
                    </div>
                    {typeof epg.current.progress === 'number' && (
                      <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${epg.current.progress}%`,
                            backgroundColor: isSelected ? theme.accentHex : '#F59E0B',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </section>
      )}

      <TvChannelListModal
        open={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
        channels={channels}
        activeChannel={activeChannel}
        categories={TV_CATEGORIES}
        getChannelEpg={getChannelEpg}
        onSelectChannel={startChannel}
        fullscreenContainer={fullscreenHost}
        recentChannelIds={recentChannels.map((c) => c.id)}
        orientationMode={orientationMode}
        activeTheme={activeTheme}
      />
    </div>
  );
}

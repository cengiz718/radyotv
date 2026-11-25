import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { RadioStation } from '../types.ts';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface UseRadioPlayerOptions {
  stations: RadioStation[];
  initialStationId?: string;
  lowBandwidthMode?: boolean;
}

const MAX_RETRIES = 2;
const CONNECT_TIMEOUT_MS = 10000;

export function useRadioPlayer({
  stations,
  initialStationId,
  lowBandwidthMode = false,
}: UseRadioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const stationsRef = useRef<RadioStation[]>(stations);
  stationsRef.current = stations;

  const activeStationRef = useRef<RadioStation | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const connectTimerRef = useRef<number | null>(null);
  const manualPauseRef = useRef(false);

  const [currentStation, setCurrentStation] = useState<RadioStation | null>(() => {
    if (initialStationId) {
      return stations.find((s) => s.id === initialStationId) ?? stations[0] ?? null;
    }
    return stations[0] ?? null;
  });
  activeStationRef.current = currentStation;

  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('radyokutu_volume');
    return saved ? Math.min(1, Math.max(0, Number(saved))) : 0.85;
  });
  const [muted, setMuted] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (connectTimerRef.current !== null) {
      window.clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        audioCtxRef.current = new AudioContextCtor();
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      if (!analyserRef.current && audioCtxRef.current) {
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        analyserRef.current = analyser;
      }

      if (!sourceNodeRef.current && audioCtxRef.current && analyserRef.current) {
        const source = audioCtxRef.current.createMediaElementSource(audio);
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
        sourceNodeRef.current = source;
      }
    } catch {
      // Native audio continues unaffected if Web Audio fails on restricted hardware
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    clearTimers();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [clearTimers]);

  const startStream = useCallback(
    (station: RadioStation, isRetry = false, forceHlsProxy = false) => {
      const audio = audioRef.current;
      if (!audio) return;

      manualPauseRef.current = false;
      if (!isRetry) {
        retryCountRef.current = 0;
      }

      ensureAudioGraph();
      cleanupMedia();
      setStatus('loading');
      setErrorMessage(null);

      // Detect weak network via Network Information API when available
      const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
      const isWeakNet =
        lowBandwidthMode ||
        Boolean(conn?.saveData) ||
        conn?.effectiveType === '2g' ||
        conn?.effectiveType === '3g' ||
        conn?.effectiveType === 'slow-2g';

      // Longer connection timeout guard on weak connections
      connectTimerRef.current = window.setTimeout(() => {
        setStatus((curr) => {
          if (curr === 'loading') {
            setErrorMessage('Yayın zaman aşımına uğradı. Sonraki kanalı deneyebilirsiniz.');
            return 'error';
          }
          return curr;
        });
      }, isWeakNet ? 18000 : CONNECT_TIMEOUT_MS);

      const isHls =
        station.format === 'HLS' || station.streamUrl.toLowerCase().includes('.m3u8');

      if (isHls) {
        const useProxy =
          forceHlsProxy || Boolean(station.needsProxy) || station.streamUrl.startsWith('http://');
        const hlsUrl = useProxy
          ? `/api/hls?url=${encodeURIComponent(station.streamUrl)}`
          : station.streamUrl;

        if (Hls.isSupported()) {
          let networkRecoveryTries = 0;
          let mediaRecoveryTries = 0;
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: isWeakNet ? 0 : -1,
            abrEwmaDefaultEstimate: isWeakNet ? 64000 : 192000,
            maxBufferLength: isWeakNet ? 40 : 28,
            maxMaxBufferLength: isWeakNet ? 80 : 50,
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
          hls.loadSource(hlsUrl);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (isWeakNet && hls.levels.length > 1) {
              hls.currentLevel = 0;
            }
            ensureAudioGraph();
            audio.play().catch(() => {
              setStatus('paused');
            });
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (!useProxy) {
                startStream(station, true, true);
                return;
              }
              if (networkRecoveryTries < 3) {
                networkRecoveryTries += 1;
                if (hls.levels.length > 1) hls.currentLevel = 0;
                window.setTimeout(() => {
                  if (!manualPauseRef.current && hlsRef.current === hls) {
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

            clearTimers();
            setStatus('error');
            setErrorMessage('Bu yayın şu anda yanıt vermiyor. Başka bir kanal seçin.');
          });
          return;
        }
        if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.crossOrigin = 'anonymous';
          audio.src = hlsUrl;
          audio.play().catch(() => setStatus('paused'));
          return;
        }
      }

      // Route MP3/AAC streams via same-origin proxy so Web Audio AnalyserNode has zero CORS blocks
      audio.src = `/api/stream?url=${encodeURIComponent(station.streamUrl)}`;
      audio.play().catch(() => {
        setStatus('paused');
      });
    },
    [cleanupMedia, clearTimers, ensureAudioGraph, lowBandwidthMode],
  );

  const playStation = useCallback(
    (station: RadioStation) => {
      setCurrentStation(station);
      activeStationRef.current = station;
      localStorage.setItem('radyokutu_last_station', station.id);
      startStream(station, false);
    },
    [startStream],
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!currentStation) return;

    if (status === 'playing' || status === 'loading') {
      manualPauseRef.current = true;
      clearTimers();
      if (audio) audio.pause();
      setStatus('paused');
      return;
    }

    manualPauseRef.current = false;
    ensureAudioGraph();

    if (audio && audio.src && status === 'paused') {
      setStatus('loading');
      setErrorMessage(null);
      audio.play().catch(() => {
        startStream(currentStation, false);
      });
    } else {
      startStream(currentStation, false);
    }
  }, [clearTimers, currentStation, ensureAudioGraph, startStream, status]);

  const stepStation = useCallback(
    (direction: 1 | -1, list?: RadioStation[]) => {
      const targetList = list && list.length > 0 ? list : stationsRef.current;
      if (targetList.length === 0) return;
      const idx = currentStation ? targetList.findIndex((s) => s.id === currentStation.id) : -1;
      const nextIdx = idx === -1 ? 0 : (idx + direction + targetList.length) % targetList.length;
      playStation(targetList[nextIdx]);
    },
    [currentStation, playStation],
  );

  const cycleSleepTimer = useCallback(() => {
    const options: Array<number | null> = [null, 15, 30, 60];
    const currentIdx = options.indexOf(sleepMinutes);
    const next = options[(currentIdx + 1) % options.length];
    setSleepMinutes(next);
    setSleepSecondsLeft(next ? next * 60 : null);
  }, [sleepMinutes]);

  // Attach core HTMLAudioElement listeners once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume;
    audio.muted = muted;
    audioRef.current = audio;

    const onPlaying = () => {
      clearTimers();
      retryCountRef.current = 0;
      setStatus('playing');
      setErrorMessage(null);
    };
    const onWaiting = () => {
      if (!manualPauseRef.current) {
        setStatus((prev) => (prev === 'paused' ? 'paused' : 'loading'));
      }
    };
    const onPause = () => {
      clearTimers();
      setStatus((prev) => (prev === 'idle' || prev === 'error' ? prev : 'paused'));
    };
    const onError = () => {
      clearTimers();
      if (manualPauseRef.current) return;

      const active = activeStationRef.current;
      if (active && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setStatus('loading');
        retryTimerRef.current = window.setTimeout(() => {
          if (!manualPauseRef.current && activeStationRef.current?.id === active.id) {
            startStream(active, true);
          }
        }, 1200 * retryCountRef.current);
        return;
      }

      setStatus('error');
      setErrorMessage('Yayın bağlantısı kurulamadı. Sonraki kanalı deneyebilirsiniz.');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      cleanupMedia();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync volume & mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
    localStorage.setItem('radyokutu_volume', String(volume));
  }, [volume, muted]);

  // Sleep timer tick
  useEffect(() => {
    if (sleepSecondsLeft === null) return;
    if (sleepSecondsLeft <= 0) {
      manualPauseRef.current = true;
      if (audioRef.current) audioRef.current.pause();
      setStatus('paused');
      setSleepMinutes(null);
      setSleepSecondsLeft(null);
      return;
    }
    const timer = window.setInterval(() => {
      setSleepSecondsLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepSecondsLeft]);

  // Android TV / Mi Box Media Session API integration
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentStation) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStation.name,
      artist: `Türkçe · ${currentStation.genre}`,
      album: 'Cengiz TV & Radyo',
    });
    navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : 'paused';
  }, [currentStation, status]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', togglePlayPause);
    navigator.mediaSession.setActionHandler('pause', togglePlayPause);
    navigator.mediaSession.setActionHandler('previoustrack', () => stepStation(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => stepStation(1));
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [stepStation, togglePlayPause]);

  return {
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
    playStation,
    togglePlayPause,
    stepStation,
    cycleSleepTimer,
  };
}

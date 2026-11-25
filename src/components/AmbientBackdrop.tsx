import { useEffect, useRef, useState } from 'react';
import { FIREPLACE_SCENE, LANDSCAPE_SCENES } from '../data/stations.ts';
import type { BackgroundMode, LandscapeItem } from '../types.ts';

interface AmbientBackdropProps {
  mode: BackgroundMode;
  immersive: boolean;
  activeLandscape: LandscapeItem;
  paused?: boolean;
  enableEmbers?: boolean;
  pageBg?: string;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

function resolveBackdropSrc(imageUrl: string): string {
  if (imageUrl.startsWith('/')) return imageUrl;
  return `/api/backdrop?url=${encodeURIComponent(imageUrl)}`;
}

export function AmbientBackdrop({
  mode,
  immersive,
  activeLandscape,
  paused = false,
  enableEmbers = true,
  pageBg = '#0D0F12',
}: AmbientBackdropProps) {
  const [displayedSrc, setDisplayedSrc] = useState<string>(() =>
    resolveBackdropSrc(activeLandscape.imageUrl),
  );
  const [previousSrc, setPreviousSrc] = useState<string | null>(null);
  const [fireplaceFailed, setFireplaceFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preload next Full HD landscape before crossfading, then release previous bitmap from RAM
  useEffect(() => {
    if (mode !== 'landscapes') return;
    const nextSrc = resolveBackdropSrc(activeLandscape.imageUrl);
    if (nextSrc === displayedSrc) return;

    let cancelled = false;
    let releaseTimer: number | undefined;
    const loader = new Image();
    loader.referrerPolicy = 'no-referrer';
    loader.onload = () => {
      if (cancelled) return;
      setPreviousSrc(displayedSrc);
      setDisplayedSrc(nextSrc);
      releaseTimer = window.setTimeout(() => {
        if (!cancelled) setPreviousSrc(null);
      }, 1050);
    };
    loader.onerror = () => {
      if (cancelled) return;
      const fallback = LANDSCAPE_SCENES[Math.floor(Math.random() * LANDSCAPE_SCENES.length)].imageUrl;
      setPreviousSrc(displayedSrc);
      setDisplayedSrc(fallback);
      releaseTimer = window.setTimeout(() => {
        if (!cancelled) setPreviousSrc(null);
      }, 1050);
    };
    loader.src = nextSrc;

    return () => {
      cancelled = true;
      if (releaseTimer) window.clearTimeout(releaseTimer);
    };
  }, [activeLandscape.imageUrl, displayedSrc, mode]);

  // Low-RAM throttled (~24fps) ember canvas for Fireplace mode; pauses when tab hidden or TV active
  useEffect(() => {
    if (mode !== 'fireplace' || paused || !enableEmbers) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = 0;
    const embers: Ember[] = [];

    const resize = () => {
      canvas.width = Math.min(1280, window.innerWidth);
      canvas.height = Math.min(720, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnEmber = () => {
      const w = canvas.width;
      const h = canvas.height;
      embers.push({
        x: w * 0.62 + (Math.random() - 0.5) * (w * 0.16),
        y: h * 0.68 + (Math.random() - 0.5) * (h * 0.08),
        vx: (Math.random() - 0.5) * 0.45,
        vy: -(0.5 + Math.random() * 0.9),
        size: 1.2 + Math.random() * 2.0,
        alpha: 0.4 + Math.random() * 0.45,
        life: 0,
        maxLife: 60 + Math.random() * 75,
      });
    };

    const tick = (now: number) => {
      if (document.hidden) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      if (now - lastTime < 42) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (embers.length < 20 && Math.random() < 0.35) {
        spawnEmber();
      }

      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life += 1;
        e.x += e.vx + Math.sin(e.life * 0.06) * 0.25;
        e.y += e.vy;

        const progress = e.life / e.maxLife;
        const opacity = e.alpha * (1 - progress);

        if (e.life >= e.maxLife || opacity <= 0.01) {
          embers.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 168, 52, ${opacity.toFixed(2)})`;
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [mode, paused, enableEmbers]);

  if (mode === 'dark') {
    return (
      <div
        className="fixed inset-0 z-0 transition-colors duration-300"
        style={{ backgroundColor: pageBg }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden select-none"
      style={{ backgroundColor: pageBg }}
      aria-hidden="true"
    >
      {mode === 'fireplace' ? (
        <div
          className="absolute inset-0"
          style={{ background: FIREPLACE_SCENE.fallbackGradient }}
        >
          {!fireplaceFailed && (
            <img
              src={FIREPLACE_SCENE.imageUrl}
              alt={FIREPLACE_SCENE.title}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFireplaceFailed(true)}
              className="w-full h-full object-cover scale-[1.02]"
            />
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 62% 62%, rgba(249, 115, 22, 0.22) 0%, rgba(245, 158, 11, 0.08) 28%, transparent 60%)',
            }}
          />
          {!paused && enableEmbers && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          )}
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: LANDSCAPE_SCENES[0].fallbackGradient }}
        >
          {previousSrc && (
            <img
              key={`prev-${previousSrc}`}
              src={previousSrc}
              alt=""
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <img
            key={`curr-${displayedSrc}`}
            src={displayedSrc}
            alt={activeLandscape.title}
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 opacity-100"
          />
        </div>
      )}

      {/* Lightweight GPU-free scrim for Mi Box low-RAM smoothness */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${
          immersive ? 'bg-transparent' : 'bg-[#0D0F12]/76'
        }`}
      />
    </div>
  );
}

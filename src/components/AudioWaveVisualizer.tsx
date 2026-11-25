import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface AudioWaveVisualizerProps {
  analyserRef: RefObject<AnalyserNode | null>;
  isPlaying: boolean;
  variant?: 'compact' | 'hero';
  stationName?: string;
  accentHex?: string;
  accentLightHex?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 245;
  const g = parseInt(clean.slice(2, 4), 16) || 158;
  const b = parseInt(clean.slice(4, 6), 16) || 11;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AudioWaveVisualizer({
  analyserRef,
  isPlaying,
  variant = 'compact',
  stationName,
  accentHex = '#10B981',
  accentLightHex = '#6EE7B7',
}: AudioWaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastDraw = 0;
    let phase = 0;
    let smoothEnergy = 0;
    let silentFrames = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Cap DPR at 1.25 for crisp yet ultra-fast rendering on Mi Box / budget Android
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const freqData = new Uint8Array(128);
    const timeData = new Uint8Array(128);

    const drawRibbon = (
      width: number,
      centerY: number,
      maxAmp: number,
      freqOffset: number,
      waveSpeed: number,
      strokeStyle: string | CanvasGradient,
      lineWidth: number,
      mirror = false,
    ) => {
      const points = 64;
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = t * width;
        const envelope = Math.pow(Math.sin(Math.PI * t), 1.7);

        const symDist = Math.abs(t - 0.5) * 2;
        const binIdx = Math.min(
          freqData.length - 1,
          Math.floor(symDist * (freqData.length * 0.6)) + freqOffset,
        );
        const freqVal = freqData[binIdx] / 255;
        const timeIdx = Math.floor(t * (timeData.length - 1));
        const timeVal = (timeData[timeIdx] - 128) / 128;

        const harmonic =
          Math.sin(t * Math.PI * 5 + phase * waveSpeed) * 0.45 +
          Math.sin(t * Math.PI * 9 - phase * (waveSpeed * 1.35)) * 0.35 +
          Math.cos(t * Math.PI * 13 + phase * 0.7) * 0.2;

        const signalMix = freqVal * 0.75 + Math.abs(timeVal) * 0.55 + smoothEnergy * 0.35;
        const displacement =
          envelope * maxAmp * (0.12 + signalMix * 0.95) * harmonic * (mirror ? -1 : 1);

        const y = centerY + displacement;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    const drawFrame = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      let rawEnergy = 0;

      if (isPlaying && analyser) {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        let sum = 0;
        for (let i = 0; i < 48; i++) {
          sum += freqData[i];
        }
        rawEnergy = sum / (48 * 255);

        if (rawEnergy < 0.002) silentFrames++;
        else silentFrames = 0;
      } else {
        freqData.fill(0);
        timeData.fill(128);
      }

      if (isPlaying && silentFrames > 25) {
        for (let i = 0; i < freqData.length; i++) {
          const synthetic =
            (Math.sin(phase * 1.7 + i * 0.28) * 0.5 + 0.5) *
            (Math.cos(phase * 0.9 - i * 0.14) * 0.4 + 0.6);
          freqData[i] = Math.floor(synthetic * 130);
          timeData[i] = Math.floor(128 + Math.sin(phase * 2.2 + i * 0.35) * 32);
        }
        rawEnergy = 0.28 + Math.sin(phase * 1.4) * 0.1;
      }

      const targetEnergy = isPlaying ? Math.max(0.08, rawEnergy) : 0;
      smoothEnergy += (targetEnergy - smoothEnergy) * 0.18;

      if (!prefersReduced) {
        phase += isPlaying ? 0.055 + smoothEnergy * 0.07 : 0.01;
      }

      // Baseline horizon
      const baselineGrad = ctx.createLinearGradient(0, 0, width, 0);
      baselineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      baselineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
      baselineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = baselineGrad;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (smoothEnergy > 0.01) {
        const maxAmp = height * (variant === 'hero' ? 0.4 : 0.38);

        const outerGrad = ctx.createLinearGradient(0, 0, width, 0);
        outerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        outerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        outerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        drawRibbon(width, centerY, maxAmp * 0.7, 10, 0.85, outerGrad, 1.4, true);

        const primaryGrad = ctx.createLinearGradient(0, 0, width, 0);
        primaryGrad.addColorStop(0, hexToRgba(accentHex, 0));
        primaryGrad.addColorStop(0.25, hexToRgba(accentHex, 0.78));
        primaryGrad.addColorStop(0.5, hexToRgba(accentLightHex, 0.96));
        primaryGrad.addColorStop(0.75, hexToRgba(accentHex, 0.78));
        primaryGrad.addColorStop(1, hexToRgba(accentHex, 0));
        drawRibbon(width, centerY, maxAmp, 0, 1.35, primaryGrad, 2.3, false);
      }
    };

    const render = (now: number) => {
      if (!isPlaying) return;
      if (document.hidden) {
        rafId = window.requestAnimationFrame(render);
        return;
      }
      // ~30fps cap to save CPU & battery on mobile and Android TV Box
      if (now - lastDraw >= 32) {
        lastDraw = now;
        drawFrame();
      }
      rafId = window.requestAnimationFrame(render);
    };

    drawFrame();
    if (isPlaying) {
      rafId = window.requestAnimationFrame(render);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [accentHex, accentLightHex, analyserRef, isPlaying, variant]);

  if (variant === 'hero') {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center px-4">
        <div className="w-full h-40 sm:h-52 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            aria-label={stationName ? `${stationName} ses dalgası` : 'Ses dalgası görselleştirici'}
          />
        </div>
        {stationName && (
          <p className="mt-2 text-sm tracking-wide text-white/75 font-medium truncate max-w-md text-center">
            {isPlaying ? `${stationName} · Canlı Ses Dalgası` : `${stationName} · Duraklatıldı`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto h-16 sm:h-20 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        aria-label={stationName ? `${stationName} ses dalgası` : 'Ses dalgası görselleştirici'}
      />
    </div>
  );
}

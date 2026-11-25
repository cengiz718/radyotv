// Gentle 3-note harmonic notification chime using Web Audio API (zero audio file bloat)
export function playGentlePrayerChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // Soft C5 -> E5 -> G5 harmonic chime
    const startTime = ctx.currentTime + 0.03;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.24);

      gain.gain.setValueAtTime(0.0001, startTime + idx * 0.24);
      gain.gain.exponentialRampToValueAtTime(0.14, startTime + idx * 0.24 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.24 + 1.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.24);
      osc.stop(startTime + idx * 0.24 + 1.15);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 2500);
  } catch {
    // Ignore autoplay restrictions before first user gesture
  }
}

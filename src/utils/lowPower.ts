// Android TV / Mi Box gibi güçsüz cihazları algılar.
// Bu cihazlarda ağır CSS (backdrop-blur) ve sürekli animasyonlar kumandayı geciktirir.
export function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  if (/Android TV|AFT[A-Z]+|Mi Box|BRAVIA|Google TV|SHIELD/i.test(ua)) return true;
  // Dokunmatik olmayan Android cihazlar (kumandayla kullanılan TV kutuları)
  const isAndroid = /Android/i.test(ua);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? true;
  return isAndroid && !coarse;
}

export const LOW_POWER = isLowPowerDevice();

import { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[40px] px-3.5 rounded-xl bg-white/12 border border-white/20 text-xs sm:text-sm font-medium text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4 text-emerald-400" />
        <span>Cihaza Kur (Uygulama)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] px-3.5 rounded-xl bg-white/10 border border-white/15 text-xs font-medium text-white hover:bg-white/20 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Ana Ekrana Ekle</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#161920] border border-white/15 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">iPhone / iPad Kurulumu</h3>
              <p className="text-sm text-[#D1D5DB] leading-relaxed">
                1. Safari alt çubuğundaki <strong>Paylaş</strong> simgesine dokunun.
                <br />
                2. Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğine dokunun.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07130E] text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                Tamam
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

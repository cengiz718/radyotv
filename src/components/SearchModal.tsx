import { useEffect, useState } from 'react';
import { Download, Plus, Radio, Search, X } from 'lucide-react';
import { isAdultContentText, isForeignLanguageText } from '../data/contentSafety.ts';
import type { RadioStation, StationCategory } from '../types.ts';
import { VoiceSearchButton } from './VoiceSearchButton.tsx';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  existingUrls: Set<string>;
  exportableStations: RadioStation[];
  onAddStation: (station: RadioStation, playImmediately: boolean) => void;
}

const CUSTOM_CATEGORIES: Array<{ id: StationCategory; label: string }> = [
  { id: 'ilahi', label: 'İlahi' },
  { id: 'arabesk', label: 'Arabesk' },
  { id: 'ozgun', label: 'Özgün' },
  { id: 'turku', label: 'Türkü' },
  { id: 'pop', label: 'Pop' },
  { id: 'slow', label: 'Slow' },
  { id: 'haber', label: 'Haber' },
];

export function SearchModal({
  open,
  onClose,
  existingUrls,
  exportableStations,
  onAddStation,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customCategory, setCustomCategory] = useState<StationCategory>('ilahi');
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const runSearch = async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      const res = await fetch(`/api/stations/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Arama yapılamadı.');
        setResults([]);
      } else {
        setResults(data.stations ?? []);
      }
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && results.length === 0 && !loading) {
      runSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customName.trim();
    const trimmedUrl = customUrl.trim();
    if (!trimmedName || !trimmedUrl) {
      setCustomError('Lütfen kanal adı ve yayın bağlantısı girin.');
      return;
    }
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setCustomError('Bağlantı http:// veya https:// ile başlamalıdır.');
      return;
    }
    if (isAdultContentText(`${trimmedName} ${trimmedUrl}`)) {
      setCustomError('18+ yetişkin içerikli kanallar programda kalıcı olarak kapalıdır.');
      return;
    }
    if (isForeignLanguageText(`${trimmedName} ${trimmedUrl}`)) {
      setCustomError('Program yalnızca Türkçe yayınları desteklemektedir.');
      return;
    }
    const isHls = trimmedUrl.toLowerCase().includes('.m3u8');
    const newStation: RadioStation = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      language: 'turkish',
      category: customCategory,
      genre: 'Özel Türkçe Kanal',
      city: 'Türkiye',
      streamUrl: trimmedUrl,
      format: isHls ? 'HLS' : 'MP3',
      needsProxy: trimmedUrl.startsWith('http://'),
      isCustom: true,
    };
    onAddStation(newStation, true);
    setCustomName('');
    setCustomUrl('');
    setCustomError(null);
    setShowCustomForm(false);
    onClose();
  };

  const handleDownloadM3u = () => {
    const lines = ['#EXTM3U'];
    for (const st of exportableStations) {
      lines.push(`#EXTINF:-1,${st.name}`);
      lines.push(st.streamUrl);
    }
    const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cengiz-tv-radyo-turkce.m3u';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Türkçe Radyo Bul ve Ekle"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#141820] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#252A34]">
          <div>
            <h2 className="text-xl font-semibold text-[#F4F5F7]">Türkçe Radyo Bul &amp; Ekle</h2>
            <p className="text-sm text-[#9BA1AE]">
              Sadece Türkçe canlı radyo istasyonlarını arayın veya kendi yayın adresinizi ekleyin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9BA1AE] hover:text-white hover:bg-[#222731] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 border-b border-[#252A34] space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="space-y-1.5"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#9BA1AE] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (voiceStatus) setVoiceStatus(null);
                  }}
                  placeholder="Türkçe kanal adı yazın (örn. Diyanet, Kral FM, Slow Türk)..."
                  className="w-full min-h-[46px] pl-11 pr-12 rounded-xl bg-[#0D0F12] border border-[#2A303C] text-[#F4F5F7] placeholder:text-[#6E7582] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <VoiceSearchButton
                    onResult={(txt) => setQuery(txt)}
                    onFinalResult={(txt) => {
                      setQuery(txt);
                      runSearch(txt);
                    }}
                    onListeningChange={(active) =>
                      setVoiceStatus(active ? 'Dinleniyor... Radyo adını söyleyin.' : null)
                    }
                    onError={(msg) => setVoiceStatus(msg)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="min-h-[46px] px-6 rounded-xl bg-emerald-500 text-[#07130E] font-semibold text-sm hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors whitespace-nowrap shrink-0"
              >
                Ara
              </button>
            </div>
            {voiceStatus && (
              <p className="text-xs text-emerald-300" role="status">
                {voiceStatus}
              </p>
            )}
          </form>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {exportableStations.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadM3u}
                className="min-h-[44px] px-3.5 rounded-xl border border-[#2C3240] text-sm font-medium text-[#E2E5EB] hover:bg-[#222731] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>.m3u İndir</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCustomForm((v) => !v)}
              className="min-h-[44px] px-4 rounded-xl border border-[#2C3240] text-sm font-medium text-[#E2E5EB] hover:bg-[#222731] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {showCustomForm ? 'Dizine Dön' : 'Özel URL Ekle'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {showCustomForm ? (
            <form onSubmit={handleAddCustom} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">
                  Radyo Adı
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Örn: Ankara Türkü FM"
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#0D0F12] border border-[#2A303C] text-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">
                  Yayın URL (MP3, AAC veya M3U8)
                </label>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#0D0F12] border border-[#2A303C] text-[#F4F5F7] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Kategori</label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCustomCategory(cat.id)}
                      className={`min-h-[40px] px-4 rounded-xl border text-sm font-medium transition-colors ${
                        customCategory === cat.id
                          ? 'bg-emerald-500 text-[#07130E] border-emerald-400 font-semibold'
                          : 'bg-[#0D0F12] text-[#D1D5DB] border-[#2A303C] hover:border-[#3F4756]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              {customError && <p className="text-sm text-rose-400">{customError}</p>}
              <button
                type="submit"
                className="min-h-[46px] px-6 rounded-xl bg-emerald-500 text-[#07130E] font-semibold text-sm hover:bg-emerald-400 transition-colors"
              >
                Kanala Ekle ve Çal
              </button>
            </form>
          ) : loading ? (
            <div className="py-12 text-center text-[#9BA1AE]">Türkçe kanallar aranıyor...</div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400">{error}</div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-[#9BA1AE]">
              Aramanıza uygun Türkçe yayın bulunamadı. Farklı bir kelime deneyin.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((station) => {
                const alreadyAdded = existingUrls.has(station.streamUrl);
                return (
                  <div
                    key={station.id}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0D0F12] border border-[#252A34]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="font-semibold text-[#F4F5F7] truncate">{station.name}</p>
                      </div>
                      <p className="text-xs text-[#9BA1AE] mt-1 truncate">
                        Türkçe · {station.format}
                        {station.bitrate ? ` · ${station.bitrate} kbps` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => onAddStation(station, true)}
                      className={`min-h-[44px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        alreadyAdded
                          ? 'bg-[#1D212A] text-[#6E7582] cursor-default'
                          : 'bg-emerald-500 text-[#07130E] hover:bg-emerald-400'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {alreadyAdded ? 'Listede' : 'Ekle ve Çal'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

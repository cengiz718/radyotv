import { useEffect, useState } from 'react';
import {
  Bell,
  Download,
  Flame,
  Image as ImageIcon,
  MapPin,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shuffle,
  Sliders,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { CUSTOM_THEME_OPTIONS, SURFACE_TONE_STYLES } from '../data/categoryThemes.ts';
import type {
  AppSettings,
  BackgroundMode,
  DiyanetCity,
  DiyanetDistrict,
  RadioStation,
  SurfaceTone,
  SystemStatusResponse,
} from '../types.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  bgMode: BackgroundMode;
  onChangeBgMode: (mode: BackgroundMode) => void;
  autoScenicOnPlay: boolean;
  onToggleAutoScenic: () => void;
  onPickRandomLandscape: () => void;
  landscapeTotal: number;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onTestPrayerAlarm: () => void;
  checkingUpdate: boolean;
  systemStatus: SystemStatusResponse | null;
  onCheckUpdate: () => void;
  onOpenAddChannel: () => void;
  exportableStations: RadioStation[];
}

export function SettingsModal({
  open,
  onClose,
  bgMode,
  onChangeBgMode,
  autoScenicOnPlay,
  onToggleAutoScenic,
  onPickRandomLandscape,
  landscapeTotal,
  settings,
  onUpdateSettings,
  onTestPrayerAlarm,
  checkingUpdate,
  systemStatus,
  onCheckUpdate,
  onOpenAddChannel,
  exportableStations,
}: SettingsModalProps) {
  const [cities, setCities] = useState<DiyanetCity[]>([]);
  const [districts, setDistricts] = useState<DiyanetDistrict[]>([]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || cities.length > 0) return;
    fetch('/api/prayer/cities')
      .then((r) => r.json())
      .then((data: { cities?: DiyanetCity[] }) => {
        if (Array.isArray(data.cities)) setCities(data.cities);
      })
      .catch(() => {});
  }, [open, cities.length]);

  useEffect(() => {
    if (!open || !settings.cityId) return;
    fetch(`/api/prayer/districts?cityId=${encodeURIComponent(settings.cityId)}`)
      .then((r) => r.json())
      .then((data: { districts?: DiyanetDistrict[] }) => {
        if (Array.isArray(data.districts) && data.districts.length > 0) {
          setDistricts(data.districts);
        }
      })
      .catch(() => {});
  }, [open, settings.cityId]);

  if (!open) return null;

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
      aria-label="Program Ayarları"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#141820] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">Ayarlar Modülü</h2>
              <p className="text-xs sm:text-sm text-[#9BA1AE]">
                Cengiz TV &amp; Radyo · Hazırlayan: Mehmet Cengiz Akdağ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9BA1AE] hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Ayarları Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Diyanet Namaz Vakitleri İl / İlçe & Ezan Alarmı */}
          <section className="space-y-4 bg-[#0D0F12] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <MapPin className="w-4 h-4" />
              <h3>Diyanet Namaz Vakitleri &amp; Ezan Alarmı</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9BA1AE] mb-1.5">İl Seçin</label>
                <select
                  value={settings.cityId}
                  onChange={(e) => {
                    const selected = cities.find((c) => c.SehirID === e.target.value);
                    if (!selected) return;
                    onUpdateSettings({
                      cityId: selected.SehirID,
                      cityName: selected.SehirAdi,
                    });
                    fetch(`/api/prayer/districts?cityId=${encodeURIComponent(selected.SehirID)}`)
                      .then((r) => r.json())
                      .then((data: { districts?: DiyanetDistrict[] }) => {
                        const list = data.districts ?? [];
                        setDistricts(list);
                        const merkez =
                          list.find((d) => d.IlceAdi === selected.SehirAdi) ?? list[0];
                        if (merkez) {
                          onUpdateSettings({
                            districtId: merkez.IlceID,
                            districtName: merkez.IlceAdi,
                          });
                        }
                      })
                      .catch(() => {});
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#161B24] border border-white/12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {cities.length === 0 ? (
                    <option value={settings.cityId}>{settings.cityName}</option>
                  ) : (
                    cities.map((c) => (
                      <option key={c.SehirID} value={c.SehirID}>
                        {c.SehirAdi}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9BA1AE] mb-1.5">İlçe Seçin</label>
                <select
                  value={settings.districtId}
                  onChange={(e) => {
                    const selected = districts.find((d) => d.IlceID === e.target.value);
                    if (!selected) return;
                    onUpdateSettings({
                      districtId: selected.IlceID,
                      districtName: selected.IlceAdi,
                    });
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#161B24] border border-white/12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {districts.length === 0 ? (
                    <option value={settings.districtId}>{settings.districtName}</option>
                  ) : (
                    districts.map((d) => (
                      <option key={d.IlceID} value={d.IlceID}>
                        {d.IlceAdi}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-white/8 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ enablePrayerAlarm: !settings.enablePrayerAlarm })
                }
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between gap-2 transition-colors ${
                  settings.enablePrayerAlarm
                    ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  <span>Vakit Uyarısı</span>
                </span>
                <span className="font-mono text-xs">
                  {settings.enablePrayerAlarm ? 'AÇIK' : 'KAPALI'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ enablePrayerAlarmSound: !settings.enablePrayerAlarmSound })
                }
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between gap-2 transition-colors ${
                  settings.enablePrayerAlarmSound
                    ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <span>Bildirim Sesi</span>
                </span>
                <span className="font-mono text-xs">
                  {settings.enablePrayerAlarmSound ? 'AÇIK' : 'SESSİZ'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTestPrayerAlarm();
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[#161B24] border border-white/15 text-sm font-semibold text-white hover:bg-white/10 flex items-center justify-center gap-2 transition-colors"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Alarmı Test Et</span>
              </button>
            </div>
          </section>

          {/* 2. Tema Özelleştirme */}
          <section className="space-y-4 bg-[#0D0F12] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
              <Palette className="w-4 h-4" />
              <h3>Tema Özelleştirme</h3>
            </div>

            <div className="space-y-2">
              <span className="block text-xs text-[#9BA1AE]">Vurgu Rengi</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CUSTOM_THEME_OPTIONS.map((opt) => {
                  const selected = settings.themeMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateSettings({ themeMode: opt.id })}
                      className={`min-h-[42px] px-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-colors ${
                        selected
                          ? 'bg-white/12 border-white text-white font-semibold'
                          : 'bg-[#161B24] border-white/10 text-[#D1D5DB] hover:bg-white/8'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                        style={{ backgroundColor: opt.swatchHex }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <span className="block text-xs text-[#9BA1AE]">Zemin ve Panel Tonu</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(SURFACE_TONE_STYLES) as SurfaceTone[]).map((toneKey) => {
                  const tone = SURFACE_TONE_STYLES[toneKey];
                  const selected = settings.surfaceTone === toneKey;
                  return (
                    <button
                      key={toneKey}
                      type="button"
                      onClick={() => onUpdateSettings({ surfaceTone: toneKey })}
                      className={`min-h-[42px] px-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-colors ${
                        selected
                          ? 'bg-white/12 border-white text-white font-semibold'
                          : 'bg-[#161B24] border-white/10 text-[#D1D5DB] hover:bg-white/8'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-md shrink-0 border border-white/30"
                        style={{ backgroundColor: tone.pageBg }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{tone.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Arka Plan & Görünüm */}
          <section className="space-y-3 bg-[#0D0F12] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
              <ImageIcon className="w-4 h-4" />
              <h3>Arka Plan ve Arayüz Düzeni</h3>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChangeBgMode('landscapes')}
                className={`min-h-[42px] px-4 rounded-xl text-sm font-medium border flex items-center gap-2 transition-colors ${
                  bgMode === 'landscapes'
                    ? 'bg-white text-[#0D0F12] border-white font-semibold'
                    : 'bg-[#161B24] text-[#D1D5DB] border-white/12 hover:bg-white/10'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Manzaralar ({landscapeTotal.toLocaleString('tr-TR')} Full HD)</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeBgMode('fireplace')}
                className={`min-h-[42px] px-4 rounded-xl text-sm font-medium border flex items-center gap-2 transition-colors ${
                  bgMode === 'fireplace'
                    ? 'bg-amber-500 text-[#0D0F12] border-amber-400 font-semibold'
                    : 'bg-[#161B24] text-[#D1D5DB] border-white/12 hover:bg-white/10'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>Şömine</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeBgMode('dark')}
                className={`min-h-[42px] px-4 rounded-xl text-sm font-medium border flex items-center gap-2 transition-colors ${
                  bgMode === 'dark'
                    ? 'bg-white text-[#0D0F12] border-white font-semibold'
                    : 'bg-[#161B24] text-[#D1D5DB] border-white/12 hover:bg-white/10'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Koyu Zemin (En Düşük RAM)</span>
              </button>

              {bgMode === 'landscapes' && (
                <button
                  type="button"
                  onClick={onPickRandomLandscape}
                  className="min-h-[42px] px-4 rounded-xl text-sm font-medium border bg-[#161B24] text-[#D1D5DB] border-white/12 hover:bg-white/10 flex items-center gap-2"
                >
                  <Shuffle className="w-4 h-4 text-amber-400" />
                  <span>Rastgele Manzara</span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-white/8">
              <button type="button" onClick={() => onUpdateSettings({ enableDailyWisdomPopup: !settings.enableDailyWisdomPopup })} className={`min-h-[44px] w-full px-4 rounded-xl border text-sm font-medium flex items-center justify-between ${settings.enableDailyWisdomPopup ? 'bg-amber-500/15 border-amber-400 text-amber-200' : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'}`}>
                <span>Uygulama Açılışında Ayet &amp; Hadis Popup’ı</span>
                <span className="font-mono text-xs">{settings.enableDailyWisdomPopup ? 'AÇIK' : 'KAPALI'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={onToggleAutoScenic}
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors ${
                  autoScenicOnPlay
                    ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span>Çalarken Otomatik Manzara</span>
                <span className="font-mono text-xs">{autoScenicOnPlay ? 'AÇIK' : 'KAPALI'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showSpiritualStrip: !settings.showSpiritualStrip })
                }
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors ${
                  settings.showSpiritualStrip
                    ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span>Ana Ekranda Vakit &amp; Ayet Özeti</span>
                <span className="font-mono text-xs">
                  {settings.showSpiritualStrip ? 'AÇIK' : 'KAPALI'}
                </span>
              </button>
            </div>
          </section>

          {/* 4. Düşük RAM & Performans */}
          <section className="space-y-3 bg-[#0D0F12] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
              <Sparkles className="w-4 h-4" />
              <h3>Mi Box &amp; Mobil Düşük RAM Performansı</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ enableVisualizer: !settings.enableVisualizer })
                }
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors ${
                  settings.enableVisualizer
                    ? 'bg-sky-500/15 border-sky-400 text-sky-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span>Ses Dalgası Görselleştiricisi</span>
                <span className="font-mono text-xs">
                  {settings.enableVisualizer ? 'AÇIK' : 'KAPALI'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ enableFireplaceEmbers: !settings.enableFireplaceEmbers })
                }
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors ${
                  settings.enableFireplaceEmbers
                    ? 'bg-sky-500/15 border-sky-400 text-sky-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span>Şömine Kıvılcım Efekti</span>
                <span className="font-mono text-xs">
                  {settings.enableFireplaceEmbers ? 'AÇIK' : 'KAPALI'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ lowBandwidthMode: !settings.lowBandwidthMode })
                }
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors sm:col-span-2 ${
                  settings.lowBandwidthMode
                    ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                    : 'bg-[#161B24] border-white/12 text-[#D1D5DB]'
                }`}
              >
                <span>Zayıf İnternet Modu (Düşük HLS Kalitesi &amp; Geniş Tampon)</span>
                <span className="font-mono text-xs">
                  {settings.lowBandwidthMode ? 'AÇIK' : 'OTOMATİK'}
                </span>
              </button>
            </div>
          </section>

          {/* 5. Otomatik Güncelleme, Kurulum ve Kanallar */}
          <section className="space-y-3 bg-[#0D0F12] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <h3>Güncelleme, Kurulum &amp; Kanal Araçları</h3>
              </div>
              <span className="text-xs font-mono text-[#9BA1AE]">
                Sürüm {systemStatus?.appVersion ?? '2.4.0'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onCheckUpdate}
                disabled={checkingUpdate}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-500 text-[#07130E] text-sm font-semibold hover:bg-emerald-400 transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
                <span>{checkingUpdate ? 'Güncelleniyor...' : 'Şimdi Güncelle'}</span>
              </button>

              <PWAInstallButton />

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddChannel();
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[#161B24] border border-white/12 text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Özel URL / Radyo Ekle</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadM3u}
                className="min-h-[44px] px-4 rounded-xl bg-[#161B24] border border-white/12 text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>.m3u Liste İndir</span>
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-white/8 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Aile Koruması Aktif: 18+ Yetişkin İçerik Kalıcı Kapalı</span>
              </span>
              <span className="text-[#9BA1AE] font-medium">
                Yayın Dili: Yalnızca Türkçe (Spor, Sinema &amp; Dizi, Ulusal)
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

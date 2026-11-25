import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, BookOpen, Clock, Compass, MapPin, RefreshCw, Sliders, Volume2 } from 'lucide-react';
import type { AppSettings, DailyWisdomData, PrayerTimesData } from '../types.ts';

interface SpiritualCornerViewProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenFullView?: () => void;
  onTogglePrayerAlarm?: () => void;
  onTestPrayerAlarm?: () => void;
  cardBg?: string;
}

const PRAYER_LABELS: Array<{ key: keyof PrayerTimesData['timings']; label: string }> = [
  { key: 'Imsak', label: 'İmsak' },
  { key: 'Gunes', label: 'Güneş' },
  { key: 'Ogle', label: 'Öğle' },
  { key: 'Ikindi', label: 'İkindi' },
  { key: 'Aksam', label: 'Akşam' },
  { key: 'Yatsi', label: 'Yatsı' },
];

function computeNextPrayer(timings: PrayerTimesData['timings'] | undefined) {
  if (!timings) return null;
  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .split(':');
  const nowMins = Number(nowParts[0]) * 60 + Number(nowParts[1]);

  for (const item of PRAYER_LABELS) {
    const raw = timings[item.key];
    const [hStr, mStr] = (raw || '').split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    const targetMins = h * 60 + m;
    if (targetMins > nowMins) {
      const diff = targetMins - nowMins;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      return {
        key: item.key,
        label: item.label,
        time: raw,
        remainingText: hrs > 0 ? `${hrs} sa ${mins} dk` : `${mins} dk`,
      };
    }
  }

  // After Yatsı -> next is tomorrow İmsak
  const [hStr, mStr] = (timings.Imsak || '05:30').split(':');
  const targetMins = Number(hStr) * 60 + Number(mStr) + 24 * 60;
  const diff = targetMins - nowMins;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    key: 'Imsak' as const,
    label: 'İmsak',
    time: timings.Imsak,
    remainingText: `${hrs} sa ${mins} dk`,
  };
}

function usePrayerAndWisdom(settings: AppSettings) {
  const [prayer, setPrayer] = useState<PrayerTimesData | null>(null);
  const [wisdom, setWisdom] = useState<DailyWisdomData | null>(null);
  const [wisdomSeed, setWisdomSeed] = useState<number>(() =>
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
  );
  const [loadingWisdom, setLoadingWisdom] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      districtId: settings.districtId,
      cityName: settings.cityName,
      districtName: settings.districtName,
    });
    fetch(`/api/prayer/times?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PrayerTimesData | null) => {
        if (data?.timings) setPrayer(data);
      })
      .catch(() => {});
  }, [settings.cityName, settings.districtId, settings.districtName]);

  const loadWisdom = useCallback((seed: number) => {
    setLoadingWisdom(true);
    fetch(`/api/daily-wisdom?seed=${seed}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DailyWisdomData | null) => {
        if (data?.ayah && data?.hadith) setWisdom(data);
      })
      .catch(() => {})
      .finally(() => setLoadingWisdom(false));
  }, []);

  useEffect(() => {
    loadWisdom(wisdomSeed);
  }, [loadWisdom, wisdomSeed]);

  const nextPrayer = useMemo(() => computeNextPrayer(prayer?.timings), [prayer?.timings]);

  return {
    prayer,
    wisdom,
    nextPrayer,
    loadingWisdom,
    nextWisdom: () => setWisdomSeed((s) => s + 1),
  };
}

export function SpiritualSummaryStrip({
  settings,
  onOpenSettings,
  onOpenFullView,
  onTogglePrayerAlarm,
  onTestPrayerAlarm,
  cardBg,
}: SpiritualCornerViewProps) {
  const { prayer, wisdom, nextPrayer, nextWisdom } = usePrayerAndWisdom(settings);

  return (
    <section
      aria-label="Diyanet Namaz Vakitleri ve Günün Ayeti Hadis Özeti"
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      {/* Diyanet Namaz Vakitleri Compact Card */}
      <div
        className="border border-emerald-500/25 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3"
        style={{ backgroundColor: cardBg ?? 'rgba(20, 24, 32, 0.94)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <Compass className="w-4 h-4" />
            <span>Diyanet Namaz Vakitleri · {prayer?.district || settings.districtName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextPrayer && (
              <span className="text-xs font-mono tabular-nums text-amber-300 pr-1">
                {nextPrayer.label}: {nextPrayer.remainingText}
              </span>
            )}
            {onTogglePrayerAlarm && (
              <button
                type="button"
                onClick={onTogglePrayerAlarm}
                className={`min-h-[40px] px-3 rounded-lg border text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  settings.enablePrayerAlarm
                    ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-[#0D0F12] border-white/12 text-[#9BA1AE] hover:text-white'
                }`}
                title="Ezan Vakti Bildirim Alarmını Aç/Kapat"
              >
                {settings.enablePrayerAlarm ? (
                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 text-[#9BA1AE]" />
                )}
                <span>{settings.enablePrayerAlarm ? 'Alarm Açık' : 'Alarm Kapalı'}</span>
              </button>
            )}
            {onTestPrayerAlarm && (
              <button
                type="button"
                onClick={onTestPrayerAlarm}
                className="min-h-[40px] px-3 rounded-lg bg-[#0D0F12] border border-white/12 text-xs text-[#D1D5DB] hover:text-white flex items-center gap-1.5 whitespace-nowrap"
                title="Bildirim sesini ve uyarısını test et"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Test</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[40px] px-3 rounded-lg bg-[#0D0F12] border border-white/12 text-xs text-[#D1D5DB] hover:text-white flex items-center gap-1.5 whitespace-nowrap"
              title="İl / İlçe Değiştir"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Konum</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PRAYER_LABELS.map((p) => {
            const isNext = nextPrayer?.key === p.key;
            return (
              <div
                key={p.key}
                className={`rounded-xl px-2.5 py-2 text-center border ${
                  isNext
                    ? 'bg-emerald-500/18 border-emerald-400/70'
                    : 'bg-[#0D0F12] border-white/8'
                }`}
              >
                <div className="text-[11px] text-[#9BA1AE]">{p.label}</div>
                <div
                  className={`text-sm font-mono font-semibold tabular-nums mt-0.5 ${
                    isNext ? 'text-emerald-300' : 'text-white'
                  }`}
                >
                  {prayer?.timings[p.key] ?? '--:--'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Günün Ayeti & Hadis Compact Card */}
      <div
        className="border border-amber-500/25 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3"
        style={{ backgroundColor: cardBg ?? 'rgba(20, 24, 32, 0.94)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <BookOpen className="w-4 h-4" />
            <span>Ayet &amp; Hadis Köşesi</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={nextWisdom}
              className="min-h-[40px] px-3 rounded-lg bg-[#0D0F12] border border-white/12 text-xs text-[#D1D5DB] hover:text-white flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Değiştir</span>
            </button>
            {onOpenFullView && (
              <button
                type="button"
                onClick={onOpenFullView}
                className="min-h-[40px] px-3 rounded-lg bg-amber-500/15 border border-amber-400/35 text-xs font-medium text-amber-300 hover:bg-amber-500/25 whitespace-nowrap"
              >
                Tam Görünüm
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 text-xs sm:text-sm">
          <p className="text-white/95 line-clamp-2 leading-relaxed">
            <strong className="text-amber-300 font-semibold">Ayet: </strong>
            {wisdom?.ayah.turkish ?? 'Yükleniyor...'}
            {wisdom?.ayah.reference && (
              <span className="text-[#9BA1AE] ml-1.5 text-xs">({wisdom.ayah.reference})</span>
            )}
          </p>
          <p className="text-[#D1D5DB] line-clamp-2 leading-relaxed">
            <strong className="text-emerald-300 font-semibold">Hadis: </strong>
            {wisdom?.hadith.text ?? 'Yükleniyor...'}
          </p>
        </div>
      </div>
    </section>
  );
}

export function SpiritualCornerView({
  settings,
  onOpenSettings,
  onTogglePrayerAlarm,
  onTestPrayerAlarm,
  cardBg,
}: SpiritualCornerViewProps) {
  const { prayer, wisdom, nextPrayer, loadingWisdom, nextWisdom } = usePrayerAndWisdom(settings);

  return (
    <div className="space-y-6">
      {/* Full Diyanet Prayer Calendar */}
      <section
        className="border border-emerald-500/30 rounded-2xl p-5 sm:p-7 space-y-5"
        style={{ backgroundColor: cardBg ?? 'rgba(20, 24, 32, 0.94)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <Compass className="w-4 h-4" />
              <span>{prayer?.source || 'Diyanet İşleri Başkanlığı Takvimi'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {prayer?.city || settings.cityName} · {prayer?.district || settings.districtName}
            </h1>
            <p className="text-sm text-[#B5BBC7] mt-1">
              {prayer?.miladiDate || ''}
              {prayer?.hicriDate ? ` · ${prayer.hicriDate}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {nextPrayer && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <div className="text-xs sm:text-sm">
                  <span className="text-emerald-200">{nextPrayer.label} vaktine </span>
                  <strong className="font-mono text-white">{nextPrayer.remainingText}</strong>
                </div>
              </div>
            )}
            {onTogglePrayerAlarm && (
              <button
                type="button"
                onClick={onTogglePrayerAlarm}
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors ${
                  settings.enablePrayerAlarm
                    ? 'bg-emerald-500/18 border-emerald-400 text-emerald-300'
                    : 'bg-[#0D0F12] border-white/15 text-[#D1D5DB] hover:bg-white/10'
                }`}
              >
                {settings.enablePrayerAlarm ? (
                  <Bell className="w-4 h-4 text-emerald-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-[#9BA1AE]" />
                )}
                <span>{settings.enablePrayerAlarm ? 'Vakit Alarmı Açık' : 'Vakit Alarmı Kapalı'}</span>
              </button>
            )}
            {onTestPrayerAlarm && (
              <button
                type="button"
                onClick={onTestPrayerAlarm}
                className="min-h-[44px] px-4 rounded-xl bg-[#0D0F12] border border-white/15 text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Alarmı Test Et</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[44px] px-4 rounded-xl bg-[#0D0F12] border border-white/15 text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>İl / İlçe Seç</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PRAYER_LABELS.map((p) => {
            const isNext = nextPrayer?.key === p.key;
            return (
              <div
                key={p.key}
                className={`rounded-2xl p-4 text-center border transition-colors ${
                  isNext
                    ? 'bg-emerald-500/20 border-emerald-400'
                    : 'bg-[#0D0F12] border-white/10'
                }`}
              >
                <div className="text-sm text-[#B5BBC7] font-medium">{p.label}</div>
                <div
                  className={`text-2xl font-mono font-bold tabular-nums mt-1.5 ${
                    isNext ? 'text-emerald-300' : 'text-white'
                  }`}
                >
                  {prayer?.timings[p.key] ?? '--:--'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full Ayet & Hadis Cards (Strictly Turkish Diyanet Meali — No Arabic) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span>Günün Ayeti ve Hadis-i Şerif Köşesi</span>
          </h2>
          <button
            type="button"
            onClick={nextWisdom}
            disabled={loadingWisdom}
            className="min-h-[44px] px-4 rounded-xl bg-amber-500 text-[#120D05] text-sm font-semibold hover:bg-amber-400 flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loadingWisdom ? 'animate-spin' : ''}`} />
            <span>Yeni Ayet &amp; Hadis</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <article
            className="border border-amber-400/30 rounded-2xl p-6 space-y-4 flex flex-col justify-between"
            style={{ backgroundColor: cardBg ?? 'rgba(20, 24, 32, 0.94)' }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                <span>KUR’AN-I KERİM · TÜRKÇE MEAL</span>
                <span>{wisdom?.ayah.reference}</span>
              </div>
              <p className="text-base sm:text-lg text-white leading-relaxed">
                “{wisdom?.ayah.turkish ?? 'Yükleniyor...'}”
              </p>
            </div>
            <p className="text-xs text-[#9BA1AE]">{wisdom?.ayah.source ?? 'Diyanet İşleri Meali'}</p>
          </article>

          <article
            className="border border-emerald-400/30 rounded-2xl p-6 space-y-4 flex flex-col justify-between"
            style={{ backgroundColor: cardBg ?? 'rgba(20, 24, 32, 0.94)' }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                <span>HADİS-İ ŞERİF KÖŞESİ</span>
                <span>{wisdom?.hadith.source}</span>
              </div>
              <p className="text-base sm:text-lg text-white leading-relaxed">
                {wisdom?.hadith.text ?? 'Yükleniyor...'}
              </p>
            </div>
            <p className="text-xs text-[#9BA1AE]">{wisdom?.hadith.reference}</p>
          </article>
        </div>
      </section>
    </div>
  );
}

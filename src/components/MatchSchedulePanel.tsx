import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  Tv,
} from 'lucide-react';
import type {
  MatchScheduleItem,
  MatchScheduleResponse,
  MatchSportType,
  TvChannel,
} from '../types.ts';
import { VoiceSearchButton } from './VoiceSearchButton.tsx';

interface MatchSchedulePanelProps {
  channels: TvChannel[];
  onPlayChannel: (channel: TvChannel) => void;
  surfaceCardBg?: string;
}

const SPORT_TABS: Array<{ id: 'all' | MatchSportType; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'futbol', label: 'Futbol' },
  { id: 'basketbol', label: 'Basketbol' },
  { id: 'voleybol', label: 'Voleybol' },
];

const QUICK_CHANNEL_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Tüm Kanallar' },
  { id: 'trt 1', label: 'TRT 1' },
  { id: 'trt spor', label: 'TRT Spor' },
  { id: 'trt spor yıldız', label: 'TRT Spor Yıldız' },
  { id: 'a spor', label: 'A Spor' },
  { id: 'tabii spor', label: 'Tabii Spor' },
  { id: 'bein', label: 'beIN Sports' },
];

const SPORT_LABELS: Record<MatchSportType, string> = {
  futbol: 'Futbol',
  basketbol: 'Basketbol',
  voleybol: 'Voleybol',
  diger: 'Diğer Sporlar',
};

export function MatchSchedulePanel({
  channels,
  onPlayChannel,
  surfaceCardBg = 'rgba(20, 24, 32, 0.94)',
}: MatchSchedulePanelProps) {
  const [data, setData] = useState<MatchScheduleResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [sportFilter, setSportFilter] = useState<'all' | MatchSportType>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [freeOnly, setFreeOnly] = useState<boolean>(false);
  const [todayOnly, setTodayOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  const fetchMatches = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(force ? '/api/match-schedule?refresh=1' : '/api/match-schedule');
      if (!res.ok) throw new Error('Maç programı alınamadı.');
      const payload = (await res.json()) as MatchScheduleResponse;
      setData(payload);
    } catch {
      setError('Canlı maç rehberi şu anda yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches(false);
    const timer = window.setInterval(() => fetchMatches(false), 180000);
    return () => window.clearInterval(timer);
  }, [fetchMatches]);

  const resolvePlayableChannel = useCallback(
    (item: MatchScheduleItem): TvChannel | undefined => {
      if (item.playableChannelId) {
        const direct = channels.find((ch) => ch.id === item.playableChannelId);
        if (direct) return direct;
      }
      if (!item.isFreeToAir) return undefined;
      const lower = item.channelName.toLocaleLowerCase('tr-TR');
      return channels.find((ch) => {
        const nameLower = ch.name.toLocaleLowerCase('tr-TR');
        return nameLower === lower || lower.includes(nameLower);
      });
    },
    [channels],
  );

  const filteredMatches = useMemo(() => {
    const list = data?.matches ?? [];
    const q = search.trim().toLocaleLowerCase('tr-TR');

    return list.filter((m) => {
      if (sportFilter !== 'all' && m.sport !== sportFilter) return false;
      if (todayOnly && data?.todayDate && m.dateStr !== data.todayDate) return false;
      if (freeOnly && !m.isFreeToAir) return false;
      if (channelFilter !== 'all') {
        const chLower = m.channelName.toLocaleLowerCase('tr-TR');
        if (channelFilter === 'trt spor') {
          if (chLower !== 'trt spor') return false;
        } else if (!chLower.includes(channelFilter)) {
          return false;
        }
      }
      if (q) {
        const hay = `${m.title} ${m.league} ${m.channelName} ${SPORT_LABELS[m.sport]}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [channelFilter, data, freeOnly, search, sportFilter, todayOnly]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ dateStr: string; dateLabel: string; items: MatchScheduleItem[] }> = [];
    const map = new Map<string, { dateStr: string; dateLabel: string; items: MatchScheduleItem[] }>();
    for (const item of filteredMatches) {
      let group = map.get(item.dateStr);
      if (!group) {
        group = { dateStr: item.dateStr, dateLabel: item.dateLabel, items: [] };
        map.set(item.dateStr, group);
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [filteredMatches]);

  const liveCount = useMemo(
    () => filteredMatches.filter((m) => m.status === 'live').length,
    [filteredMatches],
  );
  const freePlayableCount = useMemo(
    () => filteredMatches.filter((m) => Boolean(resolvePlayableChannel(m))).length,
    [filteredMatches, resolvePlayableChannel],
  );

  return (
    <section aria-label="Maç Rehberi: Hangi Kanalda Hangi Maç Var?" className="space-y-4">
      {/* Header + Search + Refresh */}
      <div
        className="rounded-2xl border border-white/12 p-4 sm:p-5 space-y-4"
        style={{ backgroundColor: surfaceCardBg }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>Canlı Spor &amp; Yayın Programı</span>
              <span aria-hidden="true" className="text-white/25">·</span>
              <span className="font-mono tabular-nums text-[#CBD5E1]">TSİ (Türkiye Saati)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Hangi Kanalda, Hangi Maç Var, Saat Kaçta?
            </h2>
            <p className="text-xs text-[#9BA1AE] flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-white/85">
                {filteredMatches.length} karşılaşma
              </span>
              {liveCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-red-400 font-semibold font-mono tabular-nums">
                    {liveCount} şu an canlı
                  </span>
                </>
              )}
              {freePlayableCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-300 font-mono tabular-nums">
                    {freePlayableCount} şifresiz kanalda doğrudan izlenebilir
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-300/90">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sadece Türkçe · 18+ Kapalı</span>
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-[#9BA1AE] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (voiceStatus) setVoiceStatus(null);
                }}
                placeholder="Takım, lig veya kanal ara (örn: Fenerbahçe, TRT 1)..."
                aria-label="Maç veya Kanal Ara"
                className="w-full min-h-[44px] pl-11 pr-12 rounded-xl bg-[#0D0F12]/95 border border-white/12 text-sm text-white placeholder:text-[#8C93A3] focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <VoiceSearchButton
                  onResult={(txt) => setSearch(txt)}
                  onListeningChange={(active) =>
                    setVoiceStatus(
                      active ? 'Dinleniyor... Takım veya kanal adını söyleyin.' : null,
                    )
                  }
                  onError={(msg) => setVoiceStatus(msg)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchMatches(true)}
              disabled={refreshing}
              className="min-h-[44px] px-4 rounded-xl bg-[#0D0F12]/90 border border-white/12 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 transition-colors"
              title="Maç programını şimdi yenile"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>
        </div>

        {voiceStatus && (
          <p className="text-xs text-amber-300" role="status">
            {voiceStatus}
          </p>
        )}

        {/* Sport + Broadcast Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-white/8">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {SPORT_TABS.map((tab) => {
              const active = sportFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSportFilter(tab.id)}
                  className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-emerald-500 text-[#06130C] border-emerald-400'
                      : 'bg-[#0D0F12]/85 text-[#D1D5DB] border-white/10 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTodayOnly((v) => !v)}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                todayOnly
                  ? 'bg-amber-500 text-[#120D05] border-amber-400'
                  : 'bg-[#0D0F12]/85 text-[#D1D5DB] border-white/10 hover:bg-white/10'
              }`}
            >
              Sadece Bugün
            </button>

            <button
              type="button"
              onClick={() => setFreeOnly((v) => !v)}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                freeOnly
                  ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400'
                  : 'bg-[#0D0F12]/85 text-[#D1D5DB] border-white/10 hover:bg-white/10'
              }`}
            >
              Yalnızca Şifresiz (İzlenebilir)
            </button>
          </div>
        </div>

        {/* Channel Quick Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_CHANNEL_FILTERS.map((cf) => {
            const active = channelFilter === cf.id;
            return (
              <button
                key={cf.id}
                type="button"
                onClick={() => setChannelFilter(cf.id)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#0D0F12] border-white font-semibold'
                    : 'bg-white/[0.04] text-[#B5BBC7] border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                {cf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading / Error / Empty / Match Groups */}
      {loading && !data ? (
        <div
          className="rounded-2xl border border-white/10 p-10 text-center text-sm text-[#B5BBC7]"
          style={{ backgroundColor: surfaceCardBg }}
        >
          Güncel maç programı ve TV yayın saatleri yükleniyor...
        </div>
      ) : error ? (
        <div
          className="rounded-2xl border border-rose-500/35 p-8 text-center space-y-3"
          style={{ backgroundColor: surfaceCardBg }}
          role="alert"
        >
          <p className="text-sm text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => fetchMatches(true)}
            className="min-h-[42px] px-5 rounded-xl bg-emerald-500 text-[#06130C] text-xs font-semibold hover:bg-emerald-400"
          >
            Tekrar Dene
          </button>
        </div>
      ) : groupedByDate.length === 0 ? (
        <div
          className="rounded-2xl border border-white/10 p-8 text-center space-y-3"
          style={{ backgroundColor: surfaceCardBg }}
        >
          <p className="text-sm text-[#D1D5DB]">
            Seçili filtrelere uygun karşılaşma bulunamadı.
          </p>
          <button
            type="button"
            onClick={() => {
              setSportFilter('all');
              setChannelFilter('all');
              setFreeOnly(false);
              setTodayOnly(false);
              setSearch('');
            }}
            className="min-h-[40px] px-4 rounded-xl bg-emerald-500 text-[#06130C] text-xs font-semibold hover:bg-emerald-400"
          >
            Tüm Maçları Göster
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map((group) => (
            <div key={group.dateStr} className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  <span>{group.dateLabel}</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-[#9BA1AE]">
                  {group.items.length} maç
                </span>
              </div>

              <div
                className="rounded-2xl border border-white/12 divide-y divide-white/8 overflow-hidden"
                style={{ backgroundColor: surfaceCardBg }}
              >
                {group.items.map((match) => {
                  const playableChannel = resolvePlayableChannel(match);
                  const isLive = match.status === 'live';
                  const isFinished = match.status === 'finished';

                  return (
                    <div
                      key={match.id}
                      className={`p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        isLive ? 'bg-emerald-500/[0.06]' : 'hover:bg-white/[0.025]'
                      }`}
                    >
                      {/* Time + Match Details */}
                      <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                        <div className="w-20 shrink-0">
                          <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-white leading-tight">
                            {match.startTime}
                          </div>
                          <div
                            className={`text-[11px] font-semibold mt-0.5 ${
                              isLive
                                ? 'text-red-400'
                                : isFinished
                                  ? 'text-[#8C93A3]'
                                  : 'text-emerald-300'
                            }`}
                          >
                            {isLive ? 'CANLI YAYIN' : isFinished ? 'Tamamlandı' : 'TSİ'}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white">
                              {match.title}
                            </h4>
                            {match.scoreText && (
                              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-amber-300">
                                · {match.scoreText}
                              </span>
                            )}
                          </div>

                          {/* Zero-Pill Unboxed Metadata Line */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9BA1AE]">
                            <span className="text-[#CBD5E1] font-medium">{match.league}</span>
                            <span aria-hidden="true">·</span>
                            <span>{SPORT_LABELS[match.sport]}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                playableChannel
                                  ? 'text-emerald-300 font-semibold'
                                  : 'text-amber-300 font-semibold'
                              }
                            >
                              {match.channelName}
                            </span>
                            {match.endTime && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {match.startTime} - {match.endTime}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action: Live Play if Free-to-Air Channel Exists, otherwise Clear Channel Info */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pl-24 sm:pl-24 md:pl-0">
                        {playableChannel ? (
                          <button
                            type="button"
                            onClick={() => onPlayChannel(playableChannel)}
                            className="min-h-[42px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#06130C] text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{playableChannel.name} İzle</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-[#9BA1AE] font-medium">
                            <Tv className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span>
                              {match.isFreeToAir
                                ? `${match.channelName}`
                                : `${match.channelName} (Platform Yayını)`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

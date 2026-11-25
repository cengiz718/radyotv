import { useCallback, useEffect, useState } from 'react';
import { Disc3, Play, Radio, Search, X } from 'lucide-react';
import type { ArtistSearchResponse, RadioStation, YouTubeArtistResult } from '../types.ts';
import { VoiceSearchButton } from './VoiceSearchButton.tsx';

interface ArtistFinderViewProps {
  onBeforePlayYouTube: () => void;
  onPlayRadioStation: (station: RadioStation) => void;
  cardBg?: string;
}

const PRESET_ARTISTS = [
  'Müslüm Gürses',
  'Neşet Ertaş',
  'Abdurrahman Önül',
  'Ahmet Kaya',
  'Aşık Veysel',
  'İbrahim Tatlıses',
  'Sami Yusuf',
  'Barış Manço',
];

const STYLES = [
  { id: 'all', label: 'Tümü' },
  { id: 'arabesk', label: 'Arabesk' },
  { id: 'ilahi', label: 'İlahi' },
  { id: 'turku', label: 'Türkü' },
  { id: 'ozgun', label: 'Özgün' },
] as const;

export function ArtistFinderView({
  onBeforePlayYouTube,
  onPlayRadioStation,
  cardBg,
}: ArtistFinderViewProps) {
  const surfaceCardBg = cardBg ?? 'rgba(20, 24, 32, 0.94)';
  const [query, setQuery] = useState('Müslüm Gürses');
  const [style, setStyle] = useState<'all' | 'arabesk' | 'ilahi' | 'turku' | 'ozgun'>('all');
  const [data, setData] = useState<ArtistSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState<YouTubeArtistResult | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  const runSearch = useCallback(async (artistQuery: string, selectedStyle: string) => {
    const clean = artistQuery.trim() || 'Müslüm Gürses';
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: clean, style: selectedStyle });
      const res = await fetch(`/api/artist-search?${params.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as ArtistSearchResponse;
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch('Müslüm Gürses', 'all');
  }, [runSearch]);

  const handlePlayVideo = (video: YouTubeArtistResult) => {
    onBeforePlayYouTube();
    setActiveVideo(video);
  };

  return (
    <div className="space-y-6">
      {/* Search & Artist Quick Chips */}
      <section
        className="border border-white/12 rounded-2xl p-5 sm:p-6 space-y-4"
        style={{ backgroundColor: surfaceCardBg }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <Disc3 className="w-6 h-6 text-rose-400" />
            <span>Sanatçıya Göre İlahi, Türkü &amp; YouTube Bul</span>
          </h1>
          <p className="text-sm text-[#B5BBC7] mt-1">
            Sanatçı adı yazın; hem canlı Türkçe radyo kanallarını hem de YouTube yayınlarını anında oynatın.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query, style);
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
                placeholder="Örn: Müslüm Gürses, Neşet Ertaş, Abdurrahman Önül..."
                className="w-full min-h-[48px] pl-11 pr-12 rounded-xl bg-[#0D0F12] border border-white/15 text-white placeholder:text-[#6E7582] focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <VoiceSearchButton
                  onResult={(txt) => setQuery(txt)}
                  onFinalResult={(txt) => {
                    setQuery(txt);
                    runSearch(txt, style);
                  }}
                  onListeningChange={(active) =>
                    setVoiceStatus(active ? 'Dinleniyor... Sanatçı veya eser adını söyleyin.' : null)
                  }
                  onError={(msg) => setVoiceStatus(msg)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="min-h-[48px] px-6 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 transition-colors whitespace-nowrap shrink-0"
            >
              Sanatçıyı Bul
            </button>
          </div>
          {voiceStatus && (
            <p className="text-xs text-rose-300" role="status">
              {voiceStatus}
            </p>
          )}
        </form>

        {/* Genre style filter + quick artists */}
        <div className="flex flex-wrap items-center gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStyle(s.id);
                runSearch(query, s.id);
              }}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                style === s.id
                  ? 'bg-rose-500 text-white border-rose-400 font-semibold'
                  : 'bg-[#0D0F12] text-[#D1D5DB] border-white/10 hover:bg-white/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-[#9BA1AE]">Hızlı Seçim:</span>
          {PRESET_ARTISTS.map((artist) => (
            <button
              key={artist}
              type="button"
              onClick={() => {
                setQuery(artist);
                runSearch(artist, style);
              }}
              className="min-h-[36px] px-3 rounded-lg bg-[#1A202C] border border-white/10 text-xs text-[#E2E5EB] hover:border-rose-400/60 hover:text-white transition-colors"
            >
              {artist}
            </button>
          ))}
        </div>
      </section>

      {/* Active Embedded YouTube Player */}
      {activeVideo && (
        <section className="bg-[#141820]/94 border border-rose-400/60 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-rose-400 font-semibold">YOUTUBE OYNATICI</p>
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                {activeVideo.title}
              </h2>
              <p className="text-xs text-[#9BA1AE]">{activeVideo.channel}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveVideo(null)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0D0F12] border border-white/15 text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 shrink-0"
            >
              <X className="w-4 h-4" />
              <span>Oynatıcıyı Kapat</span>
            </button>
          </div>

          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
            <iframe
              key={activeVideo.videoId}
              src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&rel=0`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </section>
      )}

      {/* Matching Live Turkish Radios */}
      {data && data.radioMatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Eşleşen Canlı Türkçe Radyolar</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.radioMatches.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onPlayRadioStation(st)}
                className="text-left p-4 rounded-2xl bg-[#141820]/94 border border-white/10 hover:border-emerald-400/70 transition-colors flex items-center justify-between gap-3 min-h-[76px]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{st.name}</div>
                  <div className="text-xs text-[#9BA1AE] truncate mt-0.5">{st.genre}</div>
                </div>
                <Play className="w-5 h-5 text-emerald-400 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* YouTube Results Grid */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          YouTube Sonuçları {data ? `· ${data.query}` : ''}
        </h2>

        {loading ? (
          <div className="bg-[#141820]/94 border border-white/10 rounded-2xl p-10 text-center text-[#B5BBC7]">
            Sanatçı yayınları aranıyor...
          </div>
        ) : !data || data.youtubeResults.length === 0 ? (
          <div className="bg-[#141820]/94 border border-white/10 rounded-2xl p-10 text-center text-[#B5BBC7]">
            Sonuç bulunamadı. Başka bir sanatçı adı deneyin.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {data.youtubeResults.map((video) => {
              const isPlaying = activeVideo?.videoId === video.videoId;
              const thumbFailed = Boolean(brokenThumbs[video.videoId]);
              return (
                <button
                  key={video.videoId}
                  type="button"
                  onClick={() => handlePlayVideo(video)}
                  className={`text-left rounded-2xl border overflow-hidden transition-colors flex flex-col ${
                    isPlaying
                      ? 'bg-[#241319]/95 border-rose-400'
                      : 'border-white/10 hover:border-white/25 hover:bg-[#1B202C]'
                  }`}
                  style={!isPlaying ? { backgroundColor: surfaceCardBg } : undefined}
                >
                  <div className="relative aspect-video w-full bg-gradient-to-br from-[#1B202B] to-[#0D0F12]">
                    {!thumbFailed ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenThumbs((prev) => ({ ...prev, [video.videoId]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-3 text-center">
                        <Disc3 className="w-7 h-7 text-rose-400" />
                        <span className="text-[11px] text-[#9BA1AE] line-clamp-1">
                          {video.channel}
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 text-[11px] font-mono text-white">
                      {video.duration}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                      {video.title}
                    </h3>
                    <p className="text-xs text-[#9BA1AE] truncate">{video.channel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

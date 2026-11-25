import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Search, Tv, X } from 'lucide-react';
import { TV_CATEGORY_THEMES, type CategoryTheme } from '../data/categoryThemes.ts';
import type { ChannelEpgGuide, TvCategory, TvChannel } from '../types.ts';
import { ChannelBadgeIcon, ProgramTypeIcon } from './ChannelIcons.tsx';
import { VoiceSearchButton } from './VoiceSearchButton.tsx';

interface TvChannelListModalProps {
  open: boolean;
  onClose: () => void;
  channels: TvChannel[];
  activeChannel: TvChannel | null;
  categories: Array<{ id: TvCategory; label: string }>;
  getChannelEpg: (channel: TvChannel) => ChannelEpgGuide;
  onSelectChannel: (channel: TvChannel) => void;
  fullscreenContainer?: HTMLElement | null;
  recentChannelIds?: string[];
  orientationMode?: 'auto' | 'portrait' | 'landscape';
  activeTheme?: CategoryTheme;
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export function TvChannelListModal({
  open,
  onClose,
  channels,
  activeChannel,
  categories,
  getChannelEpg,
  onSelectChannel,
  fullscreenContainer,
  recentChannelIds = [],
  orientationMode = 'auto',
  activeTheme: activeThemeProp,
}: TvChannelListModalProps) {
  const [category, setCategory] = useState<TvCategory>('all');
  const [search, setSearch] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  );
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resetFilterBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const syncOrientation = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth);
    };
    syncOrientation();
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
    return () => {
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientation);
    };
  }, []);

  const isPortraitLayout =
    orientationMode === 'portrait' || (orientationMode === 'auto' && isPortraitViewport);

  const filteredChannels = useMemo(() => {
    const q = normalizeSearchText(search);
    const orderedBase: TvChannel[] =
      category === 'recent'
        ? recentChannelIds
            .map((id) => channels.find((ch) => ch.id === id))
            .filter((ch): ch is TvChannel => Boolean(ch))
        : channels.filter((ch) => category === 'all' || ch.category === category);

    if (!q) return orderedBase;

    return orderedBase.filter((ch, idx) => {
      const epg = getChannelEpg(ch);
      const indexText = String(idx + 1).padStart(2, '0');
      const haystack = normalizeSearchText(
        `${indexText} ${idx + 1} ${ch.name} ${epg.current.title} ${ch.category}`,
      );
      return haystack.includes(q);
    });
  }, [category, channels, getChannelEpg, recentChannelIds, search]);

  // Keep refs array aligned with currently rendered filteredChannels
  itemRefs.current.length = filteredChannels.length;

  useEffect(() => {
    if (!open) {
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (activeChannel) {
      const activeIdx = filteredChannels.findIndex((ch) => ch.id === activeChannel.id);
      if (activeIdx >= 0) {
        itemRefs.current[activeIdx]?.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }

    searchInputRef.current?.focus();
    const rafId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
    // Focus initialization intentionally runs when the modal opens/closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const getColumnCount = () => {
      const first = itemRefs.current[0];
      if (!first) return 1;
      const firstTop = first.getBoundingClientRect().top;
      let cols = 0;
      for (const el of itemRefs.current) {
        if (!el) continue;
        if (Math.abs(el.getBoundingClientRect().top - firstTop) < 12) cols++;
        else break;
      }
      return Math.max(1, cols);
    };

    const focusChannelIndex = (idx: number) => {
      const el = itemRefs.current[idx];
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      const len = filteredChannels.length;
      const currentIdx = itemRefs.current.findIndex((el) => el === document.activeElement);
      const isInSearchInput = document.activeElement === searchInputRef.current;
      const isOnCloseButton = document.activeElement === closeButtonRef.current;

      // Cycle focus strictly through the channel list items on Tab / Shift+Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (len === 0) {
          resetFilterBtnRef.current?.focus();
          return;
        }
        const nextIdx = e.shiftKey
          ? currentIdx <= 0
            ? len - 1
            : currentIdx - 1
          : currentIdx === -1 || currentIdx >= len - 1
            ? 0
            : currentIdx + 1;
        focusChannelIndex(nextIdx);
        return;
      }

      // Enter or TV remote OK/Select immediately acts on Close or switches channel and closes modal
      const isConfirmKey =
        e.key === 'Enter' ||
        e.key === 'OK' ||
        e.key === 'Select' ||
        e.key === 'Accept' ||
        e.keyCode === 23;

      if (isConfirmKey || (isOnCloseButton && e.key === ' ')) {
        if (isOnCloseButton) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (len === 0) {
          if (document.activeElement === resetFilterBtnRef.current) {
            e.preventDefault();
            e.stopPropagation();
            setCategory('all');
            setSearch('');
            window.requestAnimationFrame(() => {
              itemRefs.current[0]?.focus();
            });
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const selectedIdx = currentIdx >= 0 ? currentIdx : 0;
        const chosen = filteredChannels[selectedIdx];
        if (chosen) {
          onSelectChannel(chosen);
          onClose();
        }
        return;
      }

      if (isOnCloseButton) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          searchInputRef.current?.focus();
        } else if (e.key === 'ArrowUp' && len > 0) {
          e.preventDefault();
          e.stopPropagation();
          focusChannelIndex(len - 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (isInSearchInput) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (len > 0) focusChannelIndex(0);
          else resetFilterBtnRef.current?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          closeButtonRef.current?.focus();
        }
        return;
      }

      if (len === 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          searchInputRef.current?.focus();
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % len;
        focusChannelIndex(nextIdx);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const prevIdx = currentIdx <= 0 ? len - 1 : currentIdx - 1;
        focusChannelIndex(prevIdx);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const cols = getColumnCount();
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + cols) % len;
        focusChannelIndex(nextIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const cols = getColumnCount();
        if (currentIdx >= 0 && currentIdx < cols) {
          searchInputRef.current?.focus();
        } else {
          const prevIdx = currentIdx === -1 ? len - 1 : (currentIdx - cols + len) % len;
          focusChannelIndex(prevIdx);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        focusChannelIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        focusChannelIndex(len - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [filteredChannels, onClose, onSelectChannel, open]);

  if (!open) return null;

  const theme = TV_CATEGORY_THEMES[category];
  const activeTheme = activeThemeProp ?? theme;
  const portalTarget = fullscreenContainer ?? document.body;
  const isContained = Boolean(fullscreenContainer);

  const modalContent = (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{ '--active-accent': activeTheme.accentHex } as CSSProperties}
      className={`${isContained ? 'absolute' : 'fixed'} inset-0 z-50 flex ${
        isPortraitLayout
          ? 'items-end justify-center bg-black/25 p-0'
          : 'items-center justify-center bg-black/72 backdrop-blur-sm p-2 sm:p-5'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Hızlı TV Kanal Listesi"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full flex flex-col bg-[#0F141C]/96 border-white/18 overflow-hidden ${
          isPortraitLayout
            ? 'max-h-[54dvh] rounded-t-3xl border-t border-x shadow-[0_-18px_50px_rgba(0,0,0,0.88)] pb-[env(safe-area-inset-bottom)]'
            : 'max-w-4xl max-h-[92dvh] sm:max-h-[85dvh] rounded-2xl border shadow-2xl'
        }`}
      >
        {isPortraitLayout && (
          <div className="pt-2 pb-0.5 flex justify-center shrink-0" aria-hidden="true">
            <span className="w-10 h-1 rounded-full bg-white/25" />
          </div>
        )}

        {/* Modal Header */}
        <div
          className={`border-b border-white/10 flex items-center justify-between gap-3 shrink-0 ${
            isPortraitLayout ? 'px-3.5 py-2.5' : 'px-4 py-2.5 sm:px-6 sm:py-3.5'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-white truncate">
                TV Kanal Listesi
              </h2>
              <p className="text-[11px] sm:text-xs text-[#9BA1AE] truncate">
                {activeChannel
                  ? `Yayında: ${activeChannel.name} · 18+ Kapalı`
                  : `${filteredChannels.length} Türkçe TV kanalı · 18+ Kapalı`}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="min-h-[38px] sm:min-h-[42px] min-w-[42px] px-3 rounded-xl bg-white/10 border-2 border-white/20 text-[#E5E7EB] hover:text-white hover:bg-white/18 hover:border-white/40 flex items-center justify-center gap-1.5 shrink-0 text-xs sm:text-sm font-semibold transition-[transform,color,background-color,box-shadow,border-color] duration-150 motion-reduce:transition-none motion-reduce:focus:scale-100 focus:outline-none focus:scale-105 focus:bg-rose-600 focus:text-white focus:border-white focus:ring-4 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#10141C] focus:shadow-[0_0_24px_rgba(252,211,77,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10141C]"
            aria-label="Kanal Listesini Kapat"
            title="Kapat (ESC)"
          >
            <X className="w-4 h-4 shrink-0" />
            <span>Kapat</span>
          </button>
        </div>

        {/* Search & Category Tabs */}
        <div
          className={`border-b border-white/10 bg-[#0C1017]/85 shrink-0 ${
            isPortraitLayout ? 'p-2.5 space-y-2' : 'p-3 sm:px-6 space-y-2.5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9BA1AE] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                autoFocus
                tabIndex={-1}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (voiceError) setVoiceError(null);
                }}
                placeholder={
                  isPortraitLayout
                    ? 'Kanal adı veya numara ara...'
                    : 'Kanal adı, numarası veya program ara (TRT 1, 01, Haber...)'
                }
                aria-label="TV Kanalı Ara"
                className={`w-full ${
                  isPortraitLayout ? 'min-h-[40px]' : 'min-h-[42px]'
                } pl-9 ${
                  search.length > 0 ? 'pr-20' : 'pr-11'
                } rounded-xl bg-[#141923] border border-white/15 text-xs sm:text-sm text-white placeholder:text-[#8C93A3] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/80 transition-colors`}
              />
              {search.length > 0 && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setSearch('');
                    setVoiceError(null);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Aramayı Temizle"
                  className="absolute right-11 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[#9BA1AE] hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <VoiceSearchButton
                  tabIndex={-1}
                  onResult={(txt) => {
                    setSearch(txt);
                    setVoiceError(null);
                  }}
                  onFinalResult={(txt) => {
                    setSearch(txt);
                    setVoiceError(null);
                    searchInputRef.current?.focus();
                  }}
                  onListeningChange={(active) => {
                    setVoiceListening(active);
                    if (active) setVoiceError(null);
                  }}
                  onError={(msg) => setVoiceError(msg)}
                />
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#9BA1AE] shrink-0">
              {filteredChannels.length} / {channels.length} Kanal
            </span>
          </div>

          {(voiceListening || voiceError) && (
            <p
              className={`text-xs ${
                voiceError ? 'text-rose-300' : 'text-amber-300 font-medium'
              }`}
              role="status"
            >
              {voiceError ?? 'Dinleniyor... Kanal veya program adını söyleyin.'}
            </p>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((cat) => {
              const catTheme = TV_CATEGORY_THEMES[cat.id];
              const isSelected = category === cat.id;
              return (
                <button
                  key={`modal-cat-${cat.id}`}
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setCategory(cat.id);
                    window.requestAnimationFrame(() => {
                      itemRefs.current[0]?.focus();
                    });
                  }}
                  className={`min-h-[40px] px-3.5 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? catTheme.tabActive
                      : 'bg-[#141923] border-white/10 text-[#D1D5DB] hover:bg-white/12'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel Grid */}
        <div
          className={`flex-1 overflow-y-auto ${
            isPortraitLayout ? 'p-2.5' : 'p-3 sm:p-5'
          }`}
        >
          {filteredChannels.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-[#B5BBC7]">Aramanıza uygun TV kanalı bulunamadı.</p>
              <button
                ref={resetFilterBtnRef}
                type="button"
                onClick={() => {
                  setCategory('all');
                  setSearch('');
                  window.requestAnimationFrame(() => {
                    itemRefs.current[0]?.focus();
                  });
                }}
                className="min-h-[40px] px-4 rounded-xl bg-amber-500 text-[#120D05] text-xs font-semibold hover:bg-amber-400"
              >
                Tüm Kanalları Göster
              </button>
            </div>
          ) : (
            <div
              className={`grid ${
                isPortraitLayout
                  ? 'grid-cols-1 gap-2'
                  : 'grid-cols-2 lg:grid-cols-3 gap-2.5'
              }`}
            >
              {filteredChannels.map((ch, idx) => {
                const isPlaying = activeChannel?.id === ch.id;
                const epg = getChannelEpg(ch);
                return (
                  <button
                    key={`modal-ch-${ch.id}`}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    onFocus={(e) => {
                      e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }}
                    onClick={() => {
                      onSelectChannel(ch);
                      onClose();
                    }}
                    className={`relative text-left ${
                      isPortraitLayout ? 'p-2.5 min-h-[72px]' : 'p-3 min-h-[92px]'
                    } rounded-xl border-2 outline-none focus:outline-none focus-visible:outline-none transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out transform-gpu motion-reduce:transition-none motion-reduce:focus:scale-100 flex flex-col justify-between gap-1.5 focus:z-10 focus:scale-[1.02] ${
                      isPlaying
                        ? 'bg-amber-500/18 border-amber-400/75 focus:bg-amber-500/24 focus-visible:ring-0 focus:border-[var(--active-accent)] focus-visible:border-[var(--active-accent)] focus:shadow-[0_0_0_2px_var(--active-accent),0_12px_28px_-8px_rgba(0,0,0,0.85)]'
                        : `bg-[#151A24] border-white/10 hover:border-white/25 hover:bg-[#1B2230] focus:bg-[#1E2636] focus:border-white/80 focus:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.75)] focus-visible:ring-2 ${theme.ringClass}`
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChannelBadgeIcon name={ch.name} kind="tv" category={ch.category} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold tabular-nums shrink-0 ${
                                isPlaying
                                  ? 'bg-amber-400/25 text-amber-200 border border-amber-300/40'
                                  : 'bg-white/10 text-[#D1D5DB] border border-white/12'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-semibold text-white truncate">
                              {ch.name}
                            </span>
                          </div>
                          {isPlaying ? (
                            <span className="text-[10px] font-bold text-amber-300 shrink-0">
                              YAYINDA
                            </span>
                          ) : (
                            <Play className="w-3.5 h-3.5 text-[#8C93A3] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#9BA1AE] truncate mt-0.5">
                          {ch.resolution} · {ch.satellite}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-white/8 space-y-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ProgramTypeIcon type={epg.current.category} size="xs" />
                        <span className="text-[11px] text-[#D1D5DB] truncate flex-1">
                          {epg.current.title}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-[#9BA1AE] shrink-0">
                          {epg.current.startTime}
                        </span>
                      </div>
                      {typeof epg.current.progress === 'number' && (
                        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${epg.current.progress}%`,
                              backgroundColor: isPlaying ? '#F59E0B' : theme.accentHex,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalTarget);
}

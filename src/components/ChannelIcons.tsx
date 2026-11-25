import { useState } from 'react';
import {
  BookOpen,
  Clapperboard,
  Compass,
  Mic2,
  MoonStar,
  Music2,
  Newspaper,
  Radio,
  Smile,
  Sparkles,
  Trophy,
  Tv,
} from 'lucide-react';
import type { EpgProgramType, StationCategory, TvCategory } from '../types.ts';

// Cengiz TV & Radyo Programa Özel Simge (Header, Idle Screen, Brand Mark)
export function CengizBrandEmblem({
  accentHex = '#10B981',
  className = 'w-8 h-8',
}: {
  accentHex?: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cengizBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#121822" />
          <stop offset="100%" stopColor="#1B2433" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill="url(#cengizBg)" />
      {/* Broadcast Antenna */}
      <path
        d="M14 7 L18 3.5 L22 7"
        fill="none"
        stroke={accentHex}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* TV Screen Frame */}
      <rect
        x="4.5"
        y="7.5"
        width="27"
        height="21"
        rx="5"
        fill="none"
        stroke={accentHex}
        strokeWidth="2.1"
      />
      {/* Stylized "C" Broadcast Crest + Live Wave */}
      <path
        d="M15.5 13.5 A4.5 4.5 0 1 0 15.5 22.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M19 18 C20.5 14.2, 22.5 21.8, 24.5 18 C26 15, 27.5 18, 28.2 18"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Programa Özel Simgeler (Haber, Dini, Müzik, Dizi, Belgesel, Spor, Sohbet, Eğlence, Çocuk)
const PROGRAM_TYPE_META: Record<
  EpgProgramType,
  { label: string; colorClass: string; badgeBg: string }
> = {
  haber: {
    label: 'Haber',
    colorClass: 'text-sky-300',
    badgeBg: 'bg-sky-500/18 border-sky-400/40 text-sky-300',
  },
  dini: {
    label: 'Maneviyat',
    colorClass: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/18 border-emerald-400/40 text-emerald-300',
  },
  muzik: {
    label: 'Müzik',
    colorClass: 'text-fuchsia-300',
    badgeBg: 'bg-fuchsia-500/18 border-fuchsia-400/40 text-fuchsia-300',
  },
  dizi: {
    label: 'Dizi & Sinema',
    colorClass: 'text-rose-300',
    badgeBg: 'bg-rose-500/18 border-rose-400/40 text-rose-300',
  },
  belgesel: {
    label: 'Belgesel',
    colorClass: 'text-purple-300',
    badgeBg: 'bg-purple-500/18 border-purple-400/40 text-purple-300',
  },
  eglence: {
    label: 'Eğlence',
    colorClass: 'text-amber-300',
    badgeBg: 'bg-amber-500/18 border-amber-400/40 text-amber-300',
  },
  sohbet: {
    label: 'Sohbet',
    colorClass: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/18 border-cyan-400/40 text-cyan-300',
  },
  spor: {
    label: 'Spor',
    colorClass: 'text-lime-300',
    badgeBg: 'bg-lime-500/18 border-lime-400/40 text-lime-300',
  },
  cocuk: {
    label: 'Çocuk',
    colorClass: 'text-yellow-300',
    badgeBg: 'bg-yellow-500/18 border-yellow-400/40 text-yellow-300',
  },
};

export function ProgramTypeIcon({
  type,
  showLabel = false,
  size = 'sm',
}: {
  type: EpgProgramType;
  showLabel?: boolean;
  size?: 'xs' | 'sm';
}) {
  const meta = PROGRAM_TYPE_META[type] ?? PROGRAM_TYPE_META.eglence;
  const iconCls = size === 'xs' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0';

  const renderGlyph = () => {
    switch (type) {
      case 'haber':
        return <Newspaper className={iconCls} />;
      case 'dini':
        return <MoonStar className={iconCls} />;
      case 'muzik':
        return <Music2 className={iconCls} />;
      case 'dizi':
        return <Clapperboard className={iconCls} />;
      case 'belgesel':
        return <Compass className={iconCls} />;
      case 'sohbet':
        return <Mic2 className={iconCls} />;
      case 'spor':
        return <Trophy className={iconCls} />;
      case 'cocuk':
        return <Smile className={iconCls} />;
      case 'eglence':
      default:
        return <Sparkles className={iconCls} />;
    }
  };

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium shrink-0 ${meta.badgeBg}`}
      >
        {renderGlyph()}
        <span>{meta.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md border shrink-0 ${meta.badgeBg}`}
      title={meta.label}
      aria-label={meta.label}
    >
      {renderGlyph()}
    </span>
  );
}

// Kanalların Simgesi İkonlar (TV & Radyo İstasyonlarına Özel Rozet + İkon)
interface ChannelVisualSpec {
  shortCode: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
  motif: 'tv' | 'radio' | 'crescent' | 'news' | 'music' | 'book' | 'sports' | 'cinema';
}

const KNOWN_CHANNEL_BRANDS: Array<{ match: string; spec: ChannelVisualSpec }> = [
  { match: 'trt 1', spec: { shortCode: 'TRT1', bgHex: '#991B1B', borderHex: '#F87171', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'trt haber', spec: { shortCode: 'TRT H', bgHex: '#B91C1C', borderHex: '#FCA5A5', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'trt türk', spec: { shortCode: 'TRT T', bgHex: '#9F1239', borderHex: '#FDA4AF', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'trt müzik', spec: { shortCode: 'TRT M', bgHex: '#7E22CE', borderHex: '#D8B4FE', textHex: '#FFFFFF', motif: 'music' } },
  { match: 'trt fm', spec: { shortCode: 'TRTFM', bgHex: '#BE123C', borderHex: '#FDA4AF', textHex: '#FFFFFF', motif: 'radio' } },
  { match: 'trt türkü', spec: { shortCode: 'TÜRKÜ', bgHex: '#C2410C', borderHex: '#FDBA74', textHex: '#FFFFFF', motif: 'music' } },
  { match: 'kanal d', spec: { shortCode: 'KD', bgHex: '#0369A1', borderHex: '#38BDF8', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'star', spec: { shortCode: 'STAR', bgHex: '#4338CA', borderHex: '#A5B4FC', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'show', spec: { shortCode: 'SHOW', bgHex: '#B45309', borderHex: '#FCD34D', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'atv', spec: { shortCode: 'ATV', bgHex: '#1E293B', borderHex: '#F59E0B', textHex: '#FCD34D', motif: 'tv' } },
  { match: 'tv8', spec: { shortCode: 'TV8', bgHex: '#1D4ED8', borderHex: '#93C5FD', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'now', spec: { shortCode: 'NOW', bgHex: '#EA580C', borderHex: '#FED7AA', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'ntv', spec: { shortCode: 'NTV', bgHex: '#0F172A', borderHex: '#38BDF8', textHex: '#38BDF8', motif: 'news' } },
  { match: 'habertürk', spec: { shortCode: 'HT', bgHex: '#991B1B', borderHex: '#F87171', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'cnn', spec: { shortCode: 'CNN', bgHex: '#B91C1C', borderHex: '#FCA5A5', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'halk tv', spec: { shortCode: 'HALK', bgHex: '#1E40AF', borderHex: '#93C5FD', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'a haber', spec: { shortCode: 'AHBR', bgHex: '#DC2626', borderHex: '#FCA5A5', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'cnbc', spec: { shortCode: 'CNBC', bgHex: '#0F766E', borderHex: '#5EEAD4', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'bloomberg', spec: { shortCode: 'BHT', bgHex: '#1E1B4B', borderHex: '#818CF8', textHex: '#FFFFFF', motif: 'news' } },
  { match: 'diyanet', spec: { shortCode: 'DYN', bgHex: '#065F46', borderHex: '#34D399', textHex: '#ECFDF5', motif: 'crescent' } },
  { match: 'dost', spec: { shortCode: 'DOST', bgHex: '#047857', borderHex: '#6EE7B7', textHex: '#FFFFFF', motif: 'book' } },
  { match: 'semerkand', spec: { shortCode: 'SMR', bgHex: '#064E3B', borderHex: '#10B981', textHex: '#A7F3D0', motif: 'crescent' } },
  { match: 'lalegül', spec: { shortCode: 'LAL', bgHex: '#14532D', borderHex: '#4ADE80', textHex: '#FFFFFF', motif: 'crescent' } },
  { match: 'lalegul', spec: { shortCode: 'LAL', bgHex: '#14532D', borderHex: '#4ADE80', textHex: '#FFFFFF', motif: 'crescent' } },
  { match: 'akra', spec: { shortCode: 'AKRA', bgHex: '#065F46', borderHex: '#6EE7B7', textHex: '#FFFFFF', motif: 'crescent' } },
  { match: 'erkam', spec: { shortCode: 'ERK', bgHex: '#115E59', borderHex: '#5EEAD4', textHex: '#FFFFFF', motif: 'crescent' } },
  { match: 'moral', spec: { shortCode: 'MRL', bgHex: '#0F766E', borderHex: '#99F6E4', textHex: '#FFFFFF', motif: 'book' } },
  { match: 'kral', spec: { shortCode: 'KRAL', bgHex: '#9D174D', borderHex: '#F472B6', textHex: '#FFFFFF', motif: 'music' } },
  { match: 'baba', spec: { shortCode: 'BABA', bgHex: '#881337', borderHex: '#FB7185', textHex: '#FFFFFF', motif: 'music' } },
  { match: 'tgrt', spec: { shortCode: 'TGRT', bgHex: '#1E3A8A', borderHex: '#60A5FA', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'kanal 7', spec: { shortCode: 'K7', bgHex: '#9A3412', borderHex: '#FB923C', textHex: '#FFFFFF', motif: 'tv' } },
  { match: 'trt spor yıldız', spec: { shortCode: 'YILDZ', bgHex: '#14532D', borderHex: '#4ADE80', textHex: '#FFFFFF', motif: 'sports' } },
  { match: 'trt spor', spec: { shortCode: 'TRTSP', bgHex: '#166534', borderHex: '#22C55E', textHex: '#FFFFFF', motif: 'sports' } },
  { match: 'a spor', spec: { shortCode: 'ASPOR', bgHex: '#15803D', borderHex: '#86EFAC', textHex: '#FFFFFF', motif: 'sports' } },
  { match: 'ht spor', spec: { shortCode: 'HTSP', bgHex: '#065F46', borderHex: '#34D399', textHex: '#FFFFFF', motif: 'sports' } },
  { match: 'fb tv', spec: { shortCode: 'FBTV', bgHex: '#1E3A8A', borderHex: '#FACC15', textHex: '#FDE047', motif: 'sports' } },
  { match: 'tjk', spec: { shortCode: 'TJK', bgHex: '#14532D', borderHex: '#A3E635', textHex: '#FFFFFF', motif: 'sports' } },
  { match: 'trt 2', spec: { shortCode: 'TRT2', bgHex: '#831843', borderHex: '#F472B6', textHex: '#FFFFFF', motif: 'cinema' } },
  { match: 'tv4', spec: { shortCode: 'TV4', bgHex: '#9D174D', borderHex: '#EC4899', textHex: '#FFFFFF', motif: 'cinema' } },
];

function resolveChannelSpec(
  name: string,
  kind: 'tv' | 'radio',
  category?: TvCategory | StationCategory,
): ChannelVisualSpec {
  const lower = name.toLowerCase();
  for (const item of KNOWN_CHANNEL_BRANDS) {
    if (lower.includes(item.match)) return item.spec;
  }

  const words = name
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : (words[0]?.slice(0, 3) || (kind === 'tv' ? 'TV' : 'RD')).toUpperCase();

  if (category === 'dini' || category === 'ilahi') {
    return { shortCode: initials, bgHex: '#064E3B', borderHex: '#34D399', textHex: '#A7F3D0', motif: 'crescent' };
  }
  if (category === 'haber') {
    return { shortCode: initials, bgHex: '#1E3A8A', borderHex: '#60A5FA', textHex: '#DBEAFE', motif: 'news' };
  }
  if (category === 'arabesk' || category === 'turku' || category === 'pop' || category === 'slow' || category === 'ozgun') {
    return { shortCode: initials, bgHex: '#31162B', borderHex: '#F472B6', textHex: '#FCE7F3', motif: 'music' };
  }
  if (category === 'spor') {
    return { shortCode: initials, bgHex: '#14532D', borderHex: '#22C55E', textHex: '#DCFCE7', motif: 'sports' };
  }
  if (category === 'sinema') {
    return { shortCode: initials, bgHex: '#831843', borderHex: '#EC4899', textHex: '#FCE7F3', motif: 'cinema' };
  }
  if (category === 'kultur') {
    return { shortCode: initials, bgHex: '#3B1D54', borderHex: '#C084FC', textHex: '#F3E8FF', motif: 'book' };
  }

  return {
    shortCode: initials,
    bgHex: kind === 'tv' ? '#1E2430' : '#18222C',
    borderHex: kind === 'tv' ? '#EF4444' : '#F59E0B',
    textHex: '#F4F5F7',
    motif: kind === 'tv' ? 'tv' : 'radio',
  };
}

export function ChannelBadgeIcon({
  name,
  kind,
  category,
  size = 'md',
}: {
  name: string;
  kind: 'tv' | 'radio';
  category?: TvCategory | StationCategory;
  size?: 'sm' | 'md' | 'lg';
}) {
  const spec = resolveChannelSpec(name, kind, category);

  const boxSize =
    size === 'lg'
      ? 'w-14 h-14 rounded-2xl'
      : size === 'sm'
        ? 'w-9 h-9 rounded-lg'
        : 'w-11 h-11 rounded-xl';

  const motifIcon = () => {
    const cls = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    switch (spec.motif) {
      case 'crescent':
        return <MoonStar className={cls} />;
      case 'news':
        return <Newspaper className={cls} />;
      case 'music':
        return <Music2 className={cls} />;
      case 'book':
        return <BookOpen className={cls} />;
      case 'sports':
        return <Trophy className={cls} />;
      case 'cinema':
        return <Clapperboard className={cls} />;
      case 'tv':
        return <Tv className={cls} />;
      case 'radio':
      default:
        return <Radio className={cls} />;
    }
  };

  return (
    <div
      className={`${boxSize} border flex flex-col items-center justify-center shrink-0 select-none shadow-sm`}
      style={{
        backgroundColor: spec.bgHex,
        borderColor: spec.borderHex,
        color: spec.textHex,
      }}
      aria-hidden="true"
    >
      {motifIcon()}
      <span
        className={`font-mono font-bold leading-none mt-0.5 tracking-tight ${
          size === 'lg' ? 'text-[11px]' : 'text-[9px]'
        }`}
      >
        {spec.shortCode}
      </span>
    </div>
  );
}


// Resmi kanal alan adlarından logo/favikon yükler; erişilemeyen logoda tasarımlı rozet kullanır.
const CHANNEL_LOGO_DOMAINS: Array<{ match: string; domain: string }> = [
  { match: 'kanal d', domain: 'kanald.com.tr' },
  { match: 'star tv', domain: 'startv.com.tr' },
  { match: 'tv8', domain: 'tv8.com.tr' },
  { match: 'show tv', domain: 'showtv.com.tr' },
  { match: 'atv', domain: 'atv.com.tr' },
  { match: 'now', domain: 'nowtv.com.tr' },
  { match: 'trt haber', domain: 'trthaber.com' },
  { match: 'trt türk', domain: 'trtturk.com.tr' },
  { match: 'trt müzik', domain: 'trtmuzik.net.tr' },
  { match: 'trt 1', domain: 'trt1.com.tr' },
  { match: 'trt 2', domain: 'trt2.com.tr' },
  { match: 'trt spor yıldız', domain: 'trtspor.com.tr' },
  { match: 'trt spor', domain: 'trtspor.com.tr' },
  { match: 'diyanet', domain: 'diyanet.tv' },
  { match: 'ntv', domain: 'ntv.com.tr' },
  { match: 'habertürk', domain: 'haberturk.com' },
  { match: 'halk tv', domain: 'halktv.com.tr' },
  { match: 'a haber', domain: 'ahaber.com.tr' },
  { match: 'a spor', domain: 'aspor.com.tr' },
  { match: 'cnbc', domain: 'cnbce.com' },
  { match: 'bloomberg', domain: 'bloomberght.com' },
  { match: 'tgrt', domain: 'tgrthaber.com' },
  { match: 'kanal 7', domain: 'kanal7.com' },
  { match: '360 tv', domain: 'tv360.com.tr' },
  { match: '24 tv', domain: 'tv24.com.tr' },
  { match: 'fb tv', domain: 'fenerbahce.org' },
  { match: 'kral', domain: 'kralmuzik.com.tr' },
  { match: 'akra', domain: 'akradyo.com.tr' },
  { match: 'lalegül', domain: 'lalegul.com.tr' },
  { match: 'lalegul', domain: 'lalegul.com.tr' },
  { match: 'trt fm', domain: 'trtfm.net' },
  { match: 'trt türkü', domain: 'trtturku.net' },
  { match: 'süper fm', domain: 'superfm.com.tr' },
  { match: 'joy türk', domain: 'joyturk.com' },
  { match: 'slow türk', domain: 'slowturk.com.tr' },
  { match: 'kafa radyo', domain: 'kafaradyo.com' },
  { match: 'radyo fenomen', domain: 'radyofenomen.com' },
  { match: 'ntv radyo', domain: 'ntvradyo.com.tr' },
];

export function ChannelLogo({
  name,
  kind,
  category,
  size = 'md',
}: {
  name: string;
  kind: 'tv' | 'radio';
  category?: TvCategory | StationCategory;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const normalized = name.toLocaleLowerCase('tr-TR');
  const match = CHANNEL_LOGO_DOMAINS.find((item) => normalized.includes(item.match));
  const logoUrl = match
    ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${match.domain}`)}&sz=128`
    : null;
  const dimensions = size === 'lg' ? 'w-14 h-14 rounded-2xl' : size === 'sm' ? 'w-9 h-9 rounded-lg' : 'w-11 h-11 rounded-xl';

  if (!logoUrl || failed) {
    return <ChannelBadgeIcon name={name} kind={kind} category={category} size={size} />;
  }

  return (
    <div
      className={`${dimensions} shrink-0 flex items-center justify-center overflow-hidden border border-white/15 bg-white rounded-xl shadow-lg shadow-black/20 p-1.5`}
      title={`${name} kanal logosu`}
    >
      <img
        src={logoUrl}
        alt={`${name} logosu`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

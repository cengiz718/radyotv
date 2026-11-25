import type { CustomThemeMode, FilterTab, SurfaceTone, TvCategory } from '../types.ts';

export interface CategoryTheme {
  accentHex: string;
  accentLightHex: string;
  glowRgba: string;
  tabActive: string;
  cardBorder: string;
  ctaBg: string;
  textAccent: string;
  ringClass: string;
  tintBg: string;
}

export const SURFACE_TONE_STYLES: Record<
  SurfaceTone,
  { label: string; pageBg: string; cardBg: string; headerBg: string }
> = {
  default: {
    label: 'Koyu Antrasit',
    pageBg: '#0D0F12',
    cardBg: 'rgba(20, 24, 32, 0.94)',
    headerBg: 'rgba(13, 15, 18, 0.95)',
  },
  amoled: {
    label: 'Tam Siyah (AMOLED)',
    pageBg: '#000000',
    cardBg: 'rgba(12, 13, 16, 0.96)',
    headerBg: 'rgba(0, 0, 0, 0.97)',
  },
  slate: {
    label: 'Gece Laciverti',
    pageBg: '#0A101D',
    cardBg: 'rgba(17, 25, 42, 0.94)',
    headerBg: 'rgba(10, 16, 29, 0.95)',
  },
};

export const RADIO_CATEGORY_THEMES: Record<FilterTab, CategoryTheme> = {
  ilahi: {
    accentHex: '#10B981',
    accentLightHex: '#6EE7B7',
    glowRgba: 'rgba(16, 185, 129, 0.14)',
    tabActive: 'bg-emerald-500 text-[#07130E] border-emerald-400 font-semibold',
    cardBorder: 'border-emerald-400/80 bg-[#13221C]/95',
    ctaBg: 'bg-emerald-500 hover:bg-emerald-400 text-[#07130E]',
    textAccent: 'text-emerald-400',
    ringClass: 'focus-visible:ring-emerald-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)',
  },
  all: {
    accentHex: '#F59E0B',
    accentLightHex: '#FCD34D',
    glowRgba: 'rgba(245, 158, 11, 0.14)',
    tabActive: 'bg-amber-500 text-[#120D05] border-amber-400 font-semibold',
    cardBorder: 'border-amber-400/80 bg-[#221D13]/95',
    ctaBg: 'bg-amber-500 hover:bg-amber-400 text-[#120D05]',
    textAccent: 'text-amber-400',
    ringClass: 'focus-visible:ring-amber-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(245,158,11,0.16), transparent 70%)',
  },
  arabesk: {
    accentHex: '#F43F5E',
    accentLightHex: '#FDA4AF',
    glowRgba: 'rgba(244, 63, 94, 0.15)',
    tabActive: 'bg-rose-500 text-white border-rose-400 font-semibold',
    cardBorder: 'border-rose-400/80 bg-[#241319]/95',
    ctaBg: 'bg-rose-500 hover:bg-rose-400 text-white',
    textAccent: 'text-rose-400',
    ringClass: 'focus-visible:ring-rose-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(244,63,94,0.16), transparent 70%)',
  },
  ozgun: {
    accentHex: '#818CF8',
    accentLightHex: '#C7D2FE',
    glowRgba: 'rgba(129, 140, 248, 0.15)',
    tabActive: 'bg-indigo-500 text-white border-indigo-400 font-semibold',
    cardBorder: 'border-indigo-400/80 bg-[#171929]/95',
    ctaBg: 'bg-indigo-500 hover:bg-indigo-400 text-white',
    textAccent: 'text-indigo-400',
    ringClass: 'focus-visible:ring-indigo-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(129,140,248,0.16), transparent 70%)',
  },
  turku: {
    accentHex: '#FB923C',
    accentLightHex: '#FED7AA',
    glowRgba: 'rgba(251, 146, 60, 0.15)',
    tabActive: 'bg-orange-500 text-[#140B04] border-orange-400 font-semibold',
    cardBorder: 'border-orange-400/80 bg-[#251A12]/95',
    ctaBg: 'bg-orange-500 hover:bg-orange-400 text-[#140B04]',
    textAccent: 'text-orange-400',
    ringClass: 'focus-visible:ring-orange-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(251,146,60,0.16), transparent 70%)',
  },
  pop: {
    accentHex: '#E879F9',
    accentLightHex: '#F5D0FE',
    glowRgba: 'rgba(232, 121, 249, 0.14)',
    tabActive: 'bg-fuchsia-500 text-white border-fuchsia-400 font-semibold',
    cardBorder: 'border-fuchsia-400/80 bg-[#231426]/95',
    ctaBg: 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white',
    textAccent: 'text-fuchsia-400',
    ringClass: 'focus-visible:ring-fuchsia-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,121,249,0.15), transparent 70%)',
  },
  slow: {
    accentHex: '#38BDF8',
    accentLightHex: '#BAE6FD',
    glowRgba: 'rgba(56, 189, 248, 0.14)',
    tabActive: 'bg-sky-500 text-[#071219] border-sky-400 font-semibold',
    cardBorder: 'border-sky-400/80 bg-[#121F28]/95',
    ctaBg: 'bg-sky-500 hover:bg-sky-400 text-[#071219]',
    textAccent: 'text-sky-400',
    ringClass: 'focus-visible:ring-sky-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(56,189,248,0.15), transparent 70%)',
  },
  haber: {
    accentHex: '#60A5FA',
    accentLightHex: '#BFDBFE',
    glowRgba: 'rgba(96, 165, 250, 0.15)',
    tabActive: 'bg-blue-500 text-white border-blue-400 font-semibold',
    cardBorder: 'border-blue-400/80 bg-[#141C2B]/95',
    ctaBg: 'bg-blue-500 hover:bg-blue-400 text-white',
    textAccent: 'text-blue-400',
    ringClass: 'focus-visible:ring-blue-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(96,165,250,0.16), transparent 70%)',
  },
  favorites: {
    accentHex: '#FACC15',
    accentLightHex: '#FEF08A',
    glowRgba: 'rgba(250, 204, 21, 0.14)',
    tabActive: 'bg-yellow-400 text-[#141004] border-yellow-300 font-semibold',
    cardBorder: 'border-yellow-400/80 bg-[#232012]/95',
    ctaBg: 'bg-yellow-400 hover:bg-yellow-300 text-[#141004]',
    textAccent: 'text-yellow-400',
    ringClass: 'focus-visible:ring-yellow-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(250,204,21,0.15), transparent 70%)',
  },
  recent: {
    accentHex: '#2DD4BF',
    accentLightHex: '#99F6E4',
    glowRgba: 'rgba(45, 212, 191, 0.14)',
    tabActive: 'bg-teal-400 text-[#061412] border-teal-300 font-semibold',
    cardBorder: 'border-teal-400/80 bg-[#122220]/95',
    ctaBg: 'bg-teal-400 hover:bg-teal-300 text-[#061412]',
    textAccent: 'text-teal-400',
    ringClass: 'focus-visible:ring-teal-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(45,212,191,0.15), transparent 70%)',
  },
};

export const TV_CATEGORY_THEMES: Record<TvCategory, CategoryTheme> = {
  all: {
    accentHex: '#EF4444',
    accentLightHex: '#FCA5A5',
    glowRgba: 'rgba(239, 68, 68, 0.15)',
    tabActive: 'bg-red-500 text-white border-red-400 font-semibold',
    cardBorder: 'border-red-400/80 bg-[#241416]/95',
    ctaBg: 'bg-red-500 hover:bg-red-400 text-white',
    textAccent: 'text-red-400',
    ringClass: 'focus-visible:ring-red-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(239,68,68,0.16), transparent 70%)',
  },
  ulusal: {
    accentHex: '#F59E0B',
    accentLightHex: '#FCD34D',
    glowRgba: 'rgba(245, 158, 11, 0.15)',
    tabActive: 'bg-amber-500 text-[#120D05] border-amber-400 font-semibold',
    cardBorder: 'border-amber-400/80 bg-[#221D13]/95',
    ctaBg: 'bg-amber-500 hover:bg-amber-400 text-[#120D05]',
    textAccent: 'text-amber-400',
    ringClass: 'focus-visible:ring-amber-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(245,158,11,0.16), transparent 70%)',
  },
  spor: {
    accentHex: '#22C55E',
    accentLightHex: '#86EFAC',
    glowRgba: 'rgba(34, 197, 94, 0.16)',
    tabActive: 'bg-green-500 text-[#05160B] border-green-400 font-semibold',
    cardBorder: 'border-green-400/80 bg-[#112418]/95',
    ctaBg: 'bg-green-500 hover:bg-green-400 text-[#05160B]',
    textAccent: 'text-green-400',
    ringClass: 'focus-visible:ring-green-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(34,197,94,0.16), transparent 70%)',
  },
  sinema: {
    accentHex: '#EC4899',
    accentLightHex: '#F9A8D4',
    glowRgba: 'rgba(236, 72, 153, 0.16)',
    tabActive: 'bg-pink-500 text-white border-pink-400 font-semibold',
    cardBorder: 'border-pink-400/80 bg-[#261220]/95',
    ctaBg: 'bg-pink-500 hover:bg-pink-400 text-white',
    textAccent: 'text-pink-400',
    ringClass: 'focus-visible:ring-pink-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(236,72,153,0.16), transparent 70%)',
  },
  haber: {
    accentHex: '#3B82F6',
    accentLightHex: '#93C5FD',
    glowRgba: 'rgba(59, 130, 246, 0.15)',
    tabActive: 'bg-blue-500 text-white border-blue-400 font-semibold',
    cardBorder: 'border-blue-400/80 bg-[#141C2B]/95',
    ctaBg: 'bg-blue-500 hover:bg-blue-400 text-white',
    textAccent: 'text-blue-400',
    ringClass: 'focus-visible:ring-blue-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(59,130,246,0.16), transparent 70%)',
  },
  dini: {
    accentHex: '#10B981',
    accentLightHex: '#6EE7B7',
    glowRgba: 'rgba(16, 185, 129, 0.15)',
    tabActive: 'bg-emerald-500 text-[#07130E] border-emerald-400 font-semibold',
    cardBorder: 'border-emerald-400/80 bg-[#13221C]/95',
    ctaBg: 'bg-emerald-500 hover:bg-emerald-400 text-[#07130E]',
    textAccent: 'text-emerald-400',
    ringClass: 'focus-visible:ring-emerald-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)',
  },
  kultur: {
    accentHex: '#A855F7',
    accentLightHex: '#D8B4FE',
    glowRgba: 'rgba(168, 85, 247, 0.15)',
    tabActive: 'bg-purple-500 text-white border-purple-400 font-semibold',
    cardBorder: 'border-purple-400/80 bg-[#1E1529]/95',
    ctaBg: 'bg-purple-500 hover:bg-purple-400 text-white',
    textAccent: 'text-purple-400',
    ringClass: 'focus-visible:ring-purple-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(168,85,247,0.16), transparent 70%)',
  },
  recent: {
    accentHex: '#2DD4BF',
    accentLightHex: '#99F6E4',
    glowRgba: 'rgba(45, 212, 191, 0.15)',
    tabActive: 'bg-teal-400 text-[#061412] border-teal-300 font-semibold',
    cardBorder: 'border-teal-400/80 bg-[#122220]/95',
    ctaBg: 'bg-teal-400 hover:bg-teal-300 text-[#061412]',
    textAccent: 'text-teal-400',
    ringClass: 'focus-visible:ring-teal-400',
    tintBg: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(45,212,191,0.15), transparent 70%)',
  },
};

export const CUSTOM_THEME_OPTIONS: Array<{
  id: CustomThemeMode;
  label: string;
  swatchHex: string;
}> = [
  { id: 'auto', label: 'Kategoriye Göre Renkli', swatchHex: '#10B981' },
  { id: 'emerald', label: 'Zümrüt Yeşil', swatchHex: '#10B981' },
  { id: 'amber', label: 'Kehribar Altın', swatchHex: '#F59E0B' },
  { id: 'sky', label: 'Okyanus Mavi', swatchHex: '#38BDF8' },
  { id: 'rose', label: 'Yakut Kırmızı', swatchHex: '#F43F5E' },
  { id: 'indigo', label: 'Gece İndigo', swatchHex: '#818CF8' },
];

export function resolveCustomTheme(
  themeMode: CustomThemeMode,
  fallback: CategoryTheme,
): CategoryTheme {
  if (themeMode === 'auto') return fallback;
  const map: Record<Exclude<CustomThemeMode, 'auto'>, CategoryTheme> = {
    emerald: RADIO_CATEGORY_THEMES.ilahi,
    amber: RADIO_CATEGORY_THEMES.all,
    sky: RADIO_CATEGORY_THEMES.slow,
    rose: RADIO_CATEGORY_THEMES.arabesk,
    indigo: RADIO_CATEGORY_THEMES.ozgun,
  };
  return map[themeMode];
}


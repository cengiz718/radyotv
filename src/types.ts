export type StationLanguage = 'turkish';

export type StationCategory =
  | 'ilahi'
  | 'arabesk'
  | 'ozgun'
  | 'turku'
  | 'pop'
  | 'slow'
  | 'haber';

export interface RadioStation {
  id: string;
  name: string;
  language: StationLanguage;
  category: StationCategory;
  genre: string;
  city: string;
  streamUrl: string;
  format: 'MP3' | 'AAC' | 'HLS';
  bitrate?: number;
  needsProxy?: boolean;
  isCustom?: boolean;
}

export type FilterTab =
  | 'ilahi'
  | 'all'
  | 'arabesk'
  | 'ozgun'
  | 'turku'
  | 'pop'
  | 'slow'
  | 'haber'
  | 'favorites'
  | 'recent';

export type BackgroundMode = 'landscapes' | 'fireplace' | 'dark';

export type AppView = 'radio' | 'tv' | 'artist' | 'spiritual';

export interface StationsResponse {
  stations: RadioStation[];
  total: number;
  catalogTotal: number;
  page: number;
  limit: number;
  totalPages: number;
  categoryCounts: Record<string, number>;
  catalogVersion?: string;
}

export interface LandscapeItem {
  id: string;
  title: string;
  imageUrl: string;
  source: string;
}

export interface LandscapesResponse {
  items: LandscapeItem[];
  total: number;
  page: number;
  limit: number;
}

export type TvCategory =
  | 'ulusal'
  | 'spor'
  | 'sinema'
  | 'haber'
  | 'dini'
  | 'kultur'
  | 'recent'
  | 'all';

export interface TvChannel {
  id: string;
  name: string;
  category: Exclude<TvCategory, 'all' | 'recent'>;
  resolution: string;
  streamUrl: string;
  needsProxy?: boolean;
  satellite: string;
}

export interface SystemStatusResponse {
  appVersion: string;
  catalogVersion: string;
  radioCount: number;
  tvCount: number;
  landscapeCount: number;
  lastUpdatedAt: string;
}

export interface DiyanetCity {
  SehirAdi: string;
  SehirID: string;
}

export interface DiyanetDistrict {
  IlceAdi: string;
  IlceID: string;
}

export interface PrayerTimesData {
  city: string;
  district: string;
  miladiDate: string;
  hicriDate: string;
  source: string;
  timings: {
    Imsak: string;
    Gunes: string;
    Ogle: string;
    Ikindi: string;
    Aksam: string;
    Yatsi: string;
  };
}

export interface DailyWisdomData {
  ayah: {
    turkish: string;
    reference: string;
    source: string;
  };
  hadith: {
    text: string;
    reference: string;
    source: string;
  };
}

export interface YouTubeArtistResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnailUrl: string;
}

export interface ArtistSearchResponse {
  query: string;
  youtubeResults: YouTubeArtistResult[];
  radioMatches: RadioStation[];
}

export type CustomThemeMode = 'auto' | 'emerald' | 'amber' | 'sky' | 'rose' | 'indigo';
export type SurfaceTone = 'default' | 'amoled' | 'slate';

export interface AppSettings {
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  showSpiritualStrip: boolean;
  enableDailyWisdomPopup: boolean;
  enableVisualizer: boolean;
  enableFireplaceEmbers: boolean;
  enablePrayerAlarm: boolean;
  enablePrayerAlarmSound: boolean;
  lowBandwidthMode: boolean;
  themeMode: CustomThemeMode;
  surfaceTone: SurfaceTone;
}

export type EpgProgramType =
  | 'haber'
  | 'dini'
  | 'muzik'
  | 'dizi'
  | 'belgesel'
  | 'eglence'
  | 'sohbet'
  | 'spor'
  | 'cocuk';

export interface EpgProgramItem {
  title: string;
  startTime: string;
  endTime: string;
  category: EpgProgramType;
  description: string;
  isLive?: boolean;
  progress?: number;
}

export interface ChannelEpgGuide {
  channelKey: string;
  channelName: string;
  current: EpgProgramItem;
  next: EpgProgramItem;
  schedule: EpgProgramItem[];
}

export type MatchSportType = 'futbol' | 'basketbol' | 'voleybol' | 'diger';

export interface MatchScheduleItem {
  id: string;
  title: string;
  league: string;
  sport: MatchSportType;
  channelName: string;
  playableChannelId?: string;
  isFreeToAir: boolean;
  dateStr: string;
  dateLabel: string;
  startTime: string;
  endTime?: string;
  startTimestamp: number;
  status: 'live' | 'upcoming' | 'finished';
  scoreText?: string;
  source: string;
}

export interface MatchScheduleResponse {
  updatedAt: string;
  todayDate: string;
  todayLabel: string;
  matches: MatchScheduleItem[];
  channelHighlights: string[];
  turkishOnly: true;
  adultBlocked: true;
}


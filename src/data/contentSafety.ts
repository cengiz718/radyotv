// Strictly Turkish-only and 18+ adult-content protection filters (permanent family-safe guard)

const ADULT_EXACT_REGEXES: RegExp[] = [
  /(?:^|[\s\-_/|,.;:()[\]])(?:\+?18\+?|\+\s*18|18\s*yaş|18\s*yas)(?:$|[\s\-_/|,.;:()[\]])/i,
  /\b(?:nsfw|xxx|porn|porno|erotic|erotik|playboy|penthouse|hustler|brazzers|dorcel|redlight|vivid|onlyfans|hentai|fetish|escort|casino|poker|kumar|bahis)\b/i,
  /\b(?:adult|sex)\b/i,
  /yetişkin|yetiskin|müstehcen|mustehcen|cinsel|çıplak|ciplak/i,
];

const FOREIGN_EXACT_REGEXES: RegExp[] = [
  /\b(?:arabic|arabi|english|russian|deutsch|german|french|greek|spanish|italian|persian|farsi|kurdish|kurdi|armenian|bollywood)\b/i,
  /kurdî|dengbêj|dengbej|rojava|govend|şivan|sivan perwer|zarok tv|med\s*muzik|diyar\s*tv/i,
  /trt\s*(?:world|arabi|kurd|kurdi|avaz)/i,
  /\bgem\b|gemtv|gemfilm|gemdrama|gemfit|gemseries|gemclassic|gembollywood|gemonyx|gempixel|gemriver|gemrubix/i,
  /mekameleen|thaqalayn|almahriah|rafidain|al-zahra|elsharq|\bqaf\s*tv\b|afroturk|fortuna\s*tv|kn\s*music|luys\s*tv|grand\s*cinema|4u\s*tv|4utv|viasat|national\s*geographic|spacetoon|al\s*jazeera|france\s*24|bbc\b/i,
];

export function isAdultContentText(value: string): boolean {
  if (!value) return false;
  return ADULT_EXACT_REGEXES.some((re) => re.test(value));
}

export function isForeignLanguageText(value: string): boolean {
  if (!value) return false;
  return FOREIGN_EXACT_REGEXES.some((re) => re.test(value));
}

export function isFamilySafeTurkishContent(value: string): boolean {
  return !isAdultContentText(value) && !isForeignLanguageText(value);
}

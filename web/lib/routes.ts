import { AIRPORTS } from "./airports";

export interface Route {
  origin: string;
  destination: string;
  slug: string;
}

/**
 * 35 curated routes, all >500 combined monthly search volume (EN+DE).
 * Slugs use English city names (not airport names). "delhi" not "new-delhi"
 * because that's what users search for.
 */
export const ROUTES: Route[] = [
  { origin: "BER", destination: "LHR", slug: "berlin-to-london" },
  { origin: "FRA", destination: "JFK", slug: "frankfurt-to-new-york" },
  { origin: "MUC", destination: "IST", slug: "munich-to-istanbul" },
  { origin: "BER", destination: "CDG", slug: "berlin-to-paris" },
  { origin: "FRA", destination: "DEL", slug: "frankfurt-to-delhi" },
  { origin: "BER", destination: "IST", slug: "berlin-to-istanbul" },
  { origin: "HAM", destination: "LHR", slug: "hamburg-to-london" },
  { origin: "FRA", destination: "BKK", slug: "frankfurt-to-bangkok" },
  { origin: "FRA", destination: "DXB", slug: "frankfurt-to-dubai" },
  { origin: "FRA", destination: "IST", slug: "frankfurt-to-istanbul" },
  { origin: "BER", destination: "BCN", slug: "berlin-to-barcelona" },
  { origin: "BER", destination: "AMS", slug: "berlin-to-amsterdam" },
  { origin: "FRA", destination: "LHR", slug: "frankfurt-to-london" },
  { origin: "MUC", destination: "LHR", slug: "munich-to-london" },
  { origin: "MUC", destination: "BKK", slug: "munich-to-bangkok" },
  { origin: "BER", destination: "FCO", slug: "berlin-to-rome" },
  { origin: "BER", destination: "LIS", slug: "berlin-to-lisbon" },
  { origin: "HAM", destination: "IST", slug: "hamburg-to-istanbul" },
  { origin: "BER", destination: "JFK", slug: "berlin-to-new-york" },
  { origin: "BER", destination: "DXB", slug: "berlin-to-dubai" },
  { origin: "FRA", destination: "FCO", slug: "frankfurt-to-rome" },
  { origin: "LHR", destination: "BER", slug: "london-to-berlin" },
  { origin: "MUC", destination: "BCN", slug: "munich-to-barcelona" },
  { origin: "MUC", destination: "DEL", slug: "munich-to-delhi" },
  { origin: "FRA", destination: "NRT", slug: "frankfurt-to-tokyo" },
  { origin: "FRA", destination: "BCN", slug: "frankfurt-to-barcelona" },
  { origin: "BER", destination: "NRT", slug: "berlin-to-tokyo" },
  { origin: "MUC", destination: "FCO", slug: "munich-to-rome" },
  { origin: "MUC", destination: "DXB", slug: "munich-to-dubai" },
  { origin: "MUC", destination: "JFK", slug: "munich-to-new-york" },
  { origin: "DEL", destination: "FRA", slug: "delhi-to-frankfurt" },
  { origin: "BER", destination: "ATH", slug: "berlin-to-athens" },
  { origin: "FRA", destination: "SIN", slug: "frankfurt-to-singapore" },
  { origin: "HAM", destination: "BCN", slug: "hamburg-to-barcelona" },
  { origin: "BER", destination: "TLV", slug: "berlin-to-tel-aviv" },
];

export const ROUTES_BY_SLUG = new Map(ROUTES.map((r) => [r.slug, r]));

export function getRouteBySlug(slug: string): Route | undefined {
  return ROUTES_BY_SLUG.get(slug);
}

const AIRPORT_BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));

/**
 * Locale-aware city names for the 19 cities in our route list.
 * Only includes entries where the localized name differs from English.
 * Key = English city name (from airports.ts), value = locale → localized name.
 */
const LOCALIZED_CITY_NAMES: Record<string, Partial<Record<string, string>>> = {
  London:    { de: "London", fr: "Londres", es: "Londres", it: "Londra", pt: "Londres", zh: "伦敦", ar: "لندن", hi: "लंदन", ja: "ロンドン", ko: "런던", tr: "Londra" },
  Munich:    { de: "München", fr: "Munich", es: "Múnich", it: "Monaco di Baviera", pt: "Munique", zh: "慕尼黑", ar: "ميونخ", hi: "म्यूनिख", ja: "ミュンヘン", ko: "뮌헨", tr: "Münih" },
  Rome:      { de: "Rom", fr: "Rome", es: "Roma", it: "Roma", pt: "Roma", zh: "罗马", ar: "روما", hi: "रोम", ja: "ローマ", ko: "로마", tr: "Roma" },
  Lisbon:    { de: "Lissabon", fr: "Lisbonne", es: "Lisboa", it: "Lisbona", pt: "Lisboa", zh: "里斯本", ar: "لشبونة", hi: "लिस्बन", ja: "リスボン", ko: "리스본", tr: "Lizbon" },
  Athens:    { de: "Athen", fr: "Athènes", es: "Atenas", it: "Atene", pt: "Atenas", zh: "雅典", ar: "أثينا", hi: "एथेंस", ja: "アテネ", ko: "아테네", tr: "Atina" },
  Istanbul:  { de: "Istanbul", fr: "Istanbul", es: "Estambul", it: "Istanbul", pt: "Istambul", zh: "伊斯坦布尔", ar: "إسطنبول", hi: "इस्तांबुल", ja: "イスタンブール", ko: "이스탄불", tr: "İstanbul" },
  Paris:     { zh: "巴黎", ar: "باريس", hi: "पेरिस", ja: "パリ", ko: "파리" },
  Berlin:    { zh: "柏林", ar: "برلين", hi: "बर्लिन", ja: "ベルリン", ko: "베를린" },
  Frankfurt: { zh: "法兰克福", ar: "فرانكفورت", hi: "फ्रैंकफर्ट", ja: "フランクフルト", ko: "프랑크푸르트" },
  Hamburg:   { de: "Hamburg", fr: "Hambourg", it: "Amburgo", zh: "汉堡", ar: "هامبورغ", hi: "हैम्बर्ग", ja: "ハンブルク", ko: "함부르크" },
  Barcelona: { fr: "Barcelone", it: "Barcellona", zh: "巴塞罗那", ar: "برشلونة", hi: "बार्सिलोना", ja: "バルセロナ", ko: "바르셀로나" },
  Amsterdam: { zh: "阿姆斯特丹", ar: "أمستردام", hi: "एम्स्टर्डम", ja: "アムステルダム", ko: "암스테르담" },
  "New York":{ zh: "纽约", ar: "نيويورك", hi: "न्यूयॉर्क", ja: "ニューヨーク", ko: "뉴욕" },
  Delhi:     { fr: "Delhi", zh: "德里", ar: "دلهي", hi: "दिल्ली", ja: "デリー", ko: "델리" },
  Dubai:     { fr: "Dubaï", zh: "迪拜", ar: "دبي", hi: "दुबई", ja: "ドバイ", ko: "두바이" },
  Bangkok:   { zh: "曼谷", ar: "بانكوك", hi: "बैंकॉक", ja: "バンコク", ko: "방콕" },
  Tokyo:     { de: "Tokio", es: "Tokio", pt: "Tóquio", zh: "东京", ar: "طوكيو", hi: "टोक्यो", ja: "東京", ko: "도쿄" },
  Singapore: { de: "Singapur", fr: "Singapour", es: "Singapur", zh: "新加坡", ar: "سنغافورة", hi: "सिंगापुर", ja: "シンガポール", ko: "싱가포르", tr: "Singapur" },
  "Tel Aviv":{ fr: "Tel-Aviv", zh: "特拉维夫", ar: "تل أبيب", hi: "तेल अवीव", ja: "テルアビブ", ko: "텔아비브" },
};

export function getAirportCity(iata: string, locale?: string): string {
  const city = AIRPORT_BY_IATA.get(iata)?.city ?? iata;
  if (!locale || locale === "en") return city;
  return LOCALIZED_CITY_NAMES[city]?.[locale] ?? city;
}

export function getAirportCountry(iata: string): string {
  return AIRPORT_BY_IATA.get(iata)?.country ?? "";
}

export function getAirportName(iata: string): string {
  return AIRPORT_BY_IATA.get(iata)?.name ?? iata;
}

/** Map route slugs to the safety zone IDs they pass near (from zones-data.ts). */
export const ROUTE_SAFETY_ZONES: Record<string, string[]> = {
  "munich-to-istanbul": ["syria", "ukraine"],
  "frankfurt-to-delhi": ["pakistan_partial", "afghanistan"],
  "berlin-to-istanbul": ["syria", "ukraine"],
  "frankfurt-to-bangkok": ["iran", "pakistan_partial"],
  "frankfurt-to-dubai": ["iran", "yemen"],
  "frankfurt-to-istanbul": ["ukraine"],
  "munich-to-bangkok": ["iran", "pakistan_partial"],
  "hamburg-to-istanbul": ["ukraine"],
  "berlin-to-dubai": ["iran", "yemen"],
  "munich-to-delhi": ["pakistan_partial", "afghanistan"],
  "munich-to-dubai": ["iran", "yemen"],
  "delhi-to-frankfurt": ["pakistan_partial", "afghanistan"],
  "frankfurt-to-singapore": ["iran", "pakistan_partial"],
  "berlin-to-tel-aviv": ["israel"],
};

/**
 * Static route metadata: distance, flight time, typical stops.
 * Flight times use REAL-WORLD values (not formula-only).
 * Westbound transatlantic: +1h for jet stream.
 * Japan routes: +1h for Russian airspace avoidance (since 2022).
 * BER-NRT: no direct service, typicalStops=1.
 */
export interface RouteMeta {
  distanceKm: number;
  flightTimeMin: number;
  typicalStops: number;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "berlin-to-london":       { distanceKm: 930,   flightTimeMin: 115, typicalStops: 0 },
  "frankfurt-to-new-york":  { distanceKm: 6200,  flightTimeMin: 510, typicalStops: 0 },
  "munich-to-istanbul":     { distanceKm: 1580,  flightTimeMin: 165, typicalStops: 0 },
  "berlin-to-paris":        { distanceKm: 880,   flightTimeMin: 110, typicalStops: 0 },
  "frankfurt-to-delhi":     { distanceKm: 6600,  flightTimeMin: 480, typicalStops: 0 },
  "berlin-to-istanbul":     { distanceKm: 1730,  flightTimeMin: 175, typicalStops: 0 },
  "hamburg-to-london":      { distanceKm: 750,   flightTimeMin: 100, typicalStops: 0 },
  "frankfurt-to-bangkok":   { distanceKm: 9000,  flightTimeMin: 660, typicalStops: 0 },
  "frankfurt-to-dubai":     { distanceKm: 4850,  flightTimeMin: 360, typicalStops: 0 },
  "frankfurt-to-istanbul":  { distanceKm: 1860,  flightTimeMin: 180, typicalStops: 0 },
  "berlin-to-barcelona":    { distanceKm: 1500,  flightTimeMin: 155, typicalStops: 0 },
  "berlin-to-amsterdam":    { distanceKm: 580,   flightTimeMin: 85,  typicalStops: 0 },
  "frankfurt-to-london":    { distanceKm: 660,   flightTimeMin: 100, typicalStops: 0 },
  "munich-to-london":       { distanceKm: 940,   flightTimeMin: 115, typicalStops: 0 },
  "munich-to-bangkok":      { distanceKm: 8900,  flightTimeMin: 650, typicalStops: 0 },
  "berlin-to-rome":         { distanceKm: 1180,  flightTimeMin: 130, typicalStops: 0 },
  "berlin-to-lisbon":       { distanceKm: 2310,  flightTimeMin: 195, typicalStops: 0 },
  "hamburg-to-istanbul":    { distanceKm: 2010,  flightTimeMin: 185, typicalStops: 0 },
  "berlin-to-new-york":     { distanceKm: 6400,  flightTimeMin: 540, typicalStops: 0 },
  "berlin-to-dubai":        { distanceKm: 4750,  flightTimeMin: 360, typicalStops: 0 },
  "frankfurt-to-rome":      { distanceKm: 960,   flightTimeMin: 110, typicalStops: 0 },
  "london-to-berlin":       { distanceKm: 930,   flightTimeMin: 110, typicalStops: 0 },
  "munich-to-barcelona":    { distanceKm: 1100,  flightTimeMin: 130, typicalStops: 0 },
  "munich-to-delhi":        { distanceKm: 6300,  flightTimeMin: 470, typicalStops: 0 },
  "frankfurt-to-tokyo":     { distanceKm: 9350,  flightTimeMin: 750, typicalStops: 0 },
  "frankfurt-to-barcelona": { distanceKm: 1100,  flightTimeMin: 130, typicalStops: 0 },
  "berlin-to-tokyo":        { distanceKm: 8900,  flightTimeMin: 750, typicalStops: 1 },
  "munich-to-rome":         { distanceKm: 690,   flightTimeMin: 95,  typicalStops: 0 },
  "munich-to-dubai":        { distanceKm: 4600,  flightTimeMin: 350, typicalStops: 0 },
  "munich-to-new-york":     { distanceKm: 6500,  flightTimeMin: 570, typicalStops: 0 },
  "delhi-to-frankfurt":     { distanceKm: 6600,  flightTimeMin: 480, typicalStops: 0 },
  "berlin-to-athens":       { distanceKm: 1800,  flightTimeMin: 170, typicalStops: 0 },
  "frankfurt-to-singapore": { distanceKm: 10200, flightTimeMin: 750, typicalStops: 0 },
  "hamburg-to-barcelona":   { distanceKm: 1500,  flightTimeMin: 155, typicalStops: 0 },
  "berlin-to-tel-aviv":     { distanceKm: 2800,  flightTimeMin: 255, typicalStops: 0 },
};

export function getRouteMeta(slug: string): RouteMeta | null {
  return ROUTE_META[slug] ?? null;
}

/** Format minutes as "Xh Ym" */
export function formatFlightTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** IATA airline code to display name. Covers airlines appearing in cached route data. */
const AIRLINE_NAMES: Record<string, string> = {
  "6E": "IndiGo", AA: "American Airlines", AF: "Air France", AI: "Air India",
  A3: "Aegean", AS: "Alaska Airlines", AT: "Royal Air Maroc", AY: "Finnair",
  AZ: "ITA Airways", B6: "JetBlue", BA: "British Airways", BI: "Royal Brunei",
  BR: "EVA Air", CI: "China Airlines", CM: "Copa Airlines", CX: "Cathay Pacific",
  D8: "Norwegian", DE: "Condor", DL: "Delta", DY: "Norwegian",
  EI: "Aer Lingus", EK: "Emirates", ET: "Ethiopian", EW: "Eurowings",
  EY: "Etihad", FA: "FlySafair", FI: "Icelandair", FR: "Ryanair",
  G9: "Air Arabia", GF: "Gulf Air", GQ: "Sky Express", HU: "Hainan Airlines",
  JL: "Japan Airlines", JU: "Air Serbia", KE: "Korean Air", KL: "KLM",
  LA: "LATAM", LG: "Luxair", LH: "Lufthansa", LO: "LOT Polish",
  LX: "Swiss", MF: "Xiamen Air", MS: "EgyptAir", OS: "Austrian",
  OZ: "Asiana", PC: "Pegasus", PG: "Bangkok Airways", QR: "Qatar Airways",
  SA: "South African", SK: "SAS", SM: "Air Cairo", SN: "Brussels Airlines",
  SQ: "Singapore Airlines", TG: "Thai Airways", TK: "Turkish Airlines",
  TP: "TAP Portugal", TW: "T'way Air", U2: "easyJet", UA: "United",
  UL: "SriLankan", UX: "Air Europa", VF: "Flynas", VL: "Volotea",
  VY: "Vueling", WN: "Southwest", WY: "Oman Air",
};

export function getAirlineName(iata: string): string {
  return AIRLINE_NAMES[iata] ?? iata;
}

/** Get the reverse route slug if it exists in our route list. */
export function getReverseRouteSlug(slug: string): string | null {
  const route = ROUTES_BY_SLUG.get(slug);
  if (!route) return null;
  const reverse = ROUTES.find(
    (r) => r.origin === route.destination && r.destination === route.origin,
  );
  return reverse?.slug ?? null;
}

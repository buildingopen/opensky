"use client";

import React, { Component, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale, useFormatter } from "next-intl";
import { Link } from "../../i18n/navigation";
import { trackEvent } from "../../lib/analytics";
import { AirportAutocomplete } from "../../components/AirportAutocomplete";
import { useSavedSearches, SavedSearchesList } from "../../components/SavedSearches";
import { useAirlineFilter, AirlineFilterChips, AIRLINE_NAMES, airlineName } from "../../components/AirlineFilter";
import { AIRPORTS } from "../../lib/airports";
import { useCurrency } from "../../components/CurrencyProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AIRPORTS_BY_CODE = Object.fromEntries(AIRPORTS.map((a) => [a.iata, a]));
function flagUrl(iata: string, countries?: Record<string, string>): string | null {
  const a = AIRPORTS_BY_CODE[iata];
  if (a) return `https://flagcdn.com/w20/${a.country.toLowerCase()}.png`;
  const cc = countries?.[iata];
  if (cc) return `https://flagcdn.com/w20/${cc}.png`;
  return null;
}
const ZONES_UPDATED_AT = process.env.NEXT_PUBLIC_ZONES_UPDATED_AT || "March 2026";

// ---------------------------------------------------------------------------
// Query Preview: lookup maps (built once from AIRPORTS)
// ---------------------------------------------------------------------------
// Country code -> display name. Covers every code in AIRPORTS.
const COUNTRY_NAMES: Record<string, string> = {
  AE: "UAE", AG: "Antigua", AL: "Albania", AM: "Armenia", AR: "Argentina",
  AT: "Austria", AU: "Australia", BD: "Bangladesh", BE: "Belgium", BG: "Bulgaria",
  BH: "Bahrain", BO: "Bolivia", BR: "Brazil", BS: "Bahamas", CA: "Canada",
  CH: "Switzerland", CI: "Ivory Coast", CL: "Chile", CN: "China", CO: "Colombia",
  CR: "Costa Rica", CU: "Cuba", CW: "Curacao", CY: "Cyprus", CZ: "Czechia",
  DE: "Germany", DK: "Denmark", DO: "Dominican Republic", DZ: "Algeria",
  EC: "Ecuador", EE: "Estonia", EG: "Egypt", ES: "Spain", ET: "Ethiopia",
  FI: "Finland", FJ: "Fiji", FR: "France", GB: "UK", GD: "Grenada",
  GE: "Georgia", GH: "Ghana", GR: "Greece", GT: "Guatemala", GU: "Guam",
  HK: "Hong Kong", HR: "Croatia", HT: "Haiti", HU: "Hungary", ID: "Indonesia",
  IE: "Ireland", IL: "Israel", IN: "India", IS: "Iceland", IT: "Italy",
  JM: "Jamaica", JO: "Jordan", JP: "Japan", KE: "Kenya", KH: "Cambodia",
  KR: "South Korea", KW: "Kuwait", KZ: "Kazakhstan", LA: "Laos", LB: "Lebanon",
  LK: "Sri Lanka", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MA: "Morocco",
  MM: "Myanmar", MN: "Mongolia", MO: "Macau", MT: "Malta", MU: "Mauritius",
  MV: "Maldives", MX: "Mexico", MY: "Malaysia", MZ: "Mozambique", NG: "Nigeria",
  NL: "Netherlands", NO: "Norway", NP: "Nepal", NZ: "New Zealand", OM: "Oman",
  PA: "Panama", PE: "Peru", PF: "French Polynesia", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PR: "Puerto Rico", PT: "Portugal", PY: "Paraguay", QA: "Qatar",
  RO: "Romania", RS: "Serbia", RU: "Russia", SA: "Saudi Arabia", SC: "Seychelles",
  SE: "Sweden", SG: "Singapore", SI: "Slovenia", SK: "Slovakia", SN: "Senegal",
  SX: "St. Maarten", TH: "Thailand", TN: "Tunisia", TR: "Turkey", TT: "Trinidad",
  TW: "Taiwan", TZ: "Tanzania", UA: "Ukraine", UG: "Uganda", US: "USA",
  UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela", VN: "Vietnam", ZA: "South Africa",
  ZM: "Zambia",
};
// Strip diacritics for fuzzy matching (São Paulo -> sao paulo, Zürich -> zurich)
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Auto-build: lowercase country name -> { code, name } from every code in AIRPORTS
const COUNTRY_LOOKUP: Record<string, { code: string; name: string }> = {};
for (const a of AIRPORTS) {
  const name = COUNTRY_NAMES[a.country];
  if (name && !COUNTRY_LOOKUP[name.toLowerCase()]) {
    COUNTRY_LOOKUP[name.toLowerCase()] = { code: a.country, name };
  }
}
// Aliases for common alternate names (using entries to avoid TS duplicate key errors)
const COUNTRY_ALIAS_ENTRIES: [string, string][] = [
  ["united kingdom","GB"],["england","GB"],["uk","GB"],["britain","GB"],
  ["united states","US"],["america","US"],["usa","US"],
  ["korea","KR"],["south korea","KR"],
  ["uae","AE"],["united arab emirates","AE"],
  ["czechia","CZ"],["czech republic","CZ"],["holland","NL"],
  // German
  ["deutschland","DE"],["frankreich","FR"],["italien","IT"],["spanien","ES"],
  ["türkei","TR"],["griechenland","GR"],["indien","IN"],["österreich","AT"],
  ["schweiz","CH"],["niederlande","NL"],["vereinigtes königreich","GB"],
  ["vereinigte staaten","US"],["schweden","SE"],["norwegen","NO"],
  ["dänemark","DK"],["polen","PL"],["tschechien","CZ"],["ungarn","HU"],
  ["rumänien","RO"],["bulgarien","BG"],["kroatien","HR"],["ägypten","EG"],
  // Spanish
  ["alemania","DE"],["francia","FR"],["italia","IT"],["españa","ES"],
  ["turquía","TR"],["grecia","GR"],["india","IN"],["austria","AT"],
  ["suiza","CH"],["países bajos","NL"],["reino unido","GB"],
  ["estados unidos","US"],["suecia","SE"],["noruega","NO"],
  ["dinamarca","DK"],["polonia","PL"],["hungría","HU"],["rumania","RO"],
  ["croacia","HR"],["egipto","EG"],
  // French
  ["allemagne","DE"],["italie","IT"],["espagne","ES"],
  ["turquie","TR"],["grèce","GR"],["inde","IN"],["autriche","AT"],
  ["suisse","CH"],["pays-bas","NL"],["royaume-uni","GB"],
  ["états-unis","US"],["suède","SE"],["norvège","NO"],
  ["danemark","DK"],["pologne","PL"],["hongrie","HU"],["roumanie","RO"],
  ["croatie","HR"],["égypte","EG"],
  // Italian
  ["germania","DE"],["spagna","ES"],["turchia","TR"],["svizzera","CH"],
  ["paesi bassi","NL"],["stati uniti","US"],["svezia","SE"],["norvegia","NO"],
  ["danimarca","DK"],["ungheria","HU"],["egitto","EG"],
  // Portuguese
  ["alemanha","DE"],["frança","FR"],["itália","IT"],["espanha","ES"],
  ["turquia","TR"],["grécia","GR"],["índia","IN"],["áustria","AT"],
  ["suíça","CH"],["holanda","NL"],["suécia","SE"],
  ["polónia","PL"],["hungria","HU"],["roménia","RO"],["croácia","HR"],["egito","EG"],
  // Turkish
  ["almanya","DE"],["fransa","FR"],["italya","IT"],["ispanya","ES"],
  ["yunanistan","GR"],["hindistan","IN"],["avusturya","AT"],
  ["isviçre","CH"],["hollanda","NL"],["birleşik krallık","GB"],
  ["amerika birleşik devletleri","US"],["isveç","SE"],["norveç","NO"],
  ["polonya","PL"],["macaristan","HU"],["romanya","RO"],["hırvatistan","HR"],["mısır","EG"],
  // Chinese
  ["德国","DE"],["法国","FR"],["意大利","IT"],["西班牙","ES"],["英国","GB"],
  ["美国","US"],["日本","JP"],["中国","CN"],["印度","IN"],["韩国","KR"],
  ["土耳其","TR"],["希腊","GR"],["奥地利","AT"],["瑞士","CH"],["荷兰","NL"],
  ["瑞典","SE"],["挪威","NO"],["丹麦","DK"],["波兰","PL"],["匈牙利","HU"],
  ["泰国","TH"],["新加坡","SG"],["马来西亚","MY"],["澳大利亚","AU"],["埃及","EG"],
  // Japanese
  ["ドイツ","DE"],["フランス","FR"],["イタリア","IT"],["スペイン","ES"],["イギリス","GB"],
  ["アメリカ","US"],["日本","JP"],["中国","CN"],["インド","IN"],["韓国","KR"],
  ["トルコ","TR"],["ギリシャ","GR"],["オーストリア","AT"],["スイス","CH"],["オランダ","NL"],
  ["スウェーデン","SE"],["ノルウェー","NO"],["デンマーク","DK"],["ポーランド","PL"],
  ["タイ","TH"],["シンガポール","SG"],["マレーシア","MY"],["オーストラリア","AU"],["エジプト","EG"],
  // Korean
  ["독일","DE"],["프랑스","FR"],["이탈리아","IT"],["스페인","ES"],["영국","GB"],
  ["미국","US"],["일본","JP"],["중국","CN"],["인도","IN"],["한국","KR"],
  ["터키","TR"],["그리스","GR"],["오스트리아","AT"],["스위스","CH"],["네덜란드","NL"],
  ["스웨덴","SE"],["노르웨이","NO"],["덴마크","DK"],["폴란드","PL"],
  ["태국","TH"],["싱가포르","SG"],["말레이시아","MY"],["호주","AU"],["이집트","EG"],
  // Arabic
  ["ألمانيا","DE"],["فرنسا","FR"],["إيطاليا","IT"],["إسبانيا","ES"],["بريطانيا","GB"],
  ["أمريكا","US"],["اليابان","JP"],["الصين","CN"],["الهند","IN"],["كوريا","KR"],
  ["تركيا","TR"],["اليونان","GR"],["النمسا","AT"],["سويسرا","CH"],["هولندا","NL"],
  ["السويد","SE"],["النرويج","NO"],["الدنمارك","DK"],["بولندا","PL"],
  ["تايلاند","TH"],["سنغافورة","SG"],["ماليزيا","MY"],["أستراليا","AU"],["مصر","EG"],
  // Hindi
  ["जर्मनी","DE"],["फ्रांस","FR"],["इटली","IT"],["स्पेन","ES"],["ब्रिटेन","GB"],
  ["अमेरिका","US"],["जापान","JP"],["चीन","CN"],["भारत","IN"],["कोरिया","KR"],
  ["तुर्की","TR"],["ग्रीस","GR"],["ऑस्ट्रिया","AT"],["स्विट्जरलैंड","CH"],
  ["नीदरलैंड","NL"],["स्वीडन","SE"],["नॉर्वे","NO"],["डेनमार्क","DK"],["पोलैंड","PL"],
  ["थाईलैंड","TH"],["सिंगापुर","SG"],["मलेशिया","MY"],["ऑस्ट्रेलिया","AU"],["मिस्र","EG"],
];
for (const [alias, code] of COUNTRY_ALIAS_ENTRIES) {
  const name = COUNTRY_NAMES[code];
  if (name && !COUNTRY_LOOKUP[alias]) {
    COUNTRY_LOOKUP[alias] = { code, name };
  }
}
// Register diacritic-stripped forms so "turkei" matches "türkei", "espana" matches "españa"
for (const [alias, code] of COUNTRY_ALIAS_ENTRIES) {
  const name = COUNTRY_NAMES[code];
  const normAlias = norm(alias);
  if (name && normAlias !== alias && !COUNTRY_LOOKUP[normAlias]) {
    COUNTRY_LOOKUP[normAlias] = { code, name };
  }
}

const IATA_SET = new Set(AIRPORTS.map((a) => a.iata));
const CITY_DISPLAY = new Map<string, string>();
const COUNTRY_AIRPORT_COUNT = new Map<string, number>();
const CITY_AIRPORT_COUNT = new Map<string, number>();
for (const a of AIRPORTS) {
  const cl = a.city.toLowerCase();
  CITY_DISPLAY.set(cl, a.city);
  COUNTRY_AIRPORT_COUNT.set(a.country, (COUNTRY_AIRPORT_COUNT.get(a.country) || 0) + 1);
  CITY_AIRPORT_COUNT.set(cl, (CITY_AIRPORT_COUNT.get(cl) || 0) + 1);
}

// City aliases: common names that differ from airport data city names
// Includes multilingual city names for preview to work across locales
// Using Map to avoid duplicate key issues across languages
const CITY_ALIASES_ENTRIES: [string, string][] = [
  // English aliases
  ["delhi", "new delhi"], ["nyc", "new york"], ["sf", "san francisco"],
  ["ho chi minh", "ho chi minh city"], ["saigon", "ho chi minh city"],
  ["bombay", "mumbai"], ["calcutta", "kolkata"], ["madras", "chennai"],
  ["peking", "beijing"],
  // Spanish city names
  ["londres", "london"], ["nueva york", "new york"], ["pekín", "beijing"], ["pekin", "beijing"],
  ["moscú", "moscow"], ["moscu", "moscow"], ["múnich", "munich"],
  ["milán", "milan"], ["roma", "rome"], ["viena", "vienna"],
  ["bruselas", "brussels"], ["ginebra", "geneva"], ["zúrich", "zurich"],
  ["estambul", "istanbul"], ["atenas", "athens"], ["varsovia", "warsaw"],
  ["copenhague", "copenhagen"], ["estocolmo", "stockholm"], ["praga", "prague"],
  ["el cairo", "cairo"], ["berlín", "berlin"], ["tokio", "tokyo"],
  ["singapur", "singapore"], ["nueva delhi", "new delhi"], ["hamburgo", "hamburg"],
  ["shanghái", "shanghai"], ["dubái", "dubai"], ["ámsterdam", "amsterdam"],
  ["florencia", "florence"], ["nápoles", "naples"], ["marsella", "marseille"],
  ["edimburgo", "edinburgh"], ["la habana", "havana"],
  // German city names (tokio/peking already in English/Spanish sections)
  ["mailand", "milan"], ["rom", "rome"], ["wien", "vienna"], ["brüssel", "brussels"],
  ["lissabon", "lisbon"], ["warschau", "warsaw"], ["kopenhagen", "copenhagen"],
  ["prag", "prague"], ["athen", "athens"], ["kairo", "cairo"], ["moskau", "moscow"],
  ["neapel", "naples"], ["florenz", "florence"], ["havanna", "havana"],
  ["neu-delhi", "new delhi"],
  // French city names (londres/copenhague already in Spanish section)
  ["nouvelle-orléans", "new orleans"], ["moscou", "moscow"], ["athènes", "athens"],
  ["le caire", "cairo"], ["lisbonne", "lisbon"], ["varsovie", "warsaw"],
  ["vienne", "vienna"], ["genève", "geneva"], ["hambourg", "hamburg"],
  ["pékin", "beijing"], ["singapour", "singapore"], ["dubaï", "dubai"],
  ["édimbourg", "edinburgh"], ["barcelone", "barcelona"], ["séville", "seville"],
  ["la havane", "havana"],
  // Italian city names (londra shared with Turkish, registered here first)
  ["londra", "london"], ["nuova york", "new york"], ["parigi", "paris"],
  ["monaco di baviera", "munich"], ["bruxelles", "brussels"],
  ["ginevra", "geneva"], ["zurigo", "zurich"], ["lisbona", "lisbon"], ["atene", "athens"],
  ["varsavia", "warsaw"], ["copenaghen", "copenhagen"], ["stoccolma", "stockholm"],
  ["il cairo", "cairo"], ["mosca", "moscow"], ["francoforte", "frankfurt"],
  ["pechino", "beijing"], ["berlino", "berlin"],
  ["amburgo", "hamburg"], ["firenze", "florence"], ["napoli", "naples"],
  ["marsiglia", "marseille"], ["siviglia", "seville"], ["nuova delhi", "new delhi"],
  // Portuguese city names (shared keys with es/it noted)
  ["nova iorque", "new york"], ["nova york", "new york"], ["munique", "munich"],
  ["genebra", "geneva"], ["zurique", "zurich"], ["copenhaga", "copenhagen"],
  ["varsóvia", "warsaw"], ["lisboa", "lisbon"],
  ["pequim", "beijing"], ["moscovo", "moscow"], ["milão", "milan"],
  ["bruxelas", "brussels"], ["istambul", "istanbul"],
  ["berlim", "berlin"],
  ["florença", "florence"], ["marselha", "marseille"],
  ["sevilha", "seville"], ["nova deli", "new delhi"], ["tóquio", "tokyo"],
  ["amesterdão", "amsterdam"], ["amsterdã", "amsterdam"], ["singapura", "singapore"],
  // Turkish city names (londra/pekin/prag/singapur already registered above)
  ["münih", "munich"], ["viyana", "vienna"], ["cenevre", "geneva"],
  ["zürih", "zurich"], ["lizbon", "lisbon"], ["atina", "athens"], ["kahire", "cairo"],
  ["yeni york", "new york"], ["moskova", "moscow"], ["brüksel", "brussels"],
  ["varşova", "warsaw"], ["kopenhag", "copenhagen"], ["stokholm", "stockholm"],
  ["floransa", "florence"], ["marsilya", "marseille"], ["yeni delhi", "new delhi"],
  // Chinese city names
  ["伦敦", "london"], ["巴黎", "paris"], ["纽约", "new york"], ["东京", "tokyo"],
  ["北京", "beijing"], ["慕尼黑", "munich"], ["米兰", "milan"], ["罗马", "rome"],
  ["维也纳", "vienna"], ["布鲁塞尔", "brussels"], ["日内瓦", "geneva"],
  ["苏黎世", "zurich"], ["伊斯坦布尔", "istanbul"], ["雅典", "athens"],
  ["华沙", "warsaw"], ["哥本哈根", "copenhagen"], ["斯德哥尔摩", "stockholm"],
  ["布拉格", "prague"], ["开罗", "cairo"], ["莫斯科", "moscow"], ["里斯本", "lisbon"],
  ["柏林", "berlin"], ["汉堡", "hamburg"], ["法兰克福", "frankfurt"],
  ["上海", "shanghai"], ["香港", "hong kong"], ["新加坡", "singapore"],
  ["曼谷", "bangkok"], ["首尔", "seoul"], ["孟买", "mumbai"], ["新德里", "new delhi"],
  // Japanese city names (kanji + katakana)
  ["東京", "tokyo"], ["大阪", "osaka"], ["京都", "kyoto"], ["名古屋", "nagoya"],
  ["福岡", "fukuoka"], ["札幌", "sapporo"],
  ["ロンドン", "london"], ["パリ", "paris"], ["ニューヨーク", "new york"],
  ["ミュンヘン", "munich"], ["ミラノ", "milan"], ["ローマ", "rome"],
  ["ウィーン", "vienna"], ["ブリュッセル", "brussels"], ["ジュネーブ", "geneva"],
  ["チューリッヒ", "zurich"], ["イスタンブール", "istanbul"], ["アテネ", "athens"],
  ["ワルシャワ", "warsaw"], ["コペンハーゲン", "copenhagen"],
  ["ストックホルム", "stockholm"], ["プラハ", "prague"], ["カイロ", "cairo"],
  ["モスクワ", "moscow"], ["リスボン", "lisbon"], ["ベルリン", "berlin"],
  ["フランクフルト", "frankfurt"], ["バンコク", "bangkok"], ["ソウル", "seoul"],
  ["ムンバイ", "mumbai"], ["シンガポール", "singapore"],
  // Korean city names
  ["런던", "london"], ["파리", "paris"], ["뉴욕", "new york"], ["도쿄", "tokyo"],
  ["베이징", "beijing"], ["뮌헨", "munich"], ["밀라노", "milan"], ["로마", "rome"],
  ["빈", "vienna"], ["브뤼셀", "brussels"], ["제네바", "geneva"],
  ["취리히", "zurich"], ["이스탄불", "istanbul"], ["아테네", "athens"],
  ["바르샤바", "warsaw"], ["코펜하겐", "copenhagen"], ["스톡홀름", "stockholm"],
  ["프라하", "prague"], ["카이로", "cairo"], ["모스크바", "moscow"],
  ["리스본", "lisbon"], ["베를린", "berlin"], ["프랑크푸르트", "frankfurt"],
  ["방콕", "bangkok"], ["서울", "seoul"], ["뭄바이", "mumbai"], ["싱가포르", "singapore"],
  // Arabic city names
  ["لندن", "london"], ["باريس", "paris"], ["نيويورك", "new york"],
  ["طوكيو", "tokyo"], ["بكين", "beijing"], ["ميونخ", "munich"],
  ["ميلانو", "milan"], ["روما", "rome"], ["فيينا", "vienna"],
  ["بروكسل", "brussels"], ["جنيف", "geneva"], ["زيوريخ", "zurich"],
  ["إسطنبول", "istanbul"], ["أثينا", "athens"], ["وارسو", "warsaw"],
  ["كوبنهاغن", "copenhagen"], ["ستوكهولم", "stockholm"], ["براغ", "prague"],
  ["القاهرة", "cairo"], ["موسكو", "moscow"], ["لشبونة", "lisbon"],
  ["برلين", "berlin"], ["فرانكفورت", "frankfurt"], ["بانكوك", "bangkok"],
  ["سيول", "seoul"], ["مومباي", "mumbai"], ["سنغافورة", "singapore"],
  // Hindi city names
  ["लंदन", "london"], ["पेरिस", "paris"], ["न्यूयॉर्क", "new york"],
  ["टोक्यो", "tokyo"], ["बीजिंग", "beijing"], ["म्यूनिख", "munich"],
  ["मिलान", "milan"], ["रोम", "rome"], ["वियना", "vienna"],
  ["ब्रसेल्स", "brussels"], ["जिनेवा", "geneva"], ["ज्यूरिख", "zurich"],
  ["इस्तांबुल", "istanbul"], ["एथेंस", "athens"], ["वॉरसॉ", "warsaw"],
  ["कोपेनहेगन", "copenhagen"], ["स्टॉकहोम", "stockholm"], ["प्राग", "prague"],
  ["काहिरा", "cairo"], ["मॉस्को", "moscow"], ["लिस्बन", "lisbon"],
  ["बर्लिन", "berlin"], ["फ्रैंकफर्ट", "frankfurt"], ["बैंकॉक", "bangkok"],
  ["सियोल", "seoul"], ["मुंबई", "mumbai"], ["सिंगापुर", "singapore"],
  ["दिल्ली", "new delhi"], ["कोलकाता", "kolkata"], ["चेन्नई", "chennai"],
  // Tokenizer-safe aliases for cities with periods (tokenizer strips ".")
  ["st louis", "st. louis"], ["st petersburg", "st. petersburg"],
  ["st john's", "st. john's"], ["st johns", "st. john's"],
  ["st george's", "st. george's"], ["st georges", "st. george's"],
  ["st maarten", "st. maarten"],
  // "Saint" full-form aliases
  ["saint louis", "st. louis"], ["saint petersburg", "st. petersburg"],
  ["sankt petersburg", "st. petersburg"],
  ["san petersburgo", "st. petersburg"], ["san pietroburgo", "st. petersburg"],
];
const CITY_ALIASES: Record<string, string> = {};
for (const [alias, city] of CITY_ALIASES_ENTRIES) {
  if (!CITY_ALIASES[alias]) CITY_ALIASES[alias] = city;
}
for (const [alias, city] of Object.entries(CITY_ALIASES)) {
  if (CITY_DISPLAY.has(city)) {
    const normAlias = norm(alias);
    if (!CITY_DISPLAY.has(alias)) {
      CITY_DISPLAY.set(alias, CITY_DISPLAY.get(city)!);
      CITY_AIRPORT_COUNT.set(alias, CITY_AIRPORT_COUNT.get(city) || 1);
    }
    // Also register normalized (diacritic-stripped) form so "são paulo" -> "sao paulo" matches
    if (normAlias !== alias && !CITY_DISPLAY.has(normAlias)) {
      CITY_DISPLAY.set(normAlias, CITY_DISPLAY.get(city)!);
      CITY_AIRPORT_COUNT.set(normAlias, CITY_AIRPORT_COUNT.get(city) || 1);
    }
  }
}

const AMBIGUOUS_CITIES = new Set([
  "nice", "mobile", "split", "reading", "bath", "chester", "orange",
  "male", "cork", "buffalo", "lima", "troy",
]);

// Block common function words across Latin-script languages that could match
// an IATA code or city alias. Prefer blocking too many over a false positive.
// NOTE: Some entries (sin, den, las, per, can, aus, got, del, los, ein) collide
// with real IATA codes, but as standalone lowercase words in natural language
// they are virtually always articles/prepositions. Multi-word phrases like
// "las vegas" or "los angeles" still match via the multi-token scan.
const LOCATION_SKIPWORDS = new Set([
  // Spanish/Portuguese articles & prepositions
  "la", "el", "lo", "los", "las", "un", "una", "del", "al",
  "con", "sin", "por", "para", "sur", "son", "mas", "sus",
  // French articles & prepositions
  "le", "les", "des", "une", "par", "pas", "est", "sur",
  "aux", "son", "ses", "mes", "nos", "mon", "ton",
  // German articles & prepositions
  "den", "der", "die", "das", "dem", "des", "ein",
  "aus", "von", "vor", "fur", "nur", "mir", "ich",
  // Italian articles & prepositions
  "per", "dal", "del", "nel", "sul", "con", "una",
  // Dutch
  "van", "het", "een", "den",
  // Turkish
  "bir", "ile", "var", "ben", "sen",
  // English function words that match IATA
  "can", "hat", "was", "had", "may", "has", "got",
]);
const SKIP_REGIONS = new Set([
  "anywhere", "europe", "asia", "africa", "south america", "north america", "middle east",
  // Multilingual region names
  "cualquier lugar", "europa", "asia", "áfrica", "sudamérica", "norteamérica",
  "überall", "asien", "afrika", "südamerika", "nordamerika",
  "n'importe où", "asie", "afrique", "amérique du sud", "amérique du nord",
  "ovunque", "europa", "asia", "africa", "sud america", "nord america",
  "qualquer lugar", "ásia", "áfrica", "américa do sul", "américa do norte",
  // CJK/Arabic/Hindi
  "任何地方", "欧洲", "亚洲", "非洲", "南美洲", "北美洲",
  "どこでも", "ヨーロッパ", "アジア", "アフリカ",
  "어디든", "유럽", "아시아", "아프리카",
  "أي مكان", "أوروبا", "آسيا", "أفريقيا",
  "कहीं भी", "यूरोप", "एशिया", "अफ्रीका",
]);

const MONTH_NAMES = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

// Multilingual month names -> English index
const I18N_MONTHS: Record<string, number> = {};
const MONTH_I18N: [string, number][] = [
  // German
  ["januar",0],["februar",1],["märz",2],["april",3],["mai",4],["juni",5],["juli",6],["august",7],["september",8],["oktober",9],["november",10],["dezember",11],
  // Spanish
  ["enero",0],["febrero",1],["marzo",2],["abril",3],["mayo",4],["junio",5],["julio",6],["agosto",7],["septiembre",8],["octubre",9],["noviembre",10],["diciembre",11],
  // French
  ["janvier",0],["février",1],["mars",2],["avril",3],["mai",4],["juin",5],["juillet",6],["août",7],["septembre",8],["octobre",9],["novembre",10],["décembre",11],
  // Italian
  ["gennaio",0],["febbraio",1],["marzo",2],["aprile",3],["maggio",4],["giugno",5],["luglio",6],["agosto",7],["settembre",8],["ottobre",9],["novembre",10],["dicembre",11],
  // Portuguese
  ["janeiro",0],["fevereiro",1],["março",2],["abril",3],["maio",4],["junho",5],["julho",6],["agosto",7],["setembro",8],["outubro",9],["novembro",10],["dezembro",11],
  // Turkish
  ["ocak",0],["şubat",1],["mart",2],["nisan",3],["mayıs",4],["haziran",5],["temmuz",6],["ağustos",7],["eylül",8],["ekim",9],["kasım",10],["aralık",11],
  // Chinese
  ["一月",0],["二月",1],["三月",2],["四月",3],["五月",4],["六月",5],["七月",6],["八月",7],["九月",8],["十月",9],["十一月",10],["十二月",11],
  // Japanese (same kanji as Chinese)
  // Korean
  ["1월",0],["2월",1],["3월",2],["4월",3],["5월",4],["6월",5],["7월",6],["8월",7],["9월",8],["10월",9],["11월",10],["12월",11],
  // Arabic
  ["يناير",0],["فبراير",1],["مارس",2],["أبريل",3],["مايو",4],["يونيو",5],["يوليو",6],["أغسطس",7],["سبتمبر",8],["أكتوبر",9],["نوفمبر",10],["ديسمبر",11],
  // Hindi
  ["जनवरी",0],["फरवरी",1],["मार्च",2],["अप्रैल",3],["मई",4],["जून",5],["जुलाई",6],["अगस्त",7],["सितंबर",8],["अक्टूबर",9],["नवंबर",10],["दिसंबर",11],
];
for (const [name, idx] of MONTH_I18N) I18N_MONTHS[name] = idx;
// Also include English
for (let i = 0; i < MONTH_NAMES.length; i++) I18N_MONTHS[MONTH_NAMES[i]] = i;

// Multilingual day names -> JS day index (0=Sun)
const I18N_DAYS: Record<string, number> = {};
const DAY_I18N: [string, number][] = [
  // English already in DAY_NAMES
  // German
  ["sonntag",0],["montag",1],["dienstag",2],["mittwoch",3],["donnerstag",4],["freitag",5],["samstag",6],
  // Spanish
  ["domingo",0],["lunes",1],["martes",2],["miércoles",3],["jueves",4],["viernes",5],["sábado",6],
  // French
  ["dimanche",0],["lundi",1],["mardi",2],["mercredi",3],["jeudi",4],["vendredi",5],["samedi",6],
  // Italian
  ["domenica",0],["lunedì",1],["martedì",2],["mercoledì",3],["giovedì",4],["venerdì",5],["sabato",6],
  // Portuguese
  ["domingo",0],["segunda",1],["terça",2],["quarta",3],["quinta",4],["sexta",5],["sábado",6],
  // Turkish
  ["pazar",0],["pazartesi",1],["salı",2],["çarşamba",3],["perşembe",4],["cuma",5],["cumartesi",6],
  // Chinese
  ["星期日",0],["星期一",1],["星期二",2],["星期三",3],["星期四",4],["星期五",5],["星期六",6],
  ["周日",0],["周一",1],["周二",2],["周三",3],["周四",4],["周五",5],["周六",6],
  // Japanese
  ["日曜日",0],["月曜日",1],["火曜日",2],["水曜日",3],["木曜日",4],["金曜日",5],["土曜日",6],
  // Korean
  ["일요일",0],["월요일",1],["화요일",2],["수요일",3],["목요일",4],["금요일",5],["토요일",6],
  // Arabic
  ["الأحد",0],["الإثنين",1],["الثلاثاء",2],["الأربعاء",3],["الخميس",4],["الجمعة",5],["السبت",6],
  // Hindi
  ["रविवार",0],["सोमवार",1],["मंगलवार",2],["बुधवार",3],["गुरुवार",4],["शुक्रवार",5],["शनिवार",6],
];
for (const [name, idx] of DAY_I18N) I18N_DAYS[name] = idx;
for (let i = 0; i < DAY_NAMES.length; i++) I18N_DAYS[DAY_NAMES[i]] = i;

// Multilingual temporal phrases -> English equivalent for resolveDate
const I18N_TEMPORAL: Record<string, string> = {
  // "tomorrow"
  "morgen": "tomorrow", "mañana": "tomorrow", "demain": "tomorrow", "domani": "tomorrow", "amanhã": "tomorrow", "yarın": "tomorrow",
  // "today"
  "heute": "today", "hoy": "today", "aujourd'hui": "today", "oggi": "today", "hoje": "today", "bugün": "today",
  // "next week"
  "nächste woche": "next week", "próxima semana": "next week", "proxima semana": "next week", "la semaine prochaine": "next week", "semaine prochaine": "next week", "prossima settimana": "next week", "gelecek hafta": "next week", "la proxima semana": "next week",
  // "this weekend"
  "dieses wochenende": "this weekend", "este fin de semana": "this weekend", "ce week-end": "this weekend", "ce weekend": "this weekend", "questo fine settimana": "this weekend", "este fim de semana": "this weekend", "bu hafta sonu": "this weekend",
  // "next weekend"
  "nächstes wochenende": "next weekend", "próximo fin de semana": "next weekend", "prochain week-end": "next weekend", "prochain weekend": "next weekend", "prossimo fine settimana": "next weekend", "próximo fim de semana": "next weekend", "gelecek hafta sonu": "next weekend",
  // "next month"
  "nächsten monat": "next month", "próximo mes": "next month", "proximo mes": "next month", "le mois prochain": "next month", "mois prochain": "next month", "prossimo mese": "next month", "próximo mês": "next month", "gelecek ay": "next month",
  // Chinese
  "明天": "tomorrow", "今天": "today", "下周": "next week", "下個星期": "next week", "下个星期": "next week",
  "这个周末": "this weekend", "這個週末": "this weekend", "下个周末": "next weekend", "下個週末": "next weekend", "下个月": "next month", "下個月": "next month",
  // Japanese
  "明日": "tomorrow", "あした": "tomorrow", "今日": "today", "きょう": "today",
  "来週": "next week", "らいしゅう": "next week", "今週末": "this weekend", "来週末": "next weekend", "来月": "next month",
  // Korean
  "내일": "tomorrow", "오늘": "today", "다음주": "next week", "다음 주": "next week",
  "이번 주말": "this weekend", "다음 주말": "next weekend", "다음달": "next month", "다음 달": "next month",
  // Arabic
  "غدا": "tomorrow", "غداً": "tomorrow", "اليوم": "today", "الأسبوع القادم": "next week", "الاسبوع القادم": "next week",
  "نهاية الأسبوع": "this weekend", "الشهر القادم": "next month",
  // Hindi
  "कल": "tomorrow", "आज": "today", "अगले हफ्ते": "next week", "अगला हफ्ता": "next week",
  "इस सप्ताहांत": "this weekend", "अगले महीने": "next month",
};

function resolveDate(phrase: string): string | null {
  const now = new Date();
  const p = phrase.toLowerCase().trim();

  // Normalize multilingual temporal phrases to English
  const normalized = I18N_TEMPORAL[p] || p;

  if (normalized === "tomorrow") {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }
  if (normalized === "today") {
    return `${MONTH_SHORT[now.getMonth()]} ${now.getDate()}`;
  }
  if (normalized === "next week") {
    const d = new Date(now);
    const dayOfWeek = d.getDay(); // 0=Sun
    const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    d.setDate(d.getDate() + daysUntilMon);
    const mon = new Date(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 6);
    if (mon.getMonth() === sun.getMonth()) return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()}-${sun.getDate()}`;
    return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} - ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  }
  if (normalized === "this weekend") {
    const d = new Date(now);
    const dayOfWeek = d.getDay();
    const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
    d.setDate(d.getDate() + daysUntilSat);
    const sat = new Date(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 1);
    if (sat.getMonth() === sun.getMonth()) return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()}-${sun.getDate()}`;
    return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()} - ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  }
  if (normalized === "next weekend") {
    const d = new Date(now);
    const dayOfWeek = d.getDay();
    const daysUntilNextSat = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7);
    d.setDate(d.getDate() + daysUntilNextSat);
    const sat = new Date(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 1);
    if (sat.getMonth() === sun.getMonth()) return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()}-${sun.getDate()}`;
    return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()} - ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  }
  if (normalized === "next month") {
    const m = (now.getMonth() + 1) % 12;
    const y = m === 0 ? now.getFullYear() + 1 : (now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear());
    return `${MONTH_SHORT[m]} ${y}`;
  }
  // Day names (multilingual): "monday", "lunes", "montag", etc.
  const dayIdx = I18N_DAYS[normalized] ?? -1;
  if (dayIdx >= 0) {
    const d = new Date(now);
    let diff = dayIdx - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }
  // Month names (multilingual): "july", "julio", "juli", etc.
  const monthIdx = I18N_MONTHS[normalized] ?? -1;
  if (monthIdx >= 0) {
    const y = monthIdx < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    return `${MONTH_SHORT[monthIdx]} ${y}`;
  }
  // "march 15", "15 march", "marzo 15", "15 marzo", etc.
  const allMonthNames = Object.keys(I18N_MONTHS);
  for (const mn of allMonthNames) {
    const mi = I18N_MONTHS[mn];
    const m1 = normalized.match(new RegExp(`^${mn}\\s+(\\d{1,2})$`));
    if (m1) return `${MONTH_SHORT[mi]} ${parseInt(m1[1])}`;
    const m2 = normalized.match(new RegExp(`^(\\d{1,2})\\s+${mn}$`));
    if (m2) return `${MONTH_SHORT[mi]} ${parseInt(m2[1])}`;
  }
  return null;
}

interface LocAirport { iata: string; city: string }
interface PreviewLocInfo { display: string; count: number; airports: LocAirport[] }

function getAirportsForCountry(countryCode: string): LocAirport[] {
  return AIRPORTS.filter(a => a.country === countryCode).map(a => ({ iata: a.iata, city: a.city }));
}
function getAirportsForCity(cityLower: string): LocAirport[] {
  return AIRPORTS.filter(a => a.city.toLowerCase() === cityLower).map(a => ({ iata: a.iata, city: a.city }));
}

// ---------------------------------------------------------------------------
// Scan-based location detection: find all known locations in the prompt
// by checking every word and multi-word combination against the location DB.
// No regex patterns, no "to" dependency, no prefix matching. Exact matches only.
// ---------------------------------------------------------------------------
interface ScannedLoc { start: number; end: number; loc: PreviewLocInfo }

function scanLocations(prompt: string): ScannedLoc[] {
  const lower = prompt.toLowerCase();
  // Tokenize into words with character positions (lowercase for matching)
  const tokens: Array<{ word: string; original: string; start: number; end: number }> = [];
  // \p{M} includes combining marks needed for Indic scripts (anusvara ं, virama ्, etc.)
  const re = /[\p{L}\p{N}\p{M}]+(?:['-][\p{L}\p{N}\p{M}]+)*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    tokens.push({ word: m[0], original: prompt.slice(m.index, m.index + m[0].length), start: m.index, end: m.index + m[0].length });
  }

  // Exact-only match: no prefix matching, skip ambiguous cities
  // originalPhrase preserves case from user input to distinguish "SIN" (IATA) from "sin" (Spanish word)
  function matchExact(phrase: string, originalPhrase?: string): PreviewLocInfo | null {
    const p = norm(phrase);
    if (!p || p.length < 2 || SKIP_REGIONS.has(p)) return null;
    // Skipword check: only block if the user typed lowercase. If they typed
    // all-uppercase (e.g. "SIN", "DEN"), they likely mean the IATA code.
    const orig = originalPhrase || phrase;
    if (LOCATION_SKIPWORDS.has(p) && orig !== orig.toUpperCase()) return null;
    const upper = phrase.toUpperCase();
    // For explicit all-uppercase 3-letter input, IATA takes priority (e.g. "JFK", "GOA")
    if (upper.length === 3 && orig === orig.toUpperCase() && IATA_SET.has(upper)) {
      const ap = AIRPORTS.find(a => a.iata === upper);
      return { display: upper, count: 1, airports: ap ? [{ iata: ap.iata, city: ap.city }] : [] };
    }
    const country = COUNTRY_LOOKUP[p];
    if (country) {
      const cnt = COUNTRY_AIRPORT_COUNT.get(country.code) || 0;
      return { display: country.name, count: cnt, airports: getAirportsForCountry(country.code) };
    }
    if (CITY_DISPLAY.has(p) && !AMBIGUOUS_CITIES.has(p)) {
      const cnt = CITY_AIRPORT_COUNT.get(p) || 1;
      return { display: CITY_DISPLAY.get(p)!, count: cnt, airports: getAirportsForCity(p) };
    }
    // Fallback IATA for non-uppercase input (e.g. "jfk", "lax" still resolve)
    if (upper.length === 3 && IATA_SET.has(upper)) {
      const ap = AIRPORTS.find(a => a.iata === upper);
      return { display: upper, count: 1, airports: ap ? [{ iata: ap.iata, city: ap.city }] : [] };
    }
    // Turkish agglutination: "Moskova'dan" → try "moskova" before the apostrophe
    // Only for single-word tokens (no spaces) to avoid false matches on multi-word phrases
    const apos = p.indexOf("'");
    if (apos > 1 && !p.includes(" ")) {
      const prefix = p.slice(0, apos);
      return matchExact(prefix, originalPhrase ? originalPhrase.slice(0, apos) : undefined);
    }
    return null;
  }

  const results: ScannedLoc[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    // Try longest combination first (up to 4 words: "united arab emirates", "new york city")
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const phrase = tokens.slice(i, i + len).map(t => t.word).join(" ");
      const originalPhrase = tokens.slice(i, i + len).map(t => t.original).join(" ");
      let loc = matchExact(phrase, originalPhrase);
      // For multi-word combos, also try stripping apostrophe suffix from last token
      // (Turkish agglutination: "Yeni York'a" → try "yeni york")
      if (!loc && len > 1) {
        const lastWord = tokens[i + len - 1].word;
        const apos = lastWord.indexOf("'");
        if (apos > 1) {
          const trimmed = tokens.slice(i, i + len - 1).map(t => t.word).join(" ") + " " + lastWord.slice(0, apos);
          const trimmedOrig = tokens.slice(i, i + len - 1).map(t => t.original).join(" ") + " " + tokens[i + len - 1].original.slice(0, apos);
          loc = matchExact(trimmed, trimmedOrig);
        }
      }
      if (loc) {
        results.push({ start: tokens[i].start, end: tokens[i + len - 1].end, loc });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Shared date detection helper (used by useHighlightRanges)
// ---------------------------------------------------------------------------
function detectDate(lower: string): { text: string; start: number; end: number; resolved: string | undefined } | null {
  const allTemporalKeys = Object.keys(I18N_TEMPORAL);
  const allMonthNamesStr = Object.keys(I18N_MONTHS).join("|");
  const allDayNamesStr = Object.keys(I18N_DAYS).join("|");
  // 1. Multilingual temporal phrases (longest first)
  const sorted = allTemporalKeys.slice().sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    const idx = lower.indexOf(phrase);
    if (idx >= 0) return { text: phrase, start: idx, end: idx + phrase.length, resolved: resolveDate(phrase) || undefined };
  }
  // 2. English temporal
  const enPats = [/\b(tomorrow|today)\b/i, /\b(next week)\b/i, /\b(next weekend)\b/i, /\b(this weekend)\b/i, /\b(next month)\b/i];
  for (const pat of enPats) {
    const m = pat.exec(lower);
    if (m && m.index !== undefined) return { text: m[0], start: m.index, end: m.index + m[0].length, resolved: resolveDate(m[0]) || undefined };
  }
  // 3. Day names
  const dayRe = new RegExp(`\\b(${allDayNamesStr})\\b`, "i");
  const dayM = dayRe.exec(lower);
  if (dayM && dayM.index !== undefined) return { text: dayM[0], start: dayM.index, end: dayM.index + dayM[0].length, resolved: resolveDate(dayM[0]) || undefined };
  // 4. Month + day
  const mdRe = new RegExp(`\\b(${allMonthNamesStr})\\s+\\d{1,2}\\b`, "i");
  const mdM = mdRe.exec(lower);
  if (mdM && mdM.index !== undefined) return { text: mdM[0], start: mdM.index, end: mdM.index + mdM[0].length, resolved: resolveDate(mdM[0]) || undefined };
  const dmRe = new RegExp(`\\b\\d{1,2}\\s+(${allMonthNamesStr})\\b`, "i");
  const dmM = dmRe.exec(lower);
  if (dmM && dmM.index !== undefined) return { text: dmM[0], start: dmM.index, end: dmM.index + dmM[0].length, resolved: resolveDate(dmM[0]) || undefined };
  // 5. Standalone month
  const inMonthRe = new RegExp(`\\b(?:in|en|im|em|nel)\\s+(${allMonthNamesStr})\\b`, "i");
  const inM = inMonthRe.exec(lower);
  if (inM && inM.index !== undefined) return { text: inM[0], start: inM.index, end: inM.index + inM[0].length, resolved: resolveDate(inM[0]) || undefined };
  const monthRe = new RegExp(`\\b(${allMonthNamesStr})\\b`, "i");
  const moM = monthRe.exec(lower);
  if (moM && moM.index !== undefined) return { text: moM[0], start: moM.index, end: moM.index + moM[0].length, resolved: resolveDate(moM[0]) || undefined };
  return null;
}

// ---------------------------------------------------------------------------
// Inline Prompt Highlighting
// ---------------------------------------------------------------------------
interface HighlightRange { start: number; end: number; type: "origin" | "dest" | "date" | "qualifier"; airports: LocAirport[]; resolvedDate?: string }

function useHighlightRanges(prompt: string): HighlightRange[] {
  return useMemo(() => {
    if (!prompt || prompt.length < 5) return [];
    const lower = prompt.toLowerCase();
    const ranges: HighlightRange[] = [];

    // Location scan: first match = origin, rest = dest
    const locs = scanLocations(prompt);
    for (let li = 0; li < locs.length; li++) {
      const s = locs[li];
      ranges.push({ start: s.start, end: s.end, type: li === 0 ? "origin" : "dest", airports: s.loc.airports });
    }

    // Date detection
    const dateMatch = detectDate(lower);
    if (dateMatch) {
      ranges.push({ start: dateMatch.start, end: dateMatch.end, type: "date", airports: [], resolvedDate: dateMatch.resolved });
    }

    // Qualifier detection: safe routes, budget, class, etc. (all 12 languages)
    const qualifierPats: RegExp[] = [
      // Safe routes / safe only (en, de, es, fr, it, pt, tr, zh, ja, ko, hi, ar)
      /\b(safe\s+routes?\s*(?:only)?|safe\s+only|avoid\s+conflict\s+zones?)\b/i,
      /(nur\s+sicher(?:e\s+routen)?)/i, // de
      /(solo\s+(?:rutas?\s+)?segur[ao]s?)/i, // es
      /((?:routes?\s+)?s[uû]r(?:e?s)?\s+uniquement|s[uû]rs?\s+uniquement)/i, // fr
      /(solo\s+(?:rotte?\s+)?sicur[ei])/i, // it
      /(somente\s+(?:rotas?\s+)?segur[ao]s?)/i, // pt
      /(sadece\s+güvenli(?:\s+rotalar)?)/i, // tr
      /(仅安全航线|安全航线)/i, // zh
      /(安全ルートのみ|安全のみ)/i, // ja
      /(안전\s*노선만)/i, // ko
      /(केवल\s+सुरक्षित(?:\s+मार्ग)?)/i, // hi
      /(مسارات?\s+آمنة?\s+فقط|آمنة?\s+فقط)/i, // ar
      // Direct / nonstop (en, de, es, fr, it, pt, tr, zh, ja, ko, hi, ar)
      /\b(nonstop|non-stop|direct\s+(?:flights?\s*)?only|direct(?:\s+flights?)?)\b/i,
      /(nur\s+direkt(?:flüge)?|nonstop)/i, // de
      /(solo\s+directo)/i, // es
      /((?:vols?\s+)?directs?\s+uniquement)/i, // fr
      /(solo\s+dirett[io])/i, // it
      /(somente\s+diretos)/i, // pt
      /(sadece\s+direkt)/i, // tr
      /(仅直飞)/i, // zh
      /(直行便のみ)/i, // ja
      /(직항만)/i, // ko
      /(केवल\s+सीधी(?:\s+फ़?्लाइट)?)/i, // hi
      /(مباشر\s+فقط)/i, // ar
      // Business class (all languages)
      /\b(business\s+class)\b/i,
      /(classe?\s+affaires?)/i, // fr
      /(clase\s+business)/i, // es
      /(ビジネスクラス)/i, // ja
      /(비즈니스\s*클래스)/i, // ko
      /(商务舱)/i, // zh
      /(बिज़नेस\s+क्लास)/i, // hi
      /(درجة\s+رجال\s+الأعمال)/i, // ar
      /(classe?\s+executiva)/i, // pt
      // First class (all languages)
      /\b(first\s+class)\b/i,
      /(première\s+classe?)/i, // fr
      /(primera\s+clase)/i, // es
      /(ファーストクラス)/i, // ja
      /(퍼스트\s*클래스)/i, // ko
      /(头等舱)/i, // zh
      /(फ़र्स्ट\s+क्लास)/i, // hi
      /(الدرجة\s+الأولى)/i, // ar
      /(primeira\s+classe?)/i, // pt
      // Premium economy
      /\b(premium\s+economy)\b/i,
      /(超级经济舱)/i, // zh
      /(اقتصادية\s+مميزة)/i, // ar
      /(turista\s+premium)/i, // es
      // Economy (all languages, word-boundary sensitive)
      /\b(economy)\b/i,
      /(économique)/i, // fr
      /(经济舱)/i, // zh
      /(エコノミー)/i, // ja
      /(이코노미)/i, // ko
      /(इकॉनमी)/i, // hi
      /(اقتصادية)/i, // ar
      /\b(econômica)\b/i, // pt
      /\b(turista)\b/i, // es
      // Standalone qualifier words (single-word, after multi-word patterns so longer matches win)
      /\b(seguro|segura)\b/i,     // es: safe
      /\b(sicher|sichere)\b/i,    // de: safe
      /\b(sicuro|sicura)\b/i,     // it: safe
      /\b(güvenli)\b/i,           // tr: safe
      /\b(directo|directa)\b/i,   // es: direct
      /\b(direkt)\b/i,            // de: direct
      /\b(diretto|diretta)\b/i,   // it: direct
      /\b(direto|direta)\b/i,     // pt: direct
      // Budget: under/less than + currency + amount (all languages)
      /\b(under\s+[\$\u20ac\u00a3\u20b9\u00a5]?\s*\d[\d,]*)\b/i, // en
      /\b(max(?:imum)?\s+[\$\u20ac\u00a3\u20b9\u00a5]?\s*\d[\d,]*)\b/i, // en
      /(unter\s+\d[\d.,]*\s*[\$\u20ac\u00a3]?)/i, // de: "unter 500€"
      /(menos\s+de\s+[\$\u20ac\u00a3R]?\$?\s*\d[\d.,]*)/i, // es/pt: "menos de 500€"
      /(meno\s+di\s+\d[\d.,]*\s*[\$\u20ac\u00a3]?)/i, // it: "meno di 500€"
      /(moins\s+de\s+\d[\d.,]*\s*[\$\u20ac\u00a3]?)/i, // fr: "moins de 500€"
      /(\d[\d.,]*\s*(?:TL|₺)\s*altında)/i, // tr: "15000 TL altında"
      /(\d[\d.,]*\s*(?:元|美元)以[内下])/i, // zh: "3000元以内"
      /(\d[\d.,]*\s*(?:万?円)以[内下])/i, // ja: "5万円以内"
      /(\d[\d.,]*\s*(?:만?원)\s*이하)/i, // ko: "50만원 이하"
      /([\$\u20ac\u00a3\u20b9]?\s*\d[\d,]*\s*से\s*कम)/i, // hi: "₹40000 से कम"
      /(أقل\s+من\s+\d[\d.,]*)/i, // ar: "أقل من 2000"
    ];
    for (const pat of qualifierPats) {
      const m = pat.exec(lower);
      if (m && m.index !== undefined) {
        const overlaps = ranges.some((r) => m.index! < r.end && m.index! + m[0].length > r.start);
        if (!overlaps) ranges.push({ start: m.index, end: m.index + m[0].length, type: "qualifier", airports: [] });
      }
    }

    // Sort by start, skip overlaps
    ranges.sort((a, b) => a.start - b.start);
    const clean: HighlightRange[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start >= cursor) {
        clean.push(r);
        cursor = r.end;
      }
    }
    return clean;
  }, [prompt]);
}

interface TextRun { type: "plain" | "highlight"; text: string; segType?: "origin" | "dest" | "date" | "qualifier"; airports?: LocAirport[]; resolvedDate?: string }

function buildTextRuns(prompt: string, ranges: HighlightRange[]): TextRun[] {
  if (!ranges.length) return [{ type: "plain", text: prompt }];
  const runs: TextRun[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) runs.push({ type: "plain", text: prompt.slice(cursor, r.start) });
    runs.push({ type: "highlight", text: prompt.slice(r.start, r.end), segType: r.type, airports: r.airports, resolvedDate: r.resolvedDate });
    cursor = r.end;
  }
  if (cursor < prompt.length) runs.push({ type: "plain", text: prompt.slice(cursor) });
  return runs;
}

// Shared ref: closing one tooltip closes any other open tooltip
const activeTooltipClose = { current: null as (() => void) | null };

function InlineHighlight({ text, airports, resolvedDate }: { text: string; airports: LocAirport[]; resolvedDate?: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasTooltip = airports.length > 1 || !!resolvedDate;

  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [show]);

  useEffect(() => {
    if (show) {
      activeTooltipClose.current?.();
      activeTooltipClose.current = () => setShow(false);
    }
  }, [show]);

  // Position fixed tooltip below trigger element
  useEffect(() => {
    if (!show || !tooltipRef.current || !ref.current) return;
    const triggerRect = ref.current.getBoundingClientRect();
    const tt = tooltipRef.current;
    tt.style.top = `${triggerRect.bottom + 6}px`;
    tt.style.left = `${triggerRect.left}px`;
    // Clamp to viewport right edge
    requestAnimationFrame(() => {
      const ttRect = tt.getBoundingClientRect();
      if (ttRect.right > window.innerWidth - 8) {
        tt.style.left = `${window.innerWidth - 8 - ttRect.width}px`;
      }
    });
  }, [show]);

  if (!hasTooltip) return <span className="text-[var(--color-interactive)]">{text}</span>;
  return (
    <span
      ref={ref}
      className="inline pointer-events-auto"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(v => !v); }}
    >
      <span className="text-[var(--color-interactive)] cursor-help border-b border-dotted border-[var(--color-interactive)]/50">{text}</span>
      {show && (
        <div ref={tooltipRef} className="fixed z-50 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-2 shadow-lg animate-fade-in" style={{ maxHeight: 240, maxWidth: 220, overflowY: "auto" }}>
          {resolvedDate ? (
            <span className="block text-[11px] leading-relaxed text-[var(--color-text)] whitespace-nowrap">{resolvedDate}</span>
          ) : (
            airports.map((a) => (
              <span key={a.iata} className="block text-[11px] leading-relaxed text-[var(--color-text)] whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: 200 }}>
                <span className="font-mono text-[var(--color-accent)] font-semibold">{a.iata}</span>{" "}
                <span className="text-[var(--color-text-muted)]">{a.city}</span>
              </span>
            ))
          )}
        </div>
      )}
    </span>
  );
}

function HighlightOverlay({ prompt, ranges }: { prompt: string; ranges: HighlightRange[] }) {
  const runs = buildTextRuns(prompt, ranges);
  return (
    <div
      className="absolute inset-0 px-1 py-2 text-base leading-relaxed whitespace-pre-wrap break-words pointer-events-none z-10"
      aria-hidden="true"
    >
      {runs.map((run, i) =>
        run.type === "plain"
          ? <span key={i} className="text-[var(--color-text)]">{run.text}</span>
          : <InlineHighlight key={i} text={run.text} airports={run.airports || []} resolvedDate={run.resolvedDate} />
      )}
    </div>
  );
}

// Context for airport country codes (avoids prop drilling for flags)
const AirportCountriesCtx = createContext<Record<string, string>>({});
const useAirportCountries = () => useContext(AirportCountriesCtx);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ParsedSearch {
  origins: string[];
  destinations: string[];
  dates: string[];
  return_dates: string[];
  max_price: number;
  currency: string;
  cabin: string;
  stops: string;
  safe_only?: boolean;
  total_routes: number;
  airport_names: Record<string, string>;
}

interface FlightLeg {
  airline: string;
  flight_number: string;
  from: string;
  to: string;
  departs: string;
  arrives: string;
  duration_minutes: number;
}

interface FlightOut {
  price: number;
  currency: string;
  duration_minutes: number;
  stops: number;
  route: string;
  risk_level: string;
  risk_details: { airport: string; country: string; zone: string; risk: string }[];
  score: number;
  legs: FlightLeg[];
  provider: string;
  booking_url: string;
  booking_label: string;
  booking_exact: boolean;
  origin: string;
  destination: string;
  date: string;
}

interface RoundTripOut {
  outbound: FlightOut;
  inbound: FlightOut;
  total_price: number;
  currency: string;
  risk_level: string;
  risk_details: { airport: string; country: string; zone: string; risk: string }[];
  score: number;
}

interface ScanSummaryData {
  best_destinations: FlightOut[];
  price_matrix: {
    destinations: string[];
    dates: string[];
    prices: Record<string, number | null>;
    cheapest_per_dest: Record<string, number>;
  };
  stats: {
    total_flights: number;
    destinations: number;
    origins: number;
    dates: number;
    min_price: number;
    max_price: number;
  };
}

type SortKey = "score" | "price" | "duration" | "stops";
type AttributionParams = { utm_source?: string; utm_medium?: string; utm_campaign?: string; ref?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatTime(iso: string, loc?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(loc || "en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
}
function formatDate(iso: string, loc?: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(loc || "en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
function currencySymbol(c: string): string {
  return c === "EUR" ? "\u20AC" : c === "USD" ? "$" : c === "GBP" ? "\u00A3" : c;
}
// Fix 1: Extract display date from flight legs (actual departure date, not search date)
function flightDisplayDate(flight: FlightOut): string {
  const departs = flight.legs?.[0]?.departs;
  if (departs) return departs.slice(0, 10);
  return flight.date;
}
function priceToColor(price: number | null, min: number, max: number): string {
  if (price == null || min === max) return "transparent";
  const ratio = Math.min(1, Math.max(0, (price - min) / (max - min)));
  // Monochromatic green scale: bright green (cheap) -> muted green (expensive)
  const r = Math.round(34 + ratio * 20);
  const g = Math.round(197 - ratio * 80);
  const b = Math.round(94 - ratio * 40);
  const a = 0.9 - ratio * 0.35;
  return `rgba(${r},${g},${b},${a})`;
}

function safeUrl(url: string): string | null {
  if (!url) return null;
  try {
    const p = new URL(url);
    if (p.protocol === "https:" || p.protocol === "http:") return url;
  } catch {}
  return null;
}
// Google Flights protobuf-based ?tfs= URL builder
const SEAT_PB: Record<string, number> = { economy: 1, premium_economy: 2, business: 3, first: 4 };
function _pbVarint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return out;
}
function _pbTag(field: number, wireType: number): number[] { return _pbVarint((field << 3) | wireType); }
function _pbString(field: number, s: string): number[] {
  const bytes = new TextEncoder().encode(s);
  return [..._pbTag(field, 2), ...(_pbVarint(bytes.length)), ...bytes];
}
function _pbBytes(field: number, data: number[]): number[] { return [..._pbTag(field, 2), ...(_pbVarint(data.length)), ...data]; }
function _pbLeg(origin: string, dest: string, date: string, airline: string, flightNum: string): number[] {
  // Field 1: origin, Field 2: date, Field 3: dest, Field 5: airline, Field 6: flight number
  return [..._pbString(1, origin), ..._pbString(2, date), ..._pbString(3, dest), ..._pbString(5, airline), ..._pbString(6, flightNum)];
}
function _pbSlice(date: string, origin: string, dest: string, legs: { from: string; to: string; date: string; airline: string; flight_number: string }[]): number[] {
  // Field 2: departure date, Field 4 (repeated): individual flight legs, Field 13/14: origin/dest airports
  const inner = [
    ..._pbString(2, date),
    ...legs.flatMap((l) => _pbBytes(4, _pbLeg(l.from, l.to, l.date, l.airline, l.flight_number))),
    ..._pbBytes(13, _pbString(2, origin)),
    ..._pbBytes(14, _pbString(2, dest)),
  ];
  return _pbBytes(3, inner);
}
function _pbRouteOnly(origin: string, dest: string, date: string): number[] {
  // Fallback: simple route search (no specific flight)
  const inner = [..._pbString(2, date), ..._pbBytes(13, _pbString(2, origin)), ..._pbBytes(14, _pbString(2, dest))];
  return _pbBytes(3, inner);
}
function googleFlightsUrl(origin: string, dest: string, date: string, currency: string, cabin?: string, legs?: FlightLeg[]): string {
  const cur = (currency || "EUR").toUpperCase().slice(0, 3);
  const seat = SEAT_PB[cabin || ""] || 1;
  const hasLegs = legs && legs.length > 0 && legs.every((l) => l.airline && l.airline !== "ZZ" && l.flight_number);
  let slice: number[];
  if (hasLegs) {
    const legData = legs!.map((l) => ({ from: l.from, to: l.to, date: l.departs.slice(0, 10), airline: l.airline, flight_number: l.flight_number }));
    slice = _pbSlice(date, origin, dest, legData);
  } else {
    slice = _pbRouteOnly(origin, dest, date);
  }
  const tfs = [...slice, ..._pbBytes(8, [0x01]), ..._pbTag(9, 0), seat, ..._pbTag(19, 0), 2];
  const bytes = new Uint8Array(tfs);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `https://www.google.com/travel/flights/search?tfs=${encodeURIComponent(b64)}&hl=${typeof window !== "undefined" ? document.documentElement.lang || "en" : "en"}&curr=${cur}`;
}
function appendAttribution(url: string, params: AttributionParams): string {
  const s = safeUrl(url);
  if (!s) return "";
  const u = new URL(s);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}


function formatAirlines(codes: string): string {
  if (!codes) return "";
  return codes.split(", ").map((c) => airlineName(c.trim())).join(", ");
}

function AirlineLogos({ codes }: { codes: string }) {
  if (!codes) return null;
  const list = codes.split(", ").map((c) => c.trim()).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {list.map((code) => (
        <span key={code} className="inline-flex items-center gap-1">
          <img
            src={`https://images.kiwi.com/airlines/64/${code}.png`}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            className="w-4 h-4 rounded-sm object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span>{airlineName(code)}</span>
        </span>
      ))}
    </span>
  );
}

function consumerRouteLabel(route: string, names: Record<string, string>): string {
  return route.split(" -> ").map((code) => {
    const city = names[code.trim()];
    return city ? `${city} (${code.trim()})` : code.trim();
  }).join(" \u2192 ");
}

function RouteWithFlags({ route, names }: { route: string; names: Record<string, string> }) {
  const countries = useAirportCountries();
  const segments = route.split(" -> ").map((c) => c.trim());
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {segments.map((code, i) => {
        const city = names[code];
        const flag = flagUrl(code, countries);
        return (
          <React.Fragment key={code + i}>
            {i > 0 && <span className="text-[var(--color-text-muted)] mx-0.5">{"\u2192"}</span>}
            {flag && (
              <img
                src={flag}
                alt=""
                width={16}
                height={12}
                loading="lazy"
                className="w-4 h-3 rounded-[1px] object-cover inline-block"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <span>{city ? `${city} (${code})` : code}</span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 12 12" className="w-3 h-3 inline" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3.5 3.5h5v5M8.5 3.5L3.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 inline shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function sortFlights(flights: FlightOut[], key: SortKey): FlightOut[] {
  return [...flights].sort((a, b) => {
    if (key === "price") return (a.price || Infinity) - (b.price || Infinity);
    if (key === "duration") return a.duration_minutes - b.duration_minutes;
    if (key === "stops") return a.stops - b.stops || (a.price || Infinity) - (b.price || Infinity);
    return a.score - b.score;
  });
}

// ---------------------------------------------------------------------------
// Recommendation logic
// ---------------------------------------------------------------------------
type RecLabel = "recommended" | "cheapest" | "fastest" | "lowestStress";

function getRecommendationReason(flight: FlightOut, all: FlightOut[], label: RecLabel, t: (key: string, values?: Record<string, string | number>) => string): string {
  const sym = currencySymbol(flight.currency);
  const price = `${sym}${Math.round(flight.price)}`;
  const dur = formatDuration(flight.duration_minutes);
  const stopsLabel = flight.stops === 0 ? t("direct") : t("stops", { count: flight.stops });
  const safe = flight.risk_level === "safe";
  const via = flight.stops > 0 && flight.route ? flight.route.split(" -> ").slice(1, -1).join(", ") : "";

  if (label === "recommended") {
    const parts = [price, dur, stopsLabel + (via ? ` ${t("via", { cities: via })}` : "")];
    if (safe) parts.push(t("safeRoute"));
    return parts.join(", ") + ".";
  }
  if (label === "cheapest") {
    const avgPrice = all.length > 0 ? all.reduce((s, f) => s + f.price, 0) / all.length : 0;
    const saving = avgPrice > flight.price ? Math.round(avgPrice - flight.price) : 0;
    return saving > 0 ? t("belowAverage", { price, saving: `${sym}${saving}` }) : `${price}.`;
  }
  if (label === "fastest") {
    const slowest = all.length > 0 ? Math.max(...all.map((f) => f.duration_minutes)) : flight.duration_minutes;
    const saved = slowest - flight.duration_minutes;
    return saved > 60 ? t("fasterThanSlowest", { duration: dur, stops: stopsLabel, saved: formatDuration(saved) }) : `${dur} ${stopsLabel}.`;
  }
  return `${stopsLabel}, ${dur}, ${price}.`;
}

// ---------------------------------------------------------------------------
// Risk Badge
// ---------------------------------------------------------------------------
function RiskBadge({ level }: { level: string }) {
  const [showTip, setShowTip] = useState(false);
  const tr = useTranslations("search.risk");
  const c: Record<string, { bg: string; text: string; border: string; label: string; icon: string; tooltip: string }> = {
    safe: { bg: "bg-[var(--color-safe)]/15", text: "text-[var(--color-safe)]", border: "border-[var(--color-safe)]/25", label: tr("safe"), icon: "\u2713", tooltip: tr("safeTooltip") },
    caution: { bg: "bg-[var(--color-caution)]/15", text: "text-[var(--color-caution)]", border: "border-[var(--color-caution)]/25", label: tr("caution"), icon: "\u26A0", tooltip: tr("cautionTooltip") },
    high_risk: { bg: "bg-[var(--color-high-risk)]/15", text: "text-[var(--color-high-risk)]", border: "border-[var(--color-high-risk)]/25", label: tr("highRisk"), icon: "\u26A0", tooltip: tr("highRiskTooltip") },
    do_not_fly: { bg: "bg-[var(--color-danger)]/15", text: "text-[var(--color-danger)]", border: "border-[var(--color-danger)]/25", label: tr("doNotFly"), icon: "\u2717", tooltip: tr("doNotFlyTooltip") },
  };
  if (!level || !c[level]) return null;
  const x = c[level];
  return (
    <span
      className={`relative inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-help ${x.bg} ${x.text} ${x.border}`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={() => setShowTip((v) => !v)}
    >
      <span className="text-[10px]">{x.icon}</span>{x.label}
      {showTip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[11px] leading-relaxed text-[var(--color-text-muted)] whitespace-nowrap z-50 pointer-events-none animate-in fade-in">
          {x.tooltip}
        </span>
      )}
    </span>
  );
}

function FlightCard({
  flight,
  label,
  reason,
  airportNames,
  attributionParams,
  onOutboundClick,
  cabin,
}: {
  flight: FlightOut;
  label?: string;
  reason?: string;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
  cabin?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("search.results");
  const trec = useTranslations("search.recommendations");
  const locale = useLocale();
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const bookingUrl = appendAttribution(flight.booking_url, attributionParams);
  const googleUrl = appendAttribution(
    googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency, cabin, flight.legs),
    attributionParams
  );
  return (
    <div className={`bg-[var(--color-surface)] border rounded-2xl p-5 sm:p-6 hover:border-[var(--color-interactive)]/30 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] ${
      label === "recommended"
        ? "border-[var(--color-interactive)]/40 ring-1 ring-[var(--color-interactive)]/20"
        : "border-[var(--color-border)]"
    }`}>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[var(--color-interactive)] uppercase tracking-wider">{trec(label as "recommended")}</span>
          {reason && <span className="text-xs text-[var(--color-text-muted)]">{reason}</span>}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text)]"><RouteWithFlags route={flight.route} names={airportNames} /></div>
          {airlines && <div className="text-xs text-[var(--color-text-muted)] mt-0.5"><AirlineLogos codes={airlines} /></div>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            <span>{formatDate(flightDisplayDate(flight), locale)}</span>
            {firstLeg && lastLeg && (
              <span className="text-[var(--color-text)]">
                {formatTime(firstLeg.departs, locale)} – {formatTime(lastLeg.arrives, locale)}
              </span>
            )}
            <span>{flight.stops === 0 ? t("direct") : t("stops", { count: flight.stops })}</span>
            <span>{formatDuration(flight.duration_minutes)}</span>
            <RiskBadge level={flight.risk_level} />
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          {flight.price > 0 && (
            <div className="text-end">
              <div className="text-2xl font-bold tracking-tight text-[var(--color-text)] price-display">
                {currencySymbol(flight.currency)}{Math.round(flight.price)}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              {flight.booking_exact && bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOutboundClick("booking", flight)}
                  aria-label={t("bookDirect")}
                  className="px-4 py-2 border border-[var(--color-border)] hover:border-[var(--color-interactive)]/40 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm font-medium rounded-lg transition-colors"
                >
                  {t("bookDirect")}
                </a>
              ) : (
                <>
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOutboundClick("google", flight)}
                    aria-label={t("googleFlights")}
                    className="px-3 py-2 border border-[var(--color-border)] hover:border-[var(--color-interactive)]/40 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm font-medium rounded-lg transition-colors"
                  >
                    <GoogleIcon /> {t("googleFlights")} <ExternalLinkIcon />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {flight.legs.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-interactive)]"
          aria-expanded={expanded}
        >
          {expanded ? t("hideDetails") : t("showSegments", { count: flight.legs.length })}
        </button>
      )}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
          {flight.legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-[var(--color-interactive)] w-14 inline-flex items-center gap-1">
                {leg.airline && leg.airline !== "ZZ" && (
                  <img
                    src={`https://images.kiwi.com/airlines/64/${leg.airline}.png`}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    className="w-4 h-4 rounded-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {leg.airline && leg.airline !== "ZZ" ? `${leg.airline}${leg.flight_number}` : leg.flight_number || "---"}
              </span>
              <span className="text-[var(--color-text-muted)]">{leg.from}</span>
              <span className="text-xs">{formatTime(leg.departs)}</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span className="text-[var(--color-text-muted)]">{leg.to}</span>
              <span className="text-xs">{formatTime(leg.arrives)}</span>
              <span className="text-xs text-[var(--color-text-muted)] ms-auto">{formatDuration(leg.duration_minutes)}</span>
            </div>
          ))}
          {flight.risk_details?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">{t("riskFactors")}</p>
              {flight.risk_details.map((rd, i) => (
                <div key={i} className="text-xs text-[var(--color-caution)]">
                  {rd.airport} ({rd.country}) – {rd.zone}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoundTripCard
// ---------------------------------------------------------------------------
function RoundTripFlightRow({
  flight,
  label,
  airportNames,
  attributionParams,
  onOutboundClick,
  cabin,
}: {
  flight: FlightOut;
  label: string;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
  cabin?: string;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const bookingUrl = appendAttribution(flight.booking_url, attributionParams);
  const googleUrl = appendAttribution(
    googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency, cabin, flight.legs),
    attributionParams
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-sm font-medium text-[var(--color-text)]">
          <RouteWithFlags route={flight.route} names={airportNames} />
        </div>
        {airlines && <div className="text-xs text-[var(--color-text-muted)] mt-0.5"><AirlineLogos codes={airlines} /></div>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed">
          <span>{formatDate(flightDisplayDate(flight), locale)}</span>
          {firstLeg && lastLeg && (
            <span className="text-[var(--color-text)]">
              {formatTime(firstLeg.departs, locale)} &ndash; {formatTime(lastLeg.arrives, locale)}
            </span>
          )}
          <span>{flight.stops === 0 ? t("results.direct") : t("results.stops", { count: flight.stops })}</span>
          <span>{formatDuration(flight.duration_minutes)}</span>
          {flight.risk_level === "safe" ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-safe)] bg-[var(--color-safe)]/10 border border-[var(--color-safe)]/20 rounded px-1.5 py-0.5">
              {t("risk.safe")}
            </span>
          ) : (
            <RiskBadge level={flight.risk_level} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {flight.booking_exact && bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOutboundClick("booking", flight)}
            className="px-3 py-1.5 border border-[var(--color-border)] hover:border-[var(--color-interactive)]/40 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-medium rounded-lg transition-colors"
          >
            {t("results.book")} <ExternalLinkIcon />
          </a>
        ) : (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOutboundClick("google", flight)}
            className="px-3 py-1.5 border border-[var(--color-border)] hover:border-[var(--color-interactive)]/40 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-medium rounded-lg transition-colors"
          >
            <GoogleIcon /> {t("results.googleFlights")} <ExternalLinkIcon />
          </a>
        )}
      </div>
    </div>
  );
}

function RoundTripCard({
  result,
  airportNames,
  attributionParams,
  onOutboundClick,
  cabin,
}: {
  result: RoundTripOut;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
  cabin?: string;
}) {
  const t = useTranslations("search");
  const { outbound, inbound, total_price, currency, risk_level } = result;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 hover:border-[var(--color-interactive)]/30 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-4 shrink-0">
              <div className="w-5 h-5 rounded-full bg-[var(--color-interactive)]/20 border border-[var(--color-interactive)]/40 flex items-center justify-center text-[10px] font-bold text-[var(--color-interactive)]">1</div>
              <div className="w-px flex-1 bg-[var(--color-border)] my-1" />
              <div className="w-5 h-5 rounded-full bg-[var(--color-interactive)]/20 border border-[var(--color-interactive)]/40 flex items-center justify-center text-[10px] font-bold text-[var(--color-interactive)]">2</div>
            </div>
            <div className="flex-1 divide-y divide-[var(--color-border)]">
              <RoundTripFlightRow flight={outbound} label={t("results.step1")} airportNames={airportNames} attributionParams={attributionParams} onOutboundClick={onOutboundClick} cabin={cabin} />
              <RoundTripFlightRow flight={inbound} label={t("results.step2")} airportNames={airportNames} attributionParams={attributionParams} onOutboundClick={onOutboundClick} cabin={cabin} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 pt-2 shrink-0">
          {total_price > 0 && (
            <div className="text-end">
              <div className="text-2xl font-bold tracking-tight text-[var(--color-text)] price-display">
                {currencySymbol(currency)}{Math.round(total_price)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{t("results.combinedTotal")}</div>
            </div>
          )}
          {risk_level !== "safe" && <RiskBadge level={risk_level} />}
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{t("results.twoBookings")}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
interface ProgressInfo {
  done: number;
  total: number;
  route: string;
  date: string;
}

function SearchingState({ parsed, progress, filteredCount }: { parsed: ParsedSearch | null; progress: ProgressInfo | null; filteredCount: number }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const totalRoutes = progress?.total ?? parsed?.total_routes ?? 0;
  const workers = Math.min(16, totalRoutes);
  const manualMinutes = Math.ceil(totalRoutes * 2.5);
  const manualLabel = manualMinutes >= 60
    ? `${Math.floor(manualMinutes / 60)}h ${manualMinutes % 60}min`
    : `${manualMinutes} min`;

  const estimateSeconds = progress && progress.total > 0
    ? Math.ceil((progress.total - progress.done) / 3)
    : totalRoutes
      ? Math.ceil(totalRoutes / 3)
      : null;

  const timeLabel = estimateSeconds != null
    ? estimateSeconds < 5
      ? t("loading.almostDone")
      : t("loading.remaining", { seconds: estimateSeconds })
    : null;

  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full bg-[var(--color-interactive)] animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-[var(--color-interactive)] animate-pulse" style={{ animationDelay: "0.3s" }} />
        <div className="w-2 h-2 rounded-full bg-[var(--color-interactive)] animate-pulse" style={{ animationDelay: "0.6s" }} />
      </div>
      {progress && parsed ? (
        <>
          <p className="text-base font-medium text-[var(--color-text)]">
            {t("loading.agentsChecking", { workers, total: progress.total })}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono">{t("loading.checkingRoute", { route: progress.route, date: formatDate(progress.date, locale) })}</p>
          <div className="mt-4 mx-auto max-w-xs h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-interactive)] rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {t("loading.checked", { done: progress.done, total: progress.total })} {timeLabel ? `· ${timeLabel}` : ""}
          </p>
          {manualMinutes >= 2 && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {t("loading.savingYou", { time: manualLabel })}
            </p>
          )}
          {filteredCount > 0 && (
            <p className="text-[11px] text-[var(--color-caution)] mt-1">{t("loading.safetyFiltered", { count: filteredCount })}</p>
          )}
        </>
      ) : parsed ? (
        <>
          <p className="text-base font-medium text-[var(--color-text)]">
            {t("loading.agentsChecking", { workers, total: totalRoutes })}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {manualMinutes >= 2
              ? t("loading.wouldTake", { time: manualLabel })
              : t("loading.fetchingPrices")}
          </p>
        </>
      ) : (
        <>
          <p className="text-[var(--color-text-muted)]">{t("loading.understanding")}</p>
          <div className="mt-4 mx-auto max-w-xs h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-interactive)] opacity-60 rounded-full shimmer-bar" />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact flight row for compare-all list
// ---------------------------------------------------------------------------
function CompactFlightRow({
  flight,
  sym,
  airportNames,
  cabin,
}: {
  flight: FlightOut;
  sym: string;
  airportNames: Record<string, string>;
  cabin?: string;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airline = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const googleUrl = googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency, cabin, flight.legs);
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--color-text)] truncate"><RouteWithFlags route={flight.route} names={airportNames} /></div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-0.5">
          {airline && <span><AirlineLogos codes={airline} /></span>}
          <span>{formatDate(flightDisplayDate(flight), locale)}</span>
          {firstLeg && lastLeg && (
            <span className="hidden sm:inline">{formatTime(firstLeg.departs, locale)} – {formatTime(lastLeg.arrives, locale)}</span>
          )}
          <span>{flight.stops === 0 ? t("results.direct") : t("results.stops", { count: flight.stops })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-[var(--color-interactive)]">
          {flight.price > 0 ? `${sym}${Math.round(flight.price)}` : "-"}
        </span>
        <a
          href={safeUrl(googleUrl) || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-interactive)] hover:underline"
        >
          <GoogleIcon /> {t("results.google")} <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Summary (progressive disclosure)
// ---------------------------------------------------------------------------
function ScanSummaryCollapsed({
  summary,
  currency,
  onExpand,
  flights,
}: {
  summary: ScanSummaryData;
  currency: string;
  onExpand: () => void;
  flights?: FlightOut[];
}) {
  const t = useTranslations("search");
  const { stats } = summary;
  const sym = currencySymbol(currency);
  // Use live flight count/prices if available (e.g. after expand merge)
  const totalFlights = flights && flights.length > stats.total_flights ? flights.length : stats.total_flights;
  const destCount = flights && flights.length > 0 ? new Set(flights.map(f => f.destination)).size : stats.destinations;
  const minPrice = flights && flights.length > 0 ? Math.min(...flights.filter(f => f.price > 0).map(f => f.price)) : stats.min_price;
  const maxPrice = flights && flights.length > 0 ? Math.max(...flights.filter(f => f.price > 0).map(f => f.price)) : stats.max_price;
  return (
    <div className="mt-4">
      <button
        onClick={onExpand}
        className="text-sm text-[var(--color-interactive)] hover:underline"
      >
        {t("compare.compareAll", { flights: totalFlights, destinations: destCount })}
      </button>
      {minPrice > 0 && (
        <span className="ms-2 text-xs text-[var(--color-text-muted)]">
          {sym}{Math.round(minPrice)} – {sym}{Math.round(maxPrice)}
        </span>
      )}
    </div>
  );
}

function ScanSummaryExpanded({
  summary,
  currency,
  airportNames,
  flights,
  onCollapse,
  cabin,
}: {
  summary: ScanSummaryData;
  currency: string;
  airportNames: Record<string, string>;
  flights: FlightOut[];
  onCollapse: () => void;
  cabin?: string;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const { best_destinations, price_matrix, stats } = summary;
  const sym = currencySymbol(currency);
  const isMultiDest = best_destinations.length > 1;
  const isMultiOrigin = stats.origins > 1;
  const showMatrix = isMultiDest && price_matrix.dates.length > 1 && Object.values(price_matrix.prices).some((v) => v != null);

  // Compute global min/max for heatmap coloring
  const allPrices = Object.values(price_matrix.prices).filter((v): v is number => v != null);
  const globalMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const globalMax = allPrices.length > 0 ? Math.max(...allPrices) : 0;

  // Price bars: sorted cheapest first. When multi-origin, group by route instead of just dest.
  const sortedDests = (() => {
    if (!isMultiDest) return [];
    if (isMultiOrigin) {
      // Build best per route from flights
      const routeBest = new Map<string, FlightOut>();
      for (const f of flights) {
        const key = `${f.origin}-${f.destination}`;
        if (!routeBest.has(key) || f.score < routeBest.get(key)!.score) routeBest.set(key, f);
      }
      return [...routeBest.values()].filter((f) => f.price > 0).sort((a, b) => a.price - b.price);
    }
    return [...best_destinations].filter((f) => f.price > 0).sort((a, b) => a.price - b.price);
  })();
  const barMax = sortedDests.length > 0 ? sortedDests[sortedDests.length - 1].price : 1;

  return (
    <div className="mt-4 space-y-4">
      <button onClick={onCollapse} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-interactive)]">
        {t("compare.hideComparison")}
      </button>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
        <span><span className="text-[var(--color-text)] font-semibold">{stats.total_flights}</span> {t("compare.flights")}</span>
        <span><span className="text-[var(--color-text)] font-semibold">{stats.destinations}</span> {t("compare.destinations")}</span>
        {stats.min_price > 0 && (
          <span>{sym}{Math.round(stats.min_price)} – {sym}{Math.round(stats.max_price)}</span>
        )}
      </div>

      {/* Price bars per destination (hidden when fare heatmap is visible to avoid redundancy) */}
      {sortedDests.length > 1 && !showMatrix && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase">{isMultiOrigin ? t("compare.bestPricePerRoute") : t("compare.bestPricePerDest")}</div>
          <div className="px-4 py-3 space-y-2">
            {sortedDests.map((f, i) => {
              const pct = Math.max(8, (f.price / barMax) * 100);
              const barColor = priceToColor(f.price, sortedDests[0].price, barMax);
              const gfUrl = safeUrl(googleFlightsUrl(f.origin, f.destination, f.date, f.currency, cabin, f.legs));
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-medium shrink-0" style={{ width: isMultiOrigin ? "5.5rem" : "2.5rem" }}>
                    {isMultiOrigin ? `${f.origin} → ${f.destination}` : f.destination}
                  </span>
                  <span className="text-[var(--color-text-muted)] text-xs truncate hidden sm:inline w-24 shrink-0">{airportNames[f.destination] || ""}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 rounded" style={{ width: `${pct}%`, backgroundColor: barColor, minWidth: "2rem" }}>
                      <span className="px-1.5 text-xs font-semibold text-white leading-5 whitespace-nowrap">{sym}{Math.round(f.price)}</span>
                    </div>
                  </div>
                  <span className="text-[var(--color-text-muted)] text-xs shrink-0">{formatDate(f.date)}</span>
                  {gfUrl && (
                    <a href={gfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-interactive)] hover:underline shrink-0">
                      <GoogleIcon /> Google <ExternalLinkIcon />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isMultiDest && flights.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{t("compare.allOptions", { count: flights.length })}</div>
          <div className="divide-y divide-[var(--color-border)]">
            {[...flights].sort((a, b) => a.score - b.score).map((f, i) => (
              <CompactFlightRow key={i} flight={f} sym={sym} airportNames={airportNames} cabin={cabin} />
            ))}
          </div>
        </div>
      )}

      {/* Fare heatmap */}
      {showMatrix && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase">{t("compare.fareHeatmap")}</div>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {(() => {
              // When multi-origin, build route-level matrix from flights data
              const routeRows = isMultiOrigin
                ? (() => {
                    const routeMap = new Map<string, { origin: string; dest: string; byDate: Record<string, number> }>();
                    for (const f of flights) {
                      const key = `${f.origin}-${f.destination}`;
                      if (!routeMap.has(key)) routeMap.set(key, { origin: f.origin, dest: f.destination, byDate: {} });
                      const entry = routeMap.get(key)!;
                      if (!entry.byDate[f.date] || f.price < entry.byDate[f.date]) entry.byDate[f.date] = f.price;
                    }
                    return [...routeMap.values()].sort((a, b) => a.origin.localeCompare(b.origin) || a.dest.localeCompare(b.dest));
                  })()
                : null;

              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-3 py-2 text-start font-medium text-[var(--color-text-muted)] sticky left-0 z-10 bg-[var(--color-surface)]">{isMultiOrigin ? t("compare.route") : t("compare.dest")}</th>
                      {price_matrix.dates.map((d) => (
                        <th key={d} className="px-2 py-2 text-center font-mono text-[var(--color-text-muted)] min-w-[60px]">{d.slice(5)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routeRows
                      ? routeRows.map((row) => (
                          <tr key={`${row.origin}-${row.dest}`}>
                            <td className="px-3 py-1.5 font-mono font-medium sticky left-0 z-10 bg-[var(--color-surface)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                              {row.origin} → {row.dest} <span className="font-sans text-[var(--color-text-muted)] hidden sm:inline">{airportNames[row.dest] || ""}</span>
                            </td>
                            {price_matrix.dates.map((dt) => {
                              const price = row.byDate[dt] ?? null;
                              const bg = priceToColor(price, globalMin, globalMax);
                              const gfLink = `https://www.google.com/travel/flights?q=flights+from+${row.origin}+to+${row.dest}+on+${dt}`;
                              return (
                                <td key={dt} className="px-1 py-1">
                                  {price != null ? (
                                    <a href={gfLink} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 text-center text-xs font-mono font-semibold rounded-md transition-opacity hover:opacity-80" style={{ backgroundColor: bg, color: "#fff" }}>
                                      {sym}{Math.round(price)}
                                    </a>
                                  ) : (
                                    <span className="block px-2 py-1.5 text-center text-xs font-mono text-[var(--color-text-muted)]">---</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      : price_matrix.destinations.map((dest) => (
                          <tr key={dest}>
                            <td className="px-3 py-1.5 font-mono font-medium sticky left-0 z-10 bg-[var(--color-surface)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                              {dest} <span className="font-sans text-[var(--color-text-muted)] hidden sm:inline">{airportNames[dest] || ""}</span>
                            </td>
                            {price_matrix.dates.map((dt) => {
                              const price = price_matrix.prices[`${dest}|${dt}`];
                              const bg = priceToColor(price, globalMin, globalMax);
                              const gfLink = `https://www.google.com/travel/flights?q=flights+from+${best_destinations.find((d) => d.destination === dest)?.origin || ""}+to+${dest}+on+${dt}`;
                              return (
                                <td key={dt} className="px-1 py-1">
                                  {price != null ? (
                                    <a href={gfLink} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 text-center text-xs font-mono font-semibold rounded-md transition-opacity hover:opacity-80" style={{ backgroundColor: bg, color: "#fff" }}>
                                      {sym}{Math.round(price)}
                                    </a>
                                  ) : (
                                    <span className="block px-2 py-1.5 text-center text-xs font-mono text-[var(--color-text-muted)]">---</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
          {/* Color legend */}
          <div className="px-4 py-2.5 border-t border-[var(--color-border)] flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">{t("compare.cheapest")}</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, rgba(34,197,94,0.9), rgba(54,117,54,0.55))" }} />
            <span className="text-xs text-[var(--color-text-muted)]">{t("compare.mostExpensive")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price Alert Section
// ---------------------------------------------------------------------------
function PriceAlertSection({
  parsed,
  cheapestPrice,
}: {
  parsed: ParsedSearch;
  cheapestPrice: number;
}) {
  const t = useTranslations("search");
  const [email, setEmail] = useState("");
  const [threshold, setThreshold] = useState(cheapestPrice > 0 ? String(Math.round(cheapestPrice)) : "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const sym = currencySymbol(parsed.currency);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const resp = await fetch(`${API_URL}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          query: `${parsed.origins.join(",")} to ${parsed.destinations.join(",")}`,
          origins: parsed.origins,
          destinations: parsed.destinations,
          max_price: parseFloat(threshold) || 0,
          currency: parsed.currency,
          cabin: parsed.cabin,
          is_round_trip: parsed.return_dates?.length > 0,
          current_price: cheapestPrice > 0 ? cheapestPrice : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus("error");
        setMessage(data.detail || t("errors.somethingWentWrong"));
      } else {
        setStatus("success");
        setMessage(data.message || t("priceAlert.success"));
      }
    } catch {
      setStatus("error");
      setMessage(t("errors.networkError"));
    }
  };

  if (status === "success") {
    return (
      <div className="mt-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3">
        <p className="text-sm text-[var(--color-text)]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block me-1 text-[var(--color-safe)] -mt-0.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          {t("priceAlert.success")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 space-y-2">
      <p className="text-sm font-medium text-[var(--color-text)]">{t("priceAlert.getNotified")}</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          placeholder={t("priceAlert.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-interactive)]"
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-[var(--color-text-muted)]">{sym}</span>
          <input
            type="number"
            placeholder={t("priceAlert.maxPricePlaceholder")}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-interactive)]"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !email.trim()}
          className="px-4 py-1.5 text-sm font-medium bg-[var(--color-interactive)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {status === "loading" ? t("priceAlert.setting") : t("priceAlert.setAlert")}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-[var(--color-danger)]">{message}</p>
      )}
      <p className="text-xs text-[var(--color-text-muted)]">{t("priceAlert.disclaimer")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fix 2: Parsed Config chips
// ---------------------------------------------------------------------------
function ParsedConfig({ parsed, cacheAgeSeconds, onRefresh, safeCount, totalCount }: { parsed: ParsedSearch; cacheAgeSeconds: number | null; onRefresh: () => void; safeCount?: number; totalCount?: number }) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { origins, destinations, dates, return_dates, max_price, currency, cabin, stops, airport_names } = parsed;
  const sym = currencySymbol(currency);
  const isRoundTrip = return_dates && return_dates.length > 0;
  const [datesExpanded, setDatesExpanded] = useState(false);

  const originItems = origins.map((o) => airport_names?.[o] ? `${airport_names[o]} (${o})` : o);
  const originLabel = originItems.length <= 2 ? originItems.join(", ") : `${originItems.slice(0, 2).join(", ")} +${originItems.length - 2}`;
  const destItems = destinations.map((d) => airport_names?.[d] ? `${airport_names[d]} (${d})` : d);
  const destLabel = destItems.length <= 2 ? destItems.join(", ") : `${destItems.slice(0, 2).join(", ")} +${destItems.length - 2}`;

  const collapsedDates = dates.length <= 2 ? dates.map((d) => formatDate(d, locale)).join(", ") : `${formatDate(dates[0], locale)} + ${t("parsed.moreDates", { count: dates.length - 1 })}`;
  const canExpandDates = dates.length > 2;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-[var(--color-text)]">{originLabel}</span>
        <span className="text-[var(--color-text-muted)]">→</span>
        <span className="font-medium text-[var(--color-text)]">{destLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
        {canExpandDates ? (
          <button
            onClick={() => setDatesExpanded(!datesExpanded)}
            className="hover:text-[var(--color-text)] transition-colors underline decoration-dotted underline-offset-2"
          >
            {datesExpanded ? dates.map((d) => formatDate(d, locale)).join(", ") : collapsedDates}
          </button>
        ) : (
          <span>{collapsedDates}</span>
        )}
        {isRoundTrip && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-interactive)]/10 border border-[var(--color-interactive)]/20 text-[var(--color-interactive)] font-medium">
            {t("parsed.roundTripReturn")} → {return_dates.length <= 2 ? return_dates.map((d: string) => formatDate(d, locale)).join(", ") : `${formatDate(return_dates[0], locale)} + ${t("parsed.moreReturnDates", { count: return_dates.length - 1 })}`}
          </span>
        )}
        {cabin && <span>{t(`form.${cabin === "premium_economy" ? "premiumEconomy" : cabin}` as "form.economy")}</span>}
        {stops && stops !== "any" && (
          <span>{stops === "non_stop" ? t("parsed.directOnly") : stops === "one_stop_or_fewer" ? t("parsed.oneStopMax") : t("parsed.twoStopsMax")}</span>
        )}
        {max_price > 0 && <span>{t("parsed.max", { price: `${sym}${Math.round(max_price)}` })}</span>}
        {parsed.safe_only && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-safe)]/10 border border-[var(--color-safe)]/20 text-[var(--color-safe)] font-medium">{t("parsed.safeOnly")}</span>
        )}
        {totalCount != null && totalCount > 0 && !parsed.safe_only && (
          <span className={`px-1.5 py-0.5 rounded font-medium ${
            safeCount === totalCount
              ? "bg-[var(--color-safe)]/10 border border-[var(--color-safe)]/20 text-[var(--color-safe)]"
              : "bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/20 text-[var(--color-caution)]"
          }`}>
            {safeCount === totalCount ? t("parsed.allSafe") : t("parsed.safeCount", { safe: safeCount ?? 0, total: totalCount ?? 0 })}
          </span>
        )}
        {cacheAgeSeconds !== null && (
          <>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span>{t("parsed.pricesFrom", { minutes: Math.round(cacheAgeSeconds / 60) })}{" "}
              <button onClick={onRefresh} className="underline hover:text-[var(--color-text)] transition-colors">{tc("refresh")}</button>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
function ErrorFallback() {
  const t = useTranslations("search.errors");
  const tc = useTranslations("common");
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">{t("somethingWentWrong")}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">{t("pleaseRefresh")}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[var(--color-interactive)] text-white text-sm font-medium rounded-lg">
          {tc("refresh")}
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Structured search form state
// ---------------------------------------------------------------------------
interface SearchFormState {
  from: string;
  to: string;
  depart: string;
  returnDate: string;
  roundTrip: boolean;
  flexibleDates: boolean;
  maxPrice: string;
  directOnly: boolean;
  cabin: string;
  safeOnly: boolean;
}

function buildPromptFromForm(f: SearchFormState, sym: string, t: (key: string) => string): string {
  const parts: string[] = [];
  parts.push(`${f.from.trim()} ${t("prompt.to")} ${f.to.trim()}`);
  if (f.roundTrip && f.returnDate) {
    parts.push(`${t("prompt.roundTrip")} ${f.depart} ${t("prompt.returning")} ${f.returnDate}`);
  } else {
    parts.push(f.depart);
  }
  if (f.flexibleDates) parts.push(t("prompt.flexible"));
  if (f.cabin && f.cabin !== "economy") {
    const cabinKey = f.cabin === "premium_economy" ? "premiumEconomy" : f.cabin;
    parts.push(t(`form.${cabinKey}`));
  }
  if (f.maxPrice && parseInt(f.maxPrice, 10) > 0) parts.push(`${t("prompt.under")} ${sym}${f.maxPrice}`);
  if (f.directOnly) parts.push(t("prompt.directOnly"));
  if (f.safeOnly) parts.push(t("prompt.safeOnly"));
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
// EXAMPLES are loaded from translations in HomePage component

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function HomePage() {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const trec = useTranslations("search.recommendations");
  const locale = useLocale();
  const { currency: userCurrency } = useCurrency();
  const [searchMode, setSearchMode] = useState<"structured" | "natural">("natural");
  const [form, setForm] = useState<SearchFormState>({
    from: "",
    to: "",
    depart: "",
    returnDate: "",
    roundTrip: false,
    flexibleDates: false,
    maxPrice: "",
    directOnly: false,
    cabin: "economy",
    safeOnly: true,
  });
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "parsing" | "searching" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [parsed, setParsed] = useState<ParsedSearch | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [flights, setFlights] = useState<FlightOut[]>([]);
  const [returnFlights, setReturnFlights] = useState<FlightOut[] | null>(null);
  const [roundTripResults, setRoundTripResults] = useState<RoundTripOut[] | null>(null);
  const [zonesWarning, setZonesWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [attributionParams, setAttributionParams] = useState<AttributionParams>({ ref: "organic" });
  const [noResultsReason, setNoResultsReason] = useState<string | null>(null);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [safetyFilteredCount, setSafetyFilteredCount] = useState<number>(0);
  const [autoSearchQuery, setAutoSearchQuery] = useState<string | null>(null);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [previewFlights, setPreviewFlights] = useState<FlightOut[]>([]);
  const [tripTab, setTripTab] = useState<"roundtrip" | "oneway">("roundtrip");
  const [rtShowCount, setRtShowCount] = useState(5);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [shareCTADismissed, setShareCTADismissed] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  const [alertPopupDismissed, setAlertPopupDismissed] = useState(false);
  const [popupEmail, setPopupEmail] = useState("");
  const [popupThreshold, setPopupThreshold] = useState("");
  const [popupStatus, setPopupStatus] = useState<"idle" | "loading" | "success">("idle");
  const [expandPhase, setExpandPhase] = useState<"idle" | "expanding" | "done">("idle");
  const [expandCount, setExpandCount] = useState(0);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [expansionInfo, setExpansionInfo] = useState<string | null>(null);
  const [expandProgress, setExpandProgress] = useState<{ done: number; total: number } | null>(null);
  const expandAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savedSearches = useSavedSearches();
  const [minutesSaved, setMinutesSaved] = useState(0);

  const hasResults = phase === "done" || phase === "searching" || phase === "parsing";
  const [extraAirportNames, setExtraAirportNames] = useState<Record<string, string>>({});
  const [airportCountries, setAirportCountries] = useState<Record<string, string>>({});
  const airportNames = { ...(parsed?.airport_names || {}), ...extraAirportNames };

  useEffect(() => {
    if (searchMode === "natural") inputRef.current?.focus();
  }, [searchMode]);

  useEffect(() => {
    try { setMinutesSaved(parseInt(localStorage.getItem("flyfast_minutes_saved") || "0", 10)); } catch {}
  }, []);

  useEffect(() => {
    const restore = () => { if (!document.hidden) document.title = "FlyFast"; };
    document.addEventListener("visibilitychange", restore);
    return () => document.removeEventListener("visibilitychange", restore);
  }, []);

  // Price alert popup: show 2s after results, auto-dismiss 10s
  useEffect(() => {
    if (phase !== "done" || flights.length === 0 || alertPopupDismissed) {
      setShowAlertPopup(false);
      return;
    }
    const showTimer = setTimeout(() => setShowAlertPopup(true), 2000);
    return () => clearTimeout(showTimer);
  }, [phase, flights.length, alertPopupDismissed]);

  useEffect(() => {
    if (!showAlertPopup) return;
    const dismissTimer = setTimeout(() => {
      setShowAlertPopup(false);
      setAlertPopupDismissed(true);
    }, 10000);
    return () => clearTimeout(dismissTimer);
  }, [showAlertPopup]);

  // Reset popup on new search
  useEffect(() => {
    if (phase === "parsing") {
      setAlertPopupDismissed(false);
      setShowAlertPopup(false);
      setPopupStatus("idle");
      setPopupEmail("");
      setPopupThreshold("");
    }
  }, [phase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setAttributionParams({
      utm_source: p.get("utm_source") || undefined,
      utm_medium: p.get("utm_medium") || undefined,
      utm_campaign: p.get("utm_campaign") || undefined,
      ref: p.get("ref") || "organic",
    });
    // Fix 12: auto-populate and search from share URL
    const q = p.get("q");
    if (q) {
      setPrompt(q);
      setSearchMode("natural");
      setAutoSearchQuery(q);
    }
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  useEffect(() => {
    if ((phase === "done" || error) && resultsRef.current) resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase, error]);

  useEffect(() => {
    if (rateLimitReset === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitReset - Date.now()) / 1000));
      setRateLimitCountdown(remaining);
      if (remaining <= 0) setRateLimitReset(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitReset]);

  // Fix 12: auto-search when ?q= param present on page load
  useEffect(() => {
    if (autoSearchQuery) {
      const q = autoSearchQuery;
      setAutoSearchQuery(null);
      search(q);
    }
  }, [autoSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSearchPrompt = (): string => {
    if (searchMode === "natural") return prompt.trim();
    return buildPromptFromForm(form, currencySymbol(userCurrency), t);
  };

  const returnDateInvalid = form.roundTrip && form.returnDate && form.depart && form.returnDate < form.depart;

  const canSearch = (): boolean => {
    if (searchMode === "natural") return prompt.trim().length >= 3;
    if (returnDateInvalid) return false;
    return form.from.trim().length >= 2 && form.to.trim().length >= 2 && form.depart.length >= 8;
  };

  const search = async (q?: string) => {
    const text = q ?? getSearchPrompt();
    if (!text.trim()) return;
    trackEvent("search_submitted", {
      prompt_length: text.trim().length,
      mode: searchMode,
      ref: attributionParams.ref || "organic",
      utm_source: attributionParams.utm_source || undefined,
    });
    // Request notification permission for background tab alerts
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    setPhase("parsing");
    setError(null);
    setSuggestions(null);
    setParsed(null);
    setProgress(null);
    setFlights([]);
    setReturnFlights(null);
    setRoundTripResults(null);
    setZonesWarning(null);
    setSummary(null);
    setShowCompare(false);
    setNoResultsReason(null);
    setSearchWarning(null);
    setSafetyFilteredCount(0);
    setCacheAgeSeconds(null);
    setPreviewFlights([]);
    setIsPartial(false);
    setTripTab("roundtrip");
    setExpandPhase("idle");
    setExpandCount(0);
    setExpandError(null);
    setExpansionInfo(null);
    setExpandProgress(null);
    expandAbortRef.current?.abort();
    setRtShowCount(5);

    // Update browser URL so refresh/back restores the search (C6)
    // Keep ref/utm_source when arriving from a share URL (first search only)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", text.trim());
      const isShareVisit = url.searchParams.get("ref") === "share";
      if (!isShareVisit) {
        url.searchParams.delete("ref");
        url.searchParams.delete("utm_source");
        setAttributionParams((prev) => ({ ...prev, ref: "organic", utm_source: undefined }));
      }
      window.history.pushState({}, "", url.toString());
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 150_000);

    try {
      const resp = await fetch(`${API_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, currency: userCurrency, locale }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "", 10);
        if (retryAfter > 0) {
          setRateLimitReset(Date.now() + retryAfter * 1000);
        }
        const mins = retryAfter > 0 ? Math.ceil(retryAfter / 60) : 60;
        setError(t("rateLimit.limitReached", { mins }));
        trackEvent("rate_limit_hit", { ref: attributionParams.ref || "organic" });
        setPhase("idle");
        return;
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        setError(body?.detail || t("errors.searchFailed", { status: String(resp.status) }));
        if (body?.suggestions?.length) setSuggestions(body.suggestions);
        trackEvent("search_error", { status_code: resp.status, stage: "http" });
        setPhase("idle");
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "parsed") {
              setParsed(msg.parsed);
              if (msg.warning) setSearchWarning(msg.warning);
              setPhase("searching");
            } else if (msg.type === "progress") {
              setProgress(msg);
              if (msg.filtered > 0) setSafetyFilteredCount(msg.filtered);
              if (msg.preview_flights?.length) {
                // For round-trip previews, use combined price if available
                const previews = msg.preview_flights.map((f: FlightOut & { _combined_price?: number }) => {
                  if (f._combined_price && f._combined_price > 0) {
                    return { ...f, price: f._combined_price, _isRoundTripPrice: true };
                  }
                  return f;
                });
                setPreviewFlights(previews);
              }
            } else if (msg.type === "results") {
              setFlights(msg.flights || []);
              setReturnFlights(msg.return_flights || null);
              setRoundTripResults(msg.round_trip_results || null);
              if (msg.round_trip_results?.length) {
                setTripTab("roundtrip");
              } else {
                setTripTab("oneway");
              }
              setZonesWarning(msg.zones_warning || null);
              setSummary(msg.summary || null);
              if (msg.summary?.best_destinations?.length > 1) setShowCompare(true);
              setNoResultsReason(msg.no_results_reason || null);
              setSearchWarning(msg.warning || null);
              setCacheAgeSeconds(msg.cache_age_seconds ?? null);
              if (msg.safety_filtered_count > 0) setSafetyFilteredCount(msg.safety_filtered_count);
              if (msg.airport_names) setExtraAirportNames(prev => ({ ...prev, ...msg.airport_names }));
              if (msg.airport_countries) setAirportCountries(prev => ({ ...prev, ...msg.airport_countries }));
              if (msg.partial) setIsPartial(true);
              setPhase("done");
              // Notify user if tab is in background
              if (document.hidden) {
                document.title = `✓ ${t("resultsReady")}`;
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("FlyFast", { body: t("shareNotification", { count: (msg.flights || []).length }), icon: "/favicon.ico" });
                }
              }
              savedSearches.save(text);
              // Accumulate time saved
              const routes = parsed?.total_routes ?? 0;
              if (routes > 0) {
                const added = Math.ceil(routes * 2.5);
                try {
                  const prev = parseInt(localStorage.getItem("flyfast_minutes_saved") || "0", 10);
                  const next = prev + added;
                  localStorage.setItem("flyfast_minutes_saved", String(next));
                  setMinutesSaved(next);
                } catch {}
              }
              trackEvent("search_results_received", { count: (msg.flights || []).length, has_round_trip: Boolean(msg.round_trip_results?.length), has_return: Boolean(msg.return_flights?.length) });
            } else if (msg.type === "error") {
              setError(msg.detail);
              trackEvent("search_error", { stage: "stream", detail: String(msg.detail || "") });
              setPhase("idle");
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Use callback form to read current flights without stale closure
        setFlights((current) => {
          if (current.length > 0) {
            setIsPartial(true);
            setPhase("done");
            trackEvent("search_timeout_partial", { stage: "client", count: current.length });
          } else {
            setNoResultsReason("timeout");
            setPhase("done");
            trackEvent("search_error", { stage: "client", type: "abort_no_results" });
          }
          return current;
        });
      } else {
        setError(t("errors.couldNotReach"));
        trackEvent("search_error", { stage: "client", type: "network" });
        setPhase("idle");
      }
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setPhase((p) => (p === "parsing" || p === "searching" ? "idle" : p));
    }
  };

  const cancelSearch = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setError(null);
  };

  const expandSearch = async () => {
    if (!parsed || expandPhase !== "idle") return;
    setExpandPhase("expanding");
    setExpandCount(0);
    setExpandError(null);
    setExpansionInfo(null);
    setExpandProgress(null);
    // Scroll to top of results so user sees the progress bar
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent("expand_search_clicked", { original_results: flights.length });

    const controller = new AbortController();
    expandAbortRef.current = controller;

    try {
      const resp = await fetch(`${API_URL}/api/expand-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || "",
          original_parsed: {
            origins: parsed.origins,
            destinations: parsed.destinations,
            dates: parsed.dates,
            return_dates: parsed.return_dates || [],
            max_price: parsed.max_price,
            currency: parsed.currency,
            cabin: parsed.cabin,
            stops: parsed.stops,
            safe_only: parsed.safe_only,
          },
        }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "", 10);
        if (retryAfter > 0) setRateLimitReset(Date.now() + retryAfter * 1000);
        const mins = retryAfter > 0 ? Math.ceil(retryAfter / 60) : 60;
        setExpandError(t("expand.limitReached", { mins }));
        setExpandPhase("done");
        return;
      }
      if (!resp.ok) {
        setExpandError(t("expand.failed"));
        setExpandPhase("done");
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setExpandPhase("done"); return; }
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "parsed") {
              if (msg.expansion_info) setExpansionInfo(msg.expansion_info);
            } else if (msg.type === "progress") {
              setExpandProgress({ done: msg.done, total: msg.total });
            } else if (msg.type === "results") {
              const expandedFlights: FlightOut[] = msg.flights || [];
              const expandedRT: RoundTripOut[] = msg.round_trip_results || [];

              // Merge one-way flights
              if (expandedFlights.length > 0) {
                setFlights(prev => {
                  const existingKeys = new Set(prev.map(f => `${f.route}|${f.date}|${f.stops}`));
                  const newOnes = expandedFlights.filter(f => !existingKeys.has(`${f.route}|${f.date}|${f.stops}`));
                  setExpandCount(newOnes.length);
                  if (newOnes.length === 0) return prev;
                  const merged = [...prev, ...newOnes];
                  merged.sort((a, b) => a.score - b.score);
                  return merged;
                });
              }

              // Merge round-trip results
              if (expandedRT.length > 0 && roundTripResults) {
                setRoundTripResults(prev => {
                  if (!prev) return expandedRT;
                  const existingKeys = new Set(prev.map(r => `${r.outbound.route}|${r.outbound.date}|${r.inbound.route}|${r.inbound.date}`));
                  const newOnes = expandedRT.filter(r => !existingKeys.has(`${r.outbound.route}|${r.outbound.date}|${r.inbound.route}|${r.inbound.date}`));
                  if (!expandedFlights.length) setExpandCount(newOnes.length);
                  if (newOnes.length === 0) return prev;
                  const merged = [...prev, ...newOnes];
                  merged.sort((a, b) => a.score - b.score);
                  return merged;
                });
              } else if (expandedRT.length > 0 && !roundTripResults) {
                setRoundTripResults(expandedRT);
                if (!expandedFlights.length) setExpandCount(expandedRT.length);
              }

              setExpandPhase("done");
              trackEvent("expand_search_results", { new_flights: expandedFlights.length, new_rt: expandedRT.length });
            } else if (msg.type === "error") {
              setExpandError(msg.detail || t("expand.failed"));
              setExpandPhase("done");
            }
          } catch {}
        }
      }
    } catch {
      setExpandError(t("expand.couldNotReach"));
      setExpandPhase("done");
    } finally {
      expandAbortRef.current = null;
      setExpandProgress(null);
      setExpandPhase(p => p === "expanding" ? "done" : p);
    }
  };

  const handleOutboundClick = (provider: "booking" | "google", flight: FlightOut) => {
    trackEvent("outbound_click", {
      provider,
      route: flight.route,
      ref: attributionParams.ref || "organic",
      utm_source: attributionParams.utm_source || undefined,
    });
  };

  const getShareUrl = (): string | null => {
    const currentPrompt = getSearchPrompt();
    if (!currentPrompt) return null;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("q", currentPrompt);
    url.searchParams.set("ref", "share");
    url.searchParams.set("utm_source", "share");
    // Encode best flight data for dynamic OG preview
    const best = flights[0];
    if (best) {
      url.searchParams.set("price", String(Math.round(best.price)));
      // Use city names for readable OG titles (fall back to IATA codes)
      const codes = best.route.split(" -> ").map((c) => c.trim());
      const cityRoute = codes.map((c) => airportNames[c] || c).join(" to ");
      url.searchParams.set("route", cityRoute);
      url.searchParams.set("codes", codes.join("-"));
      url.searchParams.set("currency", best.currency || parsed?.currency || "EUR");
      url.searchParams.set("safety", best.risk_level || "safe");
      url.searchParams.set("stops", String(best.stops));
    }
    return url.toString();
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareOpen) return;
    const close = (e: MouseEvent) => { if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [shareOpen]);

  const handleCopyLink = async () => {
    const shareUrl = getShareUrl();
    if (!shareUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      trackEvent("results_shared", { method: "copy" });
    } catch {}
  };

  const handleNativeShare = async () => {
    if (!parsed) return;
    const shareUrl = getShareUrl();
    if (!shareUrl) return;
    const best = flights[0];
    const sym = currencySymbol(best?.currency || parsed.currency);
    const codes = best?.route.split(" -> ").map((c) => c.trim()) || [];
    const cityRoute = codes.map((c) => airportNames[c] || c).join(" to ");
    const shareTitle = best ? `${cityRoute} from ${sym}${Math.round(best.price)}` : t("shareFlightTitle");
    const shareText = best ? t("shareText", { route: cityRoute, price: `${sym}${Math.round(best.price)}` }) : t("shareFlightText");
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      trackEvent("results_shared", { method: "native" });
      setShareOpen(false);
    } catch {}
  };

  // On mobile (navigator.share available), use native share sheet; on desktop, copy to clipboard
  const handleShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await handleNativeShare();
    } else {
      await handleCopyLink();
    }
  };

  const isLoading = phase === "parsing" || phase === "searching";
  const highlightRanges = useHighlightRanges(prompt);

  // Airline filter (post-results)
  const airlineFilter = useAirlineFilter(flights);
  const displayFlights = airlineFilter.filtered;

  // Use only priced flights for recommendations (unpriced can appear in list but not labeled)
  const pricedFlights = displayFlights.filter((f) => f.price > 0);
  const recEligible = pricedFlights.length > 0 ? pricedFlights : flights;
  // "Recommended" only applies to safe routes — if no safe flights exist, suppress the label
  const safeFlights = recEligible.filter((f) => f.risk_level === "safe");
  const recommended = safeFlights.length > 0 ? sortFlights(safeFlights, "score")[0] : null;
  const cheapest = sortFlights(recEligible, "price")[0];
  const fastest = sortFlights(recEligible, "duration")[0];
  const lowestStress = [...recEligible].sort((a, b) => {
    const stressA = a.stops * 100 + (a.risk_level !== "safe" ? 50 : 0);
    const stressB = b.stops * 100 + (b.risk_level !== "safe" ? 50 : 0);
    return stressA - stressB || a.price - b.price;
  })[0];

  const recs: { label: RecLabel; flight: FlightOut }[] = [];
  const seen = new Set<string>();
  for (const { label, flight } of [
    { label: "recommended" as RecLabel, flight: recommended },
    { label: "cheapest" as RecLabel, flight: cheapest },
    { label: "fastest" as RecLabel, flight: fastest },
    { label: "lowestStress" as RecLabel, flight: lowestStress },
  ]) {
    if (flight && !seen.has(`${flight.route}|${flight.date}|${flight.provider}`)) {
      seen.add(`${flight.route}|${flight.date}|${flight.provider}`);
      recs.push({ label, flight });
    }
  }

  // Round-trip best pair total
  const roundTripTotal =
    roundTripResults && roundTripResults.length > 0
      ? (roundTripResults.find((r) => r.total_price > 0)?.total_price ?? null)
      : returnFlights && returnFlights.length > 0 && flights.length > 0
        ? (() => {
            const cheapOut = flights.filter((f) => f.price > 0).reduce((m, f) => (f.price < m ? f.price : m), Infinity);
            const cheapRet = returnFlights.filter((f) => f.price > 0).reduce((m, f) => (f.price < m ? f.price : m), Infinity);
            return cheapOut < Infinity && cheapRet < Infinity ? cheapOut + cheapRet : null;
          })()
        : null;

  return (
    <AirportCountriesCtx.Provider value={airportCountries}>
    <div className="flex-1 flex flex-col">
      {/* Referred-visit message */}
      {attributionParams.ref === "share" && (() => {
        const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const sharedRoute = sp?.get("route");
        const sharedPrice = sp?.get("price");
        const sharedCurrency = sp?.get("currency") || "EUR";
        const sym = currencySymbol(sharedCurrency);
        return (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="text-sm bg-[var(--color-surface)] border border-[var(--color-interactive)]/20 rounded-lg px-4 py-3 flex items-start gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[var(--color-interactive)] shrink-0 mt-0.5"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
              <div>
                <p className="text-[var(--color-text)] font-medium">
                  {sharedRoute && sharedPrice
                    ? t("referredFriend", { route: sharedRoute, price: `${sym}${sharedPrice}` })
                    : t("referredGeneric")}
                </p>
                <p className="text-[var(--color-text-muted)] mt-0.5">{t("referredSubtext")}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hero - outcome-focused */}
      <section className={`max-w-3xl mx-auto px-4 w-full transition-all duration-300 ${hasResults ? "pt-6 pb-4 text-start" : "pt-16 sm:pt-24 pb-6 text-center"}`}>
        {!hasResults && (
          <h1 className="font-bold tracking-tighter leading-tight text-5xl sm:text-6xl">
            {t("heroTitle")}{" "}
            <span className="text-[var(--color-accent)]">{t("heroTitleAccent")}</span>
          </h1>
        )}
        {!hasResults && (
          <p className="mt-4 text-[var(--color-text-muted)] text-base sm:text-lg max-w-xl mx-auto">
            {t("heroSubtitle")}
          </p>
        )}

        {/* Search surface */}
        <div className={`${hasResults ? "mt-4" : "mt-8"} bg-[var(--color-surface)] border border-white/[0.06] rounded-2xl ${hasResults ? "px-4 py-3 sm:px-5" : "p-5 sm:p-6"} search-surface transition-all duration-300`}>
          {hasResults ? (
            /* Compact mode: original prompt + action */
            <div className="flex items-center justify-between gap-3">
              {prompt && (
                <div className="text-[12px] text-[var(--color-text-muted)]/60 truncate min-w-0 flex-1">
                  {highlightRanges.length > 0
                    ? buildTextRuns(prompt, highlightRanges).map((run, i) =>
                        run.type === "plain"
                          ? <span key={i}>{run.text}</span>
                          : <InlineHighlight key={i} text={run.text} airports={run.airports || []} resolvedDate={run.resolvedDate} />
                      )
                    : prompt}
                </div>
              )}
              {isLoading ? (
                <button
                  onClick={cancelSearch}
                  aria-label={tc("cancel")}
                  className="shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg border border-white/[0.08] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-white/[0.15] transition-all duration-200"
                >
                  {tc("cancel")}
                </button>
              ) : (
                <button
                  onClick={() => { setPhase("idle"); setFlights([]); setRoundTripResults(null); setPrompt(""); setTimeout(() => inputRef.current?.focus(), 0); }}
                  aria-label={tc("newSearch")}
                  className="shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg border border-white/[0.08] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-white/[0.15] transition-all duration-200"
                >
                  {tc("newSearch")}
                </button>
              )}
            </div>
          ) : (
            /* Full mode: textarea + controls */
            <>
              {searchMode === "structured" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <AirportAutocomplete
                      id="from"
                      label={t("form.from")}
                      placeholder={t("form.fromPlaceholder")}
                      value={form.from}
                      onChange={(v) => setForm((f) => ({ ...f, from: v }))}
                      disabled={isLoading}
                    />
                    <AirportAutocomplete
                      id="to"
                      label={t("form.to")}
                      placeholder={t("form.toPlaceholder")}
                      value={form.to}
                      onChange={(v) => setForm((f) => ({ ...f, to: v }))}
                      disabled={isLoading}
                    />
                    <div>
                      <label htmlFor="depart" className="block text-[11px] font-medium text-[var(--color-text-muted)]/70 mb-1.5 uppercase tracking-wider">{t("form.depart")}</label>
                      <input
                        id="depart"
                        type="date"
                        value={form.depart}
                        onChange={(e) => setForm((f) => ({ ...f, depart: e.target.value }))}
                        disabled={isLoading}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-interactive)]/50 transition-colors"
                      />
                      <label className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--color-text-muted)] cursor-pointer select-none">
                        <input type="checkbox" checked={form.flexibleDates} onChange={(e) => setForm((f) => ({ ...f, flexibleDates: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-interactive)]" aria-label={t("form.flexibleDatesAria")} />
                        {t("form.flexibleDates")}
                      </label>
                    </div>
                    <div>
                      <label htmlFor="return" className="block text-[11px] font-medium text-[var(--color-text-muted)]/70 mb-1.5 uppercase tracking-wider">{t("form.return")}</label>
                      <input
                        id="return"
                        type="date"
                        value={form.returnDate}
                        onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
                        disabled={isLoading || !form.roundTrip}
                        className={`w-full bg-[var(--color-background)] border rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-interactive)]/50 transition-colors disabled:opacity-30 ${returnDateInvalid ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
                      />
                      {returnDateInvalid && (
                        <p className="mt-1 text-[11px] text-[var(--color-danger)]">{t("form.returnAfterDeparture")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
                      <input type="checkbox" checked={form.roundTrip} onChange={(e) => setForm((f) => ({ ...f, roundTrip: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-interactive)]" />
                      {t("form.roundTrip")}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
                      <input type="checkbox" checked={form.directOnly} onChange={(e) => setForm((f) => ({ ...f, directOnly: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-interactive)]" />
                      {t("form.directOnly")}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-safe)] cursor-pointer select-none" title={t("risk.safeTooltip")}>
                      <input type="checkbox" checked={form.safeOnly} onChange={(e) => setForm((f) => ({ ...f, safeOnly: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-safe)]" />
                      {t("form.safeRoutesOnly")}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={form.cabin}
                        onChange={(e) => setForm((f) => ({ ...f, cabin: e.target.value }))}
                        disabled={isLoading}
                        className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-interactive)]/50 cursor-pointer"
                      >
                        <option value="economy">{t("form.economy")}</option>
                        <option value="premium_economy">{t("form.premiumEconomy")}</option>
                        <option value="business">{t("form.business")}</option>
                        <option value="first">{t("form.first")}</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="maxPrice" className="text-sm text-[var(--color-text-muted)]">{t("form.maxPriceLabel")} {currencySymbol(userCurrency)}</label>
                      <input
                        id="maxPrice"
                        type="number"
                        placeholder={t("form.maxPricePlaceholder")}
                        value={form.maxPrice}
                        onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                        disabled={isLoading}
                        className="w-20 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-interactive)]/50"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative text-left">
                  {prompt && highlightRanges.length > 0 && <HighlightOverlay prompt={prompt} ranges={highlightRanges} />}
                  <textarea
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), canSearch() && search())}
                    placeholder={t("placeholder")}
                    disabled={isLoading}
                    rows={2}
                    spellCheck={false}
                    className="w-full bg-transparent border-none px-1 py-2 text-base leading-relaxed placeholder:text-[var(--color-text-muted)]/40 focus:outline-none resize-none relative"
                    style={{ color: prompt && highlightRanges.length > 0 ? "transparent" : undefined, caretColor: "var(--color-text)" }}
                    aria-label={t("ariaLabel")}
                  />
                </div>
              )}

              <div className={`${searchMode === "structured" ? "mt-3" : "mt-1 pt-3 border-t border-white/[0.04]"} flex items-center gap-3`}>
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSearchMode((m) => (m === "structured" ? "natural" : "structured"))}
                    className="text-xs text-[var(--color-text-muted)]/60 hover:text-[var(--color-text-muted)] transition-colors duration-200 shrink-0"
                  >
                    {searchMode === "structured" ? t("describeTrip") : t("useForm")}
                  </button>
                </div>
                <div className="flex items-center gap-3 ml-auto shrink-0">
                  {searchMode === "natural" && !isLoading && <span className="text-[11px] text-[var(--color-text-muted)]/25 hidden sm:inline">{t("enterToSearch")}</span>}
                  <button
                    onClick={(e) => {
                      const svg = e.currentTarget.querySelector("svg");
                      if (svg) { svg.classList.remove("plane-takeoff"); void svg.getBoundingClientRect(); svg.classList.add("plane-takeoff"); }
                      search();
                    }}
                    disabled={!canSearch()}
                    aria-label={tc("searchFlights")}
                    className="px-5 py-2.5 btn-cta text-sm font-semibold rounded-xl disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                      <path d="M2.94 3.34a1 1 0 0 1 1.1-.16l13 7a1 1 0 0 1 0 1.74l-13 7A1 1 0 0 1 2.5 18V12.48L9.5 10 2.5 7.52V2a1 1 0 0 1 .44-.66Z" />
                    </svg>
                    {tc("search")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Example prompts */}
        {phase === "idle" && flights.length === 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {(t.raw("examples") as string[]).map((rawEx, i) => {
              const sym = currencySymbol(userCurrency);
              const ex = rawEx.replace(/\$/g, sym);
              return (
              <button
                key={i}
                onClick={() => {
                  setSearchMode("natural");
                  setPrompt(ex);
                  trackEvent("example_prompt_clicked", { prompt: ex });
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="text-[13px] px-4 py-2 rounded-full border border-[var(--color-interactive)]/20 bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] hover:border-[var(--color-interactive)]/40 transition-all duration-200 whitespace-nowrap hover:-translate-y-px"
              >
                {ex}
              </button>
              );
            })}
          </div>
        )}

        {/* Recent searches */}
        {phase === "idle" && flights.length === 0 && savedSearches.searches.length > 0 && (
          <SavedSearchesList
            searches={savedSearches.searches}
            onSelect={(q) => { setSearchMode("natural"); setPrompt(q); setTimeout(() => inputRef.current?.focus(), 0); }}
            onClear={savedSearches.clear}
          />
        )}

        {/* Time saved */}
        {phase === "idle" && flights.length === 0 && minutesSaved > 0 && (
          <p className="text-[11px] text-[var(--color-text-muted)]/50 mt-3 text-center">
            {t("timeSaved", { time: minutesSaved >= 60 ? `${Math.floor(minutesSaved / 60)}h ${minutesSaved % 60}m` : `${minutesSaved} min` })}
          </p>
        )}
      </section>

      {/* Results */}
      <section id="main-content" ref={resultsRef} aria-live="polite" className="max-w-3xl mx-auto px-4 py-4 w-full flex-1">
        {error && (
          <div role="alert" className="mb-4">
            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
              {rateLimitCountdown > 0 && (
                <span className="block mt-1 text-xs font-mono">
                  {t("rateLimit.countdown", { minutes: Math.floor(rateLimitCountdown / 60), seconds: String(rateLimitCountdown % 60).padStart(2, "0") })}
                </span>
              )}
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">{t("rateLimit.tryInstead")}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setSearchMode("natural"); setPrompt(s); search(s); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-interactive)] hover:text-[var(--color-interactive)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <>
            {parsed && (
              <ParsedConfig parsed={parsed} cacheAgeSeconds={null} onRefresh={() => search()} />
            )}
            <SearchingState parsed={parsed} progress={progress} filteredCount={safetyFilteredCount} />
            <div className="mt-6 space-y-4">
              {previewFlights.length > 0 ? (
                <div className="animate-[fadeIn_0.3s_ease-in]">
                  <p className="text-xs text-[var(--color-text-muted)] text-center mb-3">{t("loading.bestSoFar")}</p>
                  {previewFlights.map((f: FlightOut & { _isRoundTripPrice?: boolean }, i: number) => (
                    <div key={`preview-${i}`} className="opacity-70 pointer-events-none mb-4 relative">
                      <FlightCard
                        flight={f}
                        airportNames={airportNames}
                        attributionParams={attributionParams}
                        onOutboundClick={() => {}}
                        cabin={parsed?.cabin}
                      />
                      {f._isRoundTripPrice && (
                        <span className="absolute top-3 end-3 text-[10px] text-[var(--color-text-muted)]">{t("loading.roundTrip")}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 overflow-hidden">
                      <div className="flex justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="h-4 skeleton-shimmer w-3/4" />
                          <div className="h-3 skeleton-shimmer w-1/3" />
                          <div className="h-3 skeleton-shimmer w-1/2" />
                        </div>
                        <div className="space-y-2 w-24">
                          <div className="h-7 skeleton-shimmer" />
                          <div className="h-9 skeleton-shimmer" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {phase === "done" && parsed && (
          <>
            {/* Fix 2: Parsed config chips */}
            {(() => {
              const items = (tripTab === "roundtrip" && roundTripResults?.length) ? roundTripResults : flights;
              const safeCount = items.filter((f: any) => f.risk_level === "safe").length;
              return <ParsedConfig parsed={parsed} cacheAgeSeconds={cacheAgeSeconds} onRefresh={() => search()} safeCount={safeCount} totalCount={items.length} />;
            })()}

            {/* Expand search progress (shown at top of results) */}
            {expandPhase === "expanding" && (
              <div className="mt-3 w-full bg-[var(--color-surface)] border border-[var(--color-interactive)]/30 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-[var(--color-interactive)] border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--color-text)]">{expansionInfo ? t("expand.expandingInfo", { info: expansionInfo }) : `${t("expand.expanding")}...`}</span>
                    {expandProgress && (
                      <div className="mt-1.5 h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-interactive)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((expandProgress.done / expandProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Fix 5: Show warning if return date was before departure */}
            {searchWarning && (
              <div className="mt-2 text-xs text-[var(--color-caution)] bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/20 rounded-lg px-3 py-2">
                {searchWarning}
              </div>
            )}

            {/* Round-trip total */}
            {roundTripTotal != null && (
              <div className="mt-4 bg-[var(--color-interactive)]/10 border border-[var(--color-interactive)]/20 rounded-lg px-4 py-3 text-sm">
                <span className="text-[var(--color-interactive)] font-semibold">{t("results.roundTripFrom", { price: `${currencySymbol(parsed.currency)}${Math.round(roundTripTotal)}` })}</span>
              </div>
            )}

            {flights.length === 0 && (!returnFlights || returnFlights.length === 0) && (!roundTripResults || roundTripResults.length === 0) ? (
              <div className="mt-6 text-center py-12 space-y-3">
                {noResultsReason === "timeout" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">{t("noResults.timeout")}</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      {t("noResults.timeoutExplanation")}
                    </p>
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <button onClick={() => search()} className="px-4 py-2 text-sm font-medium bg-[var(--color-interactive)] text-white rounded-lg hover:bg-[var(--color-interactive-hover)] transition-colors">
                        {tc("tryAgain")}
                      </button>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {t("noResults.timeoutTip")}
                      </p>
                    </div>
                  </>
                ) : noResultsReason === "provider_error" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">{t("noResults.providerError")}</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      {t("noResults.providerErrorExplanation")}
                    </p>
                  </>
                ) : noResultsReason === "safety_filtered" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">{t("noResults.safetyFiltered")}</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      {t("noResults.safetyFilteredExplanation")}
                    </p>
                  </>
                ) : noResultsReason === "no_routes" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">{t("noResults.noRoutes")}</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      {t("noResults.noRoutesExplanation")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">{t("noResults.nothingMatched")}</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      {t("noResults.nothingMatchedExplanation")}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {flights.every((f) => f.price === 0) && (
                  <div className="mt-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    {t("results.noPricing")}
                  </div>
                )}


                {/* Round-trip degradation warning */}
                {parsed && parsed.return_dates.length > 0 && roundTripResults !== null && roundTripResults.length === 0 && flights.length > 0 && (
                  <div className="mt-4 bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-caution)]">
                    {t("results.roundTripDegraded")}
                  </div>
                )}

                {/* Partial results banner */}
                {isPartial && flights.length > 0 && (
                  <div className="mt-4 bg-[var(--color-interactive)]/10 border border-[var(--color-interactive)]/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("results.partialResults", { count: flights.length })}
                    </p>
                    <button onClick={() => search()} className="text-sm font-medium text-[var(--color-interactive)] hover:underline whitespace-nowrap ms-4">
                      {tc("tryAgain")}
                    </button>
                  </div>
                )}

                {/* Trip type tabs: show when both RT and one-way results exist */}
                {roundTripResults && roundTripResults.length > 0 && flights.length > 0 && (
                  <div className="flex gap-2 mt-4 mb-2">
                    <button
                      onClick={() => setTripTab("roundtrip")}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        tripTab === "roundtrip"
                          ? "bg-[var(--color-interactive)] text-white font-medium"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {t("results.roundTrips", { count: roundTripResults.length })}
                    </button>
                    <button
                      onClick={() => setTripTab("oneway")}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        tripTab === "oneway"
                          ? "bg-[var(--color-interactive)] text-white font-medium"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {t("results.oneWay", { count: flights.length })}
                    </button>
                  </div>
                )}

                {/* One-way results: show when no RT exists, or when one-way tab active */}
                {((!roundTripResults?.length) || tripTab === "oneway") && flights.length > 0 && (
                  <>
                    {/* Airline filter */}
                    <AirlineFilterChips
                      airlines={airlineFilter.airlines}
                      selected={airlineFilter.selected}
                      toggle={airlineFilter.toggle}
                      clearFilter={airlineFilter.clearFilter}
                      totalCount={flights.length}
                      filteredCount={displayFlights.length}
                    />

                    {/* Compare all + share (above recommendations so users see before clicking) */}
                    {summary && summary.stats.total_flights > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          {!showCompare && (
                            <ScanSummaryCollapsed summary={summary} currency={parsed.currency} onExpand={() => setShowCompare(true)} flights={flights} />
                          )}
                          <button
                            onClick={handleShare}
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors ms-auto"
                          >
                            {copyFeedback ? (
                              <>
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[var(--color-interactive)]" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                                {tc("copied")}
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 0 1-5.133 2.107L5.4 7.4a3.014 3.014 0 0 1 0 1.2l4.467 2.293A3 3 0 1 1 8.8 12.4L4.333 10.107a3 3 0 1 1 0-4.214L8.8 3.6A3.015 3.015 0 0 1 9 3a3 3 0 0 1 6 0zM4.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM13.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
                                {t("shareResults")}
                              </>
                            )}
                          </button>
                        </div>
                        {showCompare && (
                          <ScanSummaryExpanded summary={summary} currency={parsed.currency} airportNames={airportNames} flights={flights} onCollapse={() => setShowCompare(false)} cabin={parsed?.cabin} />
                        )}
                      </div>
                    )}

                    {/* Recommendation stack */}
                    <div className="mt-6 space-y-5">
                      <h2 className="text-base font-semibold tracking-tight text-[var(--color-text)] mb-4">{t("results.ourRecommendations")}</h2>
                      {recs.slice(0, 4).map(({ label, flight }, i) => (
                        <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                        <FlightCard
                          key={i}
                          flight={flight}
                          label={label}
                          reason={getRecommendationReason(flight, flights, label, trec as (key: string, values?: Record<string, string | number>) => string)}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
                          cabin={parsed?.cabin}
                        />
                        </div>
                      ))}
                    </div>

                    {/* More flights */}
                    {(() => {
                      const recKeys = new Set(recs.map((r) => `${r.flight.route}|${r.flight.date}|${r.flight.provider}`));
                      const moreFlights = sortFlights(pricedFlights.length > 0 ? pricedFlights : flights, "score").filter(
                        (f) => !recKeys.has(`${f.route}|${f.date}|${f.provider}`)
                      );
                      if (moreFlights.length === 0) return null;
                      return (
                        <div className="mt-10 space-y-4">
                          <h3 className="text-base font-semibold text-[var(--color-text-muted)] mb-4">{t("results.moreFlights")}</h3>
                          {moreFlights.slice(0, 6).map((f, i) => (
                            <div key={`more-${i}`} className="animate-fade-up" style={{ animationDelay: `${(i + 4) * 60}ms` }}>
                            <FlightCard
                              flight={f}
                              airportNames={airportNames}
                              attributionParams={attributionParams}
                              onOutboundClick={handleOutboundClick}
                              cabin={parsed?.cabin}
                            />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Round-trip paired results: show when no one-way exists, or RT tab active */}
                {roundTripResults && roundTripResults.length > 0 && ((!flights.length) || tripTab === "roundtrip") && (
                  <div className="mt-6">
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">
                      {t("results.roundTripExplanation")}
                    </p>
                    <div className="space-y-5">
                      {roundTripResults.slice(0, rtShowCount).map((rt, i) => (
                        <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                        <RoundTripCard
                          result={rt}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
                          cabin={parsed?.cabin}
                        />
                        </div>
                      ))}
                    </div>
                    {rtShowCount < roundTripResults.length && (
                      <button
                        onClick={() => setRtShowCount((c) => c + 5)}
                        className="w-full py-3 mt-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      >
                        {t("results.showMoreRoundTrips", { count: Math.min(5, roundTripResults.length - rtShowCount) })}
                      </button>
                    )}
                  </div>
                )}

                {/* Fallback: separate return flights (legacy, when round_trip_results absent) */}
                {!roundTripResults && returnFlights && returnFlights.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{t("results.returnOptions")}</h3>
                    <div className="space-y-3">
                      {sortFlights(returnFlights, "score").slice(0, 5).map((f, i) => (
                        <FlightCard
                          key={i}
                          flight={f}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
                          cabin={parsed?.cabin}
                        />
                      ))}
                    </div>
                  </div>
                )}


                {/* Expand search */}
                {parsed && phase === "done" && flights.length > 0 && (
                  <div className="mt-6">
                    {expandPhase === "idle" && (
                      <button
                        onClick={expandSearch}
                        className="w-full flex items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 hover:border-[var(--color-interactive)]/40 transition-colors group"
                      >
                        <div className="text-start">
                          <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-interactive)] transition-colors">{t("expand.expandSearch")}</span>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t("expand.findMore")}</p>
                        </div>
                        <svg viewBox="0 0 20 20" className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-interactive)] transition-colors shrink-0" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {expandPhase === "done" && expandError && (
                      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm">
                        <span className="text-[var(--color-caution)]">{expandError}</span>
                      </div>
                    )}
                    {expandPhase === "done" && !expandError && expandCount > 0 && (
                      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm">
                        <span className="text-[var(--color-interactive)]">{t("expand.flightsAdded", { count: expandCount })}</span>
                      </div>
                    )}
                    {expandPhase === "done" && !expandError && expandCount === 0 && (
                      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm">
                        <span className="text-[var(--color-text-muted)]">{t("expand.noNewFlights")}</span>
                      </div>
                    )}
                  </div>
                )}


                {/* Price alert */}
                {parsed && phase === "done" && flights.length > 0 && (
                  <PriceAlertSection parsed={parsed} cheapestPrice={summary?.stats?.min_price || flights[0]?.price || 0} />
                )}

                {/* Share CTA - show once per session after results */}
                {parsed && phase === "done" && flights.length > 0 && !shareCTADismissed && (() => {
                  const destCode = summary?.best_destinations?.[0]?.destination || flights[0]?.destination;
                  const destName = destCode ? (airportNames[destCode] || destCode) : null;
                  return (
                    <div className="mt-4 flex items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5">
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {destName ? t("shareCTA", { destination: destName }) : t("shareCTAGeneric")}{" "}
                        <button onClick={() => { handleShare(); setShareCTADismissed(true); }} className="text-[var(--color-interactive)] hover:underline font-medium">
                          {t("shareTheseResults")}
                        </button>
                      </p>
                      <button onClick={() => setShareCTADismissed(true)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0" aria-label={tc("dismiss")}>
                        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
                      </button>
                    </div>
                  );
                })()}

                {/* Bottom bar: share + trust */}
                <div className="mt-8 pt-5 border-t border-[var(--color-border)]/50 flex flex-wrap items-center justify-between gap-3">
                  <div ref={shareRef} className="relative">
                    <button
                      onClick={() => setShareOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 0 1-5.133 2.107L5.4 7.4a3.014 3.014 0 0 1 0 1.2l4.467 2.293A3 3 0 1 1 8.8 12.4L4.333 10.107a3 3 0 1 1 0-4.214L8.8 3.6A3.015 3.015 0 0 1 9 3a3 3 0 0 1 6 0zM4.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM13.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
                      {tc("share")}
                    </button>
                    {shareOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden z-50">
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-start"
                        >
                          {copyFeedback ? (
                            <>
                              <svg viewBox="0 0 16 16" className="w-4 h-4 text-[var(--color-interactive)] shrink-0" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                              <span className="text-[var(--color-interactive)] font-medium">{tc("copied")}</span>
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 16 16" className="w-4 h-4 opacity-50 shrink-0" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25z"/></svg>
                              {tc("copyLink")}
                            </>
                          )}
                        </button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <button
                            onClick={handleNativeShare}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-start border-t border-[var(--color-border)]/50"
                          >
                            <svg viewBox="0 0 16 16" className="w-4 h-4 opacity-50 shrink-0" fill="currentColor"><path d="M3.5 5.75a.25.25 0 0 1 .25-.25h8.5a.25.25 0 0 1 .25.25v7.5a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25v-7.5zm.25-1.75A1.75 1.75 0 0 0 2 5.75v7.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-7.5A1.75 1.75 0 0 0 12.25 4h-8.5zM8 1a.75.75 0 0 1 .75.75v5.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72V1.75A.75.75 0 0 1 8 1z"/></svg>
                            {tc("shareVia")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("trust.bookWithProvider")}{" "}
                    <Link href="/methodology" className="text-[var(--color-interactive)] hover:underline">{t("trust.howWeRank")}</Link>
                  </span>
                  {/* zonesWarning is dev/CLI info, not user-facing */}
                </div>
              </>
            )}
          </>
        )}

        {/* New search */}
        {phase === "done" && flights.length > 0 && (
          <div className="text-center mt-6 mb-4">
            <button
              onClick={() => {
                trackEvent("new_search_clicked", { previous_results: flights.length });
                setPhase("idle");
                setPrompt("");
                setFlights([]);
                setReturnFlights(null);
                setRoundTripResults(null);
                setParsed(null);
                setSummary(null);
                setForm({ from: "", to: "", depart: "", returnDate: "", roundTrip: false, flexibleDates: false, maxPrice: "", directOnly: false, cabin: "economy", safeOnly: true });
                setAttributionParams((prev) => ({ ...prev, ref: "organic", utm_source: undefined }));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-interactive)] transition-colors"
            >
              {tc("newSearch")}
            </button>
          </div>
        )}

        {/* Empty state spacer (trust microcopy is in hero section) */}
      </section>

      {/* Floating price alert popup */}
      {showAlertPopup && parsed && (
        <div className="fixed bottom-4 end-4 z-50 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">{t("priceAlert.priceDropAlert")}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t("priceAlert.getEmailed")}</p>
            </div>
            <button
              onClick={() => { setShowAlertPopup(false); setAlertPopupDismissed(true); }}
              className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
              aria-label={tc("dismiss")}
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
            </button>
          </div>
          {popupStatus === "success" ? (
            <p className="text-sm text-[var(--color-interactive)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block me-1 -mt-0.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {t("priceAlert.alertSet")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder={t("priceAlert.emailPlaceholder")}
                value={popupEmail}
                onChange={(e) => setPopupEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-interactive)]"
              />
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-sm text-[var(--color-text-muted)]">{currencySymbol(parsed.currency)}</span>
                  <input
                    type="number"
                    placeholder={flights[0] ? String(Math.round(flights[0].price)) : t("priceAlert.maxPricePlaceholder")}
                    value={popupThreshold}
                    onChange={(e) => setPopupThreshold(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-interactive)]"
                  />
                </div>
                <button
                  disabled={!popupEmail.trim() || popupStatus === "loading"}
                  onClick={async () => {
                    if (!popupEmail.trim()) return;
                    setPopupStatus("loading");
                    try {
                      await fetch(`${API_URL}/api/alerts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: popupEmail.trim(),
                          query: `${parsed.origins.join(",")} to ${parsed.destinations.join(",")}`,
                          origins: parsed.origins,
                          destinations: parsed.destinations,
                          max_price: parseFloat(popupThreshold) || 0,
                          currency: parsed.currency,
                          cabin: parsed.cabin,
                          is_round_trip: parsed.return_dates?.length > 0,
                          current_price: flights[0]?.price || null,
                        }),
                      });
                      setPopupStatus("success");
                      trackEvent("alert_created", { source: "popup" });
                      setTimeout(() => { setShowAlertPopup(false); setAlertPopupDismissed(true); }, 3000);
                    } catch {
                      setPopupStatus("idle");
                    }
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-[var(--color-interactive)] text-white rounded-lg hover:bg-[var(--color-interactive-hover)] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {popupStatus === "loading" ? "..." : t("priceAlert.setAlert")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
    </AirportCountriesCtx.Provider>
  );
}

export default function SearchPage() {
  return (
    <ErrorBoundary>
      <HomePage />
    </ErrorBoundary>
  );
}

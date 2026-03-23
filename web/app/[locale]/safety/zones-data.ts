const API_URL =
  process.env.INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export interface ConflictZone {
  id: string;
  name: string;
  risk_level: "safe" | "caution" | "high_risk" | "do_not_fly";
  countries: string[];
  airports: string[];
  source: string;
  details: string;
  updated: string;
}

interface ZonesResponse {
  zones: ConflictZone[];
  warning: string | null;
}

let zonesPromise: Promise<ConflictZone[]> | null = null;

async function fetchZones(): Promise<ConflictZone[]> {
  try {
    const res = await fetch(`${API_URL}/api/zones`, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[zones] fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data: ZonesResponse = await res.json();
    return data.zones;
  } catch (err) {
    console.error("[zones] fetch error:", err);
    return [];
  }
}

export async function getZones(): Promise<ConflictZone[]> {
  if (!zonesPromise) {
    zonesPromise = fetchZones();
  }
  return zonesPromise;
}

export async function getZoneById(id: string): Promise<ConflictZone | undefined> {
  const zones = await getZones();
  return zones.find((z) => z.id === id);
}

export const COUNTRY_NAMES: Record<string, string> = {
  UA: "Ukraine",
  IR: "Iran",
  IQ: "Iraq",
  SY: "Syria",
  IL: "Israel",
  LB: "Lebanon",
  YE: "Yemen",
  LY: "Libya",
  SO: "Somalia",
  AF: "Afghanistan",
  KP: "North Korea",
  SD: "Sudan",
  ER: "Eritrea",
  ET: "Ethiopia",
  ML: "Mali",
  NE: "Niger",
  AE: "UAE",
  QA: "Qatar",
  BH: "Bahrain",
  KW: "Kuwait",
  OM: "Oman",
  PK: "Pakistan",
  RU: "Russia",
};

export const ZOOM_REGIONS: Record<string, { center: [number, number]; zoom: number }> = {
  do_not_fly: { center: [40, 25], zoom: 2.5 },
  high_risk: { center: [25, 12], zoom: 3 },
  caution: { center: [55, 30], zoom: 2.5 },
  reset: { center: [30, 25], zoom: 1 },
};

export const RISK_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  do_not_fly: { label: "Do Not Fly", color: "#b85c5c" },
  high_risk: { label: "High Risk", color: "#c47a5a" },
  caution: { label: "Caution", color: "#b8952f" },
  safe: { label: "Safe", color: "#6b7280" },
};

/** Primary flag code per zone (for zones without countries, or multi-country zones). */
export const ZONE_FLAGS: Record<string, string[]> = {
  ukraine: ["ua"],
  iran: ["ir"],
  iraq: ["iq"],
  syria: ["sy"],
  israel: ["il"],
  lebanon: ["lb"],
  yemen: ["ye"],
  libya: ["ly"],
  somalia: ["so"],
  afghanistan: ["af"],
  north_korea: ["kp"],
  sudan: ["sd"],
  eritrea: ["er"],
  ethiopia_partial: ["et"],
  mali: ["ml"],
  niger: ["ne"],
  gulf_states: ["ae", "qa", "bh", "kw", "om"],
  pakistan_partial: ["pk"],
  russia_partial: ["ru"],
};

/** ISO 3166-1 alpha-2 codes per zone (upper-case, for geo matching). */
export const ZONE_COUNTRIES: Record<string, string[]> = {
  ukraine: ["UA"],
  iran: ["IR"],
  iraq: ["IQ"],
  syria: ["SY"],
  israel: ["IL"],
  lebanon: ["LB"],
  yemen: ["YE"],
  libya: ["LY"],
  somalia: ["SO"],
  afghanistan: ["AF"],
  north_korea: ["KP"],
  sudan: ["SD"],
  eritrea: ["ER"],
  ethiopia_partial: ["ET"],
  mali: ["ML"],
  niger: ["NE"],
  gulf_states: ["AE", "QA", "BH", "KW", "OM"],
  pakistan_partial: ["PK"],
  russia_partial: ["RU"],
};

/** ISO 3166-1 numeric -> lowercase alpha-2 for ALL countries (used for flag display). */
export const NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "af", "008": "al", "012": "dz", "020": "ad", "024": "ao",
  "028": "ag", "032": "ar", "051": "am", "036": "au", "040": "at",
  "031": "az", "044": "bs", "048": "bh", "050": "bd", "052": "bb",
  "112": "by", "056": "be", "084": "bz", "204": "bj", "064": "bt",
  "068": "bo", "070": "ba", "072": "bw", "076": "br", "096": "bn",
  "100": "bg", "854": "bf", "108": "bi", "132": "cv", "116": "kh",
  "120": "cm", "124": "ca", "140": "cf", "148": "td", "152": "cl",
  "156": "cn", "170": "co", "174": "km", "178": "cg", "180": "cd",
  "188": "cr", "384": "ci", "191": "hr", "192": "cu", "196": "cy",
  "203": "cz", "208": "dk", "262": "dj", "212": "dm", "214": "do",
  "218": "ec", "818": "eg", "222": "sv", "226": "gq", "232": "er",
  "233": "ee", "748": "sz", "231": "et", "242": "fj", "246": "fi",
  "250": "fr", "266": "ga", "270": "gm", "268": "ge", "276": "de",
  "288": "gh", "300": "gr", "308": "gd", "320": "gt", "324": "gn",
  "624": "gw", "328": "gy", "332": "ht", "340": "hn", "348": "hu",
  "352": "is", "356": "in", "360": "id", "364": "ir", "368": "iq",
  "372": "ie", "376": "il", "380": "it", "388": "jm", "392": "jp",
  "400": "jo", "398": "kz", "404": "ke", "296": "ki", "408": "kp",
  "410": "kr", "414": "kw", "417": "kg", "418": "la", "428": "lv",
  "422": "lb", "426": "ls", "430": "lr", "434": "ly", "438": "li",
  "440": "lt", "442": "lu", "450": "mg", "454": "mw", "458": "my",
  "462": "mv", "466": "ml", "470": "mt", "584": "mh", "478": "mr",
  "480": "mu", "484": "mx", "583": "fm", "498": "md", "492": "mc",
  "496": "mn", "499": "me", "504": "ma", "508": "mz", "104": "mm",
  "516": "na", "520": "nr", "524": "np", "528": "nl", "554": "nz",
  "558": "ni", "562": "ne", "566": "ng", "807": "mk", "578": "no",
  "512": "om", "586": "pk", "585": "pw", "591": "pa", "598": "pg",
  "600": "py", "604": "pe", "608": "ph", "616": "pl", "620": "pt",
  "634": "qa", "642": "ro", "643": "ru", "646": "rw", "659": "kn",
  "662": "lc", "670": "vc", "882": "ws", "674": "sm", "678": "st",
  "682": "sa", "686": "sn", "688": "rs", "690": "sc", "694": "sl",
  "702": "sg", "703": "sk", "705": "si", "090": "sb", "706": "so",
  "710": "za", "728": "ss", "724": "es", "144": "lk", "729": "sd",
  "740": "sr", "752": "se", "756": "ch", "760": "sy", "158": "tw",
  "762": "tj", "834": "tz", "764": "th", "626": "tl", "768": "tg",
  "776": "to", "780": "tt", "788": "tn", "792": "tr", "795": "tm",
  "798": "tv", "800": "ug", "804": "ua", "784": "ae", "826": "gb",
  "840": "us", "858": "uy", "860": "uz", "548": "vu", "336": "va",
  "862": "ve", "704": "vn", "887": "ye", "894": "zm", "716": "zw",
};

// Traveler advice and risk descriptions are in messages/*.json under safety.travelerAdvice and safety.riskDescriptions

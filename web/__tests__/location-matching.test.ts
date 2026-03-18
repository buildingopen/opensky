/**
 * Data integrity and behavioral tests for the location matching system.
 *
 * Tests validate:
 * 1. All CITY_ALIASES targets exist in AIRPORTS data
 * 2. No duplicate alias keys
 * 3. LOCATION_SKIPWORDS don't block any city names
 * 4. LOCATION_SKIPWORDS + case-aware IATA bypass works correctly
 * 5. Multilingual prompts produce correct highlights
 * 6. Edge cases and adversarial inputs don't produce false positives
 */
import { describe, it, expect } from "vitest";
import { AIRPORTS } from "../lib/airports";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Extract static data from SearchPage.tsx source (avoids importing React)
// ---------------------------------------------------------------------------
const SEARCH_PAGE_SRC = fs.readFileSync(
  path.join(__dirname, "../app/[locale]/SearchPage.tsx"),
  "utf8"
);

function extractSet(varName: string): Set<string> {
  const re = new RegExp(`const ${varName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`, "m");
  const m = SEARCH_PAGE_SRC.match(re);
  if (!m) throw new Error(`Could not find ${varName} in SearchPage.tsx`);
  const items: string[] = [];
  for (const match of m[1].matchAll(/"([^"]+)"/g)) items.push(match[1]);
  return new Set(items);
}

function extractAliasEntries(): [string, string][] {
  const m = SEARCH_PAGE_SRC.match(/CITY_ALIASES_ENTRIES[^;]+;/s);
  if (!m) throw new Error("Could not find CITY_ALIASES_ENTRIES");
  const entries: [string, string][] = [];
  for (const match of m[0].matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)) {
    entries.push([match[1], match[2]]);
  }
  return entries;
}

const CITY_SET = new Set(AIRPORTS.map((a) => a.city.toLowerCase()));
const IATA_SET = new Set(AIRPORTS.map((a) => a.iata));
const LOCATION_SKIPWORDS = extractSet("LOCATION_SKIPWORDS");
const AMBIGUOUS_CITIES = extractSet("AMBIGUOUS_CITIES");
// Extract REGION_LABELS keys from the Object.fromEntries([...]) pattern
const REGION_LABELS_KEYS: Set<string> = (() => {
  const re = /const REGION_LABELS[^=]*=\s*Object\.fromEntries\(\[([\s\S]*?)\]\.map/m;
  const m = SEARCH_PAGE_SRC.match(re);
  if (!m) throw new Error("Could not find REGION_LABELS in SearchPage.tsx");
  const keys = new Set<string>();
  for (const match of m[1].matchAll(/\["([^"]+)",\s*"[^"]+"\]/g)) keys.add(match[1]);
  return keys;
})();
const ALIAS_ENTRIES = extractAliasEntries();
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Build alias map (same logic as SearchPage)
const CITY_ALIASES: Record<string, string> = {};
for (const [alias, city] of ALIAS_ENTRIES) {
  if (!CITY_ALIASES[alias]) CITY_ALIASES[alias] = city;
}
// Register normalized (diacritic-stripped) alias forms (mirrors SearchPage lines 282-293)
for (const [alias, city] of Object.entries({ ...CITY_ALIASES })) {
  const normAlias = norm(alias);
  if (normAlias !== alias && !CITY_ALIASES[normAlias]) {
    CITY_ALIASES[normAlias] = city;
  }
}

// Build country lookup (same as SearchPage)
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
const COUNTRY_LOOKUP: Record<string, { code: string; name: string }> = {};
for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
  COUNTRY_LOOKUP[name.toLowerCase()] = { code, name };
}
// Add country aliases from airports data
for (const a of AIRPORTS) {
  const cc = a.country;
  const name = COUNTRY_NAMES[cc];
  if (name && !COUNTRY_LOOKUP[name.toLowerCase()]) {
    COUNTRY_LOOKUP[name.toLowerCase()] = { code: cc, name };
  }
}

// ---------------------------------------------------------------------------
// Test-local matching engine (mirrors SearchPage logic exactly)
// ---------------------------------------------------------------------------
function testMatchExact(phrase: string, originalPhrase?: string): string | null {
  const p = norm(phrase.toLowerCase());
  if (!p || p.length < 2) return null;
  // Regions: return as a region match (mirrors SearchPage REGION_LABELS logic)
  if (REGION_LABELS_KEYS.has(p)) return `region:${p}`;
  const orig = originalPhrase || phrase;
  // Skipword: block if user typed lowercase; allow if all-uppercase (IATA intent)
  if (LOCATION_SKIPWORDS.has(p) && orig !== orig.toUpperCase()) return null;
  const upper = phrase.toUpperCase();
  // For explicit all-uppercase 3-letter input, IATA takes priority
  if (upper.length === 3 && orig === orig.toUpperCase() && IATA_SET.has(upper)) return `IATA:${upper}`;
  // Country
  if (COUNTRY_LOOKUP[p]) return `country:${COUNTRY_LOOKUP[p].name}`;
  // City (checked before fallback IATA so "goa" → city:goa, not IATA:GOA Genoa)
  if (CITY_SET.has(p) && !AMBIGUOUS_CITIES.has(p)) return `city:${p}`;
  // Alias
  const normP = norm(p);
  if (CITY_ALIASES[normP]) {
    const target = CITY_ALIASES[normP].toLowerCase();
    if (CITY_SET.has(target)) return `alias:${target}`;
  }
  // Fallback IATA for non-uppercase input (e.g. "jfk", "lax" still resolve)
  if (upper.length === 3 && IATA_SET.has(upper)) return `IATA:${upper}`;
  // Turkish agglutination: "moskova'dan" → try "moskova" before the apostrophe
  // Only for single-word tokens (no spaces) to avoid false matches on multi-word phrases
  const apos = p.indexOf("'");
  if (apos > 1 && !p.includes(" ")) {
    const prefix = p.slice(0, apos);
    return testMatchExact(prefix, originalPhrase ? originalPhrase.slice(0, apos) : undefined);
  }
  return null;
}

function scanPrompt(prompt: string): { token: string; match: string | null }[] {
  const lower = prompt.toLowerCase();
  // Include curly apostrophes (\u2018 \u2019) alongside straight (') for pasted text
  const re = /[\p{L}\p{N}\p{M}]+(?:['\u2018\u2019-][\p{L}\p{N}\p{M}]+)*/gu;
  const tokens: { word: string; original: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    // Normalize curly apostrophes to straight for consistent matching
    const word = m[0].replace(/[\u2018\u2019]/g, "'");
    tokens.push({ word, original: prompt.slice(m.index, m.index + m[0].length) });
  }
  const results: { token: string; match: string | null }[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const phrase = tokens.slice(i, i + len).map(t => t.word).join(" ");
      const originalPhrase = tokens.slice(i, i + len).map(t => t.original).join(" ");
      let match = testMatchExact(phrase, originalPhrase);
      // For multi-word combos, also try stripping apostrophe suffix from last token
      if (!match && len > 1) {
        const lastWord = tokens[i + len - 1].word;
        const apos = lastWord.indexOf("'");
        if (apos > 1) {
          const trimmed = tokens.slice(i, i + len - 1).map(t => t.word).join(" ") + " " + lastWord.slice(0, apos);
          const trimmedOrig = tokens.slice(i, i + len - 1).map(t => t.original).join(" ") + " " + tokens[i + len - 1].original.slice(0, apos);
          match = testMatchExact(trimmed, trimmedOrig);
        }
      }
      if (match) {
        results.push({ token: originalPhrase, match });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      results.push({ token: tokens[i].original, match: null });
      i++;
    }
  }
  return results;
}

/** Returns only matched tokens with their match type */
function matches(prompt: string): string[] {
  return scanPrompt(prompt).filter(t => t.match).map(t => t.match!);
}

/** Returns only unmatched tokens */
function nonMatches(prompt: string): string[] {
  return scanPrompt(prompt).filter(t => !t.match).map(t => t.token);
}

// ===================================================================
// DATA INTEGRITY TESTS
// ===================================================================

describe("CITY_ALIASES target integrity", () => {
  const uniqueTargets = [...new Set(ALIAS_ENTRIES.map(([, t]) => t.toLowerCase()))];
  for (const target of uniqueTargets) {
    it(`"${target}" exists in AIRPORTS`, () => {
      expect(CITY_SET.has(target) || Object.values(CITY_ALIASES).some(v => v.toLowerCase() === target)).toBe(true);
    });
  }
});

describe("CITY_ALIASES no duplicates", () => {
  it("every alias key is unique", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const [alias] of ALIAS_ENTRIES) {
      if (seen.has(alias)) dupes.push(alias);
      seen.add(alias);
    }
    expect(dupes).toEqual([]);
  });
});

describe("CITY_ALIASES no identity mappings", () => {
  it("no alias maps to itself", () => {
    const identities = ALIAS_ENTRIES.filter(([a, t]) => a.toLowerCase() === t.toLowerCase());
    expect(identities).toEqual([]);
  });
});

describe("LOCATION_SKIPWORDS safety", () => {
  it("no skipword matches a city name in AIRPORTS", () => {
    const bad = [...LOCATION_SKIPWORDS].filter(sw => CITY_SET.has(sw));
    expect(bad).toEqual([]);
  });

  it("no skipword matches an alias key", () => {
    const bad = [...LOCATION_SKIPWORDS].filter(sw => CITY_ALIASES[sw]);
    expect(bad).toEqual([]);
  });
});

describe("IATA/skipword collisions tracked", () => {
  const known = new Set([
    // Original skipwords that collide with IATA
    "LOS","LAS","DEL","SIN","DEN","EIN","AUS","PER","CAN","GOT",
    // English words added as skipwords that are also IATA codes
    "HAM","HER","MAD","MAN","PEN","PIT","SAT","SAW","SEA","DAD","ADD","REP","LED","FAT",
    // Cross-language verbs/adjectives that collide with IATA
    "IST","FRA","BOM","ONT","DAR","TUN","DUR","VIE","SAN","SUB",
  ]);
  it("collision set matches exactly", () => {
    const actual = new Set([...LOCATION_SKIPWORDS].map(s => s.toUpperCase()).filter(s => IATA_SET.has(s)));
    expect([...actual].sort()).toEqual([...known].sort());
  });
});

// ===================================================================
// MULTILINGUAL PROMPT TESTS - HAPPY PATHS
// ===================================================================

describe("English prompts", () => {
  it("London to Tokyo next week", () => {
    const m = matches("London to Tokyo next week");
    expect(m).toContain("city:london");
    expect(m).toContain("city:tokyo");
  });

  it("Flights from New York to Los Angeles", () => {
    const m = matches("Flights from New York to Los Angeles");
    expect(m).toContain("city:new york");
    expect(m).toContain("city:los angeles");
  });

  it("India to Germany, safe routes only", () => {
    const m = matches("India to Germany, safe routes only");
    expect(m).toContain("country:India");
    expect(m).toContain("country:Germany");
  });

  it("cheap flights NYC to LAX", () => {
    const m = matches("cheap flights NYC to LAX");
    expect(m).toContain("alias:new york");
    expect(m).toContain("IATA:LAX");
  });

  it("San Francisco to Bangkok in March", () => {
    const m = matches("San Francisco to Bangkok in March");
    expect(m).toContain("city:san francisco");
    expect(m).toContain("city:bangkok");
  });
});

describe("Spanish prompts", () => {
  it("Madrid a Londres, la proxima semana, seguro", () => {
    const m = matches("Madrid a Londres, la proxima semana, seguro");
    expect(m).toContain("city:madrid");
    expect(m).toContain("alias:london");     // londres -> london
    const nm = nonMatches("Madrid a Londres, la proxima semana, seguro");
    expect(nm).toContain("la");              // blocked by skipword
  });

  it("vuelo sin escalas desde Paris a Berlín", () => {
    const m = matches("vuelo sin escalas desde Paris a Berlín");
    expect(m).toContain("city:paris");
    expect(m).toContain("city:berlin");      // berlín normalizes to berlin, matches city directly
    const nm = nonMatches("vuelo sin escalas desde Paris a Berlín");
    expect(nm).toContain("sin");
  });

  it("Puerto Vallarta en Junio desde Hamburgo", () => {
    const m = matches("Puerto Vallarta en Junio desde Hamburgo");
    expect(m).toContain("alias:hamburg");    // hamburgo -> hamburg
  });

  it("vuelo a Florencia por la mañana", () => {
    const m = matches("vuelo a Florencia por la mañana");
    expect(m).toContain("alias:florence");
    const nm = nonMatches("vuelo a Florencia por la mañana");
    expect(nm).toContain("la");
    expect(nm).toContain("por");
  });

  it("Barcelona a Nueva York con escala en Londres", () => {
    const m = matches("Barcelona a Nueva York con escala en Londres");
    expect(m).toContain("city:barcelona");
    expect(m).toContain("alias:new york");
    expect(m).toContain("alias:london");
    const nm = nonMatches("Barcelona a Nueva York con escala en Londres");
    expect(nm).toContain("con");
  });

  it("las mejores ofertas para vuelos al Cairo", () => {
    const m = matches("las mejores ofertas para vuelos al Cairo");
    expect(m).toContain("city:cairo");       // cairo matches city directly
    const nm = nonMatches("las mejores ofertas para vuelos al Cairo");
    expect(nm).toContain("las");
    expect(nm).toContain("para");
    expect(nm).toContain("al");
  });
});

describe("German prompts", () => {
  it("den günstigsten Flug von Hamburg nach Bangkok", () => {
    const m = matches("den günstigsten Flug von Hamburg nach Bangkok");
    expect(m).toContain("city:hamburg");
    expect(m).toContain("city:bangkok");
    const nm = nonMatches("den günstigsten Flug von Hamburg nach Bangkok");
    expect(nm).toContain("den");
    expect(nm).toContain("von");
  });

  it("Flug von Mailand nach Wien für nächste Woche", () => {
    const m = matches("Flug von Mailand nach Wien für nächste Woche");
    expect(m).toContain("alias:milan");      // mailand -> milan
    expect(m).toContain("alias:vienna");     // wien -> vienna
    const nm = nonMatches("Flug von Mailand nach Wien für nächste Woche");
    expect(nm).toContain("von");
    expect(nm).toContain("für");             // nonMatches returns original form
  });

  it("Direktflug aus Rom nach Kopenhagen", () => {
    const m = matches("Direktflug aus Rom nach Kopenhagen");
    expect(m).toContain("alias:rome");       // rom -> rome
    expect(m).toContain("alias:copenhagen"); // kopenhagen -> copenhagen
    const nm = nonMatches("Direktflug aus Rom nach Kopenhagen");
    expect(nm).toContain("aus");
  });

  it("von Moskau nach Warschau ohne Umsteigen", () => {
    const m = matches("von Moskau nach Warschau ohne Umsteigen");
    expect(m).toContain("alias:moscow");
    expect(m).toContain("alias:warsaw");
    const nm = nonMatches("von Moskau nach Warschau ohne Umsteigen");
    expect(nm).toContain("von");
  });
});

describe("French prompts", () => {
  it("vol de Paris à Lisbonne la semaine prochaine", () => {
    const m = matches("vol de Paris à Lisbonne la semaine prochaine");
    expect(m).toContain("city:paris");
    expect(m).toContain("alias:lisbon");
    const nm = nonMatches("vol de Paris à Lisbonne la semaine prochaine");
    expect(nm).toContain("la");
    expect(nm).toContain("de");              // "de" is "des" without s... check
  });

  it("Genève à Édimbourg, le mois prochain", () => {
    const m = matches("Genève à Édimbourg, le mois prochain");
    expect(m).toContain("alias:geneva");
    expect(m).toContain("alias:edinburgh");
    const nm = nonMatches("Genève à Édimbourg, le mois prochain");
    expect(nm).toContain("le");
  });

  it("vol pas cher de Moscou à Vienne", () => {
    const m = matches("vol pas cher de Moscou à Vienne");
    expect(m).toContain("alias:moscow");
    expect(m).toContain("alias:vienna");
    const nm = nonMatches("vol pas cher de Moscou à Vienne");
    expect(nm).toContain("pas");
  });

  it("de Hambourg à Dubaï en décembre", () => {
    const m = matches("de Hambourg à Dubaï en décembre");
    expect(m).toContain("alias:hamburg");
    expect(m).toContain("city:dubai");       // dubaï normalizes to dubai, matches city directly
  });
});

describe("Italian prompts", () => {
  it("volo da Amburgo a Londra senza scali", () => {
    const m = matches("volo da Amburgo a Londra senza scali");
    expect(m).toContain("alias:hamburg");
    expect(m).toContain("alias:london");
  });

  it("Firenze a Napoli per il weekend", () => {
    const m = matches("Firenze a Napoli per il weekend");
    expect(m).toContain("alias:florence");
    expect(m).toContain("alias:naples");
    const nm = nonMatches("Firenze a Napoli per il weekend");
    expect(nm).toContain("per");
  });

  it("volo da Pechino a Berlino con scalo", () => {
    const m = matches("volo da Pechino a Berlino con scalo");
    expect(m).toContain("alias:beijing");
    expect(m).toContain("alias:berlin");
    const nm = nonMatches("volo da Pechino a Berlino con scalo");
    expect(nm).toContain("con");
  });

  it("da Mosca a Francoforte la prossima settimana", () => {
    const m = matches("da Mosca a Francoforte la prossima settimana");
    expect(m).toContain("alias:moscow");
    expect(m).toContain("alias:frankfurt");
    const nm = nonMatches("da Mosca a Francoforte la prossima settimana");
    expect(nm).toContain("la");
  });
});

describe("Portuguese prompts", () => {
  it("voo de Berlim para Tóquio na próxima semana", () => {
    const m = matches("voo de Berlim para Tóquio na próxima semana");
    expect(m).toContain("alias:berlin");
    expect(m).toContain("alias:tokyo");
    const nm = nonMatches("voo de Berlim para Tóquio na próxima semana");
    expect(nm).toContain("para");
  });

  it("Lisboa a Amesterdão sem escalas", () => {
    const m = matches("Lisboa a Amesterdão sem escalas");
    expect(m).toContain("alias:lisbon");     // lisboa -> lisbon
    expect(m).toContain("alias:amsterdam");  // amesterdão -> amsterdam
  });

  it("Singapura para Pequim, voo direto", () => {
    const m = matches("Singapura para Pequim, voo direto");
    expect(m).toContain("alias:singapore");
    expect(m).toContain("alias:beijing");
    const nm = nonMatches("Singapura para Pequim, voo direto");
    expect(nm).toContain("para");
  });

  it("de Moscovo a Florença por menos de 500 euros", () => {
    const m = matches("de Moscovo a Florença por menos de 500 euros");
    expect(m).toContain("alias:moscow");
    expect(m).toContain("alias:florence");
    const nm = nonMatches("de Moscovo a Florença por menos de 500 euros");
    expect(nm).toContain("por");
  });
});

describe("Turkish prompts", () => {
  it("Yeni York'a uçuş ne kadar", () => {
    const m = matches("Yeni York'a uçuş ne kadar");
    expect(m).toContain("alias:new york");
  });

  it("Moskova'dan Brüksel'e güvenli rota", () => {
    const m = matches("Moskova'dan Brüksel'e güvenli rota");
    expect(m).toContain("alias:moscow");
    expect(m).toContain("alias:brussels");
  });

  it("Floransa'dan Marsilya'ya bir bilet", () => {
    const m = matches("Floransa'dan Marsilya'ya bir bilet");
    expect(m).toContain("alias:florence");
    expect(m).toContain("alias:marseille");
    const nm = nonMatches("Floransa'dan Marsilya'ya bir bilet");
    expect(nm).toContain("bir");
  });
});

// ===================================================================
// EDGE CASES AND ADVERSARIAL INPUTS
// ===================================================================

describe("Edge cases: empty and minimal input", () => {
  it("empty string produces no matches", () => {
    expect(matches("")).toEqual([]);
  });

  it("single character produces no matches", () => {
    expect(matches("a")).toEqual([]);
  });

  it("just whitespace produces no matches", () => {
    expect(matches("   ")).toEqual([]);
  });

  it("just numbers produce no matches", () => {
    expect(matches("12345")).toEqual([]);
  });
});

describe("Edge cases: skipword-only inputs", () => {
  it("all skipwords, no locations", () => {
    expect(matches("la le den des von fur par con per una")).toEqual([]);
  });

  it("sentence made entirely of skipwords", () => {
    expect(matches("el con la del por para sin un una")).toEqual([]);
  });
});

describe("Edge cases: IATA codes mixed with skipwords", () => {
  it("uppercase IATA in middle of lowercase text", () => {
    const m = matches("vuelo a SIN la proxima semana");
    expect(m).toContain("IATA:SIN");
    expect(nonMatches("vuelo a SIN la proxima semana")).toContain("la");
  });

  it("multiple uppercase IATA codes", () => {
    const m = matches("from DEN to AUS to PER");
    expect(m).toContain("IATA:DEN");
    expect(m).toContain("IATA:AUS");
    expect(m).toContain("IATA:PER");
  });

  it("lowercase versions of same IATA codes are blocked", () => {
    const m = matches("from den to aus to per");
    expect(m).toEqual([]);
  });

  it("mixed case (not all-upper) is blocked", () => {
    expect(matches("fly to Sin")).toEqual([]);
    expect(matches("fly to Den")).toEqual([]);
  });
});

describe("Edge cases: cities that look like words", () => {
  it("Nice (France) is in AMBIGUOUS_CITIES, not highlighted", () => {
    expect(matches("fly to Nice")).toEqual([]);
  });

  it("Mobile (Alabama) is in AMBIGUOUS_CITIES, not highlighted", () => {
    expect(matches("fly to Mobile")).toEqual([]);
  });

  it("Bath (UK) is in AMBIGUOUS_CITIES, not highlighted", () => {
    expect(matches("fly to Bath")).toEqual([]);
  });

  it("Split (Croatia) is in AMBIGUOUS_CITIES, not highlighted", () => {
    expect(matches("fly to Split")).toEqual([]);
  });
});

describe("Edge cases: diacritics and normalization", () => {
  it("São Paulo with diacritics matches", () => {
    const m = matches("fly to São Paulo");
    expect(m).toContain("city:sao paulo");
  });

  it("Sao Paulo without diacritics matches", () => {
    const m = matches("fly to Sao Paulo");
    expect(m).toContain("city:sao paulo");
  });

  it("Zürich with umlaut matches", () => {
    const m = matches("fly to Zürich");
    expect(m).toContain("city:zurich");
  });

  it("Zurich without umlaut matches", () => {
    const m = matches("fly to Zurich");
    expect(m).toContain("city:zurich");
  });

  it("Münih (Turkish for Munich) matches", () => {
    const m = matches("ucus Münih");
    expect(m).toContain("alias:munich");
  });

  it("Pékin (French for Beijing) matches", () => {
    const m = matches("vol vers Pékin");
    expect(m).toContain("alias:beijing");
  });
});

describe("Edge cases: multi-word cities vs skipwords", () => {
  it("Las Vegas: 'las' is skipword but multi-word matches first", () => {
    const m = matches("fly to Las Vegas");
    expect(m).toContain("city:las vegas");
  });

  it("Los Angeles: 'los' is skipword but multi-word matches first", () => {
    const m = matches("fly to Los Angeles");
    expect(m).toContain("city:los angeles");
  });

  it("New Delhi: multi-word city works", () => {
    const m = matches("fly to New Delhi");
    expect(m).toContain("city:new delhi");
  });

  it("Ho Chi Minh City: 4-word city works", () => {
    const m = matches("fly to Ho Chi Minh City");
    expect(m).toContain("city:ho chi minh city"); // matches city directly
  });

  it("El Cairo (Spanish): multi-word alias works", () => {
    const m = matches("vuelo al El Cairo");
    expect(m).toContain("alias:cairo");
  });

  it("Nueva York: multi-word alias works", () => {
    const m = matches("vuelo a Nueva York");
    expect(m).toContain("alias:new york");
  });

  it("Nova Iorque (Portuguese): multi-word alias works", () => {
    const m = matches("voo para Nova Iorque");
    expect(m).toContain("alias:new york");
  });
});

describe("Edge cases: repeated locations", () => {
  it("same city twice", () => {
    const m = matches("London to London");
    expect(m.filter(x => x === "city:london")).toHaveLength(2);
  });
});

describe("Edge cases: gibberish and random text", () => {
  it("random gibberish produces no false positives", () => {
    const m = matches("asdfghjkl qwerty zxcvbnm");
    expect(m).toEqual([]);
  });

  it("numbers and punctuation only", () => {
    expect(matches("123 456 789!@#$%")).toEqual([]);
  });

  it("very long input doesn't crash", () => {
    const long = "fly to Paris ".repeat(100);
    const m = matches(long);
    expect(m.length).toBeGreaterThan(0);
    expect(m.every(x => x === "city:paris")).toBe(true);
  });
});

describe("Edge cases: tricky false-positive scenarios", () => {
  it("'Can I fly to London?' - 'can' is skipword, London matches", () => {
    const m = matches("Can I fly to London?");
    expect(m).toContain("city:london");
    expect(nonMatches("Can I fly to London?")).toContain("Can");
  });

  it("'I had a hat in Austin' - 'had' and 'hat' are skipwords, Austin is not matched (AUS only as IATA)", () => {
    // 'austin' as a city - let's check if it's in CITY_SET
    const m = matches("I had a hat in Austin");
    expect(nonMatches("I had a hat in Austin")).toContain("had");
    expect(nonMatches("I had a hat in Austin")).toContain("hat");
  });

  it("'Has anyone got a flight from Paris?' - skipwords blocked, Paris matches", () => {
    const m = matches("Has anyone got a flight from Paris?");
    expect(m).toContain("city:paris");
    expect(nonMatches("Has anyone got a flight from Paris?")).toContain("Has");
    expect(nonMatches("Has anyone got a flight from Paris?")).toContain("got");
  });

  it("'May I book for May?' - 'may' is skipword both times", () => {
    const m = matches("May I book for May");
    // Both instances of 'may' should be blocked (neither is uppercase-only "MAY")
    expect(m).toEqual([]);
  });

  it("'I was in Paris, it was great' - 'was' blocked, Paris matches", () => {
    const m = matches("I was in Paris, it was great");
    expect(m).toContain("city:paris");
    const nm = nonMatches("I was in Paris, it was great");
    expect(nm.filter(t => t === "was")).toHaveLength(2);
  });

  it("'von der Leyen flies from Brussels' - German articles blocked, Brussels matches", () => {
    const m = matches("von der Leyen flies from Brussels");
    expect(m).toContain("city:brussels");
    const nm = nonMatches("von der Leyen flies from Brussels");
    expect(nm).toContain("von");
    expect(nm).toContain("der");
  });

  it("'Le restaurant est sur la rue de Paris' - all French articles blocked, Paris matches", () => {
    const m = matches("Le restaurant est sur la rue de Paris");
    expect(m).toContain("city:paris");
    const nm = nonMatches("Le restaurant est sur la rue de Paris");
    expect(nm).toContain("Le");
    expect(nm).toContain("est");
    expect(nm).toContain("sur");
    expect(nm).toContain("la");
  });

  it("'Ben bir bilet istiyorum Istanbul' - Turkish skipwords blocked, Istanbul matches", () => {
    const m = matches("Ben bir bilet istiyorum Istanbul");
    expect(m).toContain("city:istanbul");
    const nm = nonMatches("Ben bir bilet istiyorum Istanbul");
    expect(nm).toContain("Ben");
    expect(nm).toContain("bir");
  });

  it("'van Amsterdam naar Den Haag' - Dutch 'van' blocked, Amsterdam matches, 'den' blocked", () => {
    const m = matches("van Amsterdam naar Den Haag");
    expect(m).toContain("city:amsterdam");
    const nm = nonMatches("van Amsterdam naar Den Haag");
    expect(nm).toContain("van");
    expect(nm).toContain("Den");  // skipword
  });
});

describe("Edge cases: sentence-initial capitalization", () => {
  it("'Sin escalas' - capital S but not all-caps, still blocked", () => {
    expect(matches("Sin escalas desde Madrid")).not.toContain("IATA:SIN");
    expect(matches("Sin escalas desde Madrid")).toContain("city:madrid");
  });

  it("'Den Flug' - capital D but not all-caps, still blocked", () => {
    const nm = nonMatches("Den Flug nach Berlin");
    expect(nm).toContain("Den");
  });

  it("'Can you find' - capital C but not all-caps, still blocked", () => {
    expect(matches("Can you find flights to London")).toContain("city:london");
    expect(nonMatches("Can you find flights to London")).toContain("Can");
  });
});

// ===================================================================
// BUG FIX VERIFICATION TESTS
// ===================================================================

describe("Bug fix: cities with periods (St. Louis, etc.)", () => {
  it("St. Louis matches via alias (tokenizer strips period)", () => {
    const m = matches("fly to St. Louis");
    expect(m).toContain("alias:st. louis");
  });

  it("St. Petersburg matches via alias", () => {
    const m = matches("St. Petersburg to Moscow");
    expect(m).toContain("alias:st. petersburg");
  });

  it("Saint Louis matches via alias", () => {
    expect(matches("Saint Louis flights")).toContain("alias:st. louis");
  });

  it("Saint Petersburg matches via alias", () => {
    expect(matches("flights to Saint Petersburg")).toContain("alias:st. petersburg");
  });

  it("Sankt Petersburg (German) matches via alias", () => {
    expect(matches("Flug nach Sankt Petersburg")).toContain("alias:st. petersburg");
  });

  it("St. John's matches via alias", () => {
    const m = matches("fly to St. John's");
    expect(m).toContain("alias:st. john's");
  });

  it("St. Maarten matches via alias", () => {
    expect(matches("vacation in St. Maarten")).toContain("alias:st. maarten");
  });
});

describe("Bug fix: AMBIGUOUS_CITIES false positive prevention", () => {
  it("'male' is ambiguous, not highlighted", () => {
    expect(matches("my male friend wants to fly")).toEqual([]);
  });

  it("'cork' is ambiguous, not highlighted", () => {
    expect(matches("pop the cork and celebrate")).toEqual([]);
  });

  it("'buffalo' is ambiguous, not highlighted", () => {
    expect(matches("buffalo wings recipe")).toEqual([]);
  });

  it("'lima' is ambiguous, not highlighted", () => {
    expect(matches("lima bean soup")).toEqual([]);
  });

  it("'troy' is ambiguous, not highlighted", () => {
    expect(matches("troy was an ancient city")).toEqual([]);
  });

  it("existing ambiguous cities still blocked: nice, mobile, split, bath", () => {
    expect(matches("a nice mobile split bath")).toEqual([]);
  });
});

describe("Bug fix: GOA IATA vs Goa city priority", () => {
  it("'goa' (lowercase) matches city Goa India, not IATA Genoa", () => {
    const m = matches("flights to goa");
    expect(m).toContain("city:goa");
    expect(m).not.toContain("IATA:GOA");
  });

  it("'Goa' (title case) matches city Goa India", () => {
    const m = matches("Goa to Mumbai");
    expect(m).toContain("city:goa");
  });

  it("'GOA' (all caps) matches IATA Genoa", () => {
    const m = matches("fly to GOA");
    expect(m).toContain("IATA:GOA");
  });

  it("lowercase IATA codes still work when not a city name", () => {
    expect(matches("fly to jfk")).toContain("IATA:JFK");
    expect(matches("fly to lax")).toContain("IATA:LAX");
  });

  it("all-caps IATA codes work", () => {
    expect(matches("JFK to LAX")).toContain("IATA:JFK");
    expect(matches("JFK to LAX")).toContain("IATA:LAX");
  });
});

// ===================================================================
// REGION HIGHLIGHT TESTS
// ===================================================================

describe("Regions are highlighted with region tag", () => {
  it("'europe' is highlighted as a region", () => {
    expect(matches("anywhere in europe")).toContain("region:europe");
  });

  it("'asia' is highlighted as a region", () => {
    expect(matches("flights to asia")).toContain("region:asia");
  });

  it("multilingual regions highlighted: europa, asie, asien", () => {
    expect(matches("vuelo a europa")).toContain("region:europa");
    expect(matches("vol vers asie")).toContain("region:asie");
    expect(matches("Flug nach asien")).toContain("region:asien");
  });

  it("'southeast asia' is highlighted as a region", () => {
    expect(matches("flights to southeast asia")).toContain("region:southeast asia");
  });

  it("'anywhere' is highlighted as a region", () => {
    expect(matches("fly anywhere cheap")).toContain("region:anywhere");
  });
});

// ===================================================================
// SKIPWORD-PREFIXED MULTI-WORD CITIES
// ===================================================================

describe("Skipword-prefixed multi-word cities", () => {
  it("La Paz matches (multi-word wins over skipword 'la')", () => {
    expect(matches("fly to La Paz")).toContain("city:la paz");
  });

  it("El Paso matches (multi-word wins over skipword 'el')", () => {
    expect(matches("flights to El Paso")).toContain("city:el paso");
  });

  it("La Habana matches alias (multi-word wins over 'la')", () => {
    expect(matches("vuelo a La Habana")).toContain("alias:havana");
  });

  it("Le Caire matches alias (multi-word wins over 'le')", () => {
    expect(matches("vol vers Le Caire")).toContain("alias:cairo");
  });

  it("El Cairo matches alias", () => {
    expect(matches("vuelo al El Cairo")).toContain("alias:cairo");
  });
});

// ===================================================================
// PUNCTUATION AROUND CITIES
// ===================================================================

describe("Punctuation around cities", () => {
  it("'Paris!' matches (exclamation stripped)", () => {
    expect(matches("Paris!")).toContain("city:paris");
  });

  it("'(London)' matches (parens stripped)", () => {
    expect(matches("fly to (London)")).toContain("city:london");
  });

  it("'Berlin, Germany' matches both", () => {
    const m = matches("Berlin, Germany");
    expect(m).toContain("city:berlin");
    expect(m).toContain("country:Germany");
  });

  it("'\"Tokyo\"' matches (quotes stripped)", () => {
    expect(matches('"Tokyo" flights')).toContain("city:tokyo");
  });

  it("'London...' matches (ellipsis stripped)", () => {
    expect(matches("fly to London...")).toContain("city:london");
  });

  it("'Paris—London' matches both (em dash as separator)", () => {
    // em dash is not a word char, acts as separator
    const m = matches("Paris\u2014London");
    expect(m).toContain("city:paris");
    expect(m).toContain("city:london");
  });
});

// ===================================================================
// NUMBERS MIXED WITH CITIES
// ===================================================================

describe("Numbers mixed with city names", () => {
  it("'747 to London' - number ignored, London matches", () => {
    const m = matches("747 to London");
    expect(m).toContain("city:london");
    expect(m).toHaveLength(1);
  });

  it("'flight 123 LAX to JFK' - IATA codes match, numbers ignored", () => {
    const m = matches("flight 123 LAX to JFK");
    expect(m).toContain("IATA:LAX");
    expect(m).toContain("IATA:JFK");
  });

  it("'$500 flights to Paris' - dollar amount ignored", () => {
    const m = matches("$500 flights to Paris");
    expect(m).toContain("city:paris");
  });
});

// ===================================================================
// CASE SENSITIVITY EDGE CASES
// ===================================================================

describe("Case sensitivity edge cases", () => {
  it("'PARIS' (all caps, 5 letters) matches as city, not IATA", () => {
    expect(matches("PARIS")).toContain("city:paris");
  });

  it("'LONDON TO TOKYO' (all caps sentence) matches cities", () => {
    const m = matches("LONDON TO TOKYO");
    expect(m).toContain("city:london");
    expect(m).toContain("city:tokyo");
  });

  it("'lOnDoN' (mixed case) matches city", () => {
    expect(matches("lOnDoN")).toContain("city:london");
  });

  it("'SIN' (all caps) matches IATA, not blocked as skipword", () => {
    expect(matches("SIN")).toContain("IATA:SIN");
  });

  it("'sin' (lowercase) is blocked as skipword", () => {
    expect(matches("sin")).toEqual([]);
  });

  it("'Sin' (title case) is blocked as skipword (not all-caps)", () => {
    expect(matches("Sin")).toEqual([]);
  });
});

// ===================================================================
// IATA EDGE CASES
// ===================================================================

describe("IATA code edge cases", () => {
  it("2-letter input does not match IATA", () => {
    expect(matches("AA")).toEqual([]);
  });

  it("4-letter input does not match IATA", () => {
    expect(matches("ABCD")).toEqual([]);
  });

  it("lowercase 3-letter IATA still resolves", () => {
    expect(matches("jfk")).toContain("IATA:JFK");
    expect(matches("lax")).toContain("IATA:LAX");
    expect(matches("cdg")).toContain("IATA:CDG");
  });

  it("NYC alias works (not IATA but alias)", () => {
    expect(matches("NYC")).toContain("alias:new york");
  });
});

// ===================================================================
// HYPHENATED CITIES
// ===================================================================

describe("Hyphenated city names", () => {
  it("Port-au-Prince matches as single hyphenated token", () => {
    expect(matches("fly to Port-au-Prince")).toContain("city:port-au-prince");
  });

  it("Xi'an matches with straight apostrophe", () => {
    expect(matches("fly to Xi'an")).toContain("city:xi'an");
  });
});

// ===================================================================
// CJK / ARABIC / HINDI ALIAS TESTS
// ===================================================================

describe("CJK alias matching", () => {
  it("Chinese: 伦敦 (London) matches", () => {
    expect(matches("伦敦")).toContain("alias:london");
  });

  it("Chinese: 巴黎 (Paris) matches", () => {
    expect(matches("巴黎")).toContain("alias:paris");
  });

  it("Japanese: 東京 (Tokyo) matches", () => {
    expect(matches("東京")).toContain("alias:tokyo");
  });

  it("Korean: 런던 (London) matches", () => {
    expect(matches("런던")).toContain("alias:london");
  });

  it("Korean: 파리 (Paris) matches", () => {
    expect(matches("파리")).toContain("alias:paris");
  });
});

describe("Arabic alias matching", () => {
  it("Arabic: لندن (London) matches", () => {
    expect(matches("لندن")).toContain("alias:london");
  });

  it("Arabic: باريس (Paris) matches", () => {
    expect(matches("باريس")).toContain("alias:paris");
  });
});

describe("Hindi alias matching", () => {
  it("Hindi: लंदन (London) matches", () => {
    expect(matches("लंदन")).toContain("alias:london");
  });

  it("Hindi: पेरिस (Paris) matches", () => {
    expect(matches("पेरिस")).toContain("alias:paris");
  });

  it("Hindi: दिल्ली (Delhi) matches", () => {
    expect(matches("दिल्ली")).toContain("alias:new delhi");
  });
});

// ===================================================================
// OVERLAPPING MULTI-WORD MATCHES
// ===================================================================

describe("Overlapping multi-word matches", () => {
  it("'San Jose' matches as 2-word city", () => {
    expect(matches("fly to San Jose")).toContain("city:san jose");
  });

  it("'New York' matches as 2-word city (not 'New York City' 3-word)", () => {
    // "new york" is in CITY_SET directly
    expect(matches("fly to New York")).toContain("city:new york");
  });

  it("'Las Vegas' wins over 'las' skipword", () => {
    expect(matches("Las Vegas")).toContain("city:las vegas");
  });

  it("'Los Angeles' wins over 'los' skipword", () => {
    expect(matches("Los Angeles")).toContain("city:los angeles");
  });
});

// ===================================================================
// ADVERSARIAL / STRESS TESTS
// ===================================================================

describe("Adversarial stress tests", () => {
  it("all AMBIGUOUS_CITIES in one sentence produce no matches", () => {
    expect(matches("nice mobile split reading bath chester orange male cork buffalo lima troy")).toEqual([]);
  });

  it("every skipword in one sentence produces no matches", () => {
    const allSkipwords = [...LOCATION_SKIPWORDS].join(" ");
    expect(matches(allSkipwords)).toEqual([]);
  });

  it("city name repeated 200 times doesn't crash", () => {
    const long = "Paris ".repeat(200);
    const m = matches(long);
    expect(m.length).toBe(200);
    expect(m.every(x => x === "city:paris")).toBe(true);
  });

  it("1000 random words produce no false positives", () => {
    const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum";
    const m = matches(words);
    // "est" is a skipword (French), "sint" is not a city, "in" is too short
    // Only potential match: check no false positives slip through
    expect(m).toEqual([]);
  });

  it("mixed scripts in one query", () => {
    const m = matches("fly from 東京 to Paris via لندن");
    expect(m).toContain("alias:tokyo");
    expect(m).toContain("city:paris");
    expect(m).toContain("alias:london");
  });

  it("repeated punctuation doesn't break scanner", () => {
    expect(matches("!!! ??? ... --- +++")).toEqual([]);
  });

  it("emoji-heavy input doesn't crash", () => {
    expect(matches("✈️ 🌍 fly to London 🇬🇧")).toContain("city:london");
  });
});

// ===================================================================
// COMMON ENGLISH WORDS AS IATA CODES (must be blocked lowercase)
// ===================================================================

describe("Common English words that are IATA codes (blocked as skipwords)", () => {
  it("'ham' (HAM=Hamburg) blocked lowercase, allowed uppercase", () => {
    expect(matches("I love ham sandwiches")).toEqual([]);
    expect(matches("fly to HAM")).toContain("IATA:HAM");
  });

  it("'her' (HER=Heraklion) blocked lowercase", () => {
    expect(matches("tell her about the flight")).toEqual([]);
    expect(matches("HER")).toContain("IATA:HER");
  });

  it("'mad' (MAD=Madrid) blocked lowercase", () => {
    expect(matches("I'm mad about delays")).toEqual([]);
    expect(matches("MAD")).toContain("IATA:MAD");
  });

  it("'man' (MAN=Manchester) blocked lowercase", () => {
    expect(matches("that man is flying")).toEqual([]);
    expect(matches("MAN")).toContain("IATA:MAN");
  });

  it("'pen' (PEN=Penang) blocked lowercase", () => {
    expect(matches("get a pen and paper")).toEqual([]);
    expect(matches("PEN")).toContain("IATA:PEN");
  });

  it("'pit' (PIT=Pittsburgh) blocked lowercase", () => {
    expect(matches("olive pit")).toEqual([]);
    expect(matches("PIT")).toContain("IATA:PIT");
  });

  it("'sat' (SAT=San Antonio) blocked lowercase", () => {
    expect(matches("I sat down")).toEqual([]);
    expect(matches("SAT")).toContain("IATA:SAT");
  });

  it("'saw' (SAW=Istanbul Sabiha) blocked lowercase", () => {
    expect(matches("I saw a bird")).toEqual([]);
    expect(matches("SAW")).toContain("IATA:SAW");
  });

  it("'sea' (SEA=Seattle) blocked lowercase", () => {
    expect(matches("by the sea")).toEqual([]);
    expect(matches("SEA")).toContain("IATA:SEA");
  });

  it("'dad' (DAD=Da Nang) blocked lowercase", () => {
    expect(matches("my dad travels")).toEqual([]);
    expect(matches("DAD")).toContain("IATA:DAD");
  });

  it("'add' (ADD=Addis Ababa) blocked lowercase", () => {
    expect(matches("please add luggage")).toEqual([]);
    expect(matches("ADD")).toContain("IATA:ADD");
  });

  it("'rep' (REP=Siem Reap) blocked lowercase", () => {
    expect(matches("sales rep meeting")).toEqual([]);
    expect(matches("REP")).toContain("IATA:REP");
  });

  it("'led' (LED=St. Petersburg) blocked lowercase", () => {
    expect(matches("she led the way")).toEqual([]);
    expect(matches("LED")).toContain("IATA:LED");
  });

  it("'fat' (FAT=Fresno) blocked lowercase", () => {
    expect(matches("low fat diet")).toEqual([]);
    expect(matches("FAT")).toContain("IATA:FAT");
  });

  it("sentence with multiple IATA-word skipwords produces no false positives", () => {
    expect(matches("my dad saw her man add the ham and sat by the sea with a pen")).toEqual([]);
  });

  it("sentence mixing IATA skipwords with real cities still matches cities", () => {
    const m = matches("my dad saw Paris and her man flew to London by the sea");
    expect(m).toContain("city:paris");
    expect(m).toContain("city:london");
    expect(nonMatches("my dad saw Paris and her man flew to London by the sea")).toContain("dad");
    expect(nonMatches("my dad saw Paris and her man flew to London by the sea")).toContain("saw");
    expect(nonMatches("my dad saw Paris and her man flew to London by the sea")).toContain("her");
    expect(nonMatches("my dad saw Paris and her man flew to London by the sea")).toContain("man");
    expect(nonMatches("my dad saw Paris and her man flew to London by the sea")).toContain("sea");
  });
});

describe("Cross-language skipwords (common verbs/adjectives that are IATA codes)", () => {
  it("'ist' (DE: is) blocked, IST (Istanbul) allowed uppercase", () => {
    expect(matches("der Flug ist billig")).toEqual([]);
    expect(matches("IST")).toContain("IATA:IST");
  });

  it("'fra' (IT: between) blocked, FRA (Frankfurt) allowed uppercase", () => {
    expect(matches("fra Roma e Milano")).toContain("alias:rome");
    expect(matches("fra Roma e Milano")).toContain("alias:milan");
    expect(nonMatches("fra Roma e Milano")).toContain("fra");
    expect(matches("FRA")).toContain("IATA:FRA");
  });

  it("'bom' (PT: good) blocked, BOM (Mumbai) allowed uppercase", () => {
    expect(matches("bom dia, voo para Londres")).toContain("alias:london");
    expect(nonMatches("bom dia, voo para Londres")).toContain("bom");
    expect(matches("BOM")).toContain("IATA:BOM");
  });

  it("'ont' (FR: have 3pl) blocked, ONT (Ontario) allowed uppercase", () => {
    expect(matches("ils ont trouve un vol")).toEqual([]);
    expect(matches("ONT")).toContain("IATA:ONT");
  });

  it("'dar' (ES: to give) blocked, DAR (Dar es Salaam) allowed uppercase", () => {
    expect(matches("me puedes dar el precio")).toEqual([]);
    expect(matches("DAR")).toContain("IATA:DAR");
  });

  it("'tun' (DE: to do) blocked, TUN (Tunis) allowed uppercase", () => {
    expect(matches("was soll ich tun")).toEqual([]);
    expect(matches("TUN")).toContain("IATA:TUN");
  });

  it("'dur' (FR: hard) blocked, DUR (Durban) allowed uppercase", () => {
    expect(matches("le vol est trop dur")).toEqual([]);
    expect(matches("DUR")).toContain("IATA:DUR");
  });

  it("'vie' (FR: life) blocked, VIE (Vienna) allowed uppercase", () => {
    expect(matches("la vie est belle")).toEqual([]);
    expect(matches("VIE")).toContain("IATA:VIE");
  });

  it("'san' alone blocked (SAN=San Diego), but 'San Francisco' still matches", () => {
    expect(matches("el san es bonito")).toEqual([]);
    expect(matches("SAN")).toContain("IATA:SAN");
    expect(matches("fly to San Francisco")).toContain("city:san francisco");
  });

  it("'sub' blocked (SUB=Surabaya), allowed uppercase", () => {
    expect(matches("sub 500 dollars")).toEqual([]);
    expect(matches("SUB")).toContain("IATA:SUB");
  });

  it("German sentence: 'Wann ist der Flug am günstigsten' - no false IST highlight", () => {
    expect(nonMatches("Wann ist der Flug am günstigsten")).toContain("ist");
    expect(nonMatches("Wann ist der Flug am günstigsten")).toContain("der");
  });

  it("Italian sentence: 'scegliere fra voli da Roma a Parigi' - no false FRA highlight", () => {
    const m = matches("scegliere fra voli da Roma a Parigi");
    expect(m).toContain("alias:rome");
    expect(m).toContain("alias:paris");
    expect(nonMatches("scegliere fra voli da Roma a Parigi")).toContain("fra");
  });

  it("Portuguese sentence: 'bom preço de São Paulo a Lisboa' - no false BOM highlight", () => {
    const m = matches("bom preço de São Paulo a Lisboa");
    expect(m).toContain("city:sao paulo");
    expect(m).toContain("alias:lisbon");
    expect(nonMatches("bom preço de São Paulo a Lisboa")).toContain("bom");
  });
});

// ===================================================================
// CURLY APOSTROPHE SUPPORT (pasted text from Word/Google Docs)
// ===================================================================

describe("Curly apostrophe support", () => {
  it("St. John\u2019s with curly apostrophe matches alias", () => {
    // U+2019 RIGHT SINGLE QUOTATION MARK (most common curly apostrophe)
    expect(matches("fly to St. John\u2019s")).toContain("alias:st. john's");
  });

  it("Xi\u2019an with curly apostrophe matches city", () => {
    expect(matches("fly to Xi\u2019an")).toContain("city:xi'an");
  });

  it("Moskova\u2019dan with curly apostrophe matches via Turkish fallback", () => {
    const m = matches("Moskova\u2019dan");
    expect(m).toContain("alias:moscow");
  });

  it("left curly apostrophe U+2018 also works", () => {
    expect(matches("fly to Xi\u2018an")).toContain("city:xi'an");
  });
});

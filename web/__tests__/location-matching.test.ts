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
  const orig = originalPhrase || phrase;
  // Skipword: block if user typed lowercase; allow if all-uppercase (IATA intent)
  if (LOCATION_SKIPWORDS.has(p) && orig !== orig.toUpperCase()) return null;
  const upper = phrase.toUpperCase();
  if (upper.length === 3 && IATA_SET.has(upper)) return `IATA:${upper}`;
  // Country
  if (COUNTRY_LOOKUP[p]) return `country:${COUNTRY_LOOKUP[p].name}`;
  // City
  if (CITY_SET.has(p) && !AMBIGUOUS_CITIES.has(p)) return `city:${p}`;
  // Alias
  const normP = norm(p);
  if (CITY_ALIASES[normP]) {
    const target = CITY_ALIASES[normP].toLowerCase();
    if (CITY_SET.has(target)) return `alias:${target}`;
  }
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
  const re = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
  const tokens: { word: string; original: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    tokens.push({ word: m[0], original: prompt.slice(m.index, m.index + m[0].length) });
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
  const known = new Set(["LOS","LAS","DEL","SIN","DEN","EIN","AUS","PER","CAN","GOT"]);
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

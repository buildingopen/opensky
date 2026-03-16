const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export async function getZones(): Promise<ConflictZone[]> {
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
  { label: string; color: string; description: string }
> = {
  do_not_fly: {
    label: "Do Not Fly",
    color: "#ef4444",
    description:
      "Airspace is closed or extremely dangerous. Airlines do not operate routes through this zone. All flights are rerouted.",
  },
  high_risk: {
    label: "High Risk",
    color: "#ff6b35",
    description:
      "Active security threats in this airspace. Most airlines avoid this zone. Flights transiting nearby may be rerouted.",
  },
  caution: {
    label: "Caution",
    color: "#f59e0b",
    description:
      "Advisory-level concern. Airports in this zone operate normally, but nearby conflict zones may affect some overflights. Airlines monitor the situation and reroute if needed.",
  },
  safe: {
    label: "Safe",
    color: "#22c55e",
    description: "No known conflict zone restrictions.",
  },
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

export const TRAVELER_ADVICE: Record<string, string> = {
  do_not_fly:
    "No commercial flights operate through this airspace. If your route would normally transit this zone, airlines automatically reroute around it. You do not need to take any action, but flights may be longer or more expensive due to detours. FlyFast filters out any routes that would pass through this zone.",
  high_risk:
    "Most airlines avoid this airspace. FlyFast flags any flights that transit nearby so you can choose safer alternatives. Check your airline's route policy if you are flying to a neighboring country.",
  caution:
    "Airports in or near this zone operate normally. You may see a Caution badge on flights transiting this area. This means the route passes near a conflict zone but is not directly affected. Monitor travel advisories from your government before booking.",
  safe: "No restrictions. Fly normally.",
};

const API_URL =
  process.env.INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export interface RouteCache {
  origin: string;
  destination: string;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  airlines: string[];
  duration_min: number | null;
  duration_max: number | null;
  sample_count: number;
  updated_at: string | null;
}

export async function getRouteCache(
  origin: string,
  destination: string,
): Promise<RouteCache | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/route-cache?origin=${origin}&destination=${destination}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.route ?? null;
  } catch {
    return null;
  }
}

export async function getAllRouteCache(): Promise<RouteCache[]> {
  try {
    const res = await fetch(`${API_URL}/api/route-cache`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.routes ?? [];
  } catch {
    return [];
  }
}

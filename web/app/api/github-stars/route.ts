import { NextResponse } from "next/server";

const REPO = "buildingopen/opensky";
const CACHE_SECONDS = 3600;

let cached: { count: number; ts: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_SECONDS * 1000) {
    return NextResponse.json({ stars: cached.count });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) {
      if (cached) return NextResponse.json({ stars: cached.count });
      return NextResponse.json({ stars: null });
    }
    const data = await res.json();
    const count = data.stargazers_count ?? null;
    if (count != null) cached = { count, ts: Date.now() };
    return NextResponse.json({ stars: count });
  } catch {
    if (cached) return NextResponse.json({ stars: cached.count });
    return NextResponse.json({ stars: null });
  }
}

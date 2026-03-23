import { proxyToBackend } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyToBackend(request, "/api/alerts");
}

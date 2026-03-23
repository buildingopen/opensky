const INTERNAL_API_BASE_URL = (
  process.env.INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const INTERNAL_API_TOKEN = (process.env.INTERNAL_API_TOKEN || "").trim();

function getEndUserIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return (headers.get("x-real-ip") || "").trim();
}

function buildProxyHeaders(requestHeaders: Headers): Headers {
  const headers = new Headers();
  const contentType = requestHeaders.get("content-type");
  const authorization = requestHeaders.get("authorization");
  const apiKey = requestHeaders.get("x-api-key");
  const endUserIp = getEndUserIp(requestHeaders);

  if (contentType) headers.set("Content-Type", contentType);
  if (authorization) headers.set("Authorization", authorization);
  if (apiKey) headers.set("X-API-Key", apiKey);
  if (endUserIp) headers.set("X-End-User-IP", endUserIp);
  if (INTERNAL_API_TOKEN) headers.set("X-Internal-API-Token", INTERNAL_API_TOKEN);

  return headers;
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const key of ["content-type", "cache-control", "retry-after"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

export function backendUrl(path: string): string {
  return `${INTERNAL_API_BASE_URL}${path}`;
}

export async function proxyToBackend(request: Request, path: string): Promise<Response> {
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  const upstream = await fetch(backendUrl(path), {
    method: request.method,
    headers: buildProxyHeaders(request.headers),
    body,
    cache: "no-store",
    redirect: "manual",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: buildResponseHeaders(upstream),
  });
}

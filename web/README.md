# OpenSky Web

Next.js frontend for the hosted OpenSky experience.

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Commands

- `npm run lint` - ESLint checks
- `npm run typecheck` - TypeScript checks
- `npm run test:run` - unit tests
- `npm run build` - production build

## Environment

- `NEXT_PUBLIC_API_URL` - backend API URL for server-side use
- `INTERNAL_API_BASE_URL` - backend API URL for Next.js route handlers
- `INTERNAL_API_TOKEN` - shared secret used by Next.js route handlers when proxying to the API
- `NEXT_PUBLIC_SITE_URL` - canonical app URL for metadata/sitemap
- `NEXT_PUBLIC_ZONES_UPDATED_AT` - user-facing safety data freshness label

# JBound — API server

Express 5 + Supabase API for JBound. Setup, environment variables, demo accounts, deployment and the full API reference are in the [root README](../README.md).

```bash
cp .env.example .env     # fill in Supabase + LTA keys (never commit .env)
pnpm install
pnpm dev                 # http://localhost:3000/api/health
```

Folder guide:

- `routes/` maps URLs to controllers; every request body/query is validated by `routes/schemas.js` (zod).
- `controllers/` holds the request handlers.
- `middleware/` covers auth, trip membership and errors.
- `services/` wraps the external APIs: LTA DataMall, Frankfurter, OpenRouteService and Supabase Storage.
- `services/logic/` holds the **core business logic** (feasibility, memory window, expense split, congestion, vibe matching).
- `db/schema.sql` + `db/seed.sql` are run once in the Supabase SQL editor.

Driving directions are available at `POST /api/routes`. Send at least two `[longitude, latitude]` pairs in a `coordinates` array; the server returns ORS GeoJSON and keeps `ORS_API_KEY` server-side. Configure the key in `.env` before using this endpoint.

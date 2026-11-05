# JBound

JBound is a Singapore–Johor Bahru travel companion. Friends use it to plan trips together, check how busy the border is, split costs in S$ and RM, discover places, share tales about them, and keep a scrapbook of past trips.

## Tech stack

- **Client:** Vue 3, Vite, Vue Router, Pinia, axios, Three.js, and the Google Maps JavaScript API
- **Server:** Node.js, Express 5, CORS, helmet, morgan, zod, and multer
- **Database & auth:** Supabase (Postgres, Auth, Storage, and Realtime)
- **External APIs:** Google Places API (New), LTA DataMall (traffic cameras), Frankfurter (exchange rates), OpenRouteService (driving routes), and data.gov.sg (weather forecasts)

## Run locally

Install [Node.js](https://nodejs.org) 20.19+ or 22.12+ and [pnpm](https://pnpm.io/installation) if they are not already installed, then install dependencies from the repository root:

```sh
pnpm install
```

### Database
Schema changes and the starter places live in `supabase/migrations/`. Never edit the remote database by hand.
```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Environment variables

Copy the example environment files:

```sh
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Fill in your Supabase URL, `anon` key and `service_role` key, all found under **Project Settings → API**. The `service_role` key belongs in `server/.env` only, and should never go in the client. An LTA DataMall key is optional. Without it, the Watcher page shows congestion estimates but no live camera images.

Add your OpenRouteService key as `ORS_API_KEY` in `server/.env`. Keep it server-side; do not add it to a `VITE_` variable or expose it in the client.

Google Maps needs a [Google Cloud](https://console.cloud.google.com) project with billing enabled. Under **APIs & Services → Library**, enable the **Maps JavaScript API** and **Places API (New)**. Then, under **APIs & Services → Credentials**, create two API keys with these restrictions:

| | Browser key | Server key |
|---|---|---|
| Goes in | `VITE_GOOGLE_MAPS_API_KEY` in `client/.env.local` (and your client host) | `GOOGLE_PLACES_API_KEY` in `server/.env` (and your API host) |
| Application restrictions | **Websites**: `http://localhost:5173/*` and `https://your-app.vercel.app/*` | **None**. Hosts such as Vercel have no fixed IP address, so this key is protected by staying secret on the server. |
| API restrictions | Restrict key → **Maps JavaScript API** only | Restrict key → **Places API (New)** only |

The browser key is visible to anyone who opens the site, which is why it is locked to your addresses. Add your Vercel URL to it after deploying, or the map will not load in production. New restrictions can take about five minutes to apply.

To avoid surprise charges, set a budget alert under **Billing → Budgets & alerts**. Also cap daily requests under **APIs & Services → Places API (New) → Quotas** (for example, 500 per day). Never commit either key; both `.env` files are already in `.gitignore`.

`VITE_GOOGLE_MAP_ID` can stay as `DEMO_MAP_ID` during development. Without the Google keys, the route map and Google search show a setup message, and the rest of the app still works.

### Start the app

Start the Vite client and the Express API in separate terminals:

```sh
pnpm dev
```

```sh
pnpm --filter jbound-server dev
```

Open the client at [http://localhost:5173](http://localhost:5173) and create an account on the sign-up page. No email confirmation is needed. There is no demo data seed, so trips, tales and expenses start empty. The API is available at [http://localhost:3001](http://localhost:3001), and its health check is at `/api/health`.

### API notes


Driving directions are available at `POST /api/routes`. Send JSON with a `coordinates` array containing at least two `[longitude, latitude]` pairs; the response is ORS GeoJSON.

Trip expense endpoints are mounted at `/api/trips/:tripId/expenses`. They require a signed-in trip member and support listing/creating/updating expenses, retrieving SGD balances, and recording SGD settlements. MYR expenses include the exchange rate and its effective date.

The server accepts browser requests from the origins listed in `CLIENT_ORIGIN` in `server/.env` (`http://localhost:5173` if unset) and from any `*.vercel.app` origin, so that preview deployments work. To change the API port, set `PORT` in `server/.env`. If you do, also update `VITE_API_URL` in `client/.env.local` to match.

## Tests

Run the server's unit and API tests:

```sh
pnpm test
```

Run the client's unit tests in watch mode:

```sh
pnpm --filter jbound-client test:unit
```

### End-to-end tests (Cypress)

One-time setup:

1. `pnpm install` from the repo root (already covers Cypress — it's a pinned `devDependency`
   in `client/package.json`, no separate install step needed).
2. Copy `.env.example` to `.env` in both `server/` and `client/` and fill it. For more information, contact Coen.
   
3. Copy `cypress.env.json.example` to `cypress.env.json` (repo root, gitignored) and fill
   in test account credentials. These are self-service: sign up your own throwaway
   account(s) through the running app itself, no one needs to hand them to you.

Running the suite:

1. Start the backend: Run `pnpm dev` in `server/`.
2. Start the frontend: Run `pnpm dev` in `client/`.
3. Run the tests headless: `pnpm --filter jbound-client test:e2e:cypress`.
   To watch it run in a real browser instead: Open another terminal and run `npx cypress open --project ..` in `client/`.

Troubleshooting Tips :
- Always run Cypress from `client/`, as running it from the root picks up
  a different, unpinned Cypress version and everything breaks with unrelated errors.
- If sign-ins start failing after many repeated test runs, the backend's auth rate limiter
  is kicking in and you need to restart the backend with `AUTH_RATE_LIMIT=off pnpm dev` to lift it.
- `cypress/e2e/map.cy.js` is out of date (targets Planner markup and demo data that no
  longer exist) and is superseded by `cypress/e2e/route-map.cy.js`.

## Build the client

```sh
pnpm --filter jbound-client build
```
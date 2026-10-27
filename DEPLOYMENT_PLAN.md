# Separate Vercel deployment plan

Status: proposed for review. This file does not enable deployments.

## Decision and intended behavior

Use two Vercel projects connected to the same GitHub repository:

| Project | Root directory | Runtime/purpose |
| --- | --- | --- |
| jbound-web | client | Vite builds the Vue frontend to dist |
| jbound-api | server | Express runs as a Vercel Function |

Supabase continues providing Postgres, Auth, Storage, and Realtime.

For routine production releases, add the `prod` label to a pull request before merging it into `main`. One GitHub Actions workflow deploys the backend, checks its health, then deploys the frontend. Merges without the label do not deploy production. Closing an unmerged PR or adding the label after merging does not trigger a release.

Both deployments use the PR's exact merge commit. A labelled merge releases all changes contained in that commit, including earlier unlabelled merges already on main.

## Existing setup and completed prerequisites

- The repository is a pnpm workspace containing independent client and server packages.
- The frontend already reads its backend base URL from VITE_API_URL.
- Express already has /api/health and uses Supabase for persistent storage.
- Realtime and presence use Supabase from the browser.
- The backend currently exports a named app from server/app.js; server/server.js starts a local listener.
- There are no GitHub Actions workflows or Vercel configuration files yet.
- render.yaml describes an alternative Render deployment; it is not needed for this approach.
- Previously completed: image upload limits reduced to 4 MiB on the client and server, and hardcoded photo URLs replaced with the existing assetUrl helper. Frontend build and 26 backend tests passed.

## Phase 1: Prepare the repository

Implementation work after this plan is reviewed:

1. Add a default Express app export while preserving the named export and local server startup.
2. Add client/vercel.json for the Vite build and Vue history fallback. Static assets must remain accessible; direct navigation to /planner and other frontend routes must load Vue.
3. Add server/vercel.json as needed for the Express project and production Git deployment policy. Keep API routing in Express rather than duplicating its routes in Vercel configuration.
4. Use the root pnpm workspace and lockfile consistently. Check the nested workspace file and competing npm/pnpm lockfiles before deciding whether cleanup is necessary. Avoid unrelated dependency upgrades.
5. Select and document compatible Node.js and pnpm versions for local builds, Vercel, and Actions.
6. Update frontend environment examples to refer to the Vercel backend URL.
7. Ignore local .vercel project links and downloaded environment files.
8. Document actual setup commands without relying on missing root scripts in the current README.

No application architecture rewrite or move to Supabase Edge Functions is planned.

## Phase 2: Create and deploy the backend project

User actions:

1. Create/sign in to Vercel using GitHub and grant access to this repository.
2. Confirm the selected Vercel plan supports the repository ownership, visibility, and team collaboration. GitHub Actions does not bypass plan restrictions.
3. Import the repository as jbound-api with Root Directory set to server. Enable access to workspace files outside the root directory if required by the chosen installation configuration.
4. Use Vercel's Express detection; do not configure a frontend dist output for this project.
5. Add backend environment variables directly in Vercel, using server/.env.example as the reference:
   - NODE_ENV=production
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY (server only)
   - SUPABASE_STORAGE_BUCKET
   - CLIENT_ORIGIN (initially the intended frontend URL; update once confirmed)
   - GOOGLE_PLACES_API_KEY
   - ORS_API_KEY
   - LTA_ACCOUNT_KEY if live traffic cameras are required
   - Optional API base URL overrides only if needed
6. Perform the initial deployment through the Vercel dashboard and record the stable production URL.
7. Verify /api/health returns successful JSON.

The initial deployment can build directly from GitHub. A deployment from a laptop is not required. If production Git auto-deployment has already been disabled by configuration, use an explicit dashboard deployment or an authenticated CLI deployment for bootstrap; verify the available bootstrap path before applying that policy.

## Phase 3: Create and deploy the frontend project

User actions:

1. Import the same repository as jbound-web with Root Directory set to client.
2. Select Vite, build with the documented pnpm command, and use dist as output.
3. Add these frontend variables in Vercel:

| Variable | Value |
| --- | --- |
| VITE_API_URL | Stable backend production URL, with no /api suffix |
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Public anon key used by the current app |
| VITE_GOOGLE_MAPS_API_KEY | Restricted browser Maps key |
| VITE_GOOGLE_MAP_ID | Optional map ID |

4. Deploy from the dashboard and record the stable frontend URL.
5. Update backend CLIENT_ORIGIN and redeploy the backend if necessary.
6. Add the frontend domain to Google Maps browser-key restrictions and the applicable Supabase Auth site/redirect settings.

Frontend VITE_ variables are public build-time values. Backend secret keys must never be placed in VITE_ variables, committed to Git, or pasted into chat.

## Phase 4: Verify the first complete deployment

- Check frontend home page and direct navigation/refresh on nested routes.
- Check sign-in, sign-out, auth redirects, and authenticated API access.
- Check maps, place photos, routes, and the configured external APIs.
- Check posts and trip-memory uploads below 4 MiB and rejection above the app limit. Each image is sent in a separate request; retain headroom for multipart overhead under Vercel's 4.5 MB request limit.
- Check trip realtime updates and presence through Supabase.
- Verify the backend is accessible to the browser without a Vercel sign-in page. Configure production deployment protection accordingly; an automated health-check bypass alone does not make the API accessible to users.
- Review CORS before launch: the existing backend allows all *.vercel.app origins. Decide whether to restrict this to explicitly approved frontend origins and how previews should be authorized.

## Phase 5: Configure GitHub Actions credentials

User actions in GitHub repository Settings -> Secrets and variables -> Actions:

| Secret | Purpose |
| --- | --- |
| VERCEL_TOKEN | Vercel deployment token with access to both projects |
| VERCEL_ORG_ID | Vercel team/account identifier owning both projects |
| VERCEL_API_PROJECT_ID | Backend project identifier |
| VERCEL_WEB_PROJECT_ID | Frontend project identifier |

Store the stable backend URL as a repository variable, for example VERCEL_API_URL, if the health check uses it. If deployment protection is retained for deployment-specific URLs, determine whether a separate automation bypass secret is required.

Create the GitHub label prod. No extra GitHub personal access token should be needed for this workflow.

## Phase 6: Implement the release workflow

Add .github/workflows/deploy-production.yml with this behavior:

1. Trigger on pull_request closed events targeting main.
2. Run only when merged is true and the PR has the prod label.
3. Use read-only repository permissions and check out the exact merge commit.
4. Serialize production workflows so backend/frontend releases cannot interleave. Do not cancel a deployment midway through a release. Document GitHub concurrency's treatment of pending runs; it is not a guaranteed FIFO release queue.
5. Run the backend tests before deploying.
6. Use a pinned Vercel CLI version and the selected Node/pnpm toolchain.
7. Deploy the backend project and wait for Vercel readiness.
8. Check /api/health with bounded retries, requiring successful JSON with ok=true. Prefer checking the newly deployed artifact; account for deployment protection and confirm the stable production alias is ready too.
9. Deploy the frontend only if the backend deployment and health check succeed.
10. Record deployment URLs in the GitHub Actions summary without exposing credentials.

Before implementation, choose and verify one CLI strategy for both projects: remote builds on Vercel, or pull/build/deploy --prebuilt. Run the CLI from the correct repository directory so each project's Root Directory setting is honored. Do not build the same artifact in both Actions and Vercel.

Disable automatic Git production deployments for main in both projects when switching to Actions, so an unlabelled merge cannot release production. Other branches may retain automatic previews. Configure preview environment variables deliberately; preview apps should not accidentally write to production data.

## Phase 7: Validate the release gate

| Scenario | Expected result |
| --- | --- |
| Merge a PR with prod into main | Backend deploy, health check, then frontend deploy |
| Merge without prod | Neither production project deploys |
| Close PR without merging | No production deployment |
| Add prod after merge | No deployment |
| Backend deployment or health check fails | Frontend deployment is skipped |
| Frontend deployment fails | Workflow fails; backend remains at its new version |

Use an agreed small change to test labelled/unlabelled releases after setup. These are real deployments, not local checks.

## Rollback and database changes

- Two Vercel projects are not one atomic release. Backend API changes must remain compatible with the frontend version currently live.
- A frontend failure does not automatically undo a successful backend deployment. Inspect the failure, then retry or roll back the relevant project in Vercel.
- Rolling back one project does not roll back the other project or Supabase.
- Supabase migrations remain a separate explicit process for this initial workflow. Do not automatically run database migrations just because a PR has prod.
- Database changes should be backward compatible with the currently deployed applications.

## Deliverables after implementation

- Vercel configuration for each application and compatible Express entry.
- One reviewed prod-label workflow covering both projects.
- Setup instructions listing environment variables, secrets, and project settings.
- Local build/test results and, once accounts are configured, live deployment verification.

## References

- Express on Vercel: https://vercel.com/docs/frameworks/backend/express
- Monorepos: https://vercel.com/docs/monorepos
- Git deployment control: https://vercel.com/docs/project-configuration/git-configuration
- Functions limits: https://vercel.com/docs/functions/limitations
- GitHub Actions and Vercel: https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel

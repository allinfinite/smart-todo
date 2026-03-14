# Booch-Bar Smart Todo Setup

## Plan

- [x] Inspect the current `smart-todo` portal contract and confirm what must be configured for the `allinfinite/Booch-Bar` instance.
- [x] Confirm remote access details for the preview/dev host on `dna@piko.local`.
- [x] Configure this repo so the generated portal is branded and wired for the Booch-Bar workspace, including preview and deploy actions.
- [x] Add setup documentation/scripts for GitHub-backed Vercel auto-deploys and a piko.local preview/dev server.
- [x] Verify the local build and any available deployment/auth wiring.

## Review

- Added a Booch-Bar portal env template in [/Users/daniellevy/Code/smart-todo/instances/booch-bar.env.example](/Users/daniellevy/Code/smart-todo/instances/booch-bar.env.example) with:
  - `apiBase=https://cowork-api.dnalevity.com`
  - `/api/portal/booch-bar/{requests,replies,workspace,actions}`
  - Booch-Bar-specific branding/copy/theme values
- Added Booch-Bar workspace support to the Cowork backend in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - new `booch-bar` portal slug
  - preview port `3104`
  - preview base path `/preview/booch-bar`
  - Git-backed `sync` and `deploy` actions against `/home/dna/Code/Booch-Bar`
- Updated the preview gateway example in [/Users/daniellevy/Code/Cowork/config/piko-preview-gateway.nginx.conf.example](/Users/daniellevy/Code/Cowork/config/piko-preview-gateway.nginx.conf.example) with the `booch-bar` route.
- Updated the Booch-Bar app in [/Users/daniellevy/Code/Booch-Bar/next.config.mjs](/Users/daniellevy/Code/Booch-Bar/next.config.mjs) and related app files so it runs correctly at both:
  - `/`
  - `/preview/booch-bar`
- Pushed the Booch-Bar preview-path changes to GitHub:
  - commit `84f7356` on `main`
- Live piko/Cowork state now verified:
  - `https://cowork-api.dnalevity.com/api/portal/booch-bar/workspace` returns `200` with `preview.ready=true`
  - `https://piko.dnalevity.com/preview/booch-bar` returns `200`
  - `https://piko.dnalevity.com/preview/booch-bar/events` returns `200`
- Vercel state:
  - created project `booch-bar` and connected it to `allinfinite/Booch-Bar`
  - created project `booch-bar-todo` and connected it to `allinfinite/smart-todo`
  - loaded `PORTAL_TEMPLATE_CONFIG_JSON` into `booch-bar-todo` for `production`, `preview`, and `development`
  - current blocker: Vercel is not materializing working deployments yet
    - site deployment `https://booch-hc9adjhna-dnalevity.vercel.app` is in `Error` with no build steps recorded
    - portal deployment `https://booch-bar-todo-qf5vh73y3-dnalevity.vercel.app` remains `Initializing` with no build steps recorded
- Verification run:
  - `npm install` in `/Users/daniellevy/Code/Booch-Bar`
  - `npm run build` in `/Users/daniellevy/Code/Booch-Bar`
  - `COWORK_PREVIEW_BASE_PATH=/preview/booch-bar npm run build` in `/Users/daniellevy/Code/Booch-Bar`
  - local `next dev` smoke checks for `/preview/booch-bar` and `/preview/booch-bar/events`
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`

## Vercel Troubleshooting

### Plan

- [x] Inspect the current Vercel deployment state for `booch-bar` and `booch-bar-todo`.
- [x] Compare Git-linked deploys with direct CLI deploy behavior to determine where the blockage occurs.
- [x] Identify the concrete failure mode in Vercel CLI output or deployment metadata.
- [x] Record the result and any workaround or fix.

### Review

- `vercel inspect --debug` and raw Vercel deployment API responses show two separate issues:
  - Git-based Booch-Bar production deploy `dpl_AhZRZaSv8mhxon1DGGgnfSrCcWqY` failed with:
    - `errorCode=VULNERABLE_NEXTJS_VERSION`
    - `errorMessage="Vulnerable version of Next.js detected, please update immediately."`
  - New direct CLI/prebuilt deploys for both `booch-bar` and `booch-bar-todo` are accepted by Vercel but remain stuck in:
    - `readyState=INITIALIZING`
    - `status=INITIALIZING`
    - `isInSystemBuildsQueue=true`
    - `builds=[]`
    - `lambdas=[READY]`
    - `aliasAssigned=false`
- This means:
  - the old Booch-Bar Git deploy had a real repo-level blocker: unpatched Next.js
  - the new direct CLI deploys are not failing in upload, build, or project config; they are stuck after creation inside Vercel’s system queue/finalization layer
- Local Vercel-managed builds succeeded for both projects after `vercel pull --yes`:
  - `/Users/daniellevy/Code/Booch-Bar`
  - `/private/tmp/booch-bar-todo-oT1nAX`
- Direct deployment URLs for the fresh prebuilt deploys return `401`, not `404`, which indicates Vercel has materialized the deployment objects even though the aliases are not ready yet.
- Public status check on March 13, 2026:
  - [Vercel Status](https://www.vercel-status.com/) reports `Build & Deploy`, `Builds`, `CI/CD`, and `Git Integrations` as operational
  - the only visible incident is unrelated `dxb1` regional degradation
- Current conclusion:
  - `booch-bar` Git auto-deploys will continue to fail until the Next.js upgrade is committed and pushed
  - even after bypassing remote builds with `vercel build --prod` + `vercel deploy --prod --prebuilt`, both projects still stall in Vercel’s internal system queue, so there is no local CLI fix for the remaining initialization problem

# Telegram Smart Todo Command

## Plan

- [ ] Inspect the existing `telegram-bot` command surface on `dna@piko.local` and confirm where a new provisioning command should plug in.
- [ ] Add a reusable smart-todo setup helper on `piko.local` that accepts a GitHub repo or Vercel project and runs the existing setup flow in the correct workspace.
- [ ] Wire a `/smarttodo` Telegram command to that helper with clear usage text and serialized execution per Telegram thread.
- [ ] Verify the helper and command on `piko.local`, then document the final usage and any remaining limits.

## Review

- Added a new `/smarttodo` Telegram bot command to the live bot on `dna@piko.local` in `/home/dna/telegram-bot/bot.js`.
- Added a new helper script on `piko.local` at `/home/dna/bin/prepare-smarttodo-command.sh`.
  - Accepts either:
    - `owner/repo` or GitHub repo URL
    - Vercel project name or Vercel project URL
  - Ensures `/home/dna/Code/smart-todo` exists on `piko.local` by cloning `git@github.com:allinfinite/smart-todo.git` on first run.
  - Resolves a candidate slug, captures `vercel project inspect` output when available, and builds the Codex provisioning prompt.
- The bot command now:
  - validates usage
  - serializes execution per Telegram thread with `enqueueForTopic`
  - pins the thread cwd to `/home/dna/Code/smart-todo`
  - runs Codex with the prepared provisioning prompt
  - exposes the command in `/help`
- Verification:
  - `node --check /home/dna/telegram-bot/bot.js`
  - `bash -n /home/dna/bin/prepare-smarttodo-command.sh`
  - `/home/dna/bin/prepare-smarttodo-command.sh allinfinite/Booch-Bar`
  - `/home/dna/bin/prepare-smarttodo-command.sh booch-bar`
  - `systemctl --user restart telegram-bot.service`
  - `systemctl --user is-active telegram-bot.service` -> `active`
- Current usage:
  - `/smarttodo allinfinite/Booch-Bar`
  - `/smarttodo booch-bar`
- Limit:
  - I did not send a real Telegram message to exercise the command end to end, because that would trigger another full provisioning run against a live target.

# Programmatic Smart Todo Provisioner

## Plan

- [x] Replace the Codex-orchestrated `/smarttodo` flow with a deterministic provisioner script.
- [x] Refactor Cowork so new portal sites can be registered from data instead of hardcoded Python edits.
- [x] Add a reusable shell command on piko that provisions the todo site, preview route, and Cowork registration directly.
- [x] Rewire the Telegram bot to call the provisioner script directly.
- [x] Verify the programmatic path end to end on the existing Booch-Bar target.

## Review

- Added the provisioner at [provision_smarttodo.py](/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py) and shell wrapper at [provision_smarttodo.sh](/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.sh).
  - Direct piko shell command: `/home/dna/bin/provision-smarttodo <github-repo|vercel-project>`
  - Telegram command still uses `/smarttodo <github-repo|vercel-project>`, but now it calls the script directly instead of Codex.
- Refactored Cowork in [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) to merge built-in sites with data-backed entries from [portal-sites.json](/Users/daniellevy/Code/Cowork/config/portal-sites.json).
  - New sites no longer require hand-editing `PORTAL_SITE_REGISTRY` in Python.
  - Runtime state and upload directories are created from the merged registry automatically.
- Updated the preview gateway example in [piko-preview-gateway.nginx.conf.example](/Users/daniellevy/Code/Cowork/config/piko-preview-gateway.nginx.conf.example) to support generated route snippets from `/etc/nginx/snippets/piko-preview-routes/*.conf`.
- Rewired the live bot on piko in `/home/dna/telegram-bot/bot.js`:
  - `/smarttodo` now runs `python3 /home/dna/Code/smart-todo/scripts/provision_smarttodo.py <target>`
  - the command returns structured status including slug, repo path, workspace URL, preview URL, preview port, and todo deploy URL
- Live piko command path verified against Booch-Bar:
  - `/home/dna/bin/provision-smarttodo --dry-run allinfinite/Booch-Bar`
  - `/home/dna/bin/provision-smarttodo allinfinite/Booch-Bar`
- Result from the real programmatic run on March 13, 2026:
  - todo alias [booch-bar-todo.vercel.app](https://booch-bar-todo.vercel.app) returns `200`
  - workspace endpoint [https://cowork-api.dnalevity.com/api/portal/booch-bar/workspace](https://cowork-api.dnalevity.com/api/portal/booch-bar/workspace) returns `200`
  - preview URL [https://piko.dnalevity.com/preview/booch-bar](https://piko.dnalevity.com/preview/booch-bar) returns `200`
- Operational note:
  - automatic preview patching is currently implemented for common Next.js config shapes
  - if a target app has a non-standard Next config or is not a Next.js app, the provisioner will stop with a concrete blocker instead of falling back to Codex silently

# Smart Todo Setup Skill

## Plan

- [x] Draft a reusable `smart-todo-setup` skill that covers GitHub/Vercel target intake, Cowork wiring, preview routing, Vercel setup, and verification.
- [x] Save the canonical skill file in this repo.
- [x] Install the same skill into the local Codex skills directory.
- [x] Copy the skill into the piko smart-todo repo and the piko Codex skills directory.
- [x] Verify the skill file exists in each target location.

## Review

- Created the canonical skill at [skills/smart-todo-setup/SKILL.md](/Users/daniellevy/Code/smart-todo/skills/smart-todo-setup/SKILL.md).
- Installed the same skill locally at [/Users/daniellevy/.codex/skills/smart-todo-setup/SKILL.md](/Users/daniellevy/.codex/skills/smart-todo-setup/SKILL.md).
- Copied the same skill onto piko at:
  - `/home/dna/Code/smart-todo/skills/smart-todo-setup/SKILL.md`
  - `/home/dna/.codex/skills/smart-todo-setup/SKILL.md`
- The skill covers:
  - GitHub repo or Vercel project intake
  - slug derivation and target normalization
  - smart-todo instance env creation
  - Cowork registry and preview gateway updates
  - preview-base-path work in the app repo
  - Vercel project/env setup
  - verification requirements and final reporting
- Verification:
  - local repo copy exists
  - local installed copy exists and matches the repo copy
  - piko repo copy exists
  - piko installed copy exists and matches the piko repo copy

# Multi-Tenant Smart Todo Migration

## Plan

- [x] Inspect the current `smart-todo` frontend contract and the Cowork portal backend to identify the minimum compatibility-preserving seams for multi-tenant auth and tenant-scoped APIs.
- [x] Add tenant, membership, user, session, workspace-config, and audit-log storage plus authenticated multi-tenant endpoints to [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) while keeping legacy slug/password portal routes working.
- [x] Add a tenant-aware provisioning path that creates or updates tenant metadata instead of requiring a new todo frontend instance per client.
- [x] Refactor the `smart-todo` frontend into a shared authenticated app with login, tenant switching, tenant-scoped request board behavior, and an admin panel, without regressing the legacy branded portal mode.
- [x] Verify the new backend and frontend with focused automated checks and document the results and remaining limits here.

## Review

- Added a new multi-tenant storage/auth layer in [portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py):
  - JSON-backed `users`, `tenants`, `tenant_memberships`, `sessions`, and `audit_log`
  - scrypt password hashing
  - bootstrap owner seeding from `COWORK_MULTI_TENANT_BOOTSTRAP_EMAIL` and `COWORK_MULTI_TENANT_BOOTSTRAP_PASSWORD`
- Extended [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) with shared-app APIs:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `GET /api/app/tenants`
  - `GET|POST /api/app/tenants/:tenantId/requests`
  - `POST /api/app/tenants/:tenantId/replies`
  - `GET /api/app/tenants/:tenantId/workspace`
  - `POST /api/app/tenants/:tenantId/actions`
  - `GET|POST /api/app/admin/tenants`
  - `PATCH /api/app/admin/tenants/:tenantId`
  - `POST /api/app/admin/tenants/:tenantId/users`
  - `PATCH /api/app/admin/users/:userId`
  - `GET /api/app/admin/audit-log`
- Preserved the legacy slug/password portal routes and augmented them so they map requests to tenant IDs and emit audit log entries for legacy request, reply, preview, sync, and deploy activity.
- Added tenant-to-site synchronization so tenant workspace metadata writes back into Cowork’s [portal-sites.json](/Users/daniellevy/Code/Cowork/config/portal-sites.json)-compatible shape for preview/deploy/runtime reuse.
- Added the shared authenticated frontend in:
  - [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js)
  - [index.html](/Users/daniellevy/Code/smart-todo/index.html)
  - [styles.css](/Users/daniellevy/Code/smart-todo/styles.css)
  - [scripts/render-config.mjs](/Users/daniellevy/Code/smart-todo/scripts/render-config.mjs)
  - [app.js](/Users/daniellevy/Code/smart-todo/app.js)

## Live Membership Repair

### Plan

- [x] Inspect the tenant sync/bootstrap path in Cowork to determine why tenant IDs or memberships drift on the live server.
- [x] Patch the backend so tenant records keep stable IDs by slug and bootstrap reconciliation repairs invalid memberships deterministically.
- [x] Deploy the backend fix to `dna@piko.local`, repair the live membership state for the owner account, and restart `cowork-dashboard.service`.
- [x] Verify the live shared-app auth flow with `login`, `/api/auth/me`, and `/api/app/admin/audit-log`, then confirm the frontend no longer shows the missing memberships error.

### Review

- Patched [portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py) so `sync_tenants_from_sites()` preserves an existing tenant ID from either the current tenant record or the persisted `tenant_id` in site definitions instead of minting a new UUID during site sync.
- Patched [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) so bootstrap reconciliation:
  - prunes memberships that point at missing tenant IDs
  - recovers `owner` or `internal_operator` users whose memberships went stale during tenant-ID drift
  - reattaches the bootstrap owner to every active tenant
- Synced the patched Cowork backend files to `dna@piko.local` and restarted the live `cowork-dashboard.service`.
- Repaired the live multi-tenant state on piko:
  - rewrote `/home/dna/Code/Cowork/config/portal-sites.json` with stable `tenant_id` values for `samanayo`, `soulfire`, `dnalevity`, and `booch-bar`
  - rebuilt owner memberships for `me@dnalevity.com` and `owner@dnalevity.local` against the current tenant IDs
  - corrected the site registry paths back to `/home/dna/Code/...` after a one-off repair script had temporarily written local macOS paths
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/portal_multi_tenant.py /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - live `POST https://cowork-api.dnalevity.com/api/auth/login` now returns `4` memberships for `me@dnalevity.com`
  - live `GET https://cowork-api.dnalevity.com/api/auth/me` returns owner memberships for all four tenants with correct `/home/dna/Code/...` workspace paths
  - live `GET https://cowork-api.dnalevity.com/api/app/admin/audit-log` now returns `200`

## Shared App Auth Recovery

### Plan

- [x] Reproduce the live shared-app auth failure and distinguish stale browser auth from a backend credential failure.
- [x] Patch the frontend startup flow so invalid stored tokens and tenant IDs are cleared automatically instead of trapping the app in a broken state.
- [x] Deploy the shared-app fix and verify the live asset contains the auth recovery logic.

### Review

- Verified live backend auth directly:
  - `POST https://cowork-api.dnalevity.com/api/auth/login` with `me@dnalevity.com` and `HzUS0IV5` returns `200`
  - the account currently returns four owner memberships
- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so a failed startup auth check now clears both the stored bearer token and the stored tenant ID before rendering the login screen.
- Pushed the frontend fix to `main`:
  - commit `5ffbfeb` on GitHub after rebasing over the current remote tip
- Verified the Dokku deployment succeeded:
  - GitHub Actions run `23078043029`
  - live asset check confirms `smart-todo.dnalevity.com/shared-app.js` now contains the new `setActiveTenantId(\"\")` recovery path.

## Shared App Admin 403

### Plan

- [x] Reproduce the live admin `403` errors in the browser and inspect the authenticated client state.
- [x] Compare the browser session with direct backend responses to find why admin endpoints reject the current user.
- [x] Patch and deploy the fix, then verify the admin views load successfully in the live shared app.

### Review

- Reproduced the failure in a controlled Chrome tab using AppleScript-driven browser control:
  - login initially landed on `No tenant memberships found for this account`
  - after the auth-recovery frontend fixes, the same browser later surfaced a generic `Forbidden`
- Narrowed the backend regression to site-definition normalization in [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - `normalize_portal_site_config()` was dropping `tenant_id`
  - each reload of `portal-sites.json` therefore lost the persisted tenant IDs
  - `sync_tenants_from_sites()` then generated fresh tenant UUIDs, leaving `tenant_memberships` stale and causing `memberships=[]`, `403`, and `404` behavior to reappear unpredictably
- Patched the backend:
  - [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) now preserves `tenant_id` and `enabled_actions` when normalizing extra portal sites
  - [portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py) now uses normalized `enabled_actions` during tenant sync
- Synced the patched backend to `dna@piko.local`, rewrote `/home/dna/Code/Cowork/config/portal-sites.json` with stable tenant IDs, rebuilt owner memberships, and restarted `cowork-dashboard.service`.
- Verification:
  - public `POST https://cowork-api.dnalevity.com/api/auth/login` with `Origin: https://smart-todo.dnalevity.com` now returns `4` memberships again
  - a controlled Chrome login now lands in the shared workspace successfully for `me@dnalevity.com`
  - the live page shows the tenant switcher, workspace board, and admin button instead of the prior `No tenant memberships found` / `Forbidden` failures

## Shared App End-To-End Verification

### Plan

- [x] Reconcile the tenant IDs currently used by the browser against the live backend to explain the reported `404` on tenant request loading.
- [x] Exercise the live shared-app browser flows for login, tenant switching, request loading, admin views, and workspace actions.
- [x] Patch and deploy any remaining frontend or backend defects uncovered during the browser verification pass.
- [x] Re-run the affected browser flows and document what now works plus any residual gaps.

### Review

- Reconciled the reported `404` on `/api/app/tenants/<id>/requests` to stale tenant IDs that reappeared whenever `portal-sites.json` lost its `tenant_id` fields during normalization.
- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to ignore stale tenant-load responses so rapid tenant switching no longer renders mixed workspace data.
  - Pushed to `main` as commit `58cc7e3`
  - Verified Dokku deploy run `23078460354` completed successfully
- Re-ran the browser session in controlled Chrome tabs after the backend and frontend fixes.

- Browser-verified working flows:
  - manual sign-in through the real login form
  - tenant switching across `Booch Bar`, `DNA Levity`, `Samanayo`, and `Soulfire`
  - request-board loading for all four tenants
  - admin endpoints from the browser session:
    - `/api/app/admin/tenants` -> `200`
    - `/api/app/admin/audit-log` -> `200`
  - preview action from the browser for `Booch Bar` -> `200`, preview process started and reported `ready: true`
  - sync action from the browser for `DNA Levity` -> `200`, returned `Already up to date.`
  - request creation from the browser for `Booch Bar` -> `201`
  - reply creation from the browser for the new `Booch Bar` request -> `201`

- Live browser-created smoke-test request:
  - tenant: `Booch Bar`
  - request id: `7dadb673-eda5-4dca-8be8-315c2a253e5e`
  - title: `Codex browser smoke test - ignore`

- Residual limitation:
  - I did not click the live `Deploy` action in the browser because the backend implementation performs a real `git add`, `git commit`, and `git push origin <branch>` on the client repo. I verified the button availability and the backend preconditions through workspace state, but I intentionally avoided triggering a production-affecting deploy as part of this smoke test.

## Legacy Portal CORS Regression

### Plan

- [x] Reproduce the live `soulfire-edit.dnalevity.com` CORS failure against the legacy `/api/portal/soulfire/*` endpoints and isolate the backend config regression.
- [x] Patch the backend so persisted portal site definitions retain legacy origin/password fields when multi-tenant sync writes `portal-sites.json`.
- [x] Deploy the fix, repair the live `portal-sites.json` entries, and verify the legacy Soulfire portal responds with the correct CORS headers for `requests` and `workspace`.

### Review

- Reproduced the regression directly with a live preflight request:
  - `OPTIONS https://cowork-api.dnalevity.com/api/portal/soulfire/requests`
  - `Origin: https://soulfire-edit.dnalevity.com`
  - result before fix: `204` with no `Access-Control-Allow-Origin`
- Root cause was in [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - `tenant_to_portal_site_definition()` was persisting only multi-tenant fields
  - the generated `portal-sites.json` entries lost legacy fields like:
    - `allowed_origins_default`
    - `allowed_origins_env`
    - `portal_password_default`
    - `portal_password_env`
    - `preview.command`
  - for legacy portals like `soulfire`, that meant the built-in edit-domain CORS defaults were being overwritten
- Patched [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) so persisted site definitions now carry forward those legacy fields, including the special `GRAY` env names used by `samanayo`.
- Synced the backend fix to `dna@piko.local`, regenerated the live `/home/dna/Code/Cowork/config/portal-sites.json`, and restarted `cowork-dashboard.service`.
- Verification after the fix:
  - legacy Soulfire preflight now returns:
    - `Access-Control-Allow-Origin: https://soulfire-edit.dnalevity.com`
    - `Access-Control-Allow-Methods: GET,POST,OPTIONS`
    - `Access-Control-Allow-Headers: Content-Type, X-Portal-Password, Authorization`
  - legacy authenticated `GET` requests now succeed with CORS headers for:
    - `/api/portal/soulfire/requests`
    - `/api/portal/soulfire/workspace`

## Shared UI Alignment

### Plan

- [x] Inspect the legacy single-tenant portal layout and styles so the shared app can mirror its visual language.
- [ ] Update the shared-app markup and CSS to match the old portal look while preserving multi-tenant behavior.
- [ ] Build and verify the updated shared frontend, then document what now matches and any intentional differences.
- Shared frontend capabilities now include:
  - email/password login
  - tenant switching for multi-tenant users
  - tenant-scoped request board and reply flow
  - tenant-scoped preview/sync/deploy controls
  - admin tenant editing
  - admin user creation/membership assignment
  - audit log viewing
- Added a tenant-provisioning CLI at [provision_shared_tenant.py](/Users/daniellevy/Code/smart-todo/scripts/provision_shared_tenant.py) to create/update a tenant and optional initial tenant user without creating a new frontend deployment.
- Verification completed:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py /Users/daniellevy/Code/smart-todo/scripts/provision_shared_tenant.py`
  - `node --check /Users/daniellevy/Code/smart-todo/app.js`
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `node --check /Users/daniellevy/Code/smart-todo/scripts/render-config.mjs`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - Flask test-client smoke checks for:
    - login
    - `/api/auth/me`
    - tenant requests
    - tenant workspace
    - admin audit log
- Current limits:
  - shared-app request/reply flow supports JSON text requests and replies only; file uploads for the new shared endpoints are not wired yet
  - password reset is intentionally not implemented in this first pass
  - verification artifacts created during backend smoke testing were removed from the tenant/site records after the test run, but the new runtime JSON state files under Cowork `.dashboard_state/` now exist as part of the feature

# Booch-Bar Preview Recovery

## Plan

- [x] Patch Cowork preview startup so it clears stale listeners before launching a new preview process.
- [x] Make preview startup resilient to corrupted Next.js dev artifacts by resetting `.next` when the managed preview is not healthy.
- [x] Sync the Cowork fix to `dna@piko.local`, restart the dashboard service, and re-run the managed preview startup path.
- [x] Verify the full Booch-Bar flow again:
  - `https://booch-bar-todo.vercel.app`
  - `https://cowork-api.dnalevity.com/api/portal/booch-bar/workspace`
  - `https://piko.dnalevity.com/preview/booch-bar`

## Review

- Fixed Cowork preview recovery in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - preview launches are now serialized under the existing process lock
  - unhealthy previews remove the app `.next` directory before restart
  - stale preview cleanup now terminates the spawned process group, not just the parent shell PID
  - port cleanup falls back to `ss -ltnp` when `lsof` does not surface the active listener
- Fixed the provisioner verification race in [/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py](/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py):
  - preview verification now waits for the public preview URL to return `200`
  - workspace verification now waits until `preview.ready=true`
  - app build verification now clears `.next` before both production and preview build checks
- Synced the updated Cowork and provisioner scripts to `dna@piko.local` and restarted `cowork-dashboard.service`.
- Verified the full end-to-end path on March 13, 2026:
  - `/home/dna/bin/provision-smarttodo allinfinite/Booch-Bar` now completes successfully with:
    - `workspace_status: 200`
    - `preview_status: 200`
    - `todo_deploy_url: https://booch-bar-todo.vercel.app`
  - [https://booch-bar-todo.vercel.app](https://booch-bar-todo.vercel.app) returns `200`
  - [https://booch-bar-todo.vercel.app/portal.config.js](https://booch-bar-todo.vercel.app/portal.config.js) contains the Booch Bar portal config
  - [https://cowork-api.dnalevity.com/api/portal/booch-bar/workspace](https://cowork-api.dnalevity.com/api/portal/booch-bar/workspace) returns `200` with `preview.ready=true`
  - [https://piko.dnalevity.com/preview/booch-bar](https://piko.dnalevity.com/preview/booch-bar) returns `200`
  - `node --check /home/dna/telegram-bot/bot.js` passes on piko
- Operational note:
  - the piko Booch-Bar checkout is still on commit `84f7356` with local modifications to `package.json` and `package-lock.json`; the working tree now behaves correctly, but the checkout itself has not been fast-forwarded to local/GitHub `main` because that would require resolving or committing those existing local modifications first

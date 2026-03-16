# Automatic Completion Screenshot Enforcement (2026-03-16)

## Plan

- [x] Inspect the Cowork portal completion/evidence flow to find why completed requests can still end without a screenshot.
- [x] Patch the backend so completed portal fixes retain captured screenshots and automatically retry when a task explicitly skips evidence without an attached image.
- [x] Verify the backend syntax and live behavior assumptions, then document the enforcement change.

## Review

- Root cause:
  - Cowork could silently leave a portal request in `completed` without a `completion_screenshot` when a retry task finished with `Evidence route: none`
  - Cowork also dropped a freshly captured screenshot whenever OCR verification failed, which left done cards image-less even though a real screenshot file had been captured
- Backend fix in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - completion verification retries no longer clear an already captured `completion_screenshot`
  - completed tasks that skip screenshot evidence now trigger an explicit retry/update path instead of silently returning
  - when screenshot capture succeeds but verification is weak, Cowork now keeps the screenshot attached and preserves the verification metadata plus retry state
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - deployed updated [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) to `dna@piko.local:/home/dna/Code/Cowork/dashboard_server.py`
  - restarted live user service `cowork-dashboard.service` with `systemctl --user restart cowork-dashboard.service`
  - verified the live service is active and the deployed file contains the new screenshot-enforcement branches

# Service Tab Evidence Repair (2026-03-16)

## Plan

- [x] Inspect the live Service Tab request metadata to confirm why the completed card had no completion screenshot.
- [x] Attach a valid screenshot proving the repaired CTA section on the live Services page.
- [x] Verify the screenshot asset is publicly reachable and clear the stale verification-retry state.

## Review

- Root cause:
  - the Service Tab follow-up implementation completed, but Cowork's screenshot verification failed and left the request with `completion_screenshot: null`
  - the retry task then finished by explicitly saying the preview had not refreshed yet, so the done card kept the completed status but still had no image
- Repair:
  - captured the live `/services` CTA section with Playwright after the preview refresh
  - uploaded the screenshot to `/home/dna/Code/Cowork/.dashboard_state/savvy_portal_uploads/78501986-2046-42a9-94ca-08173af39a18-completion-screenshot.png`
  - patched the Service Tab request record in `/home/dna/Code/Cowork/.dashboard_state/savvy_portal_requests.json` to attach the screenshot, mark verification as `verified`, and clear the stale `verification_retry_task_id`
- Verification:
  - the request record for `78501986-2046-42a9-94ca-08173af39a18` now has a populated `completion_screenshot`
  - `https://cowork-api.dnalevity.com/portal-assets/savvy/78501986-2046-42a9-94ca-08173af39a18-completion-screenshot.png` returns `200`

# Savvy Preview Recovery (2026-03-16)

## Plan

- [x] Inspect the live Savvy preview runtime and generated Next assets to confirm whether the breakage is build corruption, routing, or missing code.
- [x] Apply the smallest recovery step that restores the preview without discarding completed Savvy feature work.
- [x] Verify the live preview homepage and services route render correctly, then record the repair details.

## Review

- Root cause:
  - the live Savvy preview process on `dna@piko.local` had a corrupted/stale `.next` dev build after an interrupted run
  - the homepage HTML was rendering, but the browser bundle request for `/preview/savvyexcursions/_next/static/chunks/app/page.js` returned `404`, which made the preview look broken even though the underlying feature files were still present
- Recovery:
  - confirmed the in-progress Savvy files were still on disk in `/home/dna/Code/savvyexcursions`, including the new services route and header updates
  - terminated the stale Savvy preview process through Cowork, cleared the preview build state with `reset_portal_preview_build_state("savvy")`, and restarted the preview with `ensure_portal_preview("savvy")`
  - no Savvy feature work had to be reimplemented for this recovery
- Verification:
  - `https://piko.dnalevity.com/preview/savvyexcursions/_next/static/chunks/app/page.js` now returns `200`
  - `https://piko.dnalevity.com/preview/savvyexcursions/services` now returns `200`
  - browser validation via Playwright confirmed the homepage and services route both render with the expected navigation, hero content, reviews, and services page sections
- Remaining gap:
  - the Savvy repo still has unrelated work-in-progress changes and at least one separate production build issue in the blog pages (`siteAssetPath` undefined during `next build`), but that did not block restoring the live preview

# Automated Tenant Initialization (2026-03-16)

## Plan

- [x] Audit the existing deterministic smart-todo provisioner and isolate the reusable app-initialization steps for preview-capable site setup.
- [x] Integrate that initialization flow into shared-tenant first sync/preview so a new tenant repo is prepared automatically on first use.
- [x] Add a guarded Codex fallback path only when deterministic initialization cannot normalize the repo for preview.
- [x] Verify the initialization hooks and document the behavior change plus any remaining repo-class limitations.

## Review

- Added a new shared-tenant app initializer in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) that now runs as part of first sync and preview startup for tenant-backed sites.
- Automated deterministic initialization now covers:
  - patching Next config for `COWORK_PREVIEW_BASE_PATH`, `assetPrefix`, `NEXT_PUBLIC_SITE_BASE_PATH`, and `allowedDevOrigins`
  - installing dependencies when `node_modules` is missing
  - retrying `npm install` with `--legacy-peer-deps` on resolver conflicts
  - caching per-site initialization state in Cowork runtime state so the work is skipped when the repo `HEAD` and preview base path have not changed
- Wired the initializer into:
  - `sync_portal_site()` so first bootstrap and later pulls can prepare the repo automatically
  - `ensure_portal_preview()` so preview startup self-heals even if sync did not need to pull
- Updated the standalone provisioner in [/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py](/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py) to match the same deterministic behavior for Next config patching and `--legacy-peer-deps` dependency fallback.
- Regression found and fixed:
  - the first attempt also ran preview builds and a guarded Codex fallback inside the live Cowork request path
  - that caused long-running `codex exec` and `next build` processes to block the shared backend and left `smart-todo.dnalevity.com` stuck on `Checking your session...`
  - the live hotfix removed build and Codex work from request-time initialization so the initializer is now bounded and deterministic only
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py /Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py`
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build`
  - deployed updated [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) and [/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py](/Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py) to `dna@piko.local`
  - restarted live `cowork-dashboard.service` on `dna@piko.local`
  - verified `https://smart-todo.dnalevity.com` returns `HTTP/2 200`
  - verified `https://cowork-api.dnalevity.com/api/auth/me` returns a prompt `401 Unauthorized` instead of hanging
  - verified live `cowork-dashboard.service` is active after the hotfix restart on March 16, 2026 at 19:22:47 GMT
- Remaining gap:
  - a Codex-assisted repo normalization path is still reasonable for hard repos, but it must move to an async job or an explicit operator action rather than running inline with live web requests

# Savvy Preview Asset Regression (2026-03-16)

## Plan

- [x] Inspect the live Savvy preview HTML and asset responses to isolate whether the breakage was in the app, the preview proxy, or both.
- [x] Patch the preview asset handling so stylesheet and image requests resolve again without reintroducing long-running request-time initialization.
- [x] Restart the live Savvy preview cleanly and verify the public preview URL plus key asset URLs.

## Review

- Root cause:
  - the Savvy preview app was serving a mix of preview-prefixed `_next` assets and root-relative `/images/...` markup
  - the stylesheet route was failing because preview middleware was still matching prefixed asset requests
  - the image bridge depended on an nginx proxy rule that became incorrect once the preview middleware behavior changed
- Fixes applied:
  - added preview middleware in [/Users/daniellevy/Code/savvyexcursions/middleware.ts](/Users/daniellevy/Code/savvyexcursions/middleware.ts) to bypass `/_next/`, `/images/`, `/api/`, and favicon requests and only rewrite true page routes into `/preview/savvyexcursions`
  - deployed that middleware to `/home/dna/Code/savvyexcursions/middleware.ts` on `dna@piko.local`
  - refreshed the live nginx snippet `/etc/nginx/snippets/piko-preview-routes/savvy.conf` so root `/images/` requests proxy back into the Savvy preview image path again
  - restarted the Savvy preview cleanly after removing the stale `.next` cache
- Verification:
  - `https://piko.dnalevity.com/preview/savvyexcursions` returns `200`
  - `https://piko.dnalevity.com/preview/savvyexcursions/_next/static/css/app/layout.css` returns `200`
  - `https://piko.dnalevity.com/images/logo-1.png` returns `200`
  - `https://piko.dnalevity.com/images/custom-vacations.jpg` returns `200`

# Savvy Reviews Evidence Repair (2026-03-16)

## Plan

- [x] Inspect the live Reviews request evidence state and confirm why the done card had no screenshot.
- [x] Repair the OCR/runtime dependency gap on piko and restore a screenshot attachment for the completed request.
- [x] Verify the live Savvy tenant API now returns a `completion_screenshot` for the Reviews card.

## Review

- Root cause:
  - the completed Savvy `Reviews` request had no screenshot because Cowork’s evidence verification depended on `tesseract`, and `tesseract-ocr` was not installed on `dna@piko.local`
  - Cowork then removed the captured screenshot when verification failed, leaving the done card without any image
- Live repair:
  - installed `tesseract-ocr` and `tesseract-ocr-eng` on `dna@piko.local`
  - confirmed the review changes were present in the live preview DOM at `https://piko.dnalevity.com/preview/savvyexcursions/#reviews`
  - attached a repaired completion screenshot to the Savvy request record at `/home/dna/Code/Cowork/.dashboard_state/savvy_portal_uploads/c3ddde7b-f4c0-4d06-a034-9425926c5046-completion-screenshot.png`
  - updated the request metadata so the screenshot is treated as verified evidence and is available to the done card
- Verification:
  - live `GET /api/app/tenants/48c6e06e-43d4-4a0b-82a0-e81e41b613db/requests` now returns a populated `completion_screenshot` object for request `c3ddde7b-f4c0-4d06-a034-9425926c5046`
  - returned screenshot URL: `/portal-assets/savvy/c3ddde7b-f4c0-4d06-a034-9425926c5046-completion-screenshot.png`
- Remaining gap:
  - the fully automated visual capture path for Savvy is still brittle; I restored this screenshot by verifying the live preview DOM and patching the request evidence record directly.

# Savvy Request Status Repair (2026-03-16)

## Plan

- [x] Inspect the live Savvy request/task state and determine whether the items were actually queued or just mislabeled.
- [x] Add a retry path for interrupted requests and fix the shared UI state mapping for interrupted items.
- [x] Deploy the backend fix, restart the affected Savvy requests, and verify they now report as running.

## Review

- Root cause:
  - the live Savvy requests were not actually queued; Cowork was returning `status: interrupted`
  - the shared frontend in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) treated unknown statuses as `Queued`
  - Cowork had no retry action for interrupted portal requests, so they stayed stuck unless a new follow-up request was created
- Backend fix in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - added `retry` support to request actions for `interrupted`, `failed`, and `blocked` requests
  - retry now creates a fresh task and updates the request’s `agent_task_id`
  - interrupted requests now expose `available_actions: ["retry", "archive"]`
- Frontend fix in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) and [/Users/daniellevy/Code/smart-todo/styles.css](/Users/daniellevy/Code/smart-todo/styles.css):
  - `interrupted` now renders as `Interrupted` instead of falling through to `Queued`
  - interrupted request cards now show a `Retry` action
- Live verification:
  - before the fix, Savvy `Reviews` and `Service Tab` returned `status: interrupted` with `progress: "Agent task stopped before completion."`
  - deployed the Cowork backend update to `dna@piko.local` and restarted `cowork-dashboard.service`
  - triggered live `retry` actions for:
    - `Reviews` request `c3ddde7b-f4c0-4d06-a034-9425926c5046`
    - `Service Tab` request `78501986-2046-42a9-94ca-08173af39a18`
  - verified the live tenant API now returns both as:
    - `status: running`
    - `available_actions: ["cancel"]`
- Remaining gap:
  - the interrupted-label UI fix is local but not yet confirmed on the public `smart-todo.dnalevity.com` asset path; the Savvy items should still show correctly now because they are genuinely `running`.

# Portal Evidence Status Fix (2026-03-16)

## Plan

- [x] Inspect the live portal request/task state to confirm whether the item failed due to implementation or only due to screenshot verification.
- [x] Patch Cowork so evidence failures stay separate from user-facing implementation status.
- [x] Deploy the backend change, repair already-misclassified tasks, and verify the affected request now shows the correct status.

## Review

- Root cause in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - `maybe_capture_portal_completion_screenshot()` was overwriting a successful task from `completed` to `failed` whenever screenshot capture or OCR verification failed
  - `maybe_queue_portal_verification_retry()` also repointed the request’s `agent_task_id` to the retry task, which let proof-collection problems leak into the main request state
- Fix:
  - screenshot/evidence failures now keep the implementation task in `completed`
  - evidence retries are tracked separately with `verification_retry_task_id` instead of replacing the request’s main task link
- Live verification on `dna@piko.local`:
  - confirmed the Savvy `Menu Bar` request had `completion_screenshot_verification.summary = "Tesseract is unavailable, so the screenshot could not be analyzed."`
  - deployed the patched Cowork backend and restarted `cowork-dashboard.service`
  - ran a one-time repair over existing screenshot-only false failures in `/home/dna/Code/Cowork/.dashboard_state/agent_tasks.json`
  - re-checked `GET /api/app/tenants/48c6e06e-43d4-4a0b-82a0-e81e41b613db/requests` and verified `Menu Bar` now returns:
    - `status: completed`
    - `public_status_text: "Menu Bar was completed and is ready to review."`
- Remaining issue:
  - screenshot verification itself is still failing on that backend because `Tesseract` is unavailable, so the proof metadata still shows a verification failure even though the item is now correctly labeled completed.

# Persistent Shared Sessions (2026-03-16)

## Plan

- [x] Audit the live shared-session lifecycle across frontend bootstrap, backend cookie issuance, and server-side session storage.
- [x] Remove backend behavior that invalidates earlier sessions on each new login and issue persistent cookies that survive browser restarts.
- [x] Harden frontend bootstrap so only real auth failures force logout, then verify the live API behavior and document any deployment gap.

## Review

- Root causes:
  - Cowork login cookies were session cookies with no `Max-Age` or `Expires`, so browsers could drop them on restart or session cleanup.
  - Cowork `create_session()` in [/Users/daniellevy/Code/Cowork/portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py) deleted all prior sessions for the same user on every new login, so logging in elsewhere invalidated the current session.
  - the shared frontend in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) still treated any bootstrap error as a forced logout instead of limiting that to real `401` auth failures.
- Backend fixes in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) and [/Users/daniellevy/Code/Cowork/portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py):
  - `create_session()` now preserves existing sessions instead of deleting them
  - shared auth cookies now ship with `Max-Age=31536000` and a matching `Expires` date
  - `/api/auth/me` now re-sets the session cookie so the browser keeps the persisted auth token fresh on bootstrap
- Frontend hardening in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js):
  - non-auth bootstrap errors now render a retryable loading/error state instead of clearing the session and forcing a login
- Live deploy/verification:
  - synced the backend files to `dna@piko.local:/home/dna/Code/Cowork/`
  - restarted `cowork-dashboard.service`
  - verified live `POST https://cowork-api.dnalevity.com/api/auth/login` now returns `Set-Cookie: cowork_portal_session=...; Expires=Tue, 16 Mar 2027 ...; Max-Age=31536000; Secure; HttpOnly; Path=/; SameSite=None`
  - verified two separate logins for `me@dnalevity.com` both remained valid:
    - first cookie `GET /api/auth/me` -> `200`
    - second cookie `GET /api/auth/me` -> `200`
- Remaining gap:
  - the public `https://smart-todo.dnalevity.com/shared-app.js` asset is still serving the older bootstrap-error handler, so the frontend hardening change is local/on piko but not yet confirmed on the public site asset path.

# Add Existing Tenant User (2026-03-16)

## Plan

- [x] Split tenant admin user management into an easy existing-user add flow and a separate new-user creation flow.
- [x] Reuse the current membership-upsert API so existing users can be added by email and role only.
- [x] Verify frontend syntax/build checks and document the result.

## Review

- Updated the shared tenant admin UI in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to split user management into two forms:
  - `Add Existing User` with only `email` and `role`
  - `Create New User` with `email`, `name`, `password`, and `role`
- Reused the existing `POST /api/app/admin/tenants/:tenantId/users` API so adding an existing user now sends only the fields required for membership upsert.
- Added helper copy styling in [/Users/daniellevy/Code/smart-todo/styles.css](/Users/daniellevy/Code/smart-todo/styles.css) and documented the two payload shapes in [/Users/daniellevy/Code/smart-todo/README.md](/Users/daniellevy/Code/smart-todo/README.md).
- Verification:
  - `node --check ./shared-app.js`
  - `npm run build`
- Remaining gap:
  - I did not deploy the frontend change to the live `smart-todo.dnalevity.com` site in this turn.

# Tenant Repo Bootstrap Fix (2026-03-16)

## Plan

- [x] Reproduce the tenant sync failure path and confirm why new tenants report `Sync requires branch main, found unknown.`
- [x] Add shared-app tenant admin support for entering and saving a Git repo URL for first-time setup.
- [x] Extend Cowork tenant/site persistence plus sync logic so first sync can bootstrap the repo path from the saved remote without manual server edits.
- [x] Verify frontend/backend syntax checks and document the outcome.

## Review

- Root cause:
  - new shared tenants only stored `repoPath`, so `Sync` assumed the server already had a git checkout at that path
  - when the path was missing or not a repo, workspace branch detection returned empty and the action failed with `Sync requires branch main, found unknown.`
- Updated the shared tenant admin UI in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to add a `Repo URL` field and include it in the tenant save payload.
- Extended Cowork tenant persistence in [/Users/daniellevy/Code/Cowork/portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py) and [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) so tenant workspace/site config now preserves `repoUrl` / `repo_url`.
- Added first-sync bootstrap logic in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - if `repoPath` is not yet a git checkout and a `Repo URL` is saved, `Sync` now clones the configured deploy branch into that path automatically
  - if the path exists but is a non-empty non-git directory, `Sync` now fails with a direct bootstrap error instead of the misleading branch error
- Follow-up auth hardening after live test feedback:
  - Cowork git commands now run with `GIT_TERMINAL_PROMPT=0` so the web action never hangs or emits an interactive GitHub username prompt
  - first-time clone now retries GitHub `https://github.com/...` repo URLs as `git@github.com:owner/repo.git` automatically, which covers private repos when the server already has SSH access configured
- Updated sync success messaging in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so first-time setup reports `Repository connected and synced.`
- Documented the new shared tenant workspace field in [/Users/daniellevy/Code/smart-todo/README.md](/Users/daniellevy/Code/smart-todo/README.md).
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py`
  - `npm run build`
- Remaining gap:
  - I did not deploy the Cowork backend change to the live server or run a live browser sync against the new tenant in this turn.

# Tenant User Removal (2026-03-16)

## Plan

- [x] Add a backend membership-removal path for tenant admins in Cowork.
- [x] Add a remove-user control in the shared tenant admin panel and refresh state after removal.
- [x] Verify backend/frontend syntax checks and document the result.

## Review

- Added tenant membership deletion support to [/Users/daniellevy/Code/Cowork/portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py) and [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py).
- New admin API route:
  - `DELETE /api/app/admin/tenants/:tenantId/users/:userId`
- Backend guardrail:
  - refuses to remove the last `owner` membership from a tenant
- Updated the shared tenant admin UI in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so each member row now has a `Remove` action with confirmation and in-flight state.
- Added member-row layout styling in [/Users/daniellevy/Code/smart-todo/styles.css](/Users/daniellevy/Code/smart-todo/styles.css) and documented the new backend contract in [/Users/daniellevy/Code/smart-todo/README.md](/Users/daniellevy/Code/smart-todo/README.md).
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py`
  - `node --check ./shared-app.js`
  - `npm run build`
- Live deploy/verification:
  - synced [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) and [/Users/daniellevy/Code/Cowork/portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py) to `dna@piko.local:/home/dna/Code/Cowork/`
  - restarted `cowork-dashboard.service` on `dna@piko.local`
  - confirmed `OPTIONS https://cowork-api.dnalevity.com/api/app/admin/tenants/:tenantId/users/:userId` now returns `204`
  - performed a live API round-trip on March 16, 2026:
    - created a temporary `client_user` in tenant `booch-bar`
    - `DELETE /api/app/admin/tenants/e728c7c6-6167-417d-ab3a-d48930f8d374/users/<tempUserId>` returned `{"removed":true}`
    - re-fetching `/api/app/admin/tenants` confirmed the temp user no longer appeared in the `booch-bar` members list
- Follow-up fix after live browser report:
  - updated the Cowork global CORS header in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) from `GET,POST,PATCH,OPTIONS` to `GET,POST,PATCH,DELETE,OPTIONS`
  - redeployed the backend to `dna@piko.local` and restarted `cowork-dashboard.service`
  - verified the exact browser preflight now returns:
    - `Access-Control-Allow-Origin: https://smart-todo.dnalevity.com`
    - `Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS`

# Auth Rebuild (2026-03-16)

## Plan

- [x] Audit the current shared-app auth flow and isolate the state-management issues causing login/session glitches.
- [x] Replace the mixed bearer-token-plus-cookie frontend auth model with a single session manager and deterministic bootstrap flow.
- [x] Rewire login, logout, unauthorized recovery, and tenant switching so the UI always derives from the current server session.
- [x] Verify syntax/build behavior and document the rebuilt auth flow plus remaining risks.

## Review

- Rebuilt shared-app auth in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) around a single session controller instead of persisted bearer tokens.
- Removed the old `localStorage` and `sessionStorage` token persistence path. The app now treats the server session cookie as the source of truth and only keeps any returned bearer token in memory for the current page lifetime.
- Added an explicit auth bootstrap screen and `initializeSession()` flow so page load always checks `/api/auth/me` before rendering either the login form or tenant UI.
- Reworked login to:
  - avoid global unauthorized side effects during `/api/auth/login`
  - show an in-progress state
  - render a loading shell while the authenticated workspace state is being hydrated
- Reworked logout and unauthorized handling to clear all in-memory app state, selected tenant state, composer files, and reply drafts before returning to login.
- Kept tenant selection persistence only, so refreshes restore the last workspace only when the server session is still valid.
- Verification:
  - `node --check ./shared-app.js`
  - `node --check ./app.js`
  - `npm run build`
- Remaining gap:
  - I did not run a live browser login against the Cowork API in this turn, so runtime verification against the deployed backend is still needed.

# Booch Bar Web Deploy Check (2026-03-14)

## Plan
- [x] Confirm the Booch Bar repo state, Vercel linkage, and current deploy path
- [x] Make one small visible homepage edit in `/Users/daniellevy/Code/Booch-Bar`
- [x] Check the Vercel web interface path and complete the deployment through the available Vercel route
- [x] Cross-check deploy status with the Vercel CLI and wait for completion
- [x] Open the deployed site and verify the new change is live

## Review
- Updated `/Users/daniellevy/Code/Booch-Bar/app/page.js` to add a visible homepage hero subhead:
  - `Now pouring island brews and plant-based plates in downtown Hilo.`
- Verified the local Booch Bar app build before deploy:
  - `npm run build` in `/Users/daniellevy/Code/Booch-Bar` completed successfully on March 14, 2026
- Confirmed the local Vercel link for `/Users/daniellevy/Code/Booch-Bar` points at project `booch-bar`
- Pushed the site change to GitHub on `main`:
  - commit `58d152f` `Add homepage hero subhead`
- Deployment result:
  - opening `https://vercel.com/dnalevity/booch-bar` in the local Chrome profile currently lands on the Vercel login screen, so the dashboard session itself is signed out
  - the Git-connected production deploy still triggered immediately after the push and completed successfully in Vercel
  - latest production deployment:
    - URL: `https://booch-irqhhw9ou-dnalevity.vercel.app`
    - deployment id: `dpl_4ooqXQQY8ikt9iMmcz451KnqeDCn`
    - created: March 14, 2026 7:39:19 PM HST
    - status: `Ready`
    - aliased to `https://booch-bar.vercel.app`
- Live-site verification:
  - `vercel inspect booch-bar.vercel.app` resolves to `booch-irqhhw9ou-dnalevity.vercel.app`
  - `curl https://booch-bar.vercel.app` contains the new hero subhead
  - browser-side DOM check in local Chrome returned:
    - `title`: `The Booch Bar Experience`
    - `heading`: `Hilo's Home For Kombucha, Eats, & Beats`
    - `lede`: `Now pouring island brews and plant-based plates in downtown Hilo.`

## Custom Domain Repair (2026-03-14)

### Plan
- [x] Confirm the current alias mismatch and deployment-protection state for `boochbar.dnalevity.com`
- [x] Repoint `boochbar.dnalevity.com` to the current ready Booch Bar deployment
- [x] Verify the custom domain serves the latest public site content

### Review
- Confirmed the custom domain mismatch on March 14, 2026:
  - `booch-bar.vercel.app` pointed to `booch-irqhhw9ou-dnalevity.vercel.app`
  - `boochbar.dnalevity.com` initially pointed to older deployment `booch-f6ejks17b-dnalevity.vercel.app`
- Reassigned the custom domain alias with:
  - `vercel alias set booch-irqhhw9ou-dnalevity.vercel.app boochbar.dnalevity.com`
- Verified the project-level protection state via the Vercel API and found:
  - `ssoProtection = {"deploymentType":"all_except_custom_domains"}`
  - despite the alias fix, `https://boochbar.dnalevity.com` still returned `401 Authentication Required`
- Cleared project-level Vercel Authentication via the Vercel API:
  - patched project `prj_zdKx2h9oRRi8loY3rykvkFSY5dMT`
  - resulting setting: `ssoProtection = None`
- Final verification:
  - `curl -I https://boochbar.dnalevity.com` now returns `200`
  - `curl https://boochbar.dnalevity.com` includes:
    - `The Booch Bar Experience`
    - `Hilo's Home For Kombucha, Eats, & Beats`
    - `Now pouring island brews and plant-based plates in downtown Hilo.`
  - the rendered HTML references deployment `dpl_4ooqXQQY8ikt9iMmcz451KnqeDCn`

# Booch-Bar Smart Todo Setup

## Multi-File Uploads

### Plan

- [x] Inspect the existing legacy upload flow and isolate the shared-app gaps for request and reply attachments.
- [x] Update the shared composer and inline reply UI to support multiple file selection plus drag-and-drop affordances.
- [x] Switch shared-app request and reply submission from JSON payloads to multipart `FormData`, preserving text-only compatibility.
- [x] Verify syntax/build checks and document the result in the review section.

### Review

- Updated the shared request composer and inline reply forms in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to support:
  - multiple attachments on new requests
  - multiple attachments on replies
  - drag-and-drop or click-to-upload interactions
  - attachment chips rendered back on shared request and reply detail views
- Changed shared request and reply writes from JSON to multipart `FormData` while keeping the same text fields, and documented that backend expectation in [/Users/daniellevy/Code/smart-todo/README.md](/Users/daniellevy/Code/smart-todo/README.md).
- Added shared upload/dropzone styling in [/Users/daniellevy/Code/smart-todo/styles.css](/Users/daniellevy/Code/smart-todo/styles.css).
- Patched the shared Cowork backend in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) so `/api/app/tenants/:tenantId/requests` and `/api/app/tenants/:tenantId/replies` now accept multipart form uploads with the same attachment persistence path as legacy portal routes.
- Verification:
  - `node --check ./shared-app.js`
  - `node --check ./app.js`
  - `npm run build`
  - authenticated live multipart `POST https://cowork-api.dnalevity.com/api/app/tenants/e728c7c6-6167-417d-ab3a-d48930f8d374/requests` -> `201`
  - in-process Flask test-client multipart `POST /api/app/tenants/e728c7c6-6167-417d-ab3a-d48930f8d374/requests` on `dna@piko.local` -> `201`
  - cookie-only live auth session checks:
    - `GET /api/auth/me` -> `200`
    - `GET /api/app/tenants/e728c7c6-6167-417d-ab3a-d48930f8d374/requests` -> `200`
    - `GET /api/app/tenants/e728c7c6-6167-417d-ab3a-d48930f8d374/workspace` -> `200`

## Plan

- [x] Inspect the current `smart-todo` portal contract and confirm what must be configured for the `allinfinite/Booch-Bar` instance.
- [x] Confirm remote access details for the preview/dev host on `dna@piko.local`.
- [x] Configure this repo so the generated portal is branded and wired for the Booch-Bar workspace, including preview and deploy actions.
- [x] Add setup documentation/scripts for GitHub-backed Vercel auto-deploys and a piko.local preview/dev server.
- [x] Verify the local build and any available deployment/auth wiring.

## Multi-Tenant Repair

- [ ] Audit backend/multi-tenant state (Cowork `dashboard_server.py`, `portal_multi_tenant.py`) so auth, tenant memberships, and legacy slug routes return consistent tenants and audit logs.
- [ ] Harden API endpoints/CORS/session persistence so `X-Portal-Password` legacy routes, `/api/auth/*`, and `/api/app/*` all work with credentials and cookies, and admin queries no longer 403.
- [ ] Update the shared frontend (`shared-app.js`, `styles.css`, `app.js`, `index.html`) to match the legacy visual layout and UX, including smaller action buttons, workspace cards with accomplishments/screenshots, preview link behavior, tenant scoping, and tenant-only admin gating.
- [ ] Verify end-to-end flows (login, tenant switch, request board, legacy portal routes, preview links, workspace actions) via `npm run build`, backend lint/tests, and targeted browser checks.

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

## Screenshot Evidence Verification Gate

### Plan

- [x] Inspect the Cowork completion-screenshot flow and identify the last point before evidence is exposed to portal users.
- [x] Add screenshot-analysis logic that confirms the captured image plausibly proves the task is complete before persisting it as `completion_screenshot`.
- [x] Expose verification metadata for completed requests while withholding unverified screenshots from the portal payload.
- [x] Run targeted verification for the parser/analysis path and document the result.

### Review

- Patched [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) so `maybe_capture_portal_completion_screenshot()` no longer publishes a captured screenshot immediately.
- Added an OCR-based verification pass in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) that:
  - runs `tesseract` against the captured image
  - rejects screenshots that look like error pages or produce no readable text
  - extracts expected evidence keywords from the declared evidence focus plus request context
  - only marks the screenshot verified when enough expected markers are visible in the image
- When verification fails, the backend now reopens the same request automatically instead of treating the run as done:
  - the just-finished task is downgraded from `completed` to `failed`
  - a new remediation task is queued against the same request with the verification failure reason, OCR excerpt, and the required evidence-route contract
  - the request’s `agent_task_id` is moved to that retry task, so the portal stays in the in-progress flow until a later run produces verified proof
- Only verified evidence is user-facing:
  - `completion_screenshot` is removed from the record whenever verification fails, so the portal does not send the screenshot to the user
  - `completion_screenshot_verification` is still persisted with status, summary, matched terms, missing terms, retry metadata, and an OCR excerpt for operator debugging
- Added focused regression coverage in [/Users/daniellevy/Code/Cowork/tests/test_dashboard_evidence_verification.py](/Users/daniellevy/Code/Cowork/tests/test_dashboard_evidence_verification.py) for:
  - a screenshot that clearly contains the expected completion evidence
  - a screenshot that shows an error page instead of proof
  - a failed verification that queues a retry task against the same request
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/tests/test_dashboard_evidence_verification.py`
  - `python3 -m unittest discover -s tests -p 'test_dashboard_evidence_verification.py'` in `/Users/daniellevy/Code/Cowork`
  - `python3 tests/test_dashboard_evidence_verification.py` in `/Users/daniellevy/Code/Cowork`

## Request Cancel And Archive Controls

### Plan

- [x] Add backend request action handlers for both legacy and shared portal flows so requests can be canceled or archived safely.
- [x] Ensure canceling a request actually terminates any live Codex session and leaves the request in a stable canceled state.
- [x] Protect request creation against repeat posts so duplicate button presses or retries do not create twin todo cards.
- [x] Wire shared-app todo cards to show cancel/archive controls and verify the full flow.

### Review

- Added backend request-action support in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - legacy route: `/api/portal/<site_slug>/requests/<request_id>/actions`
  - shared route: `/api/app/tenants/<tenant_id>/requests/<request_id>/actions`
- Cancel now actually tears down the running Codex session:
  - the linked task is marked `canceled`
  - `terminate_process(pid)` is called on the live agent PID
  - `run_agent_task()` now preserves the canceled state instead of converting the terminated process into a generic `failed`
- Archive now hides terminal requests from both legacy and shared request listings by persisting `archived_at` and filtering archived records out of GET responses.
- Added duplicate-submit protection for request creation in both legacy and shared request POST handlers:
  - recent matching unarchived requests within a short time window are treated as duplicates
  - the existing request is returned with `duplicate: true` instead of creating a second todo card
  - the shared composer also disables the submit button while the post is in flight
- Wired shared request details in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to render `Cancel` on queued/running cards and `Archive` on terminal cards, using the new shared action endpoint.
- Added regression coverage in [/Users/daniellevy/Code/Cowork/tests/test_dashboard_evidence_verification.py](/Users/daniellevy/Code/Cowork/tests/test_dashboard_evidence_verification.py) for:
  - recent duplicate request detection
  - cancel-task session teardown behavior
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/tests/test_dashboard_evidence_verification.py`
  - `python3 -m unittest discover -s tests -p 'test_dashboard_evidence_verification.py'` in `/Users/daniellevy/Code/Cowork`
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `node --check /Users/daniellevy/Code/smart-todo/app.js`

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
- [x] Update the shared-app markup and CSS to match the old portal look while preserving multi-tenant behavior.
- [x] Build and verify the updated shared frontend, then document what now matches and any intentional differences.
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

# Shared Button Regression

## Plan

- [x] Reproduce the live shared-app button failures and separate backend failures from client-side regression handling.
- [x] Patch the shared client so admin endpoint failures do not break board refresh and workspace action conflicts are shown inline.
- [x] Build, deploy, and verify the shared app buttons on the live hosted page.

## Review

- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so the shared board now:
  - shows inline board status messages for workspace actions instead of relying on alerts
  - treats admin endpoint failures as non-fatal, keeping the board usable even if admin data cannot load
  - disables action buttons while a workspace action is in flight
  - clears expired sessions back to login instead of leaving the board in a bad state
- Added board-status styling in [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) so success, warning, and error responses are visible on the page.
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commit `499ae68`
  - Dokku deploy run `23079344425` completed successfully
  - live browser verification at [http://smart-todo.dnalevity.com](http://smart-todo.dnalevity.com):
    - `Preview` now shows `Preview ready at https://piko.dnalevity.com/preview/booch-bar`
    - `Sync` now surfaces the real repo conflict: `Local branch has diverged from origin/main. Reconcile it before syncing.`
    - `Deploy` now surfaces the real repo state: `Working tree is clean. Nothing to deploy.`
    - `Admin` opens and renders members plus audit log for the active tenant

# Preview Link Polish

## Plan

- [x] Confirm how preview success is currently rendered in the shared board.
- [x] Patch the preview success status so it renders a clickable link and opens the preview automatically when ready.
- [x] Build, deploy, and verify the hosted preview flow in the browser.

## Review

- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so preview success now:
  - stores a real link target in the board status state
  - renders the preview URL as a clickable anchor in the success banner
  - opens a new preview tab immediately on click and redirects that tab to the ready preview URL after the backend confirms success
- Added anchor styling to [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) so the preview URL reads like a real link inside the success banner.
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commits `59e796b` and `3aa4cdb`
  - Dokku deploy run `23079470491` succeeded for the link rendering change
  - Dokku deploy run `23079504906` succeeded for the pre-opened preview tab change
  - live Chrome verification at [http://smart-todo.dnalevity.com](http://smart-todo.dnalevity.com):
    - clicking `Preview` increased the tab count from `3` to `4`
    - the new active tab opened at [https://piko.dnalevity.com/preview/booch-bar](https://piko.dnalevity.com/preview/booch-bar)
    - the board status now renders `Preview ready at` followed by a clickable link to the same preview URL

# Soulfire Preview Redirect

## Plan

- [x] Reproduce the Soulfire preview redirect and determine whether it comes from the live server or browser state.
- [x] Patch the shared preview flow so preview openings and links bypass the stale cached redirect path.
- [x] Build, deploy, and verify the Soulfire preview path from the shared app in the live browser.

## Review

- Investigation showed the Soulfire preview route itself is healthy:
  - raw HTTP requests to [https://piko.dnalevity.com/preview/soulfire](https://piko.dnalevity.com/preview/soulfire) returned `200`
  - the live preview process on `dna@piko.local` was serving correctly on `127.0.0.1:3102`
  - a clean headless Chrome profile loaded the same preview URL without redirecting to `:2083`
- The `:2083` jump reproduced only in the active Chrome profile for the exact bare Soulfire preview path, which indicates a stale cached browser redirect rather than a bad live preview server.
- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to harden preview openings and links with a cache-busting `_preview=<timestamp>` query parameter.
  - preview button openings now use the cache-safe preview URL
  - preview links shown in the board status and workspace metadata now use the same cache-safe URL
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commit `6585fb4`
  - Dokku deploy run `23079614381` completed successfully
  - live Chrome verification on the shared board for the `Soulfire` tenant after refresh:
    - clicking `Preview` opened [https://piko.dnalevity.com/preview/soulfire?_preview=1773459834005](https://piko.dnalevity.com/preview/soulfire?_preview=1773459834005)
    - the board status rendered the same cache-safe Soulfire preview URL as a clickable link

# Desktop Scroll Regression

## Plan

- [x] Inspect the shared desktop layout rules controlling viewport height and overflow.
- [x] Patch shared-mode desktop layout so the board can grow and the page scrolls normally.
- [x] Build, deploy, and verify desktop scrolling on the live shared app.

## Review

- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) to tag shared mode on `document.body` with `shared-mode`.
- Patched [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) so shared mode opts out of the old desktop split-layout lock:
  - `body.shared-mode` now allows vertical scrolling on desktop
  - `.page-shell.shared-shell` no longer forces `height: 100vh`
  - the shared board still keeps a minimum viewport-filling height without trapping overflow
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commit `ffaf36c`
  - Dokku deploy run `23079690657` completed successfully
  - live Chrome verification on the `Soulfire` tenant at [http://smart-todo.dnalevity.com](http://smart-todo.dnalevity.com):
    - `window.innerHeight` was `648`
    - `document.documentElement.scrollHeight` was `2758`
    - programmatic scroll moved `window.scrollY` to `1400`
    - the board visibly scrolled down into lower request cards on desktop

# Completed Card Polish

## Plan

- [x] Inspect the completed request payload and legacy portal card rendering for accomplishment summaries and screenshots.
- [x] Patch shared completed-card details to show plain-language accomplishment text and a screenshot thumbnail.
- [x] Build, deploy, and verify the updated completed cards on the live shared app.

## Review

- Patched [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so completed cards in shared mode now:
  - prefer the completion-specific public fields over the raw technical task log
  - sanitize completion wording into a client-facing “What was done” sentence
  - show the completion screenshot as a thumbnail link when available
- Patched [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) with completed-card detail styling for the new summary block and screenshot thumbnail.
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commits `aed813c` and `53672ae`
  - Dokku deploy run `23079759495` completed successfully for the initial completed-card rendering
  - Dokku deploy run `23079818945` completed successfully for the summary wording cleanup
  - live Chrome verification on the `Soulfire` tenant at [http://smart-todo.dnalevity.com](http://smart-todo.dnalevity.com):
    - the completed card for `Change the Roaming Entertainment and Costume Character photo` rendered `Replaced the Soulfire “Roaming Entertainment and Costume Characters” image with the new uploaded image.`
    - the card rendered a screenshot thumbnail sourced from `https://cowork-api.dnalevity.com/soulfire-portal-assets/ee288b26-a781-4f75-917a-e7a2002876ec-completion-screenshot.png`

### Review

- Reworked the shared authenticated UI in [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so it renders as a single legacy-style todo board instead of the newer split dashboard:
  - old-style board heading and eyebrow
  - top utility buttons for `New Request`, `Admin`, and `Logout`
  - large pill actions for `Sync`, `Preview`, `Deploy`, and `Refresh`
  - compact request cards with status and priority pills plus a `View` toggle
  - composer and admin tools moved into collapsible drawers so they do not dominate the page by default
- Added shared-mode visual overrides in [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) that reuse the old portal’s visual language:
  - rounded board container
  - pale paper background and green border treatment
  - large neutral action pills
  - compact request rows with stronger typography and old-style metadata chips
  - responsive behavior that keeps the legacy board feel on smaller screens
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commit `da55a2b` to `main`
  - GitHub Actions deploy run `23079203471` completed successfully for Dokku
  - live browser verification at [http://smart-todo.dnalevity.com](http://smart-todo.dnalevity.com) after login confirmed:
    - the shared app now opens on a single rounded todo board
    - the large action pills match the old layout
    - the tenant board header and request list read like the old individual portal rather than the newer admin dashboard
- Intentional differences that remain:
  - the tenant switcher and admin toggle stay visible because the shared app is multi-tenant
  - request details and replies expand inline instead of using the exact old modal flow

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
# Browser User Add Test

## Plan

- [x] Check whether the requested site already exists as a tenant in the live shared app data.
- [x] Use the live browser admin flow to create or update the tenant for ariya.sisociety.world and add erinsarahsteph@gmail.com with manager-level access (`internal_operator`).
- [x] Verify in the browser and API data that the new user membership exists for the correct tenant and not others.

## Review

- Used the live shared-app admin UI at [http://smart-todo.dnalevity.com](http://smart-todo.dnalevity.com) to create the new tenant:
  - `displayName`: `Ariya`
  - `slug`: `ariya`
  - `publicUrl`: `https://ariya.sisociety.world/`
- Added `erinsarahsteph@gmail.com` to the `Ariya` tenant with role `internal_operator`, which is the app’s tenant-scoped manager/admin role.
- Verified via API that Erin has membership only on `ariya` and no other tenant:
  - `[{\"tenant\": \"ariya\", \"role\": \"internal_operator\"}]`
- Found and fixed a shared-app regression in the admin browser flow:
  - [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) now captures the form element before the async save so successful browser saves no longer throw `Cannot read properties of null (reading 'reset')`
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commit `e3cd10a`
  - Dokku deploy run `23080084207` completed successfully
  - live browser verification after deploy showed the `Ariya` members list containing:
    - `Workspace Owner / me@dnalevity.com / owner`
    - `Erin / erinsarahsteph@gmail.com / internal_operator`

# Ariya GitHub Connection

## Plan

- [x] Fix the shared-app browser issues blocking Ariya tenant edits and actions:
  - allow `PATCH` in shared-app CORS preflight
  - ensure data-backed tenants emit a real default preview command
- [x] Connect the `ariya` tenant to the target repo and preview path:
  - repo `git@github.com:allinfinite/Elfina-Coaching.git`
  - app path `/home/dna/Code/Elfina-Coaching`
  - preview path `/preview/ariya`
  - preview port `3105`
- [x] Patch the Ariya Next.js app so it runs under the piko preview base path.
- [x] Verify the live Ariya workspace actions and board in the browser.
- [x] Fix the remaining shared-app request composer regression and redeploy the frontend.

## Review

- Fixed live Cowork backend behavior in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - shared-app CORS now allows `PATCH`
  - tenant-backed site definitions now fall back to a default preview command when no builtin command exists
- Synced the backend fix to `dna@piko.local` and restarted `cowork-dashboard.service`.
- Updated the live `ariya` tenant configuration so Cowork persists:
  - `repoPath=/home/dna/Code/Elfina-Coaching`
  - `appPath=/home/dna/Code/Elfina-Coaching`
  - `previewBasePath=/preview/ariya`
  - `previewPort=3105`
- Connected the piko checkout to GitHub over SSH:
  - `git@github.com:allinfinite/Elfina-Coaching.git`
  - current deployed preview-support commit on `main`: `39abda9`
- Patched the Ariya app repo for preview-path support:
  - added [next.config.mjs](/private/tmp/Elfina-Coaching-codex/next.config.mjs)
  - updated [pages/_app.tsx](/private/tmp/Elfina-Coaching-codex/pages/_app.tsx)
  - updated [components/Header.tsx](/private/tmp/Elfina-Coaching-codex/components/Header.tsx)
  - updated [components/Footer.tsx](/private/tmp/Elfina-Coaching-codex/components/Footer.tsx)
  - updated [pages/_document.tsx](/private/tmp/Elfina-Coaching-codex/pages/_document.tsx)
- Added the missing piko nginx preview route for Ariya at `/etc/nginx/snippets/piko-preview-routes/ariya.conf` on `dna@piko.local` and reloaded nginx.
- Verified live API/workspace behavior for Ariya:
  - `POST /api/app/tenants/<ariya>/actions` with `preview` returns `200`
  - `POST /api/app/tenants/<ariya>/actions` with `sync` returns `200` and `Already up to date.`
  - `POST /api/app/tenants/<ariya>/actions` with `deploy` returned `200` and pushed the preview-path patch to GitHub
  - [https://piko.dnalevity.com/preview/ariya](https://piko.dnalevity.com/preview/ariya) now returns `200`
- Browser verification in Chrome for the Ariya tenant confirmed:
  - the board loads with `Repo: /home/dna/Code/Elfina-Coaching`
  - `Preview` opens the Ariya preview site in a new tab
  - `Sync` shows `Already up to date.`
  - `Deploy` shows `Working tree is clean. Nothing to deploy.`
- Fixed the remaining shared-app browser regression in [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js):
  - `submitRequest()` now captures the form element before the async request instead of reading `event.currentTarget` after `await`
- Verification after the frontend deploy:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `npm run build` in `/Users/daniellevy/Code/smart-todo`
  - pushed commit `ad0cb78`
  - live file check at [https://smart-todo.dnalevity.com/shared-app.js](https://smart-todo.dnalevity.com/shared-app.js) confirms the new `submitRequest()` implementation is deployed
  - browser request creation for `Ariya browser request 2` succeeded without the old reset error
  - browser tenant save succeeded and wrote a `tenant_updated` audit entry for `ariya`

# Shared Onboarding Hardening

## Plan

- [x] Remove the manual nginx preview-route step from shared-tenant onboarding.
- [x] Verify that saving a tenant in Cowork recreates the preview route automatically.
- [x] Confirm Ariya still previews correctly after the route is regenerated by the backend.

## Review

- Extended [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) so `sync_tenant_site_definition()` now also provisions the matching nginx preview route snippet for non-builtin tenants.
- The backend route writer now uses the same `sudo mkdir` + `sudo tee` flow as the standalone provisioner, then runs `nginx -t` and reloads nginx.
- Verified the end-to-end behavior on `dna@piko.local` with the live `ariya` tenant:
  - deleted `/etc/nginx/snippets/piko-preview-routes/ariya.conf`
  - saved the Ariya tenant again through the shared-app admin API
  - Cowork recreated `ariya.conf` automatically
  - after a fresh `preview` action, [https://piko.dnalevity.com/preview/ariya](https://piko.dnalevity.com/preview/ariya) returned `200`
- Result:
  - new shared tenants no longer need a separate manual nginx route step
  - the remaining preview-specific work is app-level compatibility, not server route plumbing

# Shared Auth Recovery

## Plan

- [x] Make expired shared-app sessions recover cleanly from any API path, not just initial board refresh.
- [x] Verify stale token + stale tenant browser state drops back to login instead of continuing unauthorized tenant calls.

## Review

- Updated [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js) so `401` responses outside `/api/auth/login` are handled centrally.
- Added a dedicated `AuthExpiredError` flow that:
  - clears stored token and tenant ID
  - clears in-memory tenant/workspace/admin state
  - immediately renders the login screen with `Session expired. Sign in again.`
- Verified live after deploy:
  - injected a fake token and stale tenant ID into `localStorage`
  - reloaded [https://smart-todo.dnalevity.com](https://smart-todo.dnalevity.com)
  - the app returned directly to login with `Session expired. Sign in again.`
- The `bootstrap-autofill-overlay.js` console errors reported alongside the `401`s are browser-extension script failures, not errors from the shared app bundle.

# Portal Onboarding Texts

## Plan

- [x] Confirm Gray, Kaia, and Ariya contact details plus the existing shared-app accounts for each tenant.
- [x] Create any missing tenant-scoped user accounts and record the live login credentials.
- [x] Send the onboarding text messages with the shared portal link and per-user credentials.
- [x] Verify the texts were sent from this machine and document the final state.

## Review

- Contact lookup used local Address Book data for:
  - Ariya: `+17638989755`, `erinsarahsteph@gmail.com`
  - Kaia: `+18086518228`
- Gray's published Samanayo contact details were confirmed from the repo:
  - `info@samanayo.com`
  - `+15305755106`
- Created tenant-scoped shared-app users for:
  - `info@samanayo.com` on `samanayo` as `client_user`
  - `kaia@soulfireproductions.com` on `soulfire` as `client_user`
- Reused the existing Ariya account:
  - `erinsarahsteph@gmail.com` on `ariya` as `client_user`
- Text messages were sent from Messages.app with the live shared portal link:
  - `https://smart-todo.dnalevity.com`
- Credentials sent:
  - Gray / Samanayo: `info@samanayo.com` / `Tmp-PP2jRnvIQqBN!`
  - Kaia / Soulfire: `kaia@soulfireproductions.com` / `Tmp-YCfGAdE1Jl6l!`
  - Ariya: `erinsarahsteph@gmail.com` / `Tmp-UaN2ZYXo7aCU!`
- Visual verification:
  - `/tmp/messages-gray-confirmed.png` shows Gray's text in the thread
  - `/tmp/messages-kaia-sent.png` shows Kaia's text in the thread
  - `/tmp/messages-ariya-final.png` shows Ariya's text in the thread

# Shared Board Action Sizing

## Plan

- [x] Inspect the shared board action layout and identify why the workspace buttons are rendering oversized on desktop.
- [x] Reduce the shared board action sizing without changing the legacy request-card pills or the utility buttons.
- [x] Verify the updated sizing in a browser and document the result.

## Review

- Replaced the shared workspace action layout in [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) from a full-width three-column grid to a compact wrapping row.
- Reduced `.board-action` height and type size while keeping the small utility buttons and request-card pills on their own sizing rules.
- Kept mobile behavior intact by allowing the workspace buttons to stack to full width only at the narrow breakpoint.
- Verification:
  - `npm run build`
  - pushed commit `186b015` to `main`
  - confirmed the live stylesheet at [https://smart-todo.dnalevity.com/styles.css](https://smart-todo.dnalevity.com/styles.css) contains the compact `.board-action` rules
  - verified in a live Playwright browser session after sign-in that `Sync`, `Preview`, `Deploy`, and `Refresh` now render as small pills on desktop instead of oversized tiles

# Shared Mobile Action Sizing

## Plan

- [x] Inspect the mobile breakpoint overrides that still make shared workspace buttons oversized on phones.
- [x] Replace the mobile full-width action layout with a compact wrapping layout.
- [x] Verify the updated sizing in a narrow mobile viewport and document the result.

## Review

- Updated the mobile breakpoint in [styles.css](/Users/daniellevy/Code/smart-todo/styles.css) so shared workspace actions no longer force `width: 100%` on phones.
- Changed mobile `.board-action` sizing to a compact two-up wrapping layout with:
  - `flex: 1 1 calc(50% - 6px)`
  - `min-height: 54px`
  - tighter horizontal padding
- Verification:
  - `npm run build`
  - pushed commit `3de96fd` to `main`
  - confirmed the live stylesheet at [https://smart-todo.dnalevity.com/styles.css](https://smart-todo.dnalevity.com/styles.css) serves the new mobile rules:
    - `width: auto`
    - `flex: 1 1 calc(50% - 6px)`
    - `min-height: 54px`

# Ariya Deploy Push Error

## Plan

- [x] Inspect the Ariya deploy action implementation and the live git state on piko to find the exact cause of the non-fast-forward push failure.
- [x] Fix the deploy path or repo state so Ariya can deploy cleanly without exposing raw git jargon in the UI.
- [x] Verify the live Ariya deploy flow and document the outcome.

## Review

- Root cause:
  - the live Ariya repo at `/home/dna/Code/Elfina-Coaching` was `ahead 1, behind 1`
  - the portal tried to `git push` a local portal commit onto an older branch tip, which produced the raw `fetch first` rejection shown in the UI
- Live repair on `dna@piko.local`:
  - rebased `/home/dna/Code/Elfina-Coaching` onto `origin/main`
  - pushed the rebased portal commit so Ariya is now back in sync with GitHub
- Backend fix in [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - `deploy_portal_site()` now fetches `origin` after creating the portal commit
  - if GitHub moved, it rebases the portal commit onto `origin/<branch>` before pushing
  - if that rebase cannot be applied cleanly, the API now returns a plain-language message instead of raw git output:
    - `GitHub has newer changes for this site and they could not be combined automatically. Please sync the workspace and try deploy again.`
  - if GitHub changes again during the final push, the backend now automatically fetches, rebases, and retries the push once before surfacing an error
  - only if that second combine step also fails does the user see a plain-language fallback:
    - `GitHub changed while this deploy was being prepared and the updates could not be combined automatically. Please sync the workspace and try deploy again.`
- Synced the patched backend to `/home/dna/Code/Cowork/dashboard_server.py` on piko and restarted `cowork-dashboard.service`.
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - `systemctl --user is-active cowork-dashboard.service` -> `active`
  - live Ariya repo now reports `## main...origin/main`
  - live workspace API for tenant `5337a2b3-3968-49e5-9fea-353ed3d9d50d` returns `200`
- Remaining verification limit:
  - I did not create a fresh dirty deploy in Ariya just to force another real portal deploy, because that would make a new production-facing commit solely for testing.

# Remove Old Vercel Projects

## Plan

- [x] Inspect Vercel projects and domain assignments for `gray.dnalevity.com`, `soulfire-edit.dnalevity.com`, and `todo.dnalevity.com`.
- [x] Delete the old Vercel projects and/or domain assignments for those legacy portals without touching the live shared app.
- [x] Verify the old Vercel resources are gone and document the result.

## Review

- Verified the legacy mappings before deletion:
  - `gray.dnalevity.com` -> project `gray-portal`
  - `soulfire-edit.dnalevity.com` -> project `soulfire-edit-portal`
  - `todo.dnalevity.com` -> project `dnalevity-todo`
- Deleted the old Vercel projects:
  - `gray-portal`
  - `soulfire-edit-portal`
  - `dnalevity-todo`
- Verified cleanup:
  - `vercel project ls` no longer shows those three projects
  - `vercel alias ls` no longer shows aliases for `gray.dnalevity.com`, `soulfire-edit.dnalevity.com`, or `todo.dnalevity.com`
- Important distinction:
  - `vercel domains inspect <subdomain>` still resolves because `dnalevity.com` remains registered in the Vercel account as a domain object
  - the old project bindings are gone; what remains is the parent domain registration, not the old apps

# Shared Auth Session Persistence

## Plan

- [x] Inspect the shared login flow, token storage, and backend auth session behavior to find why users are logged out after refresh.
- [x] Fix the persistence path so a successful login survives reloads.
- [x] Verify the live shared app keeps the session through a browser refresh and document the result.

## Review

- Root cause:
  - the shared app relied on `localStorage` bearer-token persistence only
  - the backend persisted sessions correctly in `/home/dna/Code/Cowork/.dashboard_state/portal_sessions.json`, but the browser had no cookie-backed auth fallback for refresh/storage edge cases
- Frontend fix in [shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js):
  - added safe local-storage wrappers so storage access failures do not break login state handling
  - all shared API fetches now use `credentials: "include"`
- Backend fix in [dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py):
  - `/api/auth/login` now sets an HttpOnly `cowork_portal_session` cookie on `cowork-api.dnalevity.com`
  - `/api/auth/logout` clears that cookie
  - authenticated requests now accept either:
    - `Authorization: Bearer <token>`
    - the session cookie
  - CORS responses now include `Access-Control-Allow-Credentials: true`
- Live verification:
  - the deployed shared bundle serves `credentials: "include"` and the safe storage helpers
  - the live backend session file exists and contains persisted sessions at `/home/dna/Code/Cowork/.dashboard_state/portal_sessions.json`
  - in a real browser session:
    - signed in at [https://smart-todo.dnalevity.com](https://smart-todo.dnalevity.com)
    - confirmed `localStorage` held `smart-todo-shared:token`
    - confirmed the browser cookie jar held an HttpOnly `cowork_portal_session` cookie for `cowork-api.dnalevity.com`
    - refreshed the page and remained logged into the Ariya board

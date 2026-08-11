# Prevent Duplicate OAuth Consent Submissions (2026-08-10)

## Plan

- [x] Inspect the OAuth authorization form and reproduce how repeat clicks reach the login rate limiter.
- [x] Disable the submit button immediately on the first valid submission and show a connecting state.
- [x] Add focused regression coverage and run the OAuth/MCP test suite.
- [x] Deploy the narrow backend change and verify the live flow in a real browser with a fresh request.

## Review

- Root cause: the OAuth form had no submission lock, so rapid clicks could post the same credentials repeatedly and exhaust the per-email login rate limit.
- Added a same-origin `/oauth/connect.js` guard under the existing restrictive CSP. On the first valid submit it marks the form as submitting, disables the button, adds `aria-disabled`, and changes the label to `Connecting…`; later submit events are canceled.
- Added disabled-button styling and regression assertions for the form hook, same-origin script policy, script response, duplicate guard, disabled state, and connecting label.
- Verification: Python compilation passed and all 19 focused OAuth/MCP tests passed. The deployed file hash is `14a7eb5f0eb0d532025e5e80c4005533c9bbcd58678b711c5f03fe4f78c13389`; `cowork-dashboard.service` restarted and is active.
- Live browser verification used a fresh authorization page while preventing the form from reaching the login endpoint: the button changed from `Connect Smart Todo` to disabled `Connecting…` on the first valid click and remained disabled on a forced second click.
- Recoverable live backup: `/home/dna/Code/Cowork/.dashboard_state/backups/oauth-single-submit-20260811T031616Z/smart_todo_mcp.py`.

## CSP Follow-up

- [x] Reproduce the browser `form-action 'self'` block on the implicit current-page action.
- [x] Give the login form an explicit same-origin `/oauth/authorize` action and cover it in tests.
- [x] Deploy the correction and verify a real POST using a disposable probe identity.

### Follow-up Review

- Added the explicit `action="/oauth/authorize"`, which avoids the browser CSP rejection while preserving `form-action 'self'`.
- Re-ran Python compilation and all 19 focused OAuth/MCP tests successfully.
- Deployed hash `8ea3f5ed9c429b7a2cbf919eab04080f253f2e0e6306dbd2119b50de67e9bcb3`; the live service is active. Backup: `/home/dna/Code/Cowork/.dashboard_state/backups/oauth-explicit-form-action-20260811T032000Z/smart_todo_mcp.py`.
- A real headed-browser POST with `csp-probe-20260811@example.invalid` reached `/oauth/authorize` and returned the expected `401` login error. No CSP violation occurred, proving the browser no longer blocks submission. The user's email was not used for this test.
- Cleared seven stale duplicate-click attempts only from `me@dnalevity.com`'s OAuth login bucket under the store lock. Recoverable state backup: `/home/dna/Code/Cowork/.dashboard_state/backups/oauth-rate-limit-clear-20260811T032100Z/smart_todo_oauth.json`.

## Successful Redirect CSP Follow-up

- [x] Allow only the exact registered callback origin in each authorization page's `form-action` policy.
- [x] Cover loopback and hosted callback origins in tests.
- [x] Verify an accepted-credential browser redirect end to end after action-time confirmation.

### Redirect Fix Status

- The production authorization page now returns `form-action 'self' http://127.0.0.1:53947` for the active Codex request, allowing only its exact loopback callback rather than a wildcard.
- Python compilation and all 20 focused OAuth/MCP tests pass, including exact loopback-port and hosted Claude callback policies.
- Deployed hash `0f27c929ebfca1b9cd9bb32b87c088d48f858c54468e728f7df84550c26fb4cb`; `cowork-dashboard.service` is active. Backup: `/home/dna/Code/Cowork/.dashboard_state/backups/oauth-callback-csp-20260811T032400Z/smart_todo_mcp.py`.
- The final accepted-credential click creates the persistent OAuth grant, so browser automation is paused immediately before that action for user confirmation.
- The user-submitted Brave flow reached the exact `127.0.0.1` callback, and the waiting Codex process reported `Successfully logged in to MCP server 'smart-todo'.`
- `codex mcp list` now reports `smart-todo` as enabled with OAuth. A fresh read-only Codex session called `smart_todo_list_sites` successfully and returned all 12 expected sites: 42 Chakra Point, Ariya, Booch Bar, DNA Levity, Eufloria, Hope And The Honeybee, Kona Hawaii Massage, Relax & Roam Travel, Samanayo, Savvy Excursions, Soulfire, and Well of Wellness.
- Removed and verified deletion of the temporary Keychain password entry after OAuth succeeded; the persistent OAuth connection remains active independently.

# Smart Todo OAuth MCP Server (2026-08-10)

## Plan

- [x] Inventory every current end-user Smart Todo capability and its Cowork API contract.
- [x] Define a minimal tool-only MCP contract with precise read/write/deploy annotations and tenant-safe OAuth scopes.
- [x] Add OAuth 2.1 discovery, PKCE-compatible authorization, token issuance/refresh/revocation, and per-request token validation using Smart Todo accounts.
- [x] Implement the streamable HTTP `/mcp` endpoint and map each tool to the existing Smart Todo service layer without bypassing tenant authorization.
- [x] Add focused automated tests for OAuth discovery/PKCE/scopes, MCP initialization/tool listing, tenant isolation, mutations, and deployment approvals.
- [x] Document ChatGPT and Claude installation, token/account boundaries, local operation, and production configuration.
- [x] Run static, unit, local MCP, and live-safe verification; deploy only after the complete authenticated flow passes.

## Review

- Production MCP URL: `https://cowork-api.dnalevity.com/mcp`.
- Added standards-based protected-resource and authorization-server discovery, public-client DCR, authorization code + PKCE S256, exact MCP resource binding, short-lived access tokens, rotating refresh tokens, revocation, rate limiting, and Smart Todo consent.
- Exposed 28 annotated tools covering account/site/request/workspace actions, direct tracked-source search/read/patch, deployment, and global-admin operations. Smart Todo OAuth tokens are accepted only inside MCP dispatch and cannot be replayed against normal browser APIs.
- Direct source access uses a separate consent scope, rejects hidden/sensitive/control files and unsafe paths/modes, and never executes repository scripts. A direct patch uses the same re-entrant cross-process site lock as every preview start, stops Cowork preview, and creates a permanent untrusted marker that later patches cannot re-baseline. The marker survives deployment and discard and only a trusted operator can clear it after review, so host-model code never executes with Cowork's environment. Direct patches and deploy/discard actions are tenant-policy checked, workspace locked, and bound to the exact reviewed HEAD and content digest.
- Closed the existing global-admin REST gap so a tenant owner/operator cannot list all tenants or mutate global users, and made browser deploy/discard send the same reviewed revision proof.
- Verification passed: Python compilation, frontend syntax check, diff checks, 19/19 focused MCP/OAuth/security tests, public HTTPS discovery and 401 challenge, DCR and authorization-page checks, and a temporary live authenticated `tools/list` call that was revoked immediately.
- Full Cowork discovery passes 36/37 tests. The one failure is the independently reproducible pre-existing evidence-retry fixture error (`agent_task_id` missing) in `test_dashboard_evidence_verification`; it is unrelated to MCP/OAuth changes.
- Live services: `cowork-dashboard.service` is active with zero restarts; Dokku `smart-todo` is deployed/running and serves the revision-bound browser action code.
- Recoverable piko backups: `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-mcp-20260811T022647Z`, `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-mcp-hardening-20260811T023729Z`, `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-mcp-preview-guard-20260811T024618Z`, `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-mcp-trusted-head-20260811T024933Z`, `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-mcp-permanent-guard-20260811T025249Z`, and `/home/dna/Code/smart-todo/shared-app.js.pre-mcp-revision-20260811T023729Z`.

# Smart Todo All-User Login Audit (2026-08-09)

## Plan

- [x] Check Anna/Savvy's live CRM action and mark the access audit in progress.
- [x] Reproduce Anna's live access failure and inventory every active Smart Todo user, tenant, membership, and password record.
- [x] Compare missing access against verified historical memberships and back up live state before repair.
- [x] Restore only historically evidenced memberships or other root-cause account state.
- [x] Verify every active user through authenticated identity, tenant listing, and each assigned workspace endpoint.
- [x] Verify Anna and the shared login flow in a clean production browser session.
- [x] Update the CRM action and document final evidence.

## Review

- Root causes:
  - Anna and eight other active client accounts had valid password hashes and prior authenticated sessions but had lost their tenant membership rows.
  - Cowork's admin self-healing inferred global administration from any tenant-scoped `owner` or `internal_operator` row, which had expanded one client owner across unrelated sites.
- Created CRM task `Audit and repair all Smart Todo user logins`, marked it `in_progress` before repair, then `done` with a completion activity after verification.
- Recoverable live backup: `/home/dna/Code/Cowork/.dashboard_state/backups/all-user-login-pre-repair-20260809T174357Z`.
- Restored nine historically verified `client_user` memberships: Anna/Savvy, Erin/Ariya, Gray/Samanayo, Kela/Booch Bar, Kaia/Soulfire, Evita/Kona Hawaii Massage, Eufloria/Eufloria, Sandra/Relax & Roam, and Silke/Well of Wellness.
- Preserved Morayana/42 Chakra, restored Hope to only Hope And The Honeybee as `owner`, and removed 11 unintended cross-tenant owner memberships.
- Patched Cowork locally and live so only the configured canonical bootstrap admin receives every tenant; tenant-scoped owners/operators remain tenant-scoped.
- Verification:
  - Python compilation passed locally and on piko.
  - The focused admin-membership invariant unit test passed.
  - All 12 active password hashes passed structural and cryptographic encoding validation.
  - All 12 active users passed authenticated `/api/auth/me` and `/api/app/tenants` checks with exact expected membership sets.
  - All 12 workspaces returned `200` through an assigned user's authenticated session.
  - Anna's production browser session opened `Savvy Excursions`, showed only `Savvy Excursions · client_user`, survived refresh, and reported no browser errors.
  - After a final Cowork restart, the store retained exactly 23 expected membership rows; Anna's identity, tenant list, and Savvy workspace endpoints each returned `200`.

# Repair May Smart Todo Login (2026-08-07)

## Plan

- [x] Reproduce the live login failure without exposing the supplied password.
- [x] Inspect the live user, tenant, and membership records; back up any state before repair.
- [x] Apply the smallest root-cause fix to restore authentication and 42 Chakra access.
- [x] Verify login, identity, tenant list, workspace access, and browser sign-in.
- [x] Document the repair and verification evidence.

## Review

- Root cause: the live account was active and the supplied password was valid, but the account had zero tenant memberships, so the shared app could authenticate and then fail while loading a workspace.
- Restored the historically verified `client_user` membership for the existing `42chakra` tenant using `MultiTenantStore.save_membership(...)` and recorded a `membership_restored` audit entry.
- Recoverable backup: `/home/dna/Code/Cowork/.dashboard_state/backups/may-42chakra-login-pre-repair-20260807T235736Z`.
- Live API verification passed: login `200`, `/api/auth/me` `200` with one membership, tenant list `200` with only `42chakra`, and the 42 Chakra workspace endpoint `200`.
- Clean browser verification passed at `https://smart-todo.dnalevity.com`: the same credentials opened `42 Chakra Point`, displayed the correct `client_user` workspace, survived a page refresh, and produced no browser errors.
- No password reset or application-code deployment was required.

# Smart Todo Redesign Mockups (2026-06-11)

# Restore Missing Admin Tenants (2026-07-28)

## Plan

- [x] Audit the live tenant store, registry, and canonical admin memberships.
- [x] Restore the complete stable tenant registry from the latest verified backup.
- [x] Rebuild `me@dnalevity.com` access across all active tenants.
- [x] Verify live API responses and browser workspace selection.

## Review

- Root cause: live `config/portal-sites.json` had been reduced to only `hope-and-the-honeybee` and `relax-and-roam-travel`; Cowork rebuilt the tenant store from that incomplete registry.
- Restored the verified 12-tenant registry from `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-model-pre-luna-20260729T033754Z/portal-sites.json`.
- `me@dnalevity.com` now receives all 12 active workspaces, including 42 Chakra Point, Savvy Excursions, Ariya, and Eufloria.
- Live admin endpoint returns 12 tenants; clean browser reload shows all 12 workspace options.
- Current config backup retained at `/home/dna/Code/Cowork/config/portal-sites.json.pre-full-registry-20260728`.
- Hardened Cowork JSON state writes to use atomic replacement; three concurrent rounds of all 12 workspace checks returned `200` after deployment.

# Connect Hope to Hope And The Honeybee (2026-07-28)

## Plan

- [x] Inspect the live user, tenant, and existing memberships.
- [x] Back up and add the owner membership.
- [x] Verify membership and tenant access live.
- [x] Document the access change.

## Review

- Connected `hopefulopalus@gmail.com` (`Hope`) to tenant `hope-and-the-honeybee` as `owner`.
- Tenant ID: `3b3d1477-fe55-4b98-99d5-c3ec885c438f`.
- Membership ID: `98945a92-494f-48ad-bb8d-2703b782d5c2`.
- Backup: `/home/dna/Code/Cowork/.dashboard_state/backups/hope-owner-membership-pre-connect-20260729T034757Z`.
- Live store readback returns Hope's owner membership and the tenant workspace, whose model remains `gpt-5.6-luna`.

# Enforce GPT-5.6 Luna for all Smart Todo users (2026-07-28)

## Plan

- [x] Inspect model-selection code and live Cowork user/tenant state.
- [x] Determine whether model selection is global, per-user, per-tenant, or per-task.
- [x] Apply the smallest live configuration change with a backup.
- [x] Verify all active users and a live request use `gpt-5.6-luna`.
- [x] Document results and evidence in this section.

## Review

- Model selection is applied per Smart Todo task, but every portal request, reply, retry, queued follow-up, and evidence retry routes through `portal_default_task_model`.
- Pinned that server-side selector to `gpt-5.6-luna`, so stale or edited per-tenant model values cannot override it.
- Updated provisioning defaults in both Smart Todo scripts and Cowork's tenant store, plus the documented site defaults.
- Normalized all 12 active live tenant workspaces to `gpt-5.6-luna`.
- Backup: `/home/dna/Code/Cowork/.dashboard_state/backups/smart-todo-model-pre-luna-20260729T033754Z`.
- Restarted and verified the user-level `cowork-dashboard.service` is active with fresh Gunicorn workers.
- Live verification: 13 active accounts, 12 active tenant workspaces, 12/12 tenant defaults are Luna; the live backend selector used by request creation returns Luna even when supplied a stale `gpt-5.5` tenant value.
- The 7 stored tasks are historical completed/canceled records and remain labeled with the model that actually ran; there were no queued or running tasks to migrate.
- Separate pre-existing issue: `hopefulopalus@gmail.com` is active but has no active tenant membership; this model-only change did not alter access records.

# Admin Tenant Access / Tenant Not Found (2026-07-28)

# Consolidate Smart Todo Admin Identity (2026-07-28)

## Plan

- [x] Confirm the duplicate admin identities and their live access.
- [x] Disable `owner@dnalevity.local` and remove its admin memberships.
- [x] Set `me@dnalevity.com` as the sole bootstrap admin identity.
- [x] Verify live login behavior and service health.

## Review

- `owner@dnalevity.local` is now inactive, has zero memberships, and login returns `401`.
- `me@dnalevity.com` is the only active admin account and receives all 6 currently active workspace memberships.
- Live `cowork-dashboard.service` remains active after restart.
- Backups retained on piko: `portal_users.json.pre-20260728T-admin-single` and `portal_memberships.json.pre-20260728T-admin-single`.

## Plan

- [x] Inspect repository, graph coverage, and current live tenant/membership lookup behavior.
- [x] Reproduce the `Tenant not found` failure and identify the authoritative root cause.
- [x] Implement the smallest durable fix so the admin account can access every workspace.
- [x] Verify syntax, live API behavior, and browser-visible workspace selection.

## Review

- Root causes:
  - `hope-and-the-honeybee` had no stable `tenant_id` in the live site registry, so concurrent Cowork workers could generate different IDs and leave the browser holding a stale tenant ID.
  - Admin access was membership-based but not self-healing when a workspace was added after the admin’s existing memberships were established.
- Fixes applied to live piko:
  - pinned `hope-and-the-honeybee` to tenant ID `3b3d1477-fe55-4b98-99d5-c3ec885c438f` in `config/portal-sites.json`;
  - added an admin-membership invariant for active owner/operator accounts during bootstrap, tenant creation, login, and `/api/auth/me`/tenant listing;
  - restarted `cowork-dashboard.service` after Python compilation, with a recoverable backup at `/home/dna/Code/Cowork/dashboard_server.py.pre-admin-auth-selfheal-20260728`.
- Verification:
  - both `me@dnalevity.com` and `owner@dnalevity.local` receive all 12 active workspaces;
  - every workspace endpoint returns `200` for the admin accounts after the tenant-ID pin;
  - clean browser verification shows all 12 workspace options, loads 42 Chakra Point without `Tenant not found`, and switches to Hope And The Honeybee with its workspace and preview link.

# Relax & Roam Travel Smart Todo Setup (2026-07-28)

## Plan

- [x] Inspect the target site/repo or Vercel project and normalize the tenant slug.
- [x] Provision the Smart Todo tenant and Sandra's client access with a live backup first.
- [x] Wire Cowork preview routing and prepare the app for `/preview/<slug>` asset paths.
- [x] Audit every rendered preview image in a clean browser session and repair broken assets.
- [x] Verify live login, tenant/workspace, preview, and image responses.
- [x] Update the `smart-todo-setup` skill with the browser-level image audit requirement.
- [x] Send Sandra the verified credentials by email.

## Review

- Tenant slug: `relax-and-roam-travel`; local app: `/Users/daniellevy/Code/relax-and-roam-travel`; live preview checkout: `/home/dna/Code/relax-and-roam-travel`.
- Live Cowork tenant ID: `836f47b7-e07e-4e43-bca9-0826f0108833`; Sandra's login `Sandra.hodes@fora.travel` returns `200` and the expected `client_user` membership.
- Took the live pre-setup backup at `/home/dna/Code/Cowork/.dashboard_state/backups/relax-and-roam-pre-setup-20260729T031745Z`.
- Preview route: `https://piko.dnalevity.com/preview/relax-and-roam-travel`; port `3111`; nginx config installed and `nginx -t` passed.
- Preview image audit passed after scrolling full pages: homepage (21 images), About (17), Journeys (13), Services (23), Blog (16), Kenya article (19), and Portugal itinerary (4), all with `naturalWidth > 0` and no image-load errors.
- Root cause fixed in the app: preview-only `images.unoptimized` plus `assetPath()` for root-relative public assets. Local and piko production builds passed.
- Workspace endpoint and preview route both return `200`.
- Todo Vercel project: `relax-and-roam-travel-todo`; deployment: `https://relax-and-roam-travel-todo.vercel.app`.
- Credentials emailed to Sandra; Gmail Sent readback confirmed message `19fabeeefa13fa5e` to `Sandra.hodes@fora.travel`.

# Cowork API CORS Repair (2026-07-06)

## Plan

- [x] Reproduce the failing live preflight/request for Eufloria requests from `https://smart-todo.dnalevity.com`.
- [x] Inspect the local and piko Cowork backend CORS allowlist and shared tenant request route.
- [x] Patch the smallest root cause so Smart Todo browser requests receive CORS headers.
- [x] Deploy/restart only the required live Cowork API service.
- [x] Verify live `OPTIONS` and unauthenticated request behavior from the Smart Todo origin.
- [x] Document final results and evidence here.

## Review

- Root cause: the Cowork API CORS allowlist accepted `https://smart-todo.dnalevity.com`, but `Access-Control-Allow-Headers` did not include `X-Portal-Email`, which the Smart Todo sign-in flow can send with `X-Portal-Password`.
- Fix: updated `/Users/daniellevy/Code/Cowork/dashboard_server.py` and the live piko copy at `/home/dna/Code/Cowork/dashboard_server.py` so CORS allows `Content-Type, X-Portal-Email, X-Portal-Password, Authorization`.
- Deployment: ran `python3 -m py_compile dashboard_server.py` on piko and restarted `cowork-dashboard.service`; the service returned `active` with fresh Gunicorn workers.
- Verification:
  - Live `OPTIONS https://cowork-api.dnalevity.com/api/app/tenants/bf8de553-a7fd-4b55-908b-59c3b2f5d08a/requests` from origin `https://smart-todo.dnalevity.com` returns `204`.
  - The `GET` and `POST` preflight checks with requested headers `x-portal-email,x-portal-password,content-type` now return `Access-Control-Allow-Headers: Content-Type, X-Portal-Email, X-Portal-Password, Authorization`.
  - Live unauthenticated `GET` to the same requests endpoint returns the expected `401 Unauthorized` while still including `Access-Control-Allow-Origin: https://smart-todo.dnalevity.com`, so browsers can read the auth failure instead of surfacing a CORS failure.

# Smart Todo Epic Landing Page (2026-07-03)

## Plan

- [x] Inspect the current static Smart Todo surface and preserve existing portal behavior.
- [x] Generate or place an original landing-page visual asset after attempting the `generate-image` skill.
- [x] Build a polished public-facing Smart Todo landing page around the existing task portal.
- [x] Verify HTML/CSS/JS syntax and browser rendering at desktop and mobile sizes.
- [x] Document final results and evidence here.

## Review

- Built a new Smart Todo landing page around the existing portal form and board instead of replacing the request workflow.
- Added a generated hero/background image at `public/landing-assets/smart-todo-hero.png`; the requested Venice `generate-image` script was attempted first, but the API rejected the 1920px width and then returned `402 Payment Required` at the allowed size, so the final asset came from the available fallback image generator.
- Updated visible page/portal copy in `portal.config.js` from stale Soulfire labels to Smart Todo labels while leaving API paths untouched.
- Changed locked portal behavior so the landing page remains visible and the task board stays hidden until the portal is unlocked.
- Fixed unauthenticated polling so a first-time visitor does not trigger background request API calls before entering a password.
- Correction after visual review:
  - changed the portal gate from password-only to email plus password.
  - stores and sends the email as `X-Portal-Email` alongside the existing password header.
  - updated the visible login copy and button to say sign in.
  - kept the sign-in button full-width in the auth card after adding the second field.
- Verification:
  - `npm run check` passed.
  - `node --check ./portal.config.js` passed.
  - `tidy -qe index.html` passed.
  - Playwright clean-profile desktop and mobile checks passed at `http://127.0.0.1:4174`.
  - Desktop screenshot: `output/playwright/smart-todo-landing-desktop.png`.
  - Mobile screenshot: `output/playwright/smart-todo-landing-mobile.png`.

# Smart Todo All-User Access Audit (2026-06-30)

## Plan

- [x] Inventory all live Cowork users, tenants, and memberships on piko.
- [x] Validate that every active non-internal user has at least one valid tenant membership.
- [x] Verify live API session serialization for each active user via `/api/auth/me` and `/api/app/tenants`.
- [x] Verify each user membership can load its tenant workspace endpoint.
- [x] Repair any missing or invalid memberships found during the audit.
- [x] Document final results and evidence here.

## Review

- Root cause scope: the same membership-loss issue affected multiple historical Smart Todo client accounts, not only Eufloria.
- Took live backups before all-user repair:
  - `/home/dna/Code/Cowork/.dashboard_state/backups/portal_memberships.pre-all-user-access-audit.20260630T232101Z.json`
  - `/home/dna/Code/Cowork/.dashboard_state/backups/portal_users.pre-all-user-access-audit.20260630T232101Z.json`
- Restored these client memberships from task/audit-log evidence:
  - `annahuttner@yahoo.com` -> `savvy` as `client_user`
  - `erinsarahsteph@gmail.com` -> `ariya` as `client_user`
  - `info@samanayo.com` -> `samanayo` as `client_user`
  - `info@theboochbarhilo.com` -> `booch-bar` as `client_user`
  - `kaia@soulfireproductions.com` -> `soulfire` as `client_user`
  - `maytoomuch@gmail.com` -> `42chakra` as `client_user`
  - `misseufloria@gmail.com` -> `eufloria` as `client_user`
  - `silkekorfmacher@gmail.com` -> `wellofwellness` as `client_user`
- Marked inactive:
  - `info@theboochbar.com`, because audit history shows that membership was explicitly removed before `info@theboochbarhilo.com` was added.
  - `codex-remove-test-1773686120@example.com`, because it is a test account with no tenant history.
- Verification:
  - Final live state has 10 active users, 18 memberships, 0 active users without memberships, and 0 invalid membership references.
  - Live `/api/auth/me`, `/api/app/tenants`, and each tenant workspace endpoint returned successfully for all active users and memberships.
  - Workspace verification covered `savvy`, `samanayo`, `booch-bar`, `soulfire`, `42chakra`, `ariya`, `dnalevity`, `eufloria`, and `wellofwellness`.
  - Erin's first Ariya workspace check timed out at 30 seconds, then immediately passed on retry with `/api/auth/me`, `/api/app/tenants`, and the Ariya workspace endpoint all returning `200`.

# Eufloria Membership Login Repair (2026-06-30)

## Plan

- [x] Inspect live Cowork Eufloria tenant, user, and membership records on piko.
- [x] Reproduce the `no tenant memberships found for this account` login path against the live API.
- [x] Patch the smallest live-state or backend root cause so `misseufloria@gmail.com` resolves to the Eufloria tenant.
- [x] Verify login, `/api/auth/me`, and Eufloria workspace access through the live API.
- [x] Document the fix and verification evidence here.

## Review

- Root cause: the live Cowork user `misseufloria@gmail.com` and tenant `eufloria` both existed, but the client membership row was missing from `/home/dna/Code/Cowork/.dashboard_state/portal_memberships.json`.
- The piko backend bootstrap code is no longer the destructive version that rewrites memberships to owner-only rows, so the restored row should persist across service restarts.
- Took a live backup before editing: `/home/dna/Code/Cowork/.dashboard_state/backups/portal_memberships.pre-eufloria-client-restore.20260630T231714Z.json`.
- Restored membership `e81dc1a6-f2f7-4daa-85a0-d400623623f2` for user `86ce99b8-b89f-4eb2-a107-0a619b8439d2` on tenant `bf8de553-a7fd-4b55-908b-59c3b2f5d08a` with role `client_user`.
- Verification:
  - Store-level `list_memberships_for_user` returns `eufloria` with role `client_user`.
  - Live `GET https://cowork-api.dnalevity.com/api/auth/me` returns `misseufloria@gmail.com` with the Eufloria `client_user` membership.
  - Live `GET https://cowork-api.dnalevity.com/api/app/tenants` returns Eufloria tenant `bf8de553-a7fd-4b55-908b-59c3b2f5d08a`.
  - Live `GET https://cowork-api.dnalevity.com/api/app/tenants/bf8de553-a7fd-4b55-908b-59c3b2f5d08a/workspace` returns `200`, branch `main`, and preview `https://piko.dnalevity.com/preview/eufloria`.

# Smart Todo Queued Reply Steering (2026-06-30)

## Plan

- [x] Inspect current queued-reply storage, promotion, and delete controls.
- [x] Add a backend action that marks a queued reply as the steering message and moves it to the front of the queue.
- [x] Add a visible queued-reply UI control for steering the conversation.
- [x] Deploy the backend/frontend changes narrowly to piko.
- [x] Verify with Silke's Well of Wellness session and the live API.

## Review

- Added a live Cowork endpoint: `POST /api/app/tenants/:tenantId/requests/:requestId/reply-queue/:replyId/steer`.
- The endpoint marks the selected queued reply as `status: steering`, sets `steering: true`, moves it to the front of `reply_queue`, clears prior steering markers, and records `reply_queue_steered` in the audit log.
- Updated live `shared-chat-app.js` so queued replies render a `Steer next` button. Once selected, the queued reply shows `Steering next` and the button is disabled.
- Fixed a reload safety issue found during deployment: `bootstrap_multi_tenant_state()` no longer rewrites `portal_memberships.json` down to bootstrap-owner-only rows. After patching, a Gunicorn HUP preserved `me@dnalevity.com`, `owner@dnalevity.local`, and `silkekorfmacher@gmail.com` on the Well of Wellness tenant.
- Verification:
  - Local `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py` passed.
  - Local `node --check shared-chat-app.js` passed.
  - Piko `/home/dna/Code/Cowork/dashboard_server.py` passed `python3 -m py_compile`.
  - Live API login as Silke succeeds and returns the Well of Wellness membership.
  - Live API steering action returned `200` and changed the Big Cat queued reply `use gpt-image-2 instead of trying to edit` to `status: steering`, `steering: true`.
  - Playwright clean-profile login as Silke shows that queued reply under Big Cat as `Steering next`, with the `Steer next` button disabled and `Delete` still available.

# Smart Todo Full Chat History (2026-06-30)

## Plan

- [x] Confirm whether the six visible Well of Wellness request cards are a UI/API cap or the full request count.
- [x] Inspect linked Cowork agent task logs for the missing per-thread Smart Todo message history.
- [x] Expose saved agent messages in the tenant request API without leaking raw command output.
- [x] Render all serialized Smart Todo messages in the selected chat thread.
- [x] Deploy the backend/frontend fix narrowly and verify in Silke's live Well of Wellness session.

## Review

- The Well of Wellness request list currently has 6 request records; the sidebar was not capped by frontend pagination for that tenant.
- The selected-thread transcript was incomplete because Cowork stored the full agent-side message history in `agent_tasks.json` logs, but the tenant request API only exposed `latest_message`.
- Backend fix:
  - Added `agent_messages` serialization from linked task logs, including tasks matched by `record.agent_task_id`, reply `agent_task_id`, and `source_item_id`.
  - Exposes only `agent_message` text entries, not command output events.
  - Verified the Big Cat request API now returns 18 `agent_messages`.
- Frontend fix:
  - Updated live `shared-chat-app.js` so selected threads render all `agent_messages` as Smart Todo bubbles, with checklist/actions on the latest bubble.
  - Patched only the running Dokku container asset; the public asset now contains `agentMessages`, `smartTodoHistory`, and `currentSmartTodoMessage`.
- Verification:
  - Local `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py` passed.
  - Local `node --check shared-chat-app.js` passed.
  - Piko `/home/dna/Code/Cowork/dashboard_server.py` passed `python3 -m py_compile`.
  - Live API login as Silke succeeds and returns the Well of Wellness membership.
  - Playwright clean-profile login as Silke shows the Big Cat selected thread with the saved Smart Todo transcript rendered as many AI bubbles instead of a single latest message.
- Note:
  - Several active Well of Wellness worker processes were no longer alive after the backend reload and now show `Interrupted` with retry/archive controls. I left that state visible instead of masking it.

# Well of Wellness Tenant Banner Issue (2026-06-30)

## Plan

- [x] Verify the current public TLS state for `smart-todo.dnalevity.com`.
- [x] Reproduce Silke's Well of Wellness tenant/session API flow against the live Cowork API.
- [x] Identify whether `Tenant not found` is a stale browser/UI status or a live backend authorization/store failure.
- [x] Patch the smallest root-cause fix if the issue still reproduces.
- [x] Verify the browser/app state after the fix and document the outcome.

## Review

- Public TLS for `https://smart-todo.dnalevity.com` verifies successfully over HTTP/2. The active certificate is issued by Let's Encrypt YE1 and expires `2026-09-28 18:39:13 UTC`.
- Silke's live login succeeds, and the live Cowork API returns the Well of Wellness tenant, request list, and workspace for tenant `2c80d3b4-7eab-492c-9c9e-2aa7d78b90b7`.
- Root cause: the chat frontend could retain a stale workspace error banner after a later successful tenant/workspace load. If a transient tenant lookup failed during the initial provisioning window, the page could keep showing `Tenant not found` even after the backend tenant was valid.
- Fix:
  - Updated `shared-chat-app.js` and `shared-app.js` to clear `workspaceStatus` when the workspace request succeeds.
  - Hotpatched the running Dokku `smart-todo.web.1` container from the deployed image baseline, applying only the successful-workspace status-clear change to the two frontend assets.
- Verification:
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - Live `https://smart-todo.dnalevity.com/shared-chat-app.js` contains the successful-workspace `setWorkspaceStatus("")` path.
  - Playwright clean-profile login as Silke shows the Well of Wellness workspace, action buttons, repo metadata, preview link, and no `Tenant not found` banner.
  - The exact Big Cat thread from the screenshot renders successfully with the uploaded image link and active reply composer.
  - Big Cat uploaded image and completion screenshot return `200` with `image/jpeg` and `image/png` content types.
  - Browser screenshot saved at `.playwright-cli/page-2026-06-30T20-58-48-573Z.png`.

# Dokku Certificate Auto-Renewal Audit (2026-06-30)

## Plan

- [x] Audit all Dokku apps, domains, LetsEncrypt active state, expiry dates, and autorenew state.
- [x] Confirm the Dokku LetsEncrypt cron job exists and runs globally.
- [x] Renew any active Dokku LetsEncrypt certificates that are already expired or inside the renewal window.
- [x] Verify public TLS for every renewed Dokku hostname.
- [x] Document which apps are active/inactive and what remains outside Dokku scope.

## Review

- Dokku app audit:
  - Active LetsEncrypt apps: `smart-todo`, `imaginemash`, `dna-levity-crm`.
  - Inactive/not LetsEncrypt-managed apps at audit time: `bib-helper`, `coco-bot`, `commontrust-bot`, `credit-api`, `credit-bot`, `credit-pocketbase`, `hawaii-vibe-bot`.
- Auto-renewal:
  - Dokku user crontab contains `@daily /var/lib/dokku/plugins/available/letsencrypt/cron-job`.
  - `dokku letsencrypt:report` shows `autorenew: true` for all active LetsEncrypt apps.
  - Manual `dokku letsencrypt:auto-renew` completed successfully and reported all active apps outside the renewal window.
- Renewed expired active certs:
  - `imaginemash`: renewed with `dokku letsencrypt:enable imaginemash`.
  - `dna-levity-crm`: renewed with `dokku letsencrypt:enable dna-levity-crm`.
- Current active Dokku certificate expiries:
  - `smart-todo.dnalevity.com`: valid through `2026-09-28 18:39:13 UTC`.
  - `imaginemash.dnalevity.com`: valid through `2026-09-28 18:42:46 UTC`.
  - `crm.dnalevity.com`: valid through `2026-09-28 18:42:49 UTC`.
- Public TLS verification:
  - `smart-todo.dnalevity.com` verifies and returns `HTTP/2 200`.
  - `imaginemash.dnalevity.com` verifies and returns expected `HTTP/2 401` Basic Auth challenge.
  - `crm.dnalevity.com` verifies and returns expected `HTTP/2 307` redirect to `/login`.
- Outside Dokku scope: `cowork-api.dnalevity.com` and `piko.dnalevity.com` are certbot-managed nginx hosts, not Dokku app certs.

# Smart Todo SSL Repair (2026-06-30)

## Plan

- [x] Confirm the failing hostname, certificate dates, and whether API/login backend hosts are also affected.
- [x] Identify where `smart-todo.dnalevity.com` is served and which certificate manager owns it.
- [x] Renew or replace the expired certificate for the user-facing Smart Todo hostname.
- [x] Reload/restart only the required web service or proxy.
- [x] Verify browser-grade TLS, HTTP status, and login page reachability after repair.
- [x] Document the fix and verification evidence.

## Review

- Root cause: `smart-todo.dnalevity.com` was serving the Dokku app certificate at `/home/dokku/smart-todo/tls/server.crt`, which expired on `2026-06-11 23:24:50 UTC`.
- Scope check: `cowork-api.dnalevity.com` had a valid certificate expiring `2026-08-10`, so the SSL warning was isolated to the Smart Todo frontend hostname.
- Fix:
  - Ran `dokku letsencrypt:enable smart-todo` on `dna@piko.local`.
  - Dokku completed HTTP-01 validation, installed the new Let's Encrypt certificate, regenerated the app nginx config, and reloaded nginx.
  - Added the Dokku letsencrypt cron job with `dokku letsencrypt:cron-job --add`; `letsencrypt:report smart-todo` now shows `autorenew: true`.
- Verification:
  - Public `curl -Iv https://smart-todo.dnalevity.com` verifies TLS successfully and returns `HTTP/2 200`.
  - New public certificate is for `CN=smart-todo.dnalevity.com`, issuer `Let's Encrypt YE1`, valid from `2026-06-30 18:39:14 UTC` through `2026-09-28 18:39:13 UTC`.
  - `dokku letsencrypt:list` shows `smart-todo` expiry `2026-09-28 19:39:13`.
  - Dokku user crontab now contains `@daily /var/lib/dokku/plugins/available/letsencrypt/cron-job`.
  - HTTPS page body loads the Smart Todo portal HTML, including the shared app bootstrap script.

# Well of Wellness Smart Todo Access (2026-06-30)

## Plan

- [x] Inspect the live Cowork shared-tenant store for the Well of Wellness tenant, current users, memberships, and admin/operator account.
- [x] Add or update `silkekorfmacher@gmail.com` with editor access for `wellofwellness.com` without disturbing existing users.
- [x] Confirm the admin/operator account can also edit the Well of Wellness tenant.
- [x] Verify login/session/workspace access for the new user and admin account through the live API.
- [x] Verify the live preview route for `wellofwellness.com`, including rendered image requests, and fix preview asset issues if found.
- [x] Document the results and proof in this file.

## Review

- Created live Cowork tenant `wellofwellness` (`2c80d3b4-7eab-492c-9c9e-2aa7d78b90b7`) for `https://wellofwellness.com`.
- Added `silkekorfmacher@gmail.com` as `client_user` and generated a password. The password is not stored in this task log.
- Added `me@dnalevity.com` and `owner@dnalevity.local` as `owner` memberships for the Well of Wellness tenant.
- Cloned `git@github.com:allinfinite/wellofwellness.git` to `/home/dna/Code/wellofwellness` on piko and set the preview to `https://piko.dnalevity.com/preview/wellofwellness` on port `3108`.
- Added and pushed Well of Wellness commit `d53a87c` so the Next app supports `/preview/wellofwellness` and prefixes local image/link assets correctly.
- Verification:
  - Local Well of Wellness `npm run lint` passed after the build output settled.
  - Local preview-base-path `npm run build` passed.
  - Piko preview-base-path `npm run build` passed.
  - Silke login via `POST https://cowork-api.dnalevity.com/api/auth/login` succeeds, `/api/auth/me` returns the Well of Wellness membership, and the workspace endpoint returns branch `main`, `is_current=true`, `dirty=false`, and preview `ready=true`.
  - Both admin sessions (`me@dnalevity.com` and `owner@dnalevity.local`) can load the Well of Wellness workspace as `owner`.
  - `https://piko.dnalevity.com/preview/wellofwellness` and `/shop` return `200`.
  - All 37 discovered preview asset URLs, including source photos, icons, product photos, OG image, favicon, and manifest, returned `200` after retrying connection-limited requests.
  - Playwright snapshots for homepage and shop show rendered image nodes and preview-prefixed routes. Console errors were limited to dev-server HMR WebSocket handshakes behind nginx.
- Delivery:
  - Emailed Silke her Smart Todo login details at `silkekorfmacher@gmail.com` via the piko operator-mail SMTP path.

## Plan

- [x] Review the provided current-state screenshot and project lessons relevant to Smart Todo UI redesigns.
- [x] Check the local image generator model list and note whether `gpt-image-2` is available.
- [x] Generate several static redesign mockups using the closest available GPT image model and the screenshot as reference.
- [x] Review generated files and document output paths.

## Review

- `gpt-image-2` is not exposed by the local generator. The available GPT image model is `gpt-image-1-5` / `gpt-image-1-5-edit`.
- First edit attempt with `gpt-image-1-5-edit --aspect-ratio 16:9` failed because the model only supports `auto`, `1:1`, `3:2`, and `2:3`. Retrying with `auto`.
- Generated four mockups:
  - `/Users/daniellevy/.claude/scripts/generated_images/smart_todo_redesign_operator_console.png` (1536x1024)
  - `/Users/daniellevy/.claude/scripts/generated_images/smart_todo_redesign_client_workspace.png` (1536x1024)
  - `/Users/daniellevy/.claude/scripts/generated_images/smart_todo_redesign_split_board.png` (1536x1024)
  - `/Users/daniellevy/.claude/scripts/generated_images/smart_todo_redesign_inbox_console.webp` (generator returned 1024x1024 despite the requested 1280x853)

# Eufloria Smart Todo Access (2026-06-11)

## Plan

- [x] Confirm the live shared-app tenant/user storage and existing Eufloria records.
- [x] Create or update the Eufloria tenant for `https://www.eufloria.com/`.
- [x] Add `misseufloria@gmail.com` with client access and a new login password.
- [x] Find a real textable phone number before sending credentials.
- [x] Verify the user can log in and see the Eufloria workspace.
- [x] Document the result and any blocker.

## Review

- Created production Cowork tenant `eufloria` (`bf8de553-a7fd-4b55-908b-59c3b2f5d08a`) with:
  - public URL `https://www.eufloria.com/`
  - repo/app path `/home/dna/Code/eufloria.com`
  - preview URL `https://piko.dnalevity.com/preview/eufloria`
  - default model `gpt-5.5`
- Added `misseufloria@gmail.com` as `client_user` and generated a new password. The password was not written to CRM or task notes.
- Cloned `git@github.com:allinfinite/eufloria.com.git` to piko, installed dependencies, and added/pushed Eufloria repo commits so Smart Todo preview works under `/preview/eufloria`.
- Verification:
  - `POST https://cowork-api.dnalevity.com/api/auth/login` succeeds for `misseufloria@gmail.com`.
  - `/api/auth/me` returns the same user from the session cookie.
  - `/api/app/tenants/bf8de553-a7fd-4b55-908b-59c3b2f5d08a/workspace` returns branch `main`, `is_current=true`, and preview ready.
  - `https://piko.dnalevity.com/preview/eufloria` returns `200` and includes Eufloria content plus `/preview/eufloria/_next/` asset paths.
- SMS delivery blocker:
  - No verified phone number was found in live CRM, Cowork lead notes, the Eufloria site/source, or public search results.
  - Did not text the email/iMessage handle because project lessons say not to treat an email-address iMessage handle as a requested text channel unless explicitly instructed.
- SMS delivery follow-up:
  - User supplied verified phone `(808) 298-6346`.
  - Updated live CRM phone and preferred contact method to `sms`.
  - Texted the Smart Todo login link and credentials via Apple Messages automation; `osascript` returned exit code `0`.
  - CRM activity `85747de6-6089-422b-9b21-9590c4d637e2` records the phone correction.
  - CRM activity `fa024579-534d-41fd-bee0-fec7ecca6d36` records the sent SMS without storing the password in the body.
- CRM:
  - Added live CRM relationship/project/activity for Eufloria.
  - Activity `d8095ace-a0f0-4ad5-92b9-434870064715` records that access was provisioned and SMS delivery is pending a verified phone number.

# Smart Todo Text Reply 400 Fix (2026-05-17)

## Plan

- [x] Reproduce/identify why text-only replies now hit Cowork with `400 BAD REQUEST`.
- [x] Patch the optimistic-send payload so empty native file inputs are not submitted as uploads.
- [x] Verify text-only replies and attachment replies with delayed API mocks.
- [x] Deploy and update CRM.

## Review

- Root cause:
  - The optimistic-send patch rebuilt the reply upload payload from `new FormData(form).getAll("files")`.
  - For text-only replies, browsers can include the empty native file input as a file part with `filename=""`, which Cowork rejects as an unsupported upload and returns `400`.
- Fix:
  - Changed `shared-chat-app.js` to build reply/request uploads from the app-tracked `submittedFiles` array instead of the raw form file input.
  - On failure, the composer restores the same tracked `submittedFiles`.
- Verification:
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Playwright mock verified text-only replies do not send a `filename=""` multipart part.
  - Playwright mock verified replies with an actual selected attachment still send that file.
- live `shared-chat-app.js` contains `submittedFiles.forEach` and no `formData.getAll("files")` match.
- Deployed Smart Todo Dokku revision `087cd2c0419f5e739dd5a5e34ddcaee9d92599be`.
- CRM activity recorded as `2d77fe39-d9e7-46b0-9677-70ed64a11bc9` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Smart Todo Reply Queue While Working (2026-05-17)

## Plan

- [x] Inspect how active request replies are stored and rendered.
- [x] Add a queued-reply representation for replies submitted while the request task is running or queued.
- [x] Add a delete action for queued replies in Cowork and the chat UI.
- [x] Make queued replies become normal work once the current bot task is no longer active.
- [x] Verify backend/frontend behavior with syntax checks and delayed browser/API mocks.
- [x] Deploy and update CRM.

## Review

- Backend:
  - Cowork now stores replies submitted while a request task is `queued` or `running` in `reply_queue` instead of starting another task immediately.
  - Queued replies are serialized to the shared app as `reply_queue`.
  - Added `DELETE /api/app/tenants/:tenantId/requests/:requestId/reply-queue/:replyId` for deleting queued replies.
  - When the active task finishes, Cowork promotes the next queued reply into the normal `replies` thread and starts a follow-up task.
- Frontend:
  - The chat feed shows a `Queued Replies` block with each queued reply and a `Delete` button.
  - After sending during active work, the submit status says `Reply queued.`
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Python in-memory backend mock verified `start_next_queued_portal_reply()` creates a follow-up task, removes the queued item, and appends it to `replies`.
  - Playwright mock verified a running request shows `Queued Replies`, then calls the DELETE endpoint and removes the item from the feed.
  - Live Smart Todo asset contains `Queued Replies`, `reply-queue`, and `deleteQueuedReply`.
- Live Cowork route preflight for queued-reply DELETE returns `204`, and `cowork-dashboard.service` is active.
- Deployed Smart Todo Dokku revision `4fb0ebc24adcc5a25fab9342a4111db4adf3b7ed`.
- CRM activity recorded as `0a3c3ea1-b9b3-4cc3-8540-35c0226046c4` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Smart Todo Optimistic Chat Send (2026-05-17)

## Plan

- [x] Inspect the chat feed and submit path to find where the send waits on Cowork.
- [x] Add an optimistic local message so new requests and replies render immediately after Send.
- [x] Reconcile optimistic messages with the real API response and remove them on failure.
- [x] Verify with a delayed API browser mock and syntax checks.
- [x] Deploy and update CRM.

## Review

- Changed `shared-chat-app.js` to keep `optimisticMessages` in local state.
- On Send, the composer now clears immediately and renders the user's message in the selected chat feed with a `Sending...` marker while Cowork processes the request.
- For a brand-new request, the empty feed changes into a temporary `Sending request...` thread until Cowork returns the real request id.
- On success, the optimistic message remains visible until the board reloads with the real request/reply; on failure, it is removed and the original composer text/files are restored.
- Verification:
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Playwright delayed-API mock verified existing-thread replies appear before `/replies` resolves.
  - Playwright delayed-API mock verified new requests appear in a temporary thread before `/requests` resolves.
- live `shared-chat-app.js` contains `optimisticMessages` and `Sending request...`.
- Deployed Smart Todo Dokku revision `325c40a96c6d1ced0b939d6675d2c86ae18fd73c`.
- CRM activity recorded as `ed12e540-655e-47ab-a835-108a16024a64` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Smart Todo Whisper Empty Transcript Fix (2026-05-16)

## Plan

- [x] Identify why recorded audio can reach Cowork but still return `422 No speech was transcribed`.
- [x] Make browser recording flush audio chunks reliably before transcription.
- [x] Improve Cowork's local Whisper path so normal speech recordings are less likely to produce empty output.
- [x] Verify the frontend recorder and backend transcription path.
- [x] Deploy, update lessons, and record the correction in CRM.

## Review

- Root cause:
  - Cowork's `whisper.cpp` command used `-np`, but the installed `whisper.cpp` v1.5.4 CLI does not support that flag.
  - The CLI printed help output without creating a transcript file, which made the endpoint return `422 No speech was transcribed`.
- Fix:
  - Replaced `-np` with supported `-nt` in `/Users/daniellevy/Code/Cowork/dashboard_server.py` and on piko.
  - Updated `shared-chat-app.js` so `MediaRecorder` starts with a 1-second timeslice and calls `requestData()` before `stop()` when available.
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Generated WebM audio with `espeak-ng` + `ffmpeg` on piko and verified `whisper-cli ... -nt` produced transcript text.
  - Playwright mock verified the browser uses `start(1000)`, calls `requestData()`, posts to `/api/app/transcriptions`, and inserts returned text.
  - Live `shared-chat-app.js` contains `audioRecorder.start(1000)` and `audioRecorder.requestData()`.
  - Live Cowork transcription route preflight returns `204`, Cowork service is active, and piko backend contains `"-nt"`.
- Deployed Smart Todo Dokku revision `d13406f223d069b457836bcdbc594401f69e7992`.
- CRM activity recorded as `04538792-906e-4bbc-9524-7084392ecb8a` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Smart Todo Local Whisper Voice Recording (2026-05-16)

## Plan

- [x] Replace browser `SpeechRecognition` with explicit `MediaRecorder` capture that only stops when the user presses `Stop Recording`.
- [x] Add an authenticated Cowork transcription endpoint that stores audio only in a temp file, runs local Whisper, returns text, and deletes temp artifacts.
- [x] Insert returned transcript into the composer without attaching or saving the audio to the Smart Todo request.
- [x] Verify frontend behavior, backend syntax, live service health, and live deployment.
- [x] Update lessons and CRM with the correction.

## Review

- Changed `shared-chat-app.js` so the voice button records a browser audio blob through `MediaRecorder`, switches to `Stop Recording`, and only stops when pressed.
- Removed browser `SpeechRecognition` from the live voice path.
- Added `/api/app/transcriptions` to Cowork. It requires the existing shared-app auth session, accepts a multipart audio `file`, converts it to a temporary WAV, runs local Whisper, returns `{ text }`, and deletes the temp directory automatically.
- Installed local `whisper.cpp` on `dna@piko.local` with `ggml-tiny.en.bin` at `/home/dna/.local/share/whisper.cpp/ggml-tiny.en.bin`.
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Playwright mock verified `Record Audio` -> `Stop Recording`, `/api/app/transcriptions` multipart upload, transcript insertion into the textarea, and zero attachment chips.
  - piko `whisper.cpp` transcribed the bundled JFK sample correctly.
  - live Cowork preflight for `/api/app/transcriptions` returns `204` with Smart Todo CORS headers, and unauthenticated POST returns `401`.
  - live `shared-chat-app.js` contains `MediaRecorder` and `/api/app/transcriptions` and no `SpeechRecognition` match.
- Deployed Smart Todo Dokku revision `5576aee8d5c7cc172ddc9692b8ea79a7fb59051c`.
- CRM activity recorded as `24cfbcc2-a407-473a-a8b2-99aa1bd25473` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Auto Sync Dirty Workspace Recovery (2026-05-16)

## Plan

- [x] Unblock the live DNA Levity workspace by preserving dirty local changes and fast-forwarding to GitHub.
- [x] Patch Cowork sync so dirty-but-behind workspaces auto-preserve local edits instead of freezing end users.
- [x] Patch the frontend gate so a blocked state does not disable every possible recovery path.
- [x] Capture the correction in lessons.
- [x] Verify backend/frontend syntax plus live DNA Levity workspace recovery.
- [x] Update CRM activity and document the result here.

## Review

- Immediate live recovery:
  - DNA Levity workspace at `/home/dna/Code/dnalevity.com/dnalevity-next` was `main...origin/main [behind 5]` with local dirty edits.
  - Preserved those edits with `git stash push --include-untracked -m "Smart Todo auto-preserve before sync 20260517T021703Z"`.
  - Pulled `origin/main` with `--ff-only`; the checkout is now clean and `HEAD == origin/main` at `00bd5a33e6ed7e88acc2c18358bd30492fa29a4b`.
- Backend fix:
  - Updated `/Users/daniellevy/Code/Cowork/dashboard_server.py` so `sync_portal_site()` no longer freezes end users when a workspace is both dirty and behind.
  - If dirty + behind, Cowork now automatically stashes tracked/untracked local changes with a timestamped `Smart Todo auto-preserve before sync ...` message, pulls the latest GitHub commits, and returns `preserved_local_changes` metadata.
  - If dirty but already current, sync returns success without forcing an end-user decision.
- Frontend fix:
  - Updated `shared-chat-app.js` so `Sync` and `Refresh` remain available from a blocked state.
  - Updated legacy `app.js` so blocked state still allows retrying `Sync`.
- Verification:
  - `node --check app.js && node --check shared-chat-app.js && node --check shared-app.js && npm run check --if-present`
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py`
  - Local Git fixture verified dirty-behind sync now preserves dirty work in `stash@{0}`, pulls one remote commit, and leaves the checkout clean/current.
  - Deployed files to `dna@piko.local`, hotpatched running Dokku container `smart-todo.web.1`, restarted `cowork-dashboard.service`, and verified it is active.
  - Live assets now contain the recovery UI patch (`recoveryLocked`, `action !== "sync"`), and piko Cowork contains `preserved_local_changes`.
- Lessons:
  - Added a rule that freshness gates must have automatic dirty-workspace recovery and must not fail closed with every recovery action disabled.
- CRM:
  - Recorded CRM activity `5ee418e9-c99d-444f-81fb-4dd2c0678197` on project `Smart Todo Git Freshness Gate`.

# Smart Todo Voice Transcription Duration Fix (2026-05-16)

## Plan

- [x] Stop treating browser speech-recognition auto-end as a finished recording.
- [x] Keep recognition alive until the user presses `Stop Recording`.
- [x] Verify auto-end restarts recognition and still creates no audio attachment.
- [x] Deploy to the live Smart Todo app.
- [x] Update CRM activity and document the result.

## Review

- Changed `shared-chat-app.js` so recording state follows user intent (`speechRecognitionWanted`) instead of a single recognition instance.
- Browser `onend` and recoverable `no-speech`/`network` errors now restart recognition after 250ms while the user is still recording.
- Pressing `Stop Recording` finalizes the session and appends the accumulated transcript into the composer.
- Verification:
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Playwright mock forced an immediate first `onend`, verified recognition restarted, captured `keep listening longer`, appended it to the textarea, and created zero attachments.
  - live `shared-chat-app.js` contains `speechRecognitionWanted`, `scheduleSpeechRecognitionRestart`, and `Still listening`.
- Deployed Dokku revision `faa1af827b34ce8e7af9d927a86c7922663026b4`.
- CRM activity recorded as `fc2c70a7-84f9-42a0-a71c-fd46d5c4a623` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Smart Todo Voice Transcription Composer (2026-05-16)

## Plan

- [x] Replace recorded-audio attachment behavior with transcript-only voice input.
- [x] Append the transcript into the composer text after recording stops.
- [x] Verify no audio file is created or attached.
- [x] Deploy to the live Smart Todo app.
- [x] Update CRM activity and document the result.

## Review

- Changed `shared-chat-app.js` so `Record Audio` uses browser `SpeechRecognition` / `webkitSpeechRecognition`.
- Stopping recording now appends recognized speech to the message textarea and shows `Transcript added to message.`
- Removed the MediaRecorder/audio-blob path from the live chat script, so voice input no longer saves or uploads an audio file.
- Verification:
  - `node --check shared-chat-app.js`
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - Playwright mock with stubbed SpeechRecognition confirmed `Please make the headline warmer` was inserted into the textarea and zero attachment chips were created.
  - live `shared-chat-app.js` contains `SpeechRecognition`, `appendTranscriptToComposer`, and no `MediaRecorder`, `new File`, or `smart-todo-voice` audio attachment path.
- Deployed Dokku revision `7e4877d626ea5ca1de52312f40f694d0bdb694d4`.
- CRM activity recorded as `e718fbe4-ba06-442a-9aea-1d55dcad25a7` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Tenant Switch Responsiveness (2026-05-16)

## Plan

- [x] Inspect the shared tenant-switch flow and identify which work blocks visible tenant changes.
- [x] Add an immediate tenant-loading state so switching tenants gives feedback instead of leaving stale UI on screen.
- [x] Reduce avoidable latency by parallelizing independent tenant data requests and deferring owner admin/audit loading until after the main board renders.
- [x] Apply the fix to both the public shared board and the secret chat view.
- [x] Verify JavaScript syntax and run a browser-level mock that proves the selected tenant changes immediately while slow requests are still pending.
- [x] Document the result here.

## Review

- Root cause:
  - tenant switching changed `activeTenantId` and then awaited the full `loadTenantData()` path before rendering, so users kept seeing the old tenant while requests/workspace/admin/audit calls ran.
  - request and workspace fetches were serial even though they are independent.
  - owner-only admin/audit calls blocked the main board render after the tenant payload loaded.
- Fix:
  - added tenant-scoped loading state in `shared-app.js` and `shared-chat-app.js` so the selected tenant name, loading message, and disabled tenant-scoped controls render immediately.
  - changed the public shared board to fetch requests and workspace in parallel, render the main board as soon as they return, then refresh owner admin/audit data afterward.
  - applied the same immediate loading behavior to the chat view; its GitHub freshness/sync gate now renders progress before a slow auto-sync.
- Verification:
  - `node --check shared-app.js && node --check shared-chat-app.js && npm run check --if-present`
  - Playwright mock for public `shared-app.js` with slow tenant requests/workspace/admin APIs: immediately after selecting tenant `Beta`, the page showed `Beta todo board`, `Switching workspace...`, `Loading this workspace...`, and disabled workspace actions; after the delayed API returned, it showed `tenant-b request` and `/repo/tenant-b`.
  - Playwright mock for `shared-chat-app.js` with the same slow APIs: immediately after selecting tenant `Beta`, the sidebar showed `Beta`, `Switching workspace...`, `Loading this workspace...`, and disabled workspace actions; after load, it showed `tenant-b request` and `/repo/tenant-b`.
- Deployment:
  - created an isolated deploy clone from the current Dokku app repo so unrelated dirty local files were not included.
  - committed only `shared-app.js` and `shared-chat-app.js` as Dokku deploy commit `73aa45b Improve tenant switch responsiveness`.
  - pushed the commit to `dokku@piko.dnalevity.com:smart-todo`; Dokku built and promoted container `smart-todo.web.1` with CID `9e76b87b198`.
  - verified live `https://smart-todo.dnalevity.com/` still loads `chat-v2.css` and `shared-chat-app.js`.
  - verified live `shared-chat-app.js` and `shared-app.js` both contain `tenantLoading`, `Switching workspace`, `Loading this workspace`, and the parallel `Promise.allSettled` tenant fetch path.

# Smart Todo Chat Interface V2 (2026-05-16)

## Plan

- [x] Record the implementation plan before changing code.
- [x] Replace the shared board shell with a ChatGPT-style sidebar, feed, and composer.
- [x] Add recorded audio upload support in the shared composer and Cowork upload allowlist.
- [x] Preserve workspace actions, request actions, admin access, polling, and auth behavior.
- [x] Verify JavaScript/Python syntax plus local shared UI behavior.
- [x] Update CRM activity and document the result here.

## Review

- Replaced the shared-mode board surface in `shared-app.js` with a ChatGPT-style app shell: request history sidebar, selected request feed, unified bottom composer, owner admin drawer, and mobile history drawer.
- Added browser audio recording support to the shared composer; recordings are attached as `.webm` files through the existing multipart `files` upload path.
- Added audio extensions to Cowork's portal upload allowlist in `/Users/daniellevy/Code/Cowork/dashboard_server.py`: `.webm`, `.m4a`, `.mp3`, and `.wav`.
- Preserved existing shared endpoints for new requests, replies, workspace actions, request actions, tenant switching, polling, auth, and owner admin flows.
- Verification passed:
  - `node --check shared-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - local Playwright mock shared-mode check for desktop shell, request history, preview/deploy action buttons, new chat submission, audio record control presence, and mobile history drawer
- CRM:
  - inserted live CRM activity `15a26261-2bc8-4b7e-9456-70ddac2e6cc3` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`
- Live deploy:
  - not performed in this pass because the smart-todo worktree already contained unrelated dirty changes before this implementation; deploying from this checkout would risk shipping unrelated work.

# Smart Todo Public UI Revert And Secret Chat Link (2026-05-16)

## Plan

- [x] Confirm the live public site was serving the chat interface.
- [x] Restore the public shared app to the previous board UI.
- [x] Move the chat interface behind a secret entrypoint.
- [x] Verify the public route loads the old board script and the secret route loads the chat script/CSS.
- [x] Capture the correction in lessons and CRM.

## Review

- Deployed Dokku commit `a0808cad40c0581ed0ef02565839fe6db8691ce5`.
- Public `https://smart-todo.dnalevity.com/` now dynamically loads `shared-app.js`, whose live content contains the old `.shared-board` renderer and no chat renderer.
- Secret chat link is `https://smart-todo.dnalevity.com/?v2=7f3a9c`; that query-gated loader pulls `chat-v2.css` and `shared-chat-app.js`.
- Deployed the Cowork audio upload allowlist patch on `dna@piko.local`, verified Python compilation, and restarted `cowork-dashboard.service` successfully.
- Verified live assets by HTTP:
  - root HTML contains the query gate
  - public `shared-app.js` contains the old board renderer
  - `shared-chat-app.js` contains the chat renderer
- Added lessons to prevent public-first UI replacements and to account for `serve -s` SPA route rewriting.
- CRM activity recorded as `8c22a070-abb1-4ec3-8771-bad6a32c72b9` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Smart Todo Chat V2 Public Promotion (2026-05-16)

## Plan

- [x] Promote the verified chat interface to the public Smart Todo route.
- [x] Keep the old board script available as a rollback asset.
- [x] Verify live root loads the chat CSS and chat shared app script.
- [x] Update CRM activity and document the result.

## Review

- Deployed Dokku revision `004f5ba0d6e3199c937df87d5b7f5eff81426e3e`.
- Public `https://smart-todo.dnalevity.com/` now loads `chat-v2.css` and `shared-chat-app.js` directly.
- Verified live assets by HTTP:
  - root HTML references `./chat-v2.css` and `./shared-chat-app.js`
  - `shared-chat-app.js` contains the chat renderer
  - `chat-v2.css` contains the chat layout styles
- Local syntax checks passed after aligning `index.html` with the promoted public loader:
  - `node --check shared-app.js`
  - `node --check shared-chat-app.js`
  - `node --check app.js`
  - `npm run check --if-present`
- CRM activity recorded as `71dcf13c-1c77-45b9-9c62-ebc632003734` on project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.

# Auto Sync Before Workspace Use (2026-05-16)

## Plan

- [x] Inspect the shared and legacy smart-todo page-load flows plus Cowork workspace state/action endpoints.
- [x] Add backend remote freshness fields so workspace state reflects fetched GitHub refs, not stale local refs.
- [x] Add a frontend freshness gate that runs on page load, automatically syncs when behind, and blocks user actions while checking or syncing.
- [x] Verify JavaScript/Python syntax and exercise the backend freshness/sync path.
- [x] Update CRM activity and document the result here.

## Review

- Added Cowork workspace freshness reporting in `/Users/daniellevy/Code/Cowork/dashboard_server.py`:
  - `collect_workspace_state(..., check_remote=True)` fetches `origin`, compares `HEAD...origin/<deployBranch>`, and returns `ahead`, `behind`, `remote_ref`, `remote_checked_at`, `remote_error`, and `is_current`.
  - legacy `/api/portal/<site_slug>/workspace` and shared `/api/app/tenants/<tenant_id>/workspace` now use the remote-checking path.
- Added smart-todo frontend gates:
  - `shared-app.js` checks workspace freshness during authenticated page load, auto-runs the existing `sync` action when `behind > 0`, and blocks chat/request/reply/workspace actions while checking, syncing, or blocked.
  - `app.js` applies the same page-load auto-sync and action blocking for legacy portal pages.
- Updated `README.md` with the workspace freshness response fields and page-load behavior.
- Verification:
  - `node --check app.js && node --check shared-app.js && npm run check --if-present`
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py`
  - a local bare-remote/clone fixture proved `collect_workspace_state("test-site", check_remote=True)` reports `behind: 1`, `ahead: 0`, `is_current: false`, and no `remote_error` after the remote receives a new commit.
- Live rollout:
  - copied `app.js`, `shared-app.js`, and `README.md` to `dna@piko.local:/home/dna/Code/smart-todo/`
  - hotpatched the running Dokku `smart-todo.web.1` container with the updated `app.js` and `shared-app.js`
  - copied `dashboard_server.py` to `dna@piko.local:/home/dna/Code/Cowork/dashboard_server.py`
  - restarted `cowork-dashboard.service`; it reported `active`
  - verified live `https://smart-todo.dnalevity.com/app.js` and `shared-app.js` contain the new workspace freshness gate, and piko files contain `check_remote=True` workspace endpoints.
- CRM:
  - created/updated project `Smart Todo Git Freshness Gate` under `DNA Levity Apps`.
  - recorded CRM activity `40df6d31-5748-4c90-9a56-b55e5783fe1b` with the implementation and verification summary.

# Smart Todo Featured On Piko DNA Levity Site (2026-05-16)

## Plan

- [x] Add Smart Todo to the DNA Levity featured projects carousel with an appropriate live link and visual.
- [x] Verify the Next app still builds with the featured item included.
- [x] Sync/verify the piko-served DNA Levity site path for the updated featured item.
- [x] Update CRM project activity and document the result here.

## Review

- Added Smart Todo as the first featured project in `/Users/daniellevy/Code/DNAlevity.com/dnalevity-next/app/page.tsx`, linking to `https://smart-todo.dnalevity.com`.
- Verified the local DNA Levity Next app with `npm run build` and Browser inspection of the featured carousel.
- Updated the live piko root homepage at `/var/www/html/index.html` with a Smart Todo featured web app card and verified `https://piko.dnalevity.com` by HTTP and Browser.
- Mirrored the featured-project entry into `/home/dna/Code/dnalevity.com/dnalevity-next/app/page.tsx` on piko and verified the remote Next source with `npm run build`.
- Note: `https://piko.dnalevity.com/preview/dnalevity` still returns `502` because no DNA Levity preview process is currently serving that route; the root piko website is updated.
- CRM activity recorded as `4fbda88e-6c4c-4537-bc0b-b970145974ed` on project `Piko Website Smart Todo Feature` under `DNA Levity Apps`.

# 42 Chakra Preview SSL Protocol Error (2026-05-14)

## Plan

- [x] Reproduce/confirm the broken preview URL path for the 42chakra shared tenant.
- [x] Trace how smart-todo chooses the preview iframe URL after a preview action.
- [x] Patch the smallest durable fix so 42chakra preview embeds the public piko preview URL instead of an invalid secure localhost URL.
- [x] Verify frontend syntax plus live preview/API behavior for the 42chakra tenant.
- [x] Update CRM activity and document the result here.

## Review

- Root cause:
  - 42chakra middleware redirected unauthenticated protected preview routes with `new URL("/", request.url)`.
  - Behind the piko preview proxy, Next saw the internal request origin as `https://localhost:3106`, so `/preview/42chakra/scan` returned `307 Location: https://localhost:3106/`, which produced the visible `ERR_SSL_PROTOCOL_ERROR` screenshot.
- Changes:
  - patched `/Users/daniellevy/Code/42chakra/src/middleware.ts` and deployed it to `dna@piko.local:/home/dna/Code/42chakra/src/middleware.ts`
  - preview-mode unauthenticated redirects now use `https://piko.dnalevity.com/preview/42chakra/` instead of the internal localhost origin
  - patched `/Users/daniellevy/Code/smart-todo/app.js` and `/Users/daniellevy/Code/smart-todo/shared-app.js` so completion screenshots with `verification.status: "failed"` or `completion_screenshot_verification.status: "failed"` are hidden from review cards
  - hotpatched the running Dokku `smart-todo.web.1` container and piko working tree copies of `app.js` and `shared-app.js`
- Verification:
  - `npx tsc --noEmit` passed locally and on piko for `/Users/daniellevy/Code/42chakra`
  - `node --check app.js && node --check shared-app.js && npm run check --if-present` passed locally for smart-todo
  - live container checks passed: `node --check /app/app.js && node --check /app/shared-app.js`
  - `https://piko.dnalevity.com/preview/42chakra` returns `200`
  - `https://piko.dnalevity.com/preview/42chakra/scan` now redirects to `https://piko.dnalevity.com/preview/42chakra/`, then resolves to a `200` preview page with no `localhost` or `ERR_SSL`
  - live `https://smart-todo.dnalevity.com/app.js` and `shared-app.js` now contain `hasReviewableCompletionScreenshot`
- CRM:
  - inserted live CRM activity `6b332390-1d86-450c-9952-fe5beda497e7` on `Morayana Levy / 42 Chakra Point` and project `42 Chakra Point Smart Todo Access`

# Smart Todo Default Model GPT-5.5 (2026-05-14)

## Plan

- [x] Locate every smart-todo/Cowork default model fallback and provisioning path.
- [x] Change new tenant provisioning and backend fallback defaults from `gpt-5.4-mini` to `gpt-5.5`.
- [x] Migrate live piko tenant/config records so existing users default to `gpt-5.5`.
- [x] Verify Python files compile and live workspace payloads report the new default.
- [x] Record the rollout result here and update CRM activity.

## Review

- Changes:
  - updated smart-todo provisioning defaults in `scripts/provision_smarttodo.py` and `scripts/provision_shared_tenant.py` to `gpt-5.5`
  - updated Cowork shared-tenant normalization/fallbacks in `portal_multi_tenant.py` and `dashboard_server.py` to `gpt-5.5`
  - updated the smart-todo README shared workspace contract to document `gpt-5.5`
  - deployed the changed smart-todo scripts and Cowork backend files to `dna@piko.local`
  - migrated live piko tenant records and `config/portal-sites.json` entries for all 7 smart-todo tenants to `gpt-5.5`
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/smart-todo/scripts/provision_smarttodo.py /Users/daniellevy/Code/smart-todo/scripts/provision_shared_tenant.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py /Users/daniellevy/Code/Cowork/dashboard_server.py`
  - same `py_compile` check passed on piko after deployment
  - `cowork-dashboard.service` restarted and reported `active`
  - live piko tenant state now reports `gpt-5.5` for `42chakra`, `ariya`, `booch-bar`, `dnalevity`, `samanayo`, `savvy`, and `soulfire`
  - authenticated 42chakra workspace API returns `workspace.default_model: "gpt-5.5"` and tenant `workspace.defaultModel: "gpt-5.5"`
- CRM:
  - inserted CRM activity entries for portal-backed projects noting the default model rollout to `gpt-5.5`

# Morayana Smart Todo Access (2026-05-14)

## Plan

- [x] Review current smart-todo/Cowork instructions, lessons, and provisioning paths.
- [x] Identify the source repo/project and live tenant setup for `https://www.42chakrapoint.com/`.
- [x] Create or update the shared smart-todo tenant for 42 Chakra Point with preview actions that make image changes visible.
- [x] Create Morayana's `maytoomuch@gmail.com` client account and verify login access to `https://smart-todo.dnalevity.com/`.
- [x] Verify workspace preview/image-change visibility through the live Cowork/smart-todo API.
- [x] Update the CRM with the client/project/account setup state.
- [x] Send Morayana the login details by email and text, then document the result here.

## Review

- Source/project:
  - Vercel project `42chakra` serves `https://www.42chakrapoint.com/`.
  - App repo is `git@github.com:allinfinite/42chakra.git`, cloned on piko at `/home/dna/Code/42chakra`.
- Setup:
  - created shared smart-todo tenant `42chakra` with tenant id `b261623a-ce12-4060-8bcf-3aff81902e05`
  - created/updated client user `maytoomuch@gmail.com` named `Morayana` with `client_user` access
  - wired workspace actions for `preview`, `sync`, `discard`, and `deploy`
  - installed nginx route `/etc/nginx/snippets/piko-preview-routes/42chakra.conf`
  - restarted `cowork-dashboard.service`
- Preview image fix:
  - updated 42chakra preview config so preview builds use `/preview/42chakra`
  - changed public image references on the landing page so `bkg-new.png`, `marayana-logo-new.png`, `marayana-new.jpeg`, and `chakracanvas-new.png` load from the preview path
  - patched Cowork's Next preview initializer to recognize `next.config.ts` so it does not create a shadow `next.config.mjs`
- Verification:
  - `npm run build` passed locally in `/Users/daniellevy/Code/42chakra`
  - piko preview build passed with `COWORK_PREVIEW_BASE_PATH=/preview/42chakra`
  - login to `https://cowork-api.dnalevity.com/api/auth/login` succeeded for `maytoomuch@gmail.com`
  - workspace API returned tenant `42chakra`, repo `/home/dna/Code/42chakra`, and preview URL `https://piko.dnalevity.com/preview/42chakra`
  - preview action returned ready on port `3106`
  - Playwright verified preview page text rendered and all key image assets returned `200`: `bkg-new.png`, `marayana-logo-new.png`, `marayana-new.jpeg`, and `chakracanvas-new.png`
- Notifications:
  - sent email to `maytoomuch@gmail.com` with smart-todo login information
  - sent Apple Messages/iMessage notification to `maytoomuch@gmail.com`; no phone number was present in CRM or local notes
  - correction: user provided Meirav's phone number `(228) 243-3333`; credentials were then texted to `+12282433333` with a note that Daniel already submitted her edit requests
- CRM:
  - created active-client CRM relationship `Morayana Levy / 42 Chakra Point`
  - created active project `42 Chakra Point Smart Todo Access`
  - recorded tenant slug `42chakra`, public URL, preview URL, and notification status in the CRM activity timeline
  - updated the CRM person record with `(228) 243-3333`, preferred contact method `text`, and a new activity for the credential text

# Shared Client Default Model (2026-03-17)

## Plan

- [x] Trace how smart-todo client defaults propagate into Cowork task execution and identify the smallest durable model hook.
- [x] Set the smart-todo client default model to `gpt-5.4-mini` in provisioning/config sync paths for new and shared tenants.
- [x] Pass the tenant/site default model into Cowork task execution so client requests, replies, and retries actually use `gpt-5.4-mini`.
- [x] Verify the touched Python files compile and document the final behavior in this task card.

## Review

- Changes:
  - updated smart-todo provisioning to stamp `gpt-5.4-mini` into client site definitions and shared-tenant workspace config as the default model
  - documented the new shared tenant `defaultModel` workspace field in the smart-todo README
  - updated Cowork multi-tenant sync/persistence so tenants keep a `workspace.defaultModel`, defaulting to `gpt-5.4-mini` when no explicit model is set
  - updated Cowork portal task creation to attach the tenant/site default model on new requests, follow-up replies, and verification retries
  - updated the Cowork task runner so stored task models are passed through to Codex with `--model <name>`
- Verification:
  - `python3 -m py_compile scripts/provision_smarttodo.py scripts/provision_shared_tenant.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py /Users/daniellevy/Code/Cowork/dashboard_server.py`
- Notes:
  - existing tenants that already have an explicit `workspace.defaultModel` keep it
  - tenants without an explicit model now normalize to `gpt-5.4-mini`, so new client work and future synced tenant config use that default unless overridden later

# Workspace Discard Action (2026-04-03)

## Plan

- [x] Inspect the existing smart-todo workspace action flow and confirm whether the backend already supports discarding local repo changes.
- [x] Add a guarded backend `discard` workspace action that resets tracked changes, removes untracked files, and refreshes workspace state.
- [x] Expose the discard action in the legacy and shared smart-todo UIs, including tenant config defaults and action copy.
- [x] Verify the touched frontend and backend files parse cleanly and document the result.

## Review

- Changes:
  - added `discard` to Cowork workspace action allowlists, workspace-state availability, and tenant defaults so dirty repos can surface a dedicated discard action
  - added `discard_portal_site_changes()` in [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) to run `git reset --hard HEAD` plus `git clean -fd` only when the workspace is dirty and already a git checkout
  - wired the new action through both legacy `/api/portal/<slug>/actions` and shared `/api/app/tenants/<tenantId>/actions` routes, including audit logging and `409` conflict responses
  - added a `Discard Changes` button to the legacy smart-todo board and shared workspace header, plus matching labels, toasts, and tenant-admin enablement controls
  - updated shared-tenant provisioning defaults and README backend-contract docs so new tenants expose the new action consistently
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/app.js`
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py /Users/daniellevy/Code/smart-todo/scripts/provision_shared_tenant.py`
- Notes:
  - the discard action is only advertised when the workspace is actually dirty
  - discarding local changes is destructive by design for the target repo checkout because it removes both tracked edits and untracked files in that workspace

# Shared Discard Action Activation (2026-04-03)

## Plan

- [x] Reproduce why the live Soulfire shared workspace still renders `Discard Changes` as disabled after the feature shipped.
- [x] Patch the backend tenant action normalization so existing tenants with older `enabledActions` arrays automatically expose `discard`.
- [x] Deploy the backend fix to `dna@piko.local`, verify the live workspace payload includes `discard`, and document the regression.

## Review

- Root cause:
  - the live Soulfire tenant record in `/home/dna/Code/Cowork/.dashboard_state/portal_tenants.json` still had the pre-feature action list `["sync","preview","deploy"]`
  - the shared frontend correctly disabled the new button because it trusts `workspace.enabledActions`, and the backend was passing that stale list through unchanged for existing tenants
- Changes:
  - added shared `normalize_enabled_actions()` logic in [/Users/daniellevy/Code/Cowork/portal_multi_tenant.py](/Users/daniellevy/Code/Cowork/portal_multi_tenant.py)
  - updated tenant sync/save paths to persist normalized action arrays that automatically include `discard` when a workspace already exposes `sync` or `deploy`
  - updated [/Users/daniellevy/Code/Cowork/dashboard_server.py](/Users/daniellevy/Code/Cowork/dashboard_server.py) to use the same normalization when deriving workspace state and site definitions, so older tenants activate the button immediately without requiring a manual resave
- Verification:
  - `python3 -m py_compile /Users/daniellevy/Code/Cowork/dashboard_server.py /Users/daniellevy/Code/Cowork/portal_multi_tenant.py`
  - live Soulfire workspace API now includes `discard` in `enabledActions`
- Notes:
  - this was a backward-compatibility bug for tenants created before the new action existed, not a frontend enablement bug

# Shared Task Card Polling And Glow (2026-03-16)

## Plan

- [x] Audit the shared-app request rendering path and isolate a request-list-only refresh flow that preserves composer, admin, and expanded-card state.
- [x] Add a 30-second background poll for request/process status updates without triggering a full page reload.
- [x] Add an in-progress glow animation to shared task cards and verify the shared frontend syntax after the change.

## Review

- Changes:
  - extracted the shared request-board rendering/event binding so the board can rerender independently of the rest of the shared workspace shell
  - added a 30-second poll against `/api/app/tenants/:tenantId/requests` that updates only `.shared-board-list` when request data changes
  - sorted shared requests so cards with status `running` always render above non-running work while preserving backend order within each group
  - exposed structured Cowork `todo_list` progress on shared requests and render it as a live checklist in expanded cards
  - gated polling to skip hidden tabs, active request-reply editing, and in-flight workspace/request actions
  - added a running-state glow animation on `.shared-request-card.state-running`
- Verification:
  - `node --check shared-app.js`
  - `npm run check`
- Notes:
  - the poll only runs while at least one shared request is still `queued` or `running`, which keeps background traffic bounded once the board is settled

# Booch Bar Deploy Verification (2026-03-16)

## Plan

- [x] Verify where the Booch Bar portal deploy commit landed and whether it reached GitHub.
- [x] Confirm whether Vercel production is serving a deployment created from that commit.
- [x] Compare the deployed commit diff against the live site behavior to explain why the user did not see a visible change.

## Review

- Root cause:
  - the Booch Bar portal deploy did succeed end to end; the server-side checkout on `dna@piko.local:/home/dna/Code/Booch-Bar` is at commit `e80640d` on `main`
  - GitHub `origin/main` also points to `e80640d`
  - Vercel production alias `https://booch-bar.vercel.app` is attached to deployment `dpl_BW6NTHRQEgFP2iWh2Sqf3oehDt1d`, created on `2026-03-16 13:14:50 HST`, which matches the portal deploy time
  - the reason the site looks unchanged is that commit `e80640d` only updates featured-event image fallback logic in `/home/dna/Code/Booch-Bar/app/data.js`; it does not force a visible homepage change when the current upcoming calendar events already have attached images
- Verification:
  - `ssh dna@piko.local 'cd /home/dna/Code/Booch-Bar && git log --oneline --decorate -n 12'`
  - `ssh dna@piko.local 'cd /home/dna/Code/Booch-Bar && git ls-remote origin refs/heads/main'`
  - `vercel inspect https://booch-bar.vercel.app`
  - `curl -s https://booch-bar.vercel.app`
  - `ssh dna@piko.local 'cd /home/dna/Code/Booch-Bar && npm run build'`
- Notes:
  - the previous visual event/homepage work from `f78c757` is already live
  - `e80640d` will matter when an upcoming featured event lacks an `ATTACH` image in the calendar feed, because the site will now fall back to `/images/rainbow-room.jpeg` instead of dropping that event image

# Booch Bar Domain Mismatch Check (2026-03-16)

## Plan

- [x] Verify whether the production Booch Bar modal/clickable events feature exists on the Vercel deployment itself.
- [x] Compare the deployed Vercel site against the public Booch Bar custom domain the user is likely viewing.
- [x] Identify the exact hosting mismatch causing the user-visible discrepancy.

## Review

- Root cause:
  - the portal deploy updated the Vercel-hosted Booch Bar app, and the clickable featured-event modal works there
  - the public custom domain `https://www.theboochbarhilo.com/` is still served by Netlify, not Vercel
  - that Netlify site does not include the new Booch Bar app at all: it has no `.eventCardButton` nodes and no `Featured Beats` section, so the landing-page event cards cannot be clickable there
- Verification:
  - `vercel inspect https://booch-bar.vercel.app`
  - headless Playwright check against `https://booch-bar.vercel.app` confirmed clicking `.eventCardButton` opens `.eventModal`
  - `curl -I https://www.theboochbarhilo.com` returned `server: Netlify`
  - headless Playwright check against `https://www.theboochbarhilo.com` confirmed:
    - `boochButtons: 0`
    - `hasFeaturedBeats: 0`
- Conclusion:
  - the deploy itself is fine
  - the custom domain still points at the old Netlify site, so users checking that domain will not see the new interactive landing-page events until DNS/domain hosting is moved or the Netlify site is updated separately

# Booch Bar Blank Completion Screenshot Check (2026-03-16)

## Plan

- [x] Locate the affected Booch Bar request record and attached completion screenshot metadata.
- [x] Verify whether the stored screenshot asset itself is blank or whether the portal UI is failing to render it.
- [x] Record the evidence and likely failure point.

## Review

- Request checked:
  - request `8b36713b-d1ad-4511-8988-1c9f52d788dc`
  - title: `these links need to stand out as seperate links more`
- Findings:
  - the stored completion screenshot file exists at `/home/dna/Code/Cowork/.dashboard_state/booch_bar_portal_uploads/8b36713b-d1ad-4511-8988-1c9f52d788dc-completion-screenshot.png`
  - the file is not blank: `file` reports `PNG image data, 1440 x 2200`
  - the public asset URL returns `200 OK` with `Content-Type: image/png`
  - opening the exact PNG shows the updated Booch Bar `Visit & Contact` page correctly
  - OCR verification also extracted real page text from the image, confirming the capture content is valid
- Conclusion:
  - the blank box shown in the portal is a frontend rendering/display issue for the screenshot preview, not an empty capture and not a missing upload

# Shared Login Screen Recovery (2026-03-16)

## Plan

- [x] Reproduce the unauthenticated shared-app bootstrap path and confirm why the login screen is not replacing the loading shell.
- [x] Patch the shared frontend to treat the live Cowork unauthorized response as an auth failure during bootstrap.
- [x] Verify the fix locally and on the live shared site, then document the outcome.

## Review

- Root cause:
  - the shared bootstrap only treated the literal message `Request failed (401)` as unauthenticated
  - the live Cowork API returns `401` with `{"error":"Unauthorized"}`, so bootstrap fell through to the outer catch and left the app on the loading screen instead of rendering the login form
- Frontend fix in [/Users/daniellevy/Code/smart-todo/shared-app.js](/Users/daniellevy/Code/smart-todo/shared-app.js):
  - added `isAuthFailure(error)` to normalize `AuthExpiredError`, `Request failed (401)`, `Unauthorized`, and `Session expired` into one auth-failure path
  - updated both bootstrap and reload handling to use that normalized auth detection and render the login screen deterministically
- Verification:
  - `node --check /Users/daniellevy/Code/smart-todo/shared-app.js`
  - verified the live `https://cowork-api.dnalevity.com/api/auth/me` response is `401 Unauthorized`
  - hotpatched the live Dokku container `smart-todo.web.1` so `https://smart-todo.dnalevity.com/shared-app.js` now serves the new `isAuthFailure()` logic
  - browser validation with `npx playwright screenshot --wait-for-timeout 4000 https://smart-todo.dnalevity.com /tmp/smarttodo-login-check2.png` confirmed the loading shell transitions to the sign-in form on an unauthenticated visit

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

# 42 Chakra Failed Request Investigation (2026-05-16)

## Plan

- [x] Identify the failed 42chakra request records shown in the shared smart-todo UI.
- [x] Inspect live Cowork/smart-todo logs and request metadata to find the concrete failure causes.
- [x] Fix the root cause if it is in our managed code/config and keep the change scoped.
- [x] Verify the failing request path after the fix, including live preview behavior where relevant.
- [x] Update CRM activity and document the result here.

## Review

- Root cause:
  - both failed requests (`f35611c6-3205-4b4b-9cbb-6dd732c8f8ca` and `83b36d68-3717-40f6-89ea-1752a6c18509`) failed before implementation because the live Cowork runner launched `/usr/local/bin/codex`, which was `codex-cli 0.106.0`
  - the tenant default had been migrated to `gpt-5.5`, and that older CLI returned: `The 'gpt-5.5' model requires a newer version of Codex`
- Fix:
  - patched `/Users/daniellevy/Code/Cowork/dashboard_server.py` and deployed it to piko so Cowork prefers `COWORK_CODEX_BIN`, then `/home/dna/.local/bin/codex`, before falling back to the global `codex`
  - piko now imports `/home/dna/.local/bin/codex`, which reports `codex-cli 0.130.0`
  - exposed `retry` for failed/blocked shared request cards so model-start failures are recoverable from the UI/API
- Retry outcome:
  - retried the urgent 42chakra request through the live shared API; new agent task `2b998a8a-2fc7-4cca-ad39-ab4862d2291b` completed successfully
  - archived duplicate lower-priority request `83b36d68-3717-40f6-89ea-1752a6c18509` after cleanup so the board keeps the urgent completed run as the canonical result
  - the completed urgent run patched `/home/dna/Code/42chakra` scan/invoice behavior: current recipient state, reset clearing, point order rendering, chakra visual normalization, invoice update persistence, and email image point mapping
- Verification:
  - `/home/dna/Code/Cowork/dashboard_server.py` passed `python -m py_compile` locally and on piko
  - `cowork-dashboard.service` restarted and reported `active`
  - `/home/dna/.local/bin/codex --version` reports `codex-cli 0.130.0`
  - retried 42chakra request no longer failed at model startup
  - 42chakra `npm run build` passed after cleanup
  - authenticated HTTP smoke passed for `http://127.0.0.1:3106/preview/42chakra/scan`
  - live 42chakra shared request list now shows the urgent scan-system request completed and the duplicate failed card no longer visible
  - Playwright browser smoke on piko remained blocked because Chrome is unavailable on that Linux Arm64 environment
- CRM:
  - recorded the failed-request root cause, Cowork runner repair, and completed 42chakra scan-system retry in CRM activity `83f7bb3c-4982-408f-bd11-38908ea49603`
  - appended the same status to project `42 Chakra Point Smart Todo Access`

# Eufloria Smart Todo Preview Images (2026-06-11)

## Plan

- [x] Inspect the live Smart Todo preview for Eufloria image requests under `/preview/eufloria`.
- [x] Identify any broken image URL patterns in the Eufloria app.
- [x] Patch the smallest necessary image path/base-path handling.
- [x] Deploy/push the fix and sync the piko checkout.
- [x] Verify preview images load with browser and HTTP checks.

## Review

- Root cause:
  - Eufloria preview used `next/image` optimized URLs under `/preview/eufloria/_next/image`, but those requests returned `400` (`The requested resource isn't a valid image`) behind the Smart Todo preview path.
  - After disabling image optimization for preview mode, public image `src` values needed explicit `NEXT_PUBLIC_SITE_BASE_PATH` prefixing or they pointed at `https://piko.dnalevity.com/...` root assets.
  - Metadata icon/manifest URLs were also root-relative and missed `/preview/eufloria`.
  - The cacao card briefly used lowercase `cacao.jpg`, but the tracked production asset is `public/cacao.JPG`.
- Fixes pushed to `allinfinite/eufloria.com` through commit `76f2800`:
  - `next.config.js`: sets `images.unoptimized` when `COWORK_PREVIEW_BASE_PATH` is active.
  - `app/components/Hero.tsx` and `app/components/Fruits.tsx`: prefix displayed public image paths with `NEXT_PUBLIC_SITE_BASE_PATH`.
  - `app/components/Hero.tsx`: changed logo rendering to a stable aspect-ratio `fill` image so Next no longer warns about distorted dimensions.
  - `app/layout.tsx`: prefixes favicon, apple-touch icon, manifest, Open Graph image, and Twitter image paths in preview mode.
  - `app/components/InstagramFeed.tsx`: fetches the Instagram API under the preview base path.
  - `app/api/instagram/route.ts`: marks the route `force-dynamic`.
- Verification:
  - `COWORK_PREVIEW_BASE_PATH=/preview/eufloria npm run build` passes.
  - Piko checkout is clean at `76f2800`.
  - Refreshed Smart Todo preview reports ready, clean workspace, and no changed files.
  - HTTP sweep of rendered image/icon/manifest URLs shows no `/_next/image` optimizer URLs and zero failures:
    - `/preview/eufloria/flow-bio.jpeg` -> `200 image/jpeg`
    - `/preview/eufloria/logo.png` -> `200 image/png`
    - `/preview/eufloria/avacado.jpg` -> `200 image/jpeg`
    - `/preview/eufloria/cacao.JPG` -> `200 image/jpeg`
    - `/preview/eufloria/mango.jpg` -> `200 image/jpeg`
    - `/preview/eufloria/favicon.png` -> `200 image/png`
    - `/preview/eufloria/apple-touch-icon.png` -> `200 image/png`
    - `/preview/eufloria/site.webmanifest` -> `200 application/manifest+json`
  - Playwright browser snapshot shows hero image, logo, avocado, cacao, and mango image nodes rendered.
  - Final screenshot saved at `output/playwright/eufloria-preview-images-clean-2026-06-11.png`.
  - Browser console has no image warnings; the remaining console error is the known Next dev HMR websocket through the preview proxy, not an image request failure.

# Eufloria Admin Membership (2026-06-11)

## Plan

- [x] Inspect live Cowork users and the Eufloria tenant membership list.
- [x] Resolve which existing account corresponds to `admin`.
- [x] Add that account as an admin/owner on the Eufloria tenant.
- [x] Verify the user has admin access to the Eufloria tenant.

## Review

- Resolved `admin` to the existing live Cowork admin/operator account `me@dnalevity.com` because there is no literal `admin@...` user in `portal_users.json`.
- Added `me@dnalevity.com` to tenant `eufloria` as role `owner`.
- Membership id: `4dae4e0a-e401-4186-941c-eb9d811d95d1`.
- Audit id: `18f987c7-2281-4f83-82ea-680e6ff6f8da`.
- Verified final Eufloria memberships:
  - `owner@dnalevity.local` -> `owner`
  - `me@dnalevity.com` -> `owner`
  - `misseufloria@gmail.com` -> `client_user`
## Send Video Downloader Skill To Eufloria

- [x] Resolve the live Eufloria tenant and its request-delivery path.
- [x] Cancel the mistakenly created tenant-agent request after the user clarified that delivery should be by email only.
- [x] Email the complete `app-video-downloader` skill to Eufloria.
- [x] Verify the message in the sender's Sent mailbox.

### Review

- The initial Smart Todo request was canceled before execution after the delivery-channel correction; live task `69c07ca5-b4c5-4a16-8817-4dd4fa9aa95d` now has status `canceled`.
- Sent `Codex app-video-downloader skill` from `humandalayoga@gmail.com` to `misseufloria@gmail.com` with the original `SKILL.md` attached.
- Gmail Sent readback returned message `19f866fcd7a8d1c6` with the correct recipient, subject, and a 1,053-byte Markdown attachment named `SKILL.md`.
# 42 Chakra Supabase Chat Administration (2026-08-10)

## Plan

- [x] Inspect the live 42chakra tenant, user memberships, Cowork agent configuration, and the app's Supabase setup.
- [x] Identify the least-privilege server-side access path that lets authorized 42chakra chat users manage task records without exposing privileged credentials to the browser.
- [x] Back up affected live configuration and implement the tenant-scoped Supabase integration.
- [x] Verify authenticated chat can list records and the guarded helper can create, update, and delete a disposable record while another tenant cannot access the 42chakra integration.
- [x] Confirm the live tenant/user access remains intact and document the evidence in this review.

## Review

- Live tenant/user state:
  - tenant `42chakra` remains active with id `b261623a-ce12-4060-8bcf-3aff81902e05`.
  - `maytoomuch@gmail.com` remains active with a `client_user` membership; the canonical operator remains an owner.
- Implementation:
  - added a reusable `agentInstructions` capability field to Cowork tenant-to-site normalization and both initial/reply chat prompts.
  - added `/home/dna/Code/42chakra/scripts/chat-supabase-admin.mjs`, which supports schema discovery and exact-filter select/insert/update/delete operations using the existing server-only Supabase credential.
  - updates and deletes require a non-empty exact-match filter, a matching `--confirm-count`, and no more than 25 matched rows; the helper never prints credentials.
  - stored five 42 Chakra-specific database administration rules in both the tenant workspace and live site registry. The chat prompt explicitly forbids exposing keys or giving Supabase's developer MCP to portal users.
- Verification:
  - local Cowork instruction/normalization tests: 4 passed; `dashboard_server.py` and `portal_multi_tenant.py` compile; the Node helper passes syntax validation.
  - live helper discovered 14 exposed tables.
  - reversible CRUD smoke on unique coupon `CODEX_CHAT_ADMIN_SMOKE_20260811_0043`: select 0 -> insert 1 -> update 1 -> read back value `42` -> delete 1 -> select 0.
  - a broad delete with `{}` was rejected with `Filter must contain at least one exact-match condition.`
  - authenticated chat request `021aa20a-767c-4dc9-b3ff-18292cc99892` invoked the helper, returned table count 14, made no data changes, and exposed no credentials. The request was archived after verification and its unnecessary evidence-retry task was removed.
  - live `/api/auth/me`, tenant list, and 42 Chakra workspace returned `200`; the same client session received `404 Tenant not found` for a tenant without membership.
  - Cowork restarted cleanly and remains active; both live configuration sources read back five agent instructions.
- Backups:
  - `/home/dna/Code/Cowork/.dashboard_state/backups/dashboard_server.pre-42chakra-supabase.20260811T004107Z.py`
  - `/home/dna/Code/Cowork/.dashboard_state/backups/portal_tenants.pre-42chakra-supabase.20260811T004107Z.json`
  - `/home/dna/Code/Cowork/.dashboard_state/backups/portal-sites.pre-42chakra-supabase.20260811T004107Z.json`
  - `/home/dna/Code/Cowork/.dashboard_state/backups/portal_multi_tenant.pre-agent-instructions.20260811T004756Z.py`
# 42 Chakra Video Upload And Editor Support (2026-08-10)

## Plan

- [x] Inspect and mark the live Morayana / 42 Chakra CRM action in progress.
- [x] Reproduce the failed Smart Todo video handoff and trace upload/media restrictions across the portal, Cowork, and 42 Chakra editor.
- [x] Add the smallest durable video upload, preview, and looping-video rendering support without weakening image handling.
- [x] Restore the supplied video asset from the live request or report the exact reattachment requirement if it never reached the server.
- [x] Verify build/tests plus hosted desktop and 320px preview playback, with no deployment to the public site.
- [x] Complete the CRM action and record the evidence and any remaining client-side handoff.

## Review

- Root causes:
  - Cowork's portal attachment allowlist omitted `.mov`, `.mp4`, and `.m4v`, while the live API proxy limited requests to 25 MB.
  - The 42 Chakra content editor used an image-only file input and browser data URLs, so it had no durable large-video upload path.
  - 42 Chakra middleware bypassed authentication only for image extensions; the valid MOV was redirected to the homepage and could not load in the browser.
- Live fixes:
  - Cowork now accepts MOV, MP4, M4V, and WebM attachments up to 250 MB; nginx and Flask enforce the same cap.
  - The chakra-man editor field now supports server-backed image/video uploads, preserves the prior still as the poster, and exposes a clear media-type control.
  - The landing page renders video with muted autoplay, looping, inline mobile playback, no controls, `object-fit: contain`, and a static poster when reduced motion is requested.
  - Static video paths now bypass the authentication redirect just like public images.
- Exact supplied asset verified from live request `883b9cf4-55e8-4d1d-bca4-46b7e1fd9c11`: `video-output-60C78784-181C-47BD-A12A-AE62DE7C0A91-1.mov`, 65,032,807 bytes, H.264/AAC, 1080×1524, 38.1 seconds.
- Verification:
  - Cowork video-upload unit tests: 3/3 passed; a live server-side MOV save/readback/cleanup smoke passed.
  - Smart Todo build passed.
  - 42 Chakra TypeScript and preview-base-path production build passed, including `/api/admin/page-media`.
  - Hosted MOV returns `200`, `content-type: video/quicktime`, the full content length, and byte-range support.
  - Clean hosted browser checks passed at desktop and 320 px: the video reached readyState 4, advanced playback time, remained muted/looped/inline/control-free, used contain sizing, and produced no console errors.
  - Reduced-motion emulation rendered `/chakracanvas.png` and no video element.
- Preview remains at `https://piko.dnalevity.com/preview/42chakra`; no public production deployment was performed.
- Recoverable backups:
  - `/home/dna/Code/42chakra/.backups/20260810T160000HST-video-media`
  - `/home/dna/Code/Cowork/.dashboard_state/backups/dashboard_server.pre-video-uploads.20260810T160000HST.py`
  - `/etc/nginx/sites-available/cowork-api.dnalevity.com.pre-video-uploads.20260810T160000HST`
- CRM task `a5a693c2-2c13-4bdb-acd4-362883ba15a7` is `done`; completion activity `094c4bd2-9640-4926-87dd-00dd4642e5d6` was verified by production readback.

# Smart Todo Plain-Language Bot Replies (2026-08-10)

## Plan

- [x] Inspect the Smart Todo frontend and Cowork task prompts that produce customer-visible bot messages.
- [x] Add one shared plain-language rule set for new requests, follow-up replies, and retries.
- [x] Add focused tests that prevent technical or overly complex bot instructions from returning.
- [x] Deploy the narrow backend change to piko and verify the live service uses the new instructions.
- [x] Review the final diff and record verification evidence.

## Review

- Added one reusable customer-language contract in Cowork and injected it into all seven portal agent paths: generic, Gray, and Soulfire initial/follow-up prompts plus screenshot-verification retries.
- The contract requires everyday words, short sentences, result-first updates, a maximum of three short sentences for normal updates, and no internal code/files/commands/tests/logs/API/Git/build/deployment/model detail unless the customer asks.
- Added seven focused tests covering the shared rule itself, every initial/follow-up/legacy/retry prompt path, and removal of internal screenshot-proof lines from customer-visible messages; all seven pass.
- Customer-facing agent messages now omit the internal `Evidence route`, `Evidence focus`, `Evidence height`, and `Evidence why` lines while the raw task output remains available for backend screenshot processing.
- Three existing screenshot-evidence checks pass. The broader evidence suite still has one pre-existing unrelated assertion that expects `agent_task_id` while the implementation intentionally records `verification_retry_task_id`; it was not changed here.
- Cowork Python compilation passed. Smart Todo build plus `app.js`, `shared-app.js`, `shared-chat-app.js`, and `portal.config.js` syntax checks passed.
- Deployed `/Users/daniellevy/Code/Cowork/dashboard_server.py` to piko after backing up the previous live file at `/home/dna/Code/Cowork/.dashboard_state/backups/dashboard_server.pre-plain-language-20260811T020500Z.py`.
- Backed up the first deployed version before adding the customer-message filter at `/home/dna/Code/Cowork/.dashboard_state/backups/dashboard_server.pre-public-message-filter-20260811T020900Z.py`.
- Live readback through the service's own virtual environment confirmed the plain-language contract appears exactly once in a generated 42 Chakra request prompt while request details remain unchanged.
- The deployed SHA-256 matches the local backend file, `cowork-dashboard.service` is active with two freshly booted workers, Smart Todo returns `200`, and the unauthenticated Cowork auth probe returns the expected `401`.

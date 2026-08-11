# Lessons

## 2026-07-28

- Smart Todo has one canonical admin identity: `me@dnalevity.com`. Do not treat the legacy bootstrap account `owner@dnalevity.local` as a second admin; keep the bootstrap email configured to the canonical account and verify inactive legacy accounts cannot log in.

## 2026-05-14

- Smart Todo client login should be presented as email plus password. Do not describe the user-facing gate as a single shared portal password unless the target is explicitly a legacy password-only portal.
- If a client text number is not found, report the missing phone number instead of treating an email-address iMessage handle as equivalent to a requested text message unless the user explicitly asked for that handle.
- When the user provides corrected client contact info, immediately update the CRM contact record and activity timeline so future outreach uses the corrected channel.
- For major UI redesigns, do not replace the public live Smart Todo surface first. Ship the new experience behind a secret link or feature gate, verify the public route still renders the current production UI, and only promote it after explicit approval.
- When using `serve -s`, do not rely on arbitrary `.html` or directory routes for hidden variants because SPA fallback can rewrite them to the root app. Prefer a query-gated loader or an explicitly verified route.
- Do not ship an end-user freshness gate that can only fail closed. If Git sync is blocked by dirty local changes, the backend must automatically preserve those changes in a recoverable stash/branch and continue updating, while the frontend keeps at least refresh/retry feedback available.
- Do not use browser `SpeechRecognition` for Smart Todo dictated requests. It can auto-end with `no-speech` before the user finishes; record audio until the user explicitly presses Stop, transcribe server-side with local Whisper, and delete temporary audio artifacts after transcription.
- When integrating a local CLI, verify the exact installed binary's flags with a real input file on the target server. Do not assume flags from another Whisper implementation or version; unsupported flags can exit without an error code and leave the app with empty output.
- Chat-style Smart Todo interactions must render the user's submitted message optimistically before waiting for Cowork. Waiting for the task/reply API response makes the send action feel broken even when the backend is working.
- Do not start parallel Cowork agent tasks for follow-up replies on an already running Smart Todo request. Queue those replies visibly, let users delete queued items, and promote one queued reply after the active task leaves `queued`/`running`.
- For Smart Todo multipart submits, never rebuild upload payloads from the raw form file input after rendering. Use the app-tracked file list, because text-only browser forms can still expose an empty file part with `filename=""` that Cowork rejects.
- When a user supplies the missing phone number after a credential-delivery blocker, immediately update the live CRM phone/preferred channel, record an activity, then send through the requested SMS path using the already-verified credentials.
- For Smart Todo chat UI fixes, verify both the request-history card count and the selected-thread transcript depth. The request list can be complete while the thread still hides older agent messages if the API only exposes `latest_message`.
- After Smart Todo tenant provisioning or backend reload work, re-check every named client account with `list_memberships_for_user` and the live `/api/auth/me` membership payload. A valid user plus valid tenant is still broken if `portal_memberships.json` lost the client row.

## 2026-03-13

- When targeting `piko.local`, do not assume the local macOS username is the SSH username. Verify or use the user-provided SSH target explicitly, currently `dna@piko.local`.
- For this project, the Python Cowork backend runs on `dna@piko.local` under systemd, while the `smart-todo` frontend should be deployed separately; do not default shared-app hosting to Vercel when the user wants piko-hosted runtime.
- When repairing the live Cowork backend, verify the exact shared-app API route on the deployed service with a direct request before assuming the frontend is at fault.
- For shared-app button regressions, verify the exact live response codes for `preview`, `sync`, `deploy`, and admin endpoints before saying buttons are broken; treat `409` workspace conflicts as user-facing status, not generic failure.
- When a shared-app success message includes a URL, render it as a real link and wire the primary success path directly to that destination if it is the expected next step, especially for preview startup.
- If a preview route works in raw HTTP and a clean browser profile but fails in the active browser session, treat it as stale browser redirect/cache state and harden the product path with a cache-busting preview URL instead of changing a healthy server route.
- When reusing CSS from the old split desktop layout, audit global desktop rules like `body { overflow: hidden }` and `page-shell { height: 100vh }` so shared-mode pages are not accidentally locked from scrolling.
- When shared cards display completed work, prefer the existing public completion fields and sanitize the first accomplishment sentence for plain-language UI instead of dumping raw agent output with file paths, commands, or verification logs.
- In the shared app, `client_user` must not see tenant/account management controls; treat the admin drawer as owner/internal-operator only and verify that in a browser session after role changes.
- For new shared-app tenants on piko, preview is not done when the dev server starts; verify the nginx preview route snippet exists too, or the browser will still see a public `404`.
- For preview-patched Next apps, fixing `<img>` tags is not enough; audit inline `backgroundImage`, stylesheet `url(...)` assets, video sources, and any SSR-time `Math.random()` output or the preview will still show 404s and hydration warnings.
- In the shared client, handle `401` centrally inside the fetch wrapper; otherwise individual actions like request submit or workspace load can keep firing with stale auth and leave the UI in a broken half-logged-in state.
- When matching the old portal look in shared mode, do not assume the workspace action buttons should fill a multi-column desktop grid; verify the visual density in a real browser and keep these controls compact unless the user explicitly wants oversized hero buttons.
- After a desktop sizing fix, re-check the narrow breakpoint separately; mobile-only `width: 100%` overrides can silently keep shared workspace actions oversized on phones.
- For shared auth on a separate API subdomain, do not rely on `localStorage` alone; send `credentials: "include"` and issue an API-domain session cookie so refreshes survive Safari/local-storage edge cases.

## 2026-03-14

- When changing shared-app request or reply submission formats, patch the matching Cowork `/api/app/tenants/:tenantId/{requests,replies}` handlers in the same turn and verify they parse the same field names as the frontend before calling the feature done.
- For shared request submit fixes, verify the full post-submit chain on the live tenant (`POST /requests`, then `GET /requests`, then `GET /workspace`) because a successful create can still leave the UI broken if the follow-up workspace refresh path is brittle.
- In shared mode, do not gate initial app bootstrap on a `localStorage` token; always probe `/api/auth/me` so a valid API-domain session cookie can restore the user after refresh or storage failures.
- For portal completion proof, do not surface a completion screenshot to the user until the backend analyzes the captured image itself and confirms it plausibly shows the finished work; fail closed and keep only internal verification metadata when the proof is weak.
- If screenshot verification fails for a completed portal task, do not stop at hiding the screenshot; automatically reopen the same request with a remediation prompt so the system either fixes the work or chooses better proof before the user sees a “done” state.
- For portal request controls, do not stop at adding cancel/archive buttons in the UI; wire server-side request actions too, terminate the live agent process on cancel, and dedupe repeated create-posts so fast double submits do not produce duplicate cards.

## 2026-03-16

- For first-time shared-tenant repo bootstrap, do not assume a saved GitHub `https://` URL will clone on the server. Disable interactive git prompts and retry GitHub clones over SSH automatically so private repos can connect without manual server edits when SSH access is already configured.

## 2026-03-16

- For Cowork-backed admin actions, do not stop after patching local backend files and frontend UI; verify the live `cowork-api.dnalevity.com` route advertises the new method and deploy/restart `cowork-dashboard.service` on `dna@piko.local` before calling the feature done.
- For new browser-facing Cowork API methods, verify the live preflight response from `https://smart-todo.dnalevity.com` includes the method in `Access-Control-Allow-Methods`; adding the Flask route alone is not enough.
- For shared auth, audit both cookie persistence and server-side session invalidation rules; a “random logout” can come from session-cookie lifetime or from backend code that wipes prior sessions on each new login.
- For portal completion proof, do not map screenshot-capture or OCR-verification failures directly onto the user-facing request status; evidence collection can fail even when the implementation itself is complete.
- In the shared portal UI, do not collapse unknown backend task states into `Queued`; if Cowork emits statuses like `interrupted`, either surface them explicitly or provide a retry path so stale work does not look idle.
- For shared-tenant initialization on the live Cowork backend, keep request-time work bounded and deterministic. Do not launch Codex runs, full Next builds, or other long-running repo normalization inside `sync` or `preview` web requests; move that work to an async job or an explicit operator action.
- After any preview-path or middleware change for a tenant app, verify both classes of assets on the live preview URL: prefixed `_next` assets and any root-relative `/images/...` assets. A preview page can return `200` while still rendering unstyled or image-broken if those two routes are not checked separately.

## 2026-04-03

- When adding a new shared workspace action, do not only update the default action lists for new tenants. Normalize existing `workspace.enabledActions` records too, or the live UI will render the new control disabled for older tenants.
# Lessons Learned (2026-03-16)

- After any portal request finishes or a verification retry completes, check that the request record actually has a populated `completion_screenshot`; a `done` status alone is not enough for a reviewable card.
- In Cowork portal evidence handling, do not silently return on `Evidence route: none` when a completed request still lacks a `completion_screenshot`; queue another evidence repair path or keep the screenshot that was captured.
- In the shared auth bootstrap, do not key unauthenticated handling only on the literal string `Request failed (401)`; the live Cowork API can return `Unauthorized`, and the frontend must treat that as the same login-required state.
- When the user says "send [client] the skill," treat "send" as direct client communication (normally email when a verified address exists), not a Smart Todo agent-task handoff, unless they explicitly mention the tenant agent or portal.

## 2026-08-10

- Smart Todo renders Cowork agent messages almost verbatim, so “simple bot language” must be enforced in the backend prompt contract, not only by changing frontend labels. Apply the same non-technical, short-sentence rules to initial requests, follow-ups, and automatic retries, then verify the generated prompt in the live service runtime.
# OAuth Retry Verification (2026-08-10)

- When retrying a Codex MCP OAuth login, do not assume the CLI opened the newly printed authorization URL. Explicitly open the exact current URL, then verify the live OAuth store contains an unexpired authorization request for that same client ID before asking the user to sign in. Old browser tabs can otherwise keep showing a valid-looking but expired request.
- After resetting a password for browser authentication, do not trust clipboard contents or an existing password-manager value. Verify the new credential against the production login endpoint, transfer it through an ephemeral secure store, and inspect the browser field before submission.
- For OAuth forms protected by `form-action 'self'`, do not rely on the browser's implicit current-document action when the authorization URL has a long query string. Set an explicit same-origin POST action and verify an actual browser POST, not only the button's client-side state.
- OAuth `form-action` CSP also governs redirects after a successful form POST. A fake-password test proves only that the POST reaches the server; verify the accepted-credential redirect to the registered callback, and include only that exact callback origin in the authorization page policy.

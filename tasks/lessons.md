# Lessons

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
- For shared-tenant initialization on the live Cowork backend, keep request-time work bounded and deterministic. Do not launch Codex runs, full Next builds, or other long-running repo normalization inside `sync` or `preview` web requests; move that work to an async job or an explicit operator action.
- After any preview-path or middleware change for a tenant app, verify both classes of assets on the live preview URL: prefixed `_next` assets and any root-relative `/images/...` assets. A preview page can return `200` while still rendering unstyled or image-broken if those two routes are not checked separately.

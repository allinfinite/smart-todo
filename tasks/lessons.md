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

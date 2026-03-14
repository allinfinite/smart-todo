# Lessons

## 2026-03-13

- When targeting `piko.local`, do not assume the local macOS username is the SSH username. Verify or use the user-provided SSH target explicitly, currently `dna@piko.local`.
- For this project, the Python Cowork backend runs on `dna@piko.local` under systemd, while the `smart-todo` frontend should be deployed separately; do not default shared-app hosting to Vercel when the user wants piko-hosted runtime.
- When repairing the live Cowork backend, verify the exact shared-app API route on the deployed service with a direct request before assuming the frontend is at fault.
- For shared-app button regressions, verify the exact live response codes for `preview`, `sync`, `deploy`, and admin endpoints before saying buttons are broken; treat `409` workspace conflicts as user-facing status, not generic failure.

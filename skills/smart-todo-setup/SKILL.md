---
name: smart-todo-setup
description: Set up a new smart todo instance from a GitHub repo or Vercel project, including smart-todo portal config, Cowork workspace wiring, Vercel project/env setup, and the piko.local preview/dev server. Use when asked to add, create, or provision a new smart todo or client todo portal.
---

# Smart Todo Setup

Use this when the user wants a new smart todo instance for a site/app and gives either:
- a GitHub repo like `owner/repo` or a GitHub URL
- a Vercel project name or Vercel project URL

Work in the environment that exists:
- local desktop roots: `/Users/daniellevy/Code/smart-todo` and `/Users/daniellevy/Code/Cowork`
- piko roots: `/home/dna/Code/smart-todo` and `/home/dna/Code/Cowork`

If the request originates on piko through Telegram, prefer the programmatic path first:
- Telegram: `/smarttodo <repo-or-project>`
- Shell command: `/home/dna/bin/provision-smarttodo <repo-or-project>`
- Repo script: `/home/dna/Code/smart-todo/scripts/provision_smarttodo.py`

## Inputs

Normalize the target before editing anything:
- GitHub repo: extract `owner/repo`, derive the repo name, and derive a slug
- Vercel project: inspect the project first and resolve the backing app repo if possible
- Slug: lowercase, hyphenated, based on the app/project name

Use the Booch-Bar setup as the current reference pattern:
- smart-todo env example: `instances/booch-bar.env.example`
- Cowork dynamic site registry: `config/portal-sites.json`
- Cowork backend: `dashboard_server.py`
- preview gateway example: `config/piko-preview-gateway.nginx.conf.example`

## Workflow

1. Write a checkable plan in `tasks/todo.md` before non-trivial edits.
2. Ensure the target app repo exists under the matching `Code` root. Clone it if needed.
3. Create `instances/<slug>.env.example` in the smart-todo repo with:
   - `PORTAL_TEMPLATE_CONFIG_JSON`
   - branded title/copy/theme
   - `apiBase`
   - `/api/portal/<slug>/{requests,replies,workspace,actions}`
4. Update Cowork by writing the site entry into `config/portal-sites.json`:
   - define `app_dir`, `repo_dir`, `public_url`, preview `port`, preview `base_path`, and deploy branch
   - add allowed origins for the todo frontend
   - keep the preview port unique; continue the existing sequence after the highest assigned port
5. Ensure nginx preview routing is generated:
   - live piko routes: `/etc/nginx/snippets/piko-preview-routes/*.conf`
   - example gateway: `config/piko-preview-gateway.nginx.conf.example`
6. Prepare the app repo for preview routing:
   - install deps if missing
   - add preview-base-path support for `/preview/<slug>`
   - keep the root path working too
7. Configure Vercel if available:
   - app project: typically `<slug>`
   - todo project: typically `<slug>-todo`
   - connect GitHub repos
   - set `PORTAL_TEMPLATE_CONFIG_JSON` on the todo project for `production`, `preview`, and `development`
   - if Vercel is blocked, do not stop; finish local/piko setup and report the blocker
8. Start or refresh the piko preview/dev server and verify Cowork action wiring.

## Verification

Run the smallest convincing checks:
- app build succeeds at `/`
- app build or dev preview works at `/preview/<slug>`
- `python3 -m py_compile` for `dashboard_server.py` after backend edits
- workspace endpoint returns `200`:
  - `https://cowork-api.dnalevity.com/api/portal/<slug>/workspace`
- preview URL returns `200`:
  - `https://piko.dnalevity.com/preview/<slug>`
- if Vercel is in scope, inspect deployment state and report exact blockers

## Output

Finish with a concise summary containing:
- portal slug
- app repo path
- todo repo/project path
- workspace endpoint
- preview URL
- Vercel URLs or blockers

Do not claim completion without verification.

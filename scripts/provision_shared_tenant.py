#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_CLIENT_MODEL = "gpt-5.4-mini"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update a multi-tenant Smart Todo tenant.")
    parser.add_argument("slug")
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--repo-path", required=True)
    parser.add_argument("--app-path")
    parser.add_argument("--public-url", required=True)
    parser.add_argument("--preview-port", type=int, required=True)
    parser.add_argument("--preview-base-path")
    parser.add_argument("--deploy-branch", default="main")
    parser.add_argument("--user-email")
    parser.add_argument("--user-name")
    parser.add_argument("--user-password")
    parser.add_argument("--user-role", default="client_user")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    smart_todo_dir = Path(__file__).resolve().parents[1]
    cowork_dir = smart_todo_dir.parent / "Cowork"
    sys.path.insert(0, str(cowork_dir))

    from portal_multi_tenant import MultiTenantStore  # noqa: PLC0415

    state_dir = cowork_dir / ".dashboard_state"
    store = MultiTenantStore(state_dir)
    tenants_file = cowork_dir / "config" / "portal-sites.json"

    tenant = store.save_tenant(
        {
            "slug": args.slug,
            "displayName": args.display_name,
            "workspace": {
                "siteSlug": args.slug,
                "repoPath": args.repo_path,
                "appPath": args.app_path or args.repo_path,
                "publicUrl": args.public_url,
                "previewBasePath": args.preview_base_path or f"/preview/{args.slug}",
                "previewPort": args.preview_port,
                "deployBranch": args.deploy_branch,
                "defaultModel": DEFAULT_CLIENT_MODEL,
                "enabledActions": ["preview", "sync", "discard", "deploy"],
            },
        }
    )

    try:
      payload = json.loads(tenants_file.read_text()) if tenants_file.exists() else {}
    except json.JSONDecodeError:
      payload = {}
    if not isinstance(payload, dict):
      payload = {}
    payload[args.slug] = {
        "slug": args.slug,
        "display_name": args.display_name,
        "app_dir": args.app_path or args.repo_path,
        "repo_dir": args.repo_path,
        "default_model": DEFAULT_CLIENT_MODEL,
        "public_url": args.public_url,
        "preview": {
            "port": args.preview_port,
            "base_path": args.preview_base_path or f"/preview/{args.slug}",
        },
        "deploy": {"branch": args.deploy_branch},
        "tenant_id": tenant["id"],
    }
    tenants_file.parent.mkdir(parents=True, exist_ok=True)
    tenants_file.write_text(json.dumps(payload, indent=2))

    if args.user_email and args.user_password:
        user = store.get_user_by_email(args.user_email)
        if user:
            user = store.update_user(user["id"], {"name": args.user_name or user.get("name"), "password": args.user_password})
        else:
            user = store.create_user(
                {
                    "email": args.user_email,
                    "name": args.user_name or args.user_email.split("@")[0],
                    "password": args.user_password,
                    "status": "active",
                }
            )
        store.save_membership(user_id=user["id"], tenant_id=tenant["id"], role=args.user_role)

    print(json.dumps({"tenant": tenant, "portalSitesFile": str(tenants_file)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

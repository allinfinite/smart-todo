#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


VERCEL_SCOPE = "dnalevity"
DEFAULT_CLIENT_MODEL = "gpt-5.4-mini"
BUILTIN_PREVIEW_PORTS = {
    "samanayo": 3101,
    "soulfire": 3102,
    "dnalevity": 3103,
    "booch-bar": 3104,
}


def run(
    args: list[str],
    *,
    cwd: Path | None = None,
    input_text: str | None = None,
    check: bool = True,
    timeout: int = 1800,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        input=input_text,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(args)}\n"
            f"stdout:\n{result.stdout.strip()}\n\nstderr:\n{result.stderr.strip()}".strip()
        )
    return result


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized or "smart-todo"


def display_name_from_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-") if part)


def theme_for_slug(slug: str) -> dict[str, str]:
    palette = [
        {
            "bg": "#f4efe6",
            "paper": "rgba(255, 251, 245, 0.95)",
            "paperStrong": "rgba(255, 255, 251, 0.98)",
            "ink": "#171311",
            "muted": "#6c5a4d",
            "line": "rgba(48, 35, 22, 0.14)",
            "lineStrong": "rgba(48, 35, 22, 0.22)",
            "accent": "#a04a2f",
            "accentDark": "#7d3722",
            "ok": "#1f7a39",
            "warn": "#9a6a10",
            "fail": "#a72e24",
            "replyExternal": "#8a5a20",
            "bgTopLeft": "rgba(211, 163, 70, 0.18)",
            "bgRight": "rgba(160, 74, 47, 0.14)",
            "bgStart": "#f3ead8",
            "bgMid": "#faf6ed",
            "bgEnd": "#e9dcc4",
        },
        {
            "bg": "#ecf4f2",
            "paper": "rgba(247, 252, 251, 0.95)",
            "paperStrong": "rgba(255, 255, 255, 0.98)",
            "ink": "#10201d",
            "muted": "#4d6762",
            "line": "rgba(17, 49, 42, 0.14)",
            "lineStrong": "rgba(17, 49, 42, 0.22)",
            "accent": "#157061",
            "accentDark": "#0f584d",
            "ok": "#247f48",
            "warn": "#8a6518",
            "fail": "#a3342c",
            "replyExternal": "#4c6f3c",
            "bgTopLeft": "rgba(81, 167, 145, 0.18)",
            "bgRight": "rgba(21, 112, 97, 0.14)",
            "bgStart": "#e5f0ed",
            "bgMid": "#f5fbf8",
            "bgEnd": "#d8ebe5",
        },
    ]
    return palette[sum(ord(ch) for ch in slug) % len(palette)]


class Provisioner:
    def __init__(self, target: str, *, dry_run: bool = False, code_root: Path | None = None):
        self.target = target.strip()
        self.dry_run = dry_run
        self.home = Path.home()
        self.code_root = (code_root or (self.home / "Code")).expanduser()
        self.smart_todo_dir = self.code_root / "smart-todo"
        self.cowork_dir = self.code_root / "Cowork"
        self.portal_sites_file = self.cowork_dir / "config" / "portal-sites.json"
        self.nginx_site_file = Path("/etc/nginx/sites-available/piko.dnalevity.com")
        self.nginx_preview_dir = Path("/etc/nginx/snippets/piko-preview-routes")
        self.cowork_service = "cowork-dashboard.service"

        self.target_type = ""
        self.github_repo = ""
        self.vercel_project = ""
        self.repo_name = ""
        self.slug = ""
        self.display_name = ""
        self.app_dir: Path | None = None
        self.preview_port = 0
        self.preview_base_path = ""
        self.todo_project = ""
        self.todo_deploy_url = ""
        self.public_url = ""
        self.portal_password = ""

    def log(self, message: str) -> None:
        print(message, file=sys.stderr)

    def apply(self) -> dict[str, Any]:
        self.ensure_workspace()
        self.resolve_target()
        self.locate_or_clone_app_repo()
        self.preview_port = self.pick_preview_port()
        self.preview_base_path = f"/preview/{self.slug}"
        self.todo_project = f"{self.slug}-todo"
        self.public_url = f"https://{self.vercel_project or self.slug}.vercel.app"
        self.portal_password = self.slug.replace("-", "")

        config = self.render_portal_config()
        self.write_instance_env_example(config)
        self.write_portal_site_definition()
        self.patch_next_config()
        self.ensure_app_dependencies()
        self.verify_app_builds()
        self.ensure_nginx_include()
        self.write_nginx_preview_route()
        self.reload_nginx()
        self.ensure_todo_project_and_env(config)
        self.deploy_todo_project()
        self.restart_preview()
        workspace_url = f"https://cowork-api.dnalevity.com/api/portal/{self.slug}/workspace"
        preview_url = f"https://piko.dnalevity.com{self.preview_base_path}"
        self.wait_for_status(preview_url, expected_statuses={200}, timeout_seconds=90, interval_seconds=2)
        self.wait_for_workspace_preview_ready(workspace_url, timeout_seconds=90, interval_seconds=2)
        workspace_status = self.fetch_status(workspace_url, headers={"X-Portal-Password": self.portal_password})
        preview_status = self.fetch_status(preview_url)

        return {
            "target": self.target,
            "target_type": self.target_type,
            "slug": self.slug,
            "display_name": self.display_name,
            "repo_path": str(self.app_dir),
            "todo_project": self.todo_project,
            "todo_deploy_url": self.todo_deploy_url,
            "workspace_url": workspace_url,
            "workspace_status": workspace_status,
            "preview_url": preview_url,
            "preview_status": preview_status,
            "preview_port": self.preview_port,
            "dry_run": self.dry_run,
        }

    def ensure_workspace(self) -> None:
        if not self.smart_todo_dir.exists():
            raise RuntimeError(f"smart-todo workspace not found: {self.smart_todo_dir}")
        if not self.cowork_dir.exists():
            raise RuntimeError(f"Cowork workspace not found: {self.cowork_dir}")
        self.portal_sites_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.portal_sites_file.exists() and not self.dry_run:
            self.portal_sites_file.write_text("{}\n")

    def resolve_target(self) -> None:
        raw = self.target
        github_https = re.match(r"^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", raw)
        github_ssh = re.match(r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", raw)
        if github_https or github_ssh or re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", raw):
            match = github_https or github_ssh
            self.target_type = "github_repo"
            self.github_repo = match.group(1) + "/" + match.group(2) if match else raw
            self.repo_name = self.github_repo.split("/")[-1]
            self.vercel_project = slugify(self.repo_name)
        else:
            self.target_type = "vercel_project"
            self.vercel_project = raw.rsplit("/", 1)[-1]
            self.repo_name = self.vercel_project.removesuffix("-todo")

        self.slug = slugify(self.repo_name)
        self.display_name = display_name_from_slug(self.slug)
        self.log(f"Resolved target: type={self.target_type} slug={self.slug}")

    def locate_or_clone_app_repo(self) -> None:
        if self.target_type == "github_repo":
            exact = self.code_root / self.repo_name
            if exact.exists():
                self.app_dir = exact
                return
            matches = [path for path in self.code_root.iterdir() if path.is_dir() and slugify(path.name) == self.slug]
            if matches:
                self.app_dir = matches[0]
                return
            if self.dry_run:
                self.app_dir = exact
                return
            repo_url = f"git@github.com:{self.github_repo}.git"
            self.log(f"Cloning app repo: {repo_url}")
            run(["git", "clone", repo_url, str(exact)], timeout=600)
            self.app_dir = exact
            return

        matches = [path for path in self.code_root.iterdir() if path.is_dir() and slugify(path.name) == self.slug]
        if not matches:
            raise RuntimeError(
                f"Could not resolve a local repo for Vercel project '{self.vercel_project}'. "
                f"Expected a directory under {self.code_root} with slug {self.slug}."
            )
        self.app_dir = matches[0]

    def pick_preview_port(self) -> int:
        if self.slug in BUILTIN_PREVIEW_PORTS:
            return BUILTIN_PREVIEW_PORTS[self.slug]
        ports = set(BUILTIN_PREVIEW_PORTS.values())
        if self.portal_sites_file.exists():
            try:
                payload = json.loads(self.portal_sites_file.read_text())
            except json.JSONDecodeError:
                payload = {}
            if isinstance(payload, dict):
                for entry in payload.values():
                    if isinstance(entry, dict):
                        preview = entry.get("preview") if isinstance(entry.get("preview"), dict) else {}
                        port = preview.get("port") or entry.get("preview_port")
                        if port:
                            ports.add(int(port))
                existing = payload.get(self.slug)
                if isinstance(existing, dict):
                    preview = existing.get("preview") if isinstance(existing.get("preview"), dict) else {}
                    port = preview.get("port") or existing.get("preview_port")
                    if port:
                        return int(port)
        return max(ports) + 1

    def render_portal_config(self) -> dict[str, Any]:
        title = f"{self.display_name} Todo Portal"
        return {
            "portalTitle": title,
            "storageNamespace": f"{self.slug}-todo-portal",
            "apiBase": "https://cowork-api.dnalevity.com",
            "requestsPath": f"/api/portal/{self.slug}/requests",
            "repliesPath": f"/api/portal/{self.slug}/replies",
            "workspacePath": f"/api/portal/{self.slug}/workspace",
            "siteActionsPath": f"/api/portal/{self.slug}/actions",
            "authEyebrow": f"{self.display_name} Workspace",
            "authTitle": "Website updates",
            "authCopy": f"Enter the {self.display_name} portal password to review requests and ship the next site change.",
            "heroEyebrow": self.display_name,
            "heroTitle": f"Queue website work, preview it on piko, and publish the next change.",
            "heroCopy": f"Add the next {self.display_name} update, watch preview builds on piko, and keep the todo board in sync with the live app.",
            "composerTitle": f"Send work to the {self.display_name} site team",
            "boardTitle": f"{self.display_name} todo board",
            "waitingMessages": [
                f"Preview is warming up on piko for {self.display_name}. Add the next request while this one moves.",
                "Vercel is being updated in the background. Queue the next site improvement whenever it is ready.",
            ],
            "theme": theme_for_slug(self.slug),
        }

    def write_instance_env_example(self, config: dict[str, Any]) -> None:
        target = self.smart_todo_dir / "instances" / f"{self.slug}.env.example"
        payload = "PORTAL_TEMPLATE_CONFIG_JSON='" + json.dumps(config, indent=2) + "'\n"
        self.log(f"Writing smart-todo env example: {target}")
        if not self.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(payload)

    def portal_site_entry(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "display_name": self.display_name,
            "default_model": DEFAULT_CLIENT_MODEL,
            "app_dir": str(self.app_dir),
            "repo_dir": str(self.app_dir),
            "portal_password_default": self.portal_password,
            "allowed_origins_default": ",".join(
                [
                    f"https://{self.todo_project}.vercel.app",
                    "http://127.0.0.1:4173",
                    "http://localhost:4173",
                    "http://localhost:3000",
                ]
            ),
            "public_url": self.public_url,
            "preview": {
                "port": self.preview_port,
                "base_path": self.preview_base_path,
                "command": [
                    "npm",
                    "run",
                    "dev",
                    "--",
                    "--hostname",
                    "127.0.0.1",
                    "--port",
                    str(self.preview_port),
                ],
            },
            "deploy": {"branch": "main"},
            "section_id": f"portal-{self.slug}",
            "legacy_asset_path": "/portal-assets",
        }

    def write_portal_site_definition(self) -> None:
        payload: dict[str, Any] = {}
        if self.portal_sites_file.exists():
            try:
                raw = json.loads(self.portal_sites_file.read_text())
            except json.JSONDecodeError:
                raw = {}
            if isinstance(raw, dict):
                payload = raw
        payload[self.slug] = self.portal_site_entry()
        self.log(f"Updating Cowork portal registry: {self.portal_sites_file}")
        if not self.dry_run:
            self.portal_sites_file.write_text(json.dumps(payload, indent=2) + "\n")

    def patch_next_config(self) -> None:
        assert self.app_dir is not None
        package_json = self.app_dir / "package.json"
        if not package_json.exists():
            self.log("Skipping app patch: no package.json found.")
            return
        try:
            package = json.loads(package_json.read_text())
        except json.JSONDecodeError:
            self.log("Skipping app patch: invalid package.json.")
            return
        deps = {}
        if isinstance(package, dict):
            deps.update(package.get("dependencies") or {})
            deps.update(package.get("devDependencies") or {})
        if "next" not in deps:
            self.log("Skipping app patch: package is not a Next.js app.")
            return

        candidate = None
        for name in ("next.config.mjs", "next.config.js", "next.config.cjs"):
            path = self.app_dir / name
            if path.exists():
                candidate = path
                break
        if candidate is None:
            candidate = self.app_dir / "next.config.mjs"
            self.log(f"Creating Next config with preview base path support: {candidate}")
            if not self.dry_run:
                candidate.write_text(self.default_next_config_text())
            return

        content = candidate.read_text()
        if "COWORK_PREVIEW_BASE_PATH" in content:
            self.log(f"Next config already supports preview base path: {candidate}")
            return

        header = self.next_base_path_header()
        if "const nextConfig = {" in content and "export default nextConfig" in content:
            updated = content.replace("const nextConfig = {", header + "\n\nconst nextConfig = {\n  ...(usePreviewBasePath ? { basePath: normalizedBasePath, assetPrefix: normalizedBasePath } : {}),", 1)
        elif "module.exports = {" in content:
            updated = content.replace("module.exports = {", header + "\n\nmodule.exports = {\n  ...(usePreviewBasePath ? { basePath: normalizedBasePath, assetPrefix: normalizedBasePath } : {}),", 1)
        else:
            raise RuntimeError(f"Unsupported Next config shape for automatic patching: {candidate}")

        if "NEXT_PUBLIC_SITE_BASE_PATH" not in updated:
            insertion = (
                "env: {\n"
                "    NEXT_PUBLIC_SITE_BASE_PATH: normalizedBasePath,\n"
                "  },\n"
                "  allowedDevOrigins: [\"https://piko.dnalevity.com\"],\n"
            )
            if "images: {" in updated:
                updated = updated.replace("images: {", insertion + "  images: {", 1)
            else:
                updated = updated.replace("const nextConfig = {\n", "const nextConfig = {\n  " + insertion, 1)
                updated = updated.replace("module.exports = {\n", "module.exports = {\n  " + insertion, 1)
        elif "allowedDevOrigins" not in updated:
            updated = updated.replace(
                "env: {\n    NEXT_PUBLIC_SITE_BASE_PATH: normalizedBasePath,\n  },\n",
                "env: {\n    NEXT_PUBLIC_SITE_BASE_PATH: normalizedBasePath,\n  },\n  allowedDevOrigins: [\"https://piko.dnalevity.com\"],\n",
                1,
            )

        self.log(f"Patching Next config for preview base path: {candidate}")
        if not self.dry_run:
            candidate.write_text(updated)

    def next_base_path_header(self) -> str:
        return (
            "const configuredBasePath = (process.env.COWORK_PREVIEW_BASE_PATH || \"\").trim();\n"
            "const normalizedBasePath = configuredBasePath\n"
            "  ? `/${configuredBasePath.replace(/^\\/+|\\/+$/g, \"\")}`\n"
            "  : \"\";\n"
            "const usePreviewBasePath = Boolean(normalizedBasePath);"
        )

    def default_next_config_text(self) -> str:
        return (
            f"{self.next_base_path_header()}\n\n"
            "/** @type {import('next').NextConfig} */\n"
            "const nextConfig = {\n"
            "  ...(usePreviewBasePath ? { basePath: normalizedBasePath, assetPrefix: normalizedBasePath } : {}),\n"
            "  env: {\n"
            "    NEXT_PUBLIC_SITE_BASE_PATH: normalizedBasePath,\n"
            "  },\n"
            "  allowedDevOrigins: [\"https://piko.dnalevity.com\"],\n"
            "};\n\n"
            "export default nextConfig;\n"
        )

    def ensure_app_dependencies(self) -> None:
        assert self.app_dir is not None
        if self.dry_run:
            return
        if not (self.app_dir / "node_modules").exists():
            self.log(f"Installing app dependencies in {self.app_dir}")
            try:
                run(["npm", "install"], cwd=self.app_dir, timeout=1800)
            except RuntimeError as exc:
                message = str(exc)
                if "ERESOLVE" not in message and "could not resolve" not in message.lower():
                    raise
                self.log("Retrying dependency install with --legacy-peer-deps")
                run(["npm", "install", "--legacy-peer-deps"], cwd=self.app_dir, timeout=1800)

    def verify_app_builds(self) -> None:
        assert self.app_dir is not None
        if self.dry_run:
            return
        package_json = self.app_dir / "package.json"
        if not package_json.exists():
            return
        try:
            package = json.loads(package_json.read_text())
        except json.JSONDecodeError:
            return
        scripts = package.get("scripts") if isinstance(package, dict) else {}
        deps = {}
        if isinstance(package, dict):
            deps.update(package.get("dependencies") or {})
            deps.update(package.get("devDependencies") or {})
        if "next" not in deps or not isinstance(scripts, dict) or "build" not in scripts:
            return

        next_dir = self.app_dir / ".next"
        self.log(f"Verifying app production build in {self.app_dir}")
        shutil.rmtree(next_dir, ignore_errors=True)
        run(["npm", "run", "build"], cwd=self.app_dir, timeout=1800)
        preview_env = os.environ.copy()
        preview_env["COWORK_PREVIEW_BASE_PATH"] = self.preview_base_path
        preview_env["NEXT_PUBLIC_SITE_BASE_PATH"] = self.preview_base_path
        shutil.rmtree(next_dir, ignore_errors=True)
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=str(self.app_dir),
            text=True,
            capture_output=True,
            timeout=1800,
            env=preview_env,
        )
        if result.returncode != 0:
            self.log(
                (
                    f"Warning: preview build failed ({result.returncode}) for {self.app_dir}\n"
                    f"stdout:\n{result.stdout.strip()}\n\nstderr:\n{result.stderr.strip()}"
                ).strip()
            )

    def ensure_nginx_include(self) -> None:
        self.log("Ensuring nginx preview include exists")
        if self.dry_run:
            return
        run(["sudo", "mkdir", "-p", str(self.nginx_preview_dir)])
        content = run(["sudo", "cat", str(self.nginx_site_file)], timeout=60).stdout
        include_line = "    include /etc/nginx/snippets/piko-preview-routes/*.conf;\n"
        if include_line in content:
            return
        insertion = "\n" + include_line
        updated = re.sub(r"\n}\s*$", insertion + "}\n", content, count=1)
        run(["sudo", "tee", str(self.nginx_site_file)], input_text=updated, timeout=60)

    def write_nginx_preview_route(self) -> None:
        if self.slug in BUILTIN_PREVIEW_PORTS:
            self.log(f"Skipping generated nginx route for builtin slug: {self.slug}")
            return
        route_path = self.nginx_preview_dir / f"{self.slug}.conf"
        content = (
            f"location = {self.preview_base_path} {{\n"
            f"    proxy_pass http://127.0.0.1:{self.preview_port};\n"
            "    proxy_read_timeout 3600;\n"
            "    proxy_send_timeout 3600;\n"
            "}\n"
            f"location ^~ {self.preview_base_path}/ {{\n"
            f"    proxy_pass http://127.0.0.1:{self.preview_port};\n"
            "    proxy_read_timeout 3600;\n"
            "    proxy_send_timeout 3600;\n"
            "}\n"
        )
        self.log(f"Writing nginx preview route: {route_path}")
        if not self.dry_run:
            run(["sudo", "tee", str(route_path)], input_text=content, check=True)

    def reload_nginx(self) -> None:
        if self.dry_run:
            return
        self.log("Testing and reloading nginx")
        run(["sudo", "nginx", "-t"], timeout=60)
        run(["sudo", "systemctl", "reload", "nginx"], timeout=60)

    def ensure_todo_project_and_env(self, config: dict[str, Any]) -> None:
        self.log(f"Ensuring Vercel todo project exists: {self.todo_project}")
        if self.dry_run:
            return
        inspect = run(
            ["vercel", "project", "inspect", self.todo_project, "--scope", VERCEL_SCOPE],
            check=False,
            timeout=120,
        )
        if inspect.returncode != 0:
            run(["vercel", "project", "add", self.todo_project, "--scope", VERCEL_SCOPE], timeout=120)

        with self.prepare_todo_checkout(config) as checkout:
            run(
                [
                    "vercel",
                    "link",
                    "--yes",
                    "--scope",
                    VERCEL_SCOPE,
                    "--project",
                    self.todo_project,
                ],
                cwd=checkout,
                timeout=120,
            )
            config_json = json.dumps(config, separators=(",", ":"))
            for environment in ("production", "preview", "development"):
                run(
                    [
                        "vercel",
                        "env",
                        "add",
                        "PORTAL_TEMPLATE_CONFIG_JSON",
                        environment,
                        "--value",
                        config_json,
                        "--yes",
                        "--force",
                        "--scope",
                        VERCEL_SCOPE,
                    ],
                    cwd=checkout,
                    timeout=120,
                )

    def deploy_todo_project(self) -> None:
        if self.dry_run:
            return
        self.log(f"Deploying todo project: {self.todo_project}")
        config = self.render_portal_config()
        with self.prepare_todo_checkout(config) as checkout:
            run(
                [
                    "vercel",
                    "link",
                    "--yes",
                    "--scope",
                    VERCEL_SCOPE,
                    "--project",
                    self.todo_project,
                ],
                cwd=checkout,
                timeout=120,
            )
            run(["npm", "run", "build"], cwd=checkout, timeout=1800)
            deploy = run(
                ["vercel", "deploy", "--prod", "--yes", "--scope", VERCEL_SCOPE],
                cwd=checkout,
                timeout=1800,
                check=False,
            )
            lines = [line.strip() for line in (deploy.stdout + "\n" + deploy.stderr).splitlines() if line.strip()]
            for line in reversed(lines):
                if "https://" in line and ".vercel.app" in line:
                    match = re.search(r"(https://[A-Za-z0-9._/-]+\.vercel\.app)", line)
                    if match:
                        self.todo_deploy_url = match.group(1)
                        break
            if deploy.returncode != 0:
                self.todo_deploy_url = self.todo_deploy_url or "deploy failed"

    def prepare_todo_checkout(self, config: dict[str, Any]):
        temp_dir = tempfile.TemporaryDirectory(prefix=f"{self.slug}-todo-")
        checkout = Path(temp_dir.name) / "smart-todo"
        shutil.copytree(
            self.smart_todo_dir,
            checkout,
            ignore=shutil.ignore_patterns(".git", ".vercel", "node_modules", "tasks"),
        )
        env_payload = "PORTAL_TEMPLATE_CONFIG_JSON=" + json.dumps(config, separators=(",", ":")) + "\n"
        (checkout / ".env.production.local").write_text(env_payload)
        (checkout / ".env.local").write_text(env_payload)

        class _CheckoutContext:
            def __enter__(self_nonlocal):
                return checkout

            def __exit__(self_nonlocal, exc_type, exc, tb):
                temp_dir.cleanup()
                return False

        return _CheckoutContext()

    def restart_preview(self) -> None:
        self.log(f"Refreshing preview for {self.slug}")
        if self.dry_run:
            return
        run(
            [
                "curl",
                "-sS",
                "-X",
                "POST",
                "-H",
                "Content-Type: application/json",
                "-H",
                f"X-Portal-Password: {self.portal_password}",
                "-d",
                '{"action":"preview"}',
                f"https://cowork-api.dnalevity.com/api/portal/{self.slug}/actions",
            ],
            timeout=120,
        )

    def fetch_status(self, url: str, *, headers: dict[str, str] | None = None) -> int:
        if self.dry_run:
            return 0
        request = Request(url, headers=headers or {})
        try:
            with urlopen(request, timeout=15) as response:
                return int(getattr(response, "status", 200) or 200)
        except HTTPError as exc:
            return int(exc.code or 500)
        except URLError:
            return 0

    def fetch_json(self, url: str, *, headers: dict[str, str] | None = None) -> dict[str, Any] | None:
        if self.dry_run:
            return {}
        request = Request(url, headers=headers or {})
        try:
            with urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception:
            return None

    def wait_for_status(
        self,
        url: str,
        *,
        expected_statuses: set[int],
        timeout_seconds: int,
        interval_seconds: int = 2,
        headers: dict[str, str] | None = None,
    ) -> int:
        if self.dry_run:
            return 0
        deadline = time.time() + timeout_seconds
        last_status = 0
        while time.time() < deadline:
            last_status = self.fetch_status(url, headers=headers)
            if last_status in expected_statuses:
                return last_status
            time.sleep(interval_seconds)
        return last_status

    def wait_for_workspace_preview_ready(
        self,
        workspace_url: str,
        *,
        timeout_seconds: int,
        interval_seconds: int = 2,
    ) -> bool:
        if self.dry_run:
            return True
        headers = {"X-Portal-Password": self.portal_password}
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            payload = self.fetch_json(workspace_url, headers=headers)
            workspace = payload.get("workspace", {}) if isinstance(payload, dict) else {}
            preview = workspace.get("preview", {}) if isinstance(workspace, dict) else {}
            if preview.get("ready") is True:
                return True
            time.sleep(interval_seconds)
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Provision a smart-todo instance without Codex orchestration.")
    parser.add_argument("target", help="GitHub repo, GitHub URL, Vercel project, or Vercel project URL")
    parser.add_argument("--dry-run", action="store_true", help="Resolve and render changes without mutating files or services")
    parser.add_argument("--code-root", default="", help="Override the default ~/Code root")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    code_root = Path(args.code_root).expanduser() if args.code_root else None
    provisioner = Provisioner(args.target, dry_run=args.dry_run, code_root=code_root)
    result = provisioner.apply()
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

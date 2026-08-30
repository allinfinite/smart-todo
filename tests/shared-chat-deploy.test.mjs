import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../shared-chat-app.js", import.meta.url), "utf8");

test("blocked workspaces retain a recovery path", () => {
  assert.match(source, /const recoveryLocked = state\.tenantLoading \|\| \["checking", "syncing"\]/);
  assert.match(source, /data-workspace-action="sync"[\s\S]*?!recoveryLocked/);
  assert.match(source, /id="refreshWorkspaceButton"[\s\S]*?actionInFlight \|\| recoveryLocked/);
  assert.match(source, /workspaceGateLocked\(\) && action !== "sync"/);
});

test("deploy is enabled only for reviewed dirty work", () => {
  assert.match(source, /data-workspace-action="deploy"[\s\S]*?workspace\.dirty && !locked/);
  assert.match(source, /action === "discard" \|\| action === "deploy"/);
  assert.match(source, /actionBody\.expected_head = String\(state\.workspace\?\.head_sha/);
  assert.match(source, /actionBody\.expected_changes_digest = String\(state\.workspace\?\.changes_digest/);
  assert.match(source, /body: JSON\.stringify\(actionBody\)/);
});

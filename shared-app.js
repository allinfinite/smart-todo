(function () {
  const config = window.PORTAL_TEMPLATE_CONFIG || {};
  if (config.appMode !== "shared") {
    return;
  }

  const apiBase = String(config.apiBase || "").replace(/\/$/, "");
  const storageNamespace = String(config.storageNamespace || "smart-todo-shared-app");
  const tokenKey = `${storageNamespace}:token`;
  const tenantKey = `${storageNamespace}:tenant-id`;
  const defaultTheme = config.theme || {};

  document.body.classList.add("shared-mode");

  const state = {
    token: window.localStorage.getItem(tokenKey) || "",
    user: null,
    tenants: [],
    activeTenantId: window.localStorage.getItem(tenantKey) || "",
    loadRequestId: 0,
    requests: [],
    workspace: null,
    auditLog: [],
    adminTenants: [],
    adminOpen: false,
    adminStatus: "",
    creatingTenant: false,
    composerOpen: false,
    expandedRequestId: "",
    workspaceStatus: "",
    workspaceStatusTone: "",
    workspaceStatusLinkHref: "",
    workspaceStatusLinkLabel: "",
    activeAction: "",
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setToken(token) {
    state.token = String(token || "");
    if (state.token) {
      window.localStorage.setItem(tokenKey, state.token);
    } else {
      window.localStorage.removeItem(tokenKey);
    }
  }

  function setActiveTenantId(tenantId) {
    state.activeTenantId = String(tenantId || "");
    if (state.activeTenantId) {
      window.localStorage.setItem(tenantKey, state.activeTenantId);
    } else {
      window.localStorage.removeItem(tenantKey);
    }
  }

  function activeTenant() {
    return state.tenants.find(tenant => String(tenant.id) === String(state.activeTenantId)) || null;
  }

  function activeRole() {
    return String(activeTenant()?.role || "").trim().toLowerCase();
  }

  function applyAuthenticatedUser(user) {
    state.user = user;
    state.tenants = Array.isArray(user?.memberships)
      ? user.memberships.map(membership => ({ ...membership.tenant, role: membership.role }))
      : [];
    if (!state.tenants.length) {
      throw new Error("No tenant memberships found for this account");
    }
    if (!state.activeTenantId || !state.tenants.some(tenant => String(tenant.id) === String(state.activeTenantId))) {
      setActiveTenantId(user.defaultTenantId || state.tenants[0].id);
    }
  }

  function userIsAdmin() {
    return ["owner", "internal_operator"].includes(activeRole());
  }

  function setWorkspaceStatus(message, tone = "info", options = {}) {
    state.workspaceStatus = String(message || "").trim();
    state.workspaceStatusTone = state.workspaceStatus ? String(tone || "info") : "";
    state.workspaceStatusLinkHref = state.workspaceStatus ? String(options.href || "").trim() : "";
    state.workspaceStatusLinkLabel = state.workspaceStatusLinkHref
      ? String(options.label || options.href || "").trim()
      : "";
  }

  function cacheSafePreviewUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      return "";
    }
    try {
      const resolved = new URL(raw, window.location.href);
      resolved.searchParams.set("_preview", String(Date.now()));
      return resolved.toString();
    } catch (_error) {
      return raw;
    }
  }

  function messageFromActionResult(action, payload) {
    if (action === "preview") {
      const previewUrl = payload?.workspace?.preview?.url;
      const safePreviewUrl = cacheSafePreviewUrl(previewUrl);
      return {
        text: previewUrl ? "Preview ready at" : "Preview started.",
        href: safePreviewUrl,
        label: safePreviewUrl || previewUrl || "",
      };
    }
    if (action === "sync") {
      return { text: String(payload?.sync?.summary || "").trim() || "Sync finished." };
    }
    if (action === "deploy") {
      return { text: String(payload?.deploy?.summary || "").trim() || "Deploy finished." };
    }
    return { text: "Action completed." };
  }

  function workspaceStatusMarkup() {
    if (!state.workspaceStatus) {
      return "";
    }
    const linkMarkup = state.workspaceStatusLinkHref
      ? ` <a href="${escapeHtml(state.workspaceStatusLinkHref)}" target="_blank" rel="noreferrer">${escapeHtml(state.workspaceStatusLinkLabel || state.workspaceStatusLinkHref)}</a>`
      : "";
    return `<p class="shared-board-status tone-${escapeHtml(state.workspaceStatusTone || "info")}">${escapeHtml(state.workspaceStatus)}${linkMarkup}</p>`;
  }

  async function reloadBoard() {
    try {
      await loadTenantData();
    } catch (error) {
      const message = String(error?.message || "Unable to refresh workspace.");
      if (/unauthorized/i.test(message)) {
        setToken("");
        setActiveTenantId("");
        renderLogin("Session expired. Sign in again.");
        return;
      }
      setWorkspaceStatus(message, "error");
      renderApp();
    }
  }

  function authHeaders() {
    return state.token ? { Authorization: `Bearer ${state.token}` } : {};
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
  }

  function applyTheme(theme) {
    const merged = { ...defaultTheme, ...(theme || {}) };
    const mapping = {
      bg: "--bg",
      paper: "--paper",
      paperStrong: "--paper-strong",
      ink: "--ink",
      muted: "--muted",
      line: "--line",
      lineStrong: "--line-strong",
      accent: "--accent",
      accentDark: "--accent-dark",
      ok: "--ok",
      warn: "--warn",
      fail: "--fail",
      shadow: "--shadow",
      replyExternal: "--reply-external",
      bgTopLeft: "--bg-top-left",
      bgRight: "--bg-right",
      bgStart: "--bg-start",
      bgMid: "--bg-mid",
      bgEnd: "--bg-end",
    };
    Object.entries(mapping).forEach(([key, variable]) => {
      if (merged[key]) {
        document.documentElement.style.setProperty(variable, String(merged[key]));
      }
    });
  }

  function formatDate(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  }

  function assetUrl(path) {
    const raw = String(path || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    return `${apiBase}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }

  function firstReadableSentence(text) {
    const normalized = String(text || "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
      .replace(/`+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) {
      return "";
    }
    const sentence = normalized.split(/(?<=[.!?])\s+/)[0] || normalized;
    return sentence.trim();
  }

  function simplifyCompletionCopy(text, fallbackTitle = "") {
    const sentence = firstReadableSentence(text);
    if (!sentence) {
      return fallbackTitle ? `Updated ${fallbackTitle.toLowerCase()}.` : "The update is complete and ready to review.";
    }
    let simplified = sentence
      .replace(/\b(No Cowork changes were made\.?)$/i, "")
      .replace(/\bby overwriting [^.]+?\bwith\b/i, "with")
      .replace(/\boverwriting [^.]+?\bwith\b/i, "with")
      .replace(/\bby updating [^.]+$/i, "")
      .replace(/\bby overwriting [^.]+$/i, "")
      .replace(/\buploaded portal reference\b/gi, "new uploaded image")
      .replace(/\buploaded [A-Za-z0-9._-]+ asset\b/gi, "new uploaded image")
      .replace(/\bpassed in [^.]+$/i, "")
      .replace(/\bcommitted and pushed[^.]*$/i, "")
      .replace(/\bnpm run build\b/gi, "")
      .replace(/\/[A-Za-z0-9._/-]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    simplified = simplified.replace(/[,:;\-–]\s*$/, "").trim();
    if (!simplified) {
      return fallbackTitle ? `Updated ${fallbackTitle.toLowerCase()}.` : "The update is complete and ready to review.";
    }
    return simplified;
  }

  function completedRequestSummary(request) {
    const explicitSummary = String(request?.completion_summary || "").trim();
    const genericSummary = explicitSummary && /was completed and is ready to review\.?$/i.test(explicitSummary);
    if (explicitSummary && !genericSummary) {
      return explicitSummary;
    }
    const latestMessageSummary = simplifyCompletionCopy(request?.latest_message, request?.title || "");
    if (latestMessageSummary) {
      return latestMessageSummary;
    }
    if (explicitSummary) {
      return explicitSummary;
    }
    return request?.completion_screenshot?.url
      ? "The requested update is complete and a fresh screenshot is ready to review."
      : "The requested update is complete and ready to review.";
  }

  function requestState(request) {
    return String(request.status || "queued").trim().toLowerCase();
  }

  function requestPriority(request) {
    return String(request.priority || "normal").trim().toLowerCase();
  }

  function requestStatusLabel(request) {
    const stateValue = requestState(request);
    if (stateValue === "completed") return "Done";
    if (stateValue === "failed") return "Failed";
    if (stateValue === "blocked") return "Blocked";
    if (stateValue === "running") return "In Progress";
    return "Queued";
  }

  function requestPriorityLabel(request) {
    const priority = requestPriority(request);
    if (priority === "urgent") return "Urgent";
    if (priority === "high") return "High";
    if (priority === "low") return "Low";
    return "Normal";
  }

  function requestCard(request) {
    const requestId = String(request.request_id || request.id || "");
    const replies = Array.isArray(request.replies) ? request.replies : [];
    const isExpanded = requestId && requestId === state.expandedRequestId;
    const status = requestState(request);
    const priority = requestPriority(request);
    const isCompleted = status === "completed";
    const latestMessage = request.latest_message
      ? `<p class="shared-request-note">${escapeHtml(request.latest_message)}</p>`
      : "";
    const completionScreenshot = request?.completion_screenshot?.url
      ? `
        <a class="shared-completion-shot" href="${escapeHtml(assetUrl(request.completion_screenshot.url))}" target="_blank" rel="noreferrer">
          <img
            src="${escapeHtml(assetUrl(request.completion_screenshot.url))}"
            alt="Updated preview for ${escapeHtml(request.title || "completed request")}"
            loading="lazy"
          />
        </a>
      `
      : "";
    return `
      <article class="request-card state-${escapeHtml(status)} shared-request-card ${isExpanded ? "is-expanded" : ""}">
        <div class="request-summary">
          <div class="request-summary-main">
            <div class="summary-title-row">
              <span class="checkbox ${status === "completed" ? "done" : ""}">${status === "completed" ? "✓" : ""}</span>
              <div class="summary-copy">
                <h3 class="request-title">${escapeHtml(request.title || "Untitled request")}</h3>
              </div>
            </div>
          </div>
          <div class="request-summary-side">
            <div class="request-meta">
              <span class="pill status-${escapeHtml(status)}">${escapeHtml(requestStatusLabel(request))}</span>
              <span class="pill priority-${escapeHtml(priority)}">${escapeHtml(requestPriorityLabel(request))}</span>
            </div>
            <div class="summary-buttons">
              <button class="secondary card-toggle" type="button" data-request-id="${escapeHtml(requestId)}">${isExpanded ? "Hide" : "View"}</button>
            </div>
          </div>
        </div>
        ${
          isExpanded
            ? `
              <div class="shared-request-detail">
                <p class="shared-request-meta">${escapeHtml(formatDate(request.created_at || request.createdAt))}</p>
                ${request.details ? `<p class="shared-request-details">${escapeHtml(request.details)}</p>` : ""}
                ${
                  isCompleted
                    ? `
                      <div class="shared-completion-block">
                        <div class="shared-detail-label">What was done</div>
                        <p class="shared-completion-summary">${escapeHtml(completedRequestSummary(request))}</p>
                      </div>
                      ${completionScreenshot ? `
                        <div class="shared-completion-media">
                          <div class="shared-detail-label">Screenshot</div>
                          ${completionScreenshot}
                        </div>
                      ` : ""}
                    `
                    : latestMessage
                }
                ${
                  replies.length
                    ? `<div class="shared-replies">${replies
                        .slice(-4)
                        .map(
                          reply => `
                            <div class="shared-reply">
                              <strong>${escapeHtml(reply.author || "user")}</strong>
                              <span>${escapeHtml(formatDate(reply.created_at || reply.createdAt))}</span>
                              <p>${escapeHtml(reply.text || "")}</p>
                            </div>
                          `
                        )
                        .join("")}</div>`
                    : ""
                }
                <form class="shared-reply-form" data-request-id="${escapeHtml(requestId)}">
                  <textarea name="reply" rows="3" placeholder="Add a reply or clarification"></textarea>
                  <div class="form-actions">
                    <button type="submit">Send Reply</button>
                  </div>
                </form>
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function tenantOption(tenant) {
    return `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.displayName || tenant.slug)} · ${escapeHtml(tenant.role || "client_user")}</option>`;
  }

  function workspaceActionsMarkup() {
    const workspace = state.workspace || {};
    const enabledActions = Array.isArray(workspace.enabledActions) ? workspace.enabledActions : ["preview", "sync", "deploy"];
    const actionInFlight = String(state.activeAction || "");
    return `
      <button class="board-action" data-workspace-action="sync" ${(enabledActions.includes("sync") && !actionInFlight) ? "" : "disabled"}>${actionInFlight === "sync" ? "Syncing..." : "Sync"}</button>
      <button class="board-action" data-workspace-action="preview" ${(enabledActions.includes("preview") && !actionInFlight) ? "" : "disabled"}>${actionInFlight === "preview" ? "Starting..." : "Preview"}</button>
      <button class="board-action" data-workspace-action="deploy" ${(enabledActions.includes("deploy") && !actionInFlight) ? "" : "disabled"}>${actionInFlight === "deploy" ? "Deploying..." : "Deploy"}</button>
      <button class="board-action" id="refreshWorkspaceButton" type="button" ${actionInFlight ? "disabled" : ""}>Refresh</button>
    `;
  }

  function renderLogin(message = "") {
    document.body.innerHTML = `
      <div class="page-shell shared-shell">
        <section class="auth-shell">
          <div class="auth-card">
            <p class="eyebrow">${escapeHtml(config.authEyebrow || "Smart Todo")}</p>
            <h2>${escapeHtml(config.authTitle || "Sign in")}</h2>
            <p class="hero-copy">${escapeHtml(config.authCopy || "Sign in with your account to access tenant workspaces.")}</p>
            <form id="sharedLoginForm" class="auth-form">
              <label>
                <span>Email</span>
                <input name="email" type="email" autocomplete="username" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" autocomplete="current-password" required />
              </label>
              <div class="form-actions">
                <button type="submit">Sign In</button>
                <p class="form-status">${escapeHtml(message)}</p>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;
    document.querySelector("#sharedLoginForm").addEventListener("submit", async event => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        const payload = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password"),
          }),
        });
        setToken(payload.token);
        await bootstrapAuthenticatedState(payload.user);
      } catch (error) {
        renderLogin(error.message);
      }
    });
  }

  function renderApp() {
    const tenant = activeTenant();
    const tenantFormSource = state.creatingTenant
      ? { displayName: "", slug: "", status: "active", workspace: { enabledActions: ["preview", "sync", "deploy"] } }
      : (tenant || { workspace: {} });
    applyTheme(tenant?.theme || {});
    document.title = tenant?.displayName ? `${tenant.displayName} · Smart Todo` : (config.portalTitle || "Smart Todo");
    document.body.innerHTML = `
      <div class="page-shell shared-shell">
        <main class="panel shared-board">
          <header class="shared-board-header">
            <p class="eyebrow">${escapeHtml(config.heroEyebrow || "Todo List")}</p>
            <div class="shared-board-topline">
              <h1>${escapeHtml(tenant?.displayName || "Workspace")} todo board</h1>
              <div class="shared-session-line">${escapeHtml(state.user?.name || state.user?.email || "")}</div>
            </div>
            <div class="shared-board-controls">
              <label class="shared-tenant-switch">
                <span>Workspace</span>
                <select id="tenantSwitch">${state.tenants.map(tenantOption).join("")}</select>
              </label>
              <div class="shared-utility-actions">
                <button class="secondary" id="toggleComposerButton" type="button">${state.composerOpen ? "Hide Request" : "New Request"}</button>
                ${userIsAdmin() ? `<button class="secondary" id="toggleAdminButton" type="button">${state.adminOpen ? "Hide Admin" : "Admin"}</button>` : ""}
                <button class="secondary" id="logoutButton" type="button">Logout</button>
              </div>
            </div>
            <div class="shared-board-actions">
              ${workspaceActionsMarkup()}
            </div>
            ${workspaceStatusMarkup()}
          </header>

          <section class="shared-drawer ${state.composerOpen ? "" : "hidden"}" id="sharedComposerPanel">
            <form id="sharedRequestForm" class="request-form shared-inline-form">
              <label>
                <span>Title</span>
                <input name="title" maxlength="140" required />
              </label>
              <label>
                <span>Details</span>
                <textarea name="details" rows="6"></textarea>
              </label>
              <label>
                <span>Priority</span>
                <select name="priority">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <div class="form-actions">
                <button type="submit">Queue Task</button>
                <p class="form-status" id="sharedRequestStatus"></p>
              </div>
            </form>
          </section>

          ${
            userIsAdmin()
              ? `
                <section class="shared-drawer shared-admin-panel ${state.adminOpen ? "" : "hidden"}" id="sharedAdminPanel">
                  <div class="shared-admin-head">
                    <p class="eyebrow">Admin</p>
                    <h2>Tenant and account management</h2>
                  </div>
                  ${state.adminStatus ? `<p class="shared-board-status tone-warn">${escapeHtml(state.adminStatus)}</p>` : ""}
                  <div class="shared-admin-grid">
                    <form id="tenantForm" class="shared-admin-form">
                      <h3>${state.creatingTenant ? "Create Tenant" : "Edit Active Tenant"}</h3>
                      <label><span>Display Name</span><input name="displayName" value="${escapeHtml(tenantFormSource.displayName || "")}" required /></label>
                      <label><span>Slug</span><input name="slug" value="${escapeHtml(tenantFormSource.slug || "")}" ${state.creatingTenant ? "" : "readonly"} required /></label>
                      <label><span>Public URL</span><input name="publicUrl" value="${escapeHtml(tenantFormSource.workspace?.publicUrl || "")}" /></label>
                      <label><span>Repo Path</span><input name="repoPath" value="${escapeHtml(tenantFormSource.workspace?.repoPath || "")}" /></label>
                      <label><span>App Path</span><input name="appPath" value="${escapeHtml(tenantFormSource.workspace?.appPath || tenantFormSource.workspace?.repoPath || "")}" /></label>
                      <label><span>Preview Base Path</span><input name="previewBasePath" value="${escapeHtml(tenantFormSource.workspace?.previewBasePath || "")}" /></label>
                      <label><span>Preview Port</span><input name="previewPort" type="number" value="${escapeHtml(tenantFormSource.workspace?.previewPort || "")}" /></label>
                      <label><span>Deploy Branch</span><input name="deployBranch" value="${escapeHtml(tenantFormSource.workspace?.deployBranch || "main")}" /></label>
                      <label><span>Status</span><input name="status" value="${escapeHtml(tenantFormSource.status || "active")}" /></label>
                      <label class="shared-checkbox-row"><input type="checkbox" name="enablePreview" ${tenantFormSource.workspace?.enabledActions?.includes("preview") ? "checked" : ""} /> Preview</label>
                      <label class="shared-checkbox-row"><input type="checkbox" name="enableSync" ${tenantFormSource.workspace?.enabledActions?.includes("sync") ? "checked" : ""} /> Sync</label>
                      <label class="shared-checkbox-row"><input type="checkbox" name="enableDeploy" ${tenantFormSource.workspace?.enabledActions?.includes("deploy") ? "checked" : ""} /> Deploy</label>
                      <div class="form-actions">
                        <button type="submit">${state.creatingTenant ? "Create Tenant" : "Save Tenant"}</button>
                        <button class="secondary" id="newTenantButton" type="button">New Tenant</button>
                        <p class="form-status" id="tenantFormStatus"></p>
                      </div>
                    </form>

                    <form id="userForm" class="shared-admin-form">
                      <h3>Add or Update User</h3>
                      <label><span>Email</span><input name="email" type="email" required /></label>
                      <label><span>Name</span><input name="name" required /></label>
                      <label><span>Password</span><input name="password" type="password" required /></label>
                      <label>
                        <span>Role</span>
                        <select name="role">
                          <option value="client_user">client_user</option>
                          <option value="internal_operator">internal_operator</option>
                          <option value="owner">owner</option>
                        </select>
                      </label>
                      <div class="form-actions">
                        <button type="submit">Save User</button>
                        <p class="form-status" id="userFormStatus"></p>
                      </div>
                    </form>
                  </div>
                  <div class="shared-members">
                    <h3>Members</h3>
                    ${((state.adminTenants.find(entry => String(entry.id) === String(state.activeTenantId)) || {}).members || [])
                      .map(
                        member => `
                          <div class="shared-member-row">
                            <strong>${escapeHtml(member.user?.name || member.user?.email || member.userId)}</strong>
                            <span>${escapeHtml(member.user?.email || "")}</span>
                            <span>${escapeHtml(member.role || "")}</span>
                          </div>
                        `
                      )
                      .join("") || '<div class="empty-state">No members yet.</div>'}
                  </div>
                  <div class="shared-audit-log">
                    <h3>Audit Log</h3>
                    ${(state.auditLog || [])
                      .slice(0, 12)
                      .map(
                        entry => `
                          <div class="shared-audit-row">
                            <strong>${escapeHtml(entry.actionType || "")}</strong>
                            <span>${escapeHtml(entry.status || "")}</span>
                            <span>${escapeHtml(formatDate(entry.createdAt || ""))}</span>
                            <p>${escapeHtml(JSON.stringify(entry.metadata || {}))}</p>
                          </div>
                        `
                      )
                      .join("") || '<div class="empty-state">No audit log entries yet.</div>'}
                  </div>
                </section>
              `
              : ""
          }

          <div class="shared-workspace-meta">
            <span>Repo: ${escapeHtml(state.workspace?.repo_path || state.workspace?.repoPath || "n/a")}</span>
            <span>Branch: ${escapeHtml(state.workspace?.branch || "n/a")}</span>
            <span>Preview: ${state.workspace?.preview?.url ? `<a href="${escapeHtml(cacheSafePreviewUrl(state.workspace.preview.url))}" target="_blank" rel="noreferrer">${escapeHtml(state.workspace.preview.url)}</a>` : "n/a"}</span>
          </div>
          <section class="queue-list shared-board-list">${state.requests.length ? state.requests.map(requestCard).join("") : '<div class="empty-state">No requests yet.</div>'}</section>
        </main>
      </div>
    `;

    document.querySelector("#tenantSwitch").value = state.activeTenantId;
    document.querySelector("#tenantSwitch").addEventListener("change", async event => {
      setActiveTenantId(event.currentTarget.value);
      await reloadBoard();
    });
    document.querySelector("#logoutButton").addEventListener("click", async () => {
      try {
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch (_error) {
        // Ignore logout failures and clear local state.
      }
      setToken("");
      setActiveTenantId("");
      state.user = null;
      state.tenants = [];
      state.requests = [];
      state.workspace = null;
      renderLogin();
    });
    document.querySelector("#refreshWorkspaceButton").addEventListener("click", () => reloadBoard());
    const toggleComposerButton = document.querySelector("#toggleComposerButton");
    if (toggleComposerButton) {
      toggleComposerButton.addEventListener("click", () => {
        setWorkspaceStatus("");
        state.composerOpen = !state.composerOpen;
        renderApp();
      });
    }
    const toggleAdminButton = document.querySelector("#toggleAdminButton");
    if (toggleAdminButton) {
      toggleAdminButton.addEventListener("click", () => {
        setWorkspaceStatus("");
        state.adminOpen = !state.adminOpen;
        renderApp();
      });
    }
    document.querySelector("#sharedRequestForm").addEventListener("submit", submitRequest);
    document.querySelectorAll(".card-toggle").forEach(button => {
      button.addEventListener("click", event => {
        const requestId = String(event.currentTarget.dataset.requestId || "");
        state.expandedRequestId = state.expandedRequestId === requestId ? "" : requestId;
        renderApp();
      });
    });
    document.querySelectorAll("[data-workspace-action]").forEach(button => {
      button.addEventListener("click", event => runWorkspaceAction(event.currentTarget.dataset.workspaceAction));
    });
    document.querySelectorAll(".shared-reply-form").forEach(form => {
      form.addEventListener("submit", submitReply);
    });
    const tenantForm = document.querySelector("#tenantForm");
    if (tenantForm) {
      tenantForm.addEventListener("submit", saveTenant);
    }
    const newTenantButton = document.querySelector("#newTenantButton");
    if (newTenantButton) {
      newTenantButton.addEventListener("click", () => {
        state.creatingTenant = true;
        renderApp();
      });
    }
    const userForm = document.querySelector("#userForm");
    if (userForm) {
      userForm.addEventListener("submit", saveUser);
    }
  }

  async function bootstrapAuthenticatedState(currentUser = null) {
    const mePayload = currentUser ? { user: currentUser } : await apiFetch("/api/auth/me");
    applyAuthenticatedUser(mePayload.user);
    state.creatingTenant = false;
    await loadTenantData();
  }

  async function loadTenantData(retryOnTenantNotFound = true) {
    const tenant = activeTenant();
    if (!tenant) {
      renderLogin("No tenant selected.");
      return;
    }
    const requestedTenantId = String(tenant.id);
    const loadRequestId = state.loadRequestId + 1;
    state.loadRequestId = loadRequestId;
    let requestsPayload;
    let workspacePayload;
    try {
      [requestsPayload, workspacePayload] = await Promise.all([
        apiFetch(`/api/app/tenants/${requestedTenantId}/requests`),
        apiFetch(`/api/app/tenants/${requestedTenantId}/workspace`),
      ]);
    } catch (error) {
      if (retryOnTenantNotFound && /tenant not found/i.test(String(error?.message || ""))) {
        const mePayload = await apiFetch("/api/auth/me");
        applyAuthenticatedUser(mePayload.user);
        return loadTenantData(false);
      }
      throw error;
    }
    if (loadRequestId !== state.loadRequestId || String(state.activeTenantId) !== requestedTenantId) {
      return;
    }
    state.requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
    state.workspace = workspacePayload.workspace || requestsPayload.workspace || null;
    state.adminStatus = "";
    if (userIsAdmin()) {
      try {
        const [tenantsPayload, auditPayload] = await Promise.all([
          apiFetch("/api/app/admin/tenants"),
          apiFetch("/api/app/admin/audit-log"),
        ]);
        if (loadRequestId !== state.loadRequestId || String(state.activeTenantId) !== requestedTenantId) {
          return;
        }
        state.adminTenants = Array.isArray(tenantsPayload.tenants) ? tenantsPayload.tenants : [];
        state.auditLog = Array.isArray(auditPayload.entries) ? auditPayload.entries : [];
      } catch (error) {
        if (loadRequestId !== state.loadRequestId || String(state.activeTenantId) !== requestedTenantId) {
          return;
        }
        state.adminTenants = [];
        state.auditLog = [];
        state.adminStatus = String(error?.message || "").trim() || "Admin tools are unavailable right now.";
      }
    } else {
      if (loadRequestId !== state.loadRequestId || String(state.activeTenantId) !== requestedTenantId) {
        return;
      }
      state.adminTenants = [];
      state.auditLog = [];
    }
    renderApp();
  }

  async function submitRequest(event) {
    event.preventDefault();
    const tenant = activeTenant();
    const formData = new FormData(event.currentTarget);
    const statusNode = document.querySelector("#sharedRequestStatus");
    if (!tenant) return;
    statusNode.textContent = "Saving...";
    try {
      await apiFetch(`/api/app/tenants/${tenant.id}/requests`, {
        method: "POST",
        body: JSON.stringify({
          title: formData.get("title"),
          details: formData.get("details"),
          priority: formData.get("priority"),
        }),
      });
      event.currentTarget.reset();
      statusNode.textContent = "Request queued.";
      await reloadBoard();
    } catch (error) {
      statusNode.textContent = error.message;
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    const tenant = activeTenant();
    const requestId = event.currentTarget.dataset.requestId;
    const text = String(new FormData(event.currentTarget).get("reply") || "").trim();
    if (!tenant || !requestId || !text) {
      return;
    }
    try {
      await apiFetch(`/api/app/tenants/${tenant.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ requestId, text }),
      });
      setWorkspaceStatus("Reply added.", "success");
      await reloadBoard();
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function runWorkspaceAction(action) {
    const tenant = activeTenant();
    if (!tenant) return;
    const previewWindow = action === "preview" ? window.open("about:blank", "_blank") : null;
    if (previewWindow && action === "preview") {
      previewWindow.document.write("<title>Starting preview...</title><p style=\"font-family: sans-serif; padding: 24px;\">Starting preview...</p>");
      previewWindow.document.close();
    }
    state.activeAction = action;
    setWorkspaceStatus(`${action[0].toUpperCase()}${action.slice(1)} in progress...`);
    renderApp();
    try {
      const payload = await apiFetch(`/api/app/tenants/${tenant.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const actionMessage = messageFromActionResult(action, payload);
      setWorkspaceStatus(actionMessage.text, "success", {
        href: actionMessage.href,
        label: actionMessage.label,
      });
      if (previewWindow) {
        if (actionMessage.href) {
          previewWindow.location = actionMessage.href;
        } else {
          previewWindow.close();
        }
      }
      await reloadBoard();
    } catch (error) {
      if (previewWindow) {
        previewWindow.close();
      }
      setWorkspaceStatus(error.message, "warn");
      renderApp();
    } finally {
      state.activeAction = "";
      if (state.user) {
        renderApp();
      }
    }
  }

  async function saveTenant(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const statusNode = document.querySelector("#tenantFormStatus");
    const payload = {
      displayName: formData.get("displayName"),
      slug: formData.get("slug"),
      status: formData.get("status"),
      workspace: {
        siteSlug: formData.get("slug"),
        publicUrl: formData.get("publicUrl"),
        repoPath: formData.get("repoPath"),
        appPath: formData.get("appPath"),
        previewBasePath: formData.get("previewBasePath"),
        previewPort: Number(formData.get("previewPort") || 0),
        deployBranch: formData.get("deployBranch"),
        enabledActions: [
          formData.get("enablePreview") ? "preview" : "",
          formData.get("enableSync") ? "sync" : "",
          formData.get("enableDeploy") ? "deploy" : "",
        ].filter(Boolean),
      },
    };
    statusNode.textContent = state.creatingTenant ? "Creating..." : "Saving...";
    try {
      if (state.creatingTenant) {
        const created = await apiFetch("/api/app/admin/tenants", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setActiveTenantId(created.tenant.id);
        state.creatingTenant = false;
      } else {
        await apiFetch(`/api/app/admin/tenants/${state.activeTenantId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      statusNode.textContent = "Saved.";
      await bootstrapAuthenticatedState();
    } catch (error) {
      statusNode.textContent = error.message;
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    const statusNode = document.querySelector("#userFormStatus");
    const form = event.currentTarget;
    const formData = new FormData(form);
    statusNode.textContent = "Saving...";
    try {
      await apiFetch(`/api/app/admin/tenants/${state.activeTenantId}/users`, {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          name: formData.get("name"),
          password: formData.get("password"),
          role: formData.get("role"),
        }),
      });
      form.reset();
      statusNode.textContent = "Saved.";
      await reloadBoard();
    } catch (error) {
      statusNode.textContent = error.message;
    }
  }

  if (!apiBase) {
    renderLogin("PORTAL_API_BASE is required for shared mode.");
    return;
  }

  if (state.token) {
    bootstrapAuthenticatedState().catch(error => {
      setToken("");
      setActiveTenantId("");
      renderLogin(error.message);
    });
  } else {
    renderLogin();
  }
}());

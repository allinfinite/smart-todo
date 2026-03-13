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

  const state = {
    token: window.localStorage.getItem(tokenKey) || "",
    user: null,
    tenants: [],
    activeTenantId: window.localStorage.getItem(tenantKey) || "",
    requests: [],
    workspace: null,
    auditLog: [],
    adminTenants: [],
    creatingTenant: false,
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

  function userIsAdmin() {
    return ["owner", "internal_operator"].includes(activeRole());
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

  function requestCard(request) {
    const replies = Array.isArray(request.replies) ? request.replies : [];
    const actions = request.latest_message ? `<p class="shared-request-note">${escapeHtml(request.latest_message)}</p>` : "";
    return `
      <article class="shared-request-card">
        <div class="shared-request-top">
          <div>
            <h3>${escapeHtml(request.title)}</h3>
            <p class="shared-request-meta">${escapeHtml(request.priority || "normal")} · ${escapeHtml(request.status || "queued")} · ${escapeHtml(formatDate(request.created_at || request.createdAt))}</p>
          </div>
          <span class="shared-request-status shared-status-${escapeHtml(request.status || "queued")}">${escapeHtml(request.status || "queued")}</span>
        </div>
        <p class="shared-request-details">${escapeHtml(request.details || "")}</p>
        ${actions}
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
        <form class="shared-reply-form" data-request-id="${escapeHtml(request.request_id || request.id)}">
          <textarea name="reply" rows="3" placeholder="Add a reply or clarification"></textarea>
          <button type="submit">Send Reply</button>
        </form>
      </article>
    `;
  }

  function tenantOption(tenant) {
    return `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.displayName || tenant.slug)} · ${escapeHtml(tenant.role || "client_user")}</option>`;
  }

  function workspaceActionsMarkup() {
    const workspace = state.workspace || {};
    const enabledActions = Array.isArray(workspace.enabledActions) ? workspace.enabledActions : ["preview", "sync", "deploy"];
    return `
      <button class="secondary" data-workspace-action="preview" ${enabledActions.includes("preview") ? "" : "disabled"}>Preview</button>
      <button class="secondary" data-workspace-action="sync" ${enabledActions.includes("sync") ? "" : "disabled"}>Sync</button>
      <button class="secondary" data-workspace-action="deploy" ${enabledActions.includes("deploy") ? "" : "disabled"}>Deploy</button>
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
        <header class="hero shared-hero">
          <div>
            <p class="eyebrow">${escapeHtml(tenant?.displayName || config.heroEyebrow || "Smart Todo")}</p>
            <h1>${escapeHtml(tenant?.copy?.heroTitle || config.heroTitle || "Shared Smart Todo")}</h1>
            <p class="hero-copy">${escapeHtml(tenant?.copy?.heroCopy || config.heroCopy || "Manage requests, previews, and deployments from one authenticated workspace.")}</p>
          </div>
          <div class="shared-session-card">
            <div class="shared-user-line">${escapeHtml(state.user?.name || state.user?.email || "")}</div>
            <label class="shared-tenant-switch">
              <span>Workspace</span>
              <select id="tenantSwitch">${state.tenants.map(tenantOption).join("")}</select>
            </label>
            <div class="shared-session-actions">
              <button class="secondary" id="refreshWorkspaceButton" type="button">Refresh</button>
              ${userIsAdmin() ? '<button class="secondary" id="toggleAdminButton" type="button">Admin</button>' : ""}
              <button class="secondary" id="logoutButton" type="button">Logout</button>
            </div>
          </div>
        </header>

        <main class="layout shared-layout">
          <section class="panel composer-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">New Request</p>
                <h2>${escapeHtml(tenant?.displayName || "Workspace")} request board</h2>
              </div>
              <span class="mono">${escapeHtml(String(apiBase).replace(/^https?:\/\//, ""))}</span>
            </div>
            <form id="sharedRequestForm" class="request-form">
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

          <section class="panel queue-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Workspace Board</p>
                <h2>${escapeHtml(tenant?.displayName || "Tenant")} work</h2>
              </div>
              <div class="panel-actions">
                ${workspaceActionsMarkup()}
              </div>
            </div>
            <div class="shared-workspace-meta">
              <span>Repo: ${escapeHtml(state.workspace?.repo_path || state.workspace?.repoPath || "n/a")}</span>
              <span>Branch: ${escapeHtml(state.workspace?.branch || "n/a")}</span>
              <span>Preview: ${escapeHtml(state.workspace?.preview?.url || "n/a")}</span>
            </div>
            <div class="queue-list">${state.requests.length ? state.requests.map(requestCard).join("") : '<div class="empty-state">No requests yet.</div>'}</div>
          </section>

          ${
            userIsAdmin()
              ? `
                <section class="panel shared-admin-panel ${state.adminOpen ? "" : "hidden"}" id="sharedAdminPanel">
                  <div class="panel-head">
                    <div>
                      <p class="eyebrow">Admin</p>
                      <h2>Tenant and account management</h2>
                    </div>
                  </div>
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
        </main>
      </div>
    `;

    document.querySelector("#tenantSwitch").value = state.activeTenantId;
    document.querySelector("#tenantSwitch").addEventListener("change", async event => {
      setActiveTenantId(event.currentTarget.value);
      await loadTenantData();
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
    document.querySelector("#refreshWorkspaceButton").addEventListener("click", () => loadTenantData());
    const toggleAdminButton = document.querySelector("#toggleAdminButton");
    if (toggleAdminButton) {
      toggleAdminButton.addEventListener("click", () => {
        state.adminOpen = !state.adminOpen;
        renderApp();
      });
    }
    document.querySelector("#sharedRequestForm").addEventListener("submit", submitRequest);
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
    state.user = mePayload.user;
    state.tenants = Array.isArray(mePayload.user?.memberships)
      ? mePayload.user.memberships.map(membership => ({ ...membership.tenant, role: membership.role }))
      : [];
    if (!state.tenants.length) {
      throw new Error("No tenant memberships found for this account");
    }
    if (!state.activeTenantId || !state.tenants.some(tenant => String(tenant.id) === String(state.activeTenantId))) {
      setActiveTenantId(mePayload.user.defaultTenantId || state.tenants[0].id);
    }
    state.creatingTenant = false;
    await loadTenantData();
  }

  async function loadTenantData() {
    const tenant = activeTenant();
    if (!tenant) {
      renderLogin("No tenant selected.");
      return;
    }
    const [requestsPayload, workspacePayload] = await Promise.all([
      apiFetch(`/api/app/tenants/${tenant.id}/requests`),
      apiFetch(`/api/app/tenants/${tenant.id}/workspace`),
    ]);
    state.requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
    state.workspace = workspacePayload.workspace || requestsPayload.workspace || null;
    if (userIsAdmin()) {
      const [tenantsPayload, auditPayload] = await Promise.all([
        apiFetch("/api/app/admin/tenants"),
        apiFetch("/api/app/admin/audit-log"),
      ]);
      state.adminTenants = Array.isArray(tenantsPayload.tenants) ? tenantsPayload.tenants : [];
      state.auditLog = Array.isArray(auditPayload.entries) ? auditPayload.entries : [];
    } else {
      state.adminTenants = [];
      state.auditLog = [];
      state.adminOpen = false;
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
      await loadTenantData();
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
      await loadTenantData();
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function runWorkspaceAction(action) {
    const tenant = activeTenant();
    if (!tenant) return;
    try {
      await apiFetch(`/api/app/tenants/${tenant.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await loadTenantData();
    } catch (error) {
      window.alert(error.message);
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
    const formData = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      statusNode.textContent = "Saved.";
      await loadTenantData();
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
      renderLogin(error.message);
    });
  } else {
    renderLogin();
  }
}());

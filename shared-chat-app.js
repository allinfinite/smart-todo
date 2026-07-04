(function () {
  const config = window.PORTAL_TEMPLATE_CONFIG || {};
  if (config.appMode !== "shared") {
    return;
  }

  const apiBase = String(config.apiBase || "").replace(/\/$/, "");
  const storageNamespace = String(config.storageNamespace || "smart-todo-shared-app");
  const tenantKey = `${storageNamespace}:tenant-id`;
  const defaultTheme = config.theme || {};

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (_error) {
      return "";
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // Ignore storage failures and rely on cookie-backed auth.
    }
  }

  function safeStorageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_error) {
      // Ignore storage failures and rely on cookie-backed auth.
    }
  }

  function markSharedReady() {
    document.body.classList.add("shared-ready");
    document.documentElement.classList.remove("shared-bootstrap");
  }

  document.body.classList.add("shared-mode");
  markSharedReady();

  const state = {
    user: null,
    tenants: [],
    activeTenantId: safeStorageGet(tenantKey),
    loadRequestId: 0,
    requests: [],
    workspace: null,
    auditLog: [],
    adminTenants: [],
    adminOpen: false,
    adminStatus: "",
    creatingTenant: false,
    selectedRequestId: "",
    composingNewRequest: false,
    historyOpen: false,
    expandedRequestId: "",
    workspaceStatus: "",
    workspaceStatusTone: "",
    workspaceStatusLinkHref: "",
    workspaceStatusLinkLabel: "",
    updateGateStatus: "idle",
    tenantLoading: false,
    activeAction: "",
    requestSubmitInFlight: false,
    composerFiles: [],
    composerText: "",
    recordingStatus: "",
    recordingTranscript: "",
    replyDrafts: {},
    optimisticMessages: [],
    requestListSignature: "",
  };
  const session = {
    status: "loading",
    bearerToken: "",
  };
  const requestActionKeysInFlight = new Set();
  const memberActionKeysInFlight = new Set();
  let requestPollTimer = 0;
  let requestPollInFlight = false;
  const requestPollIntervalMs = 30000;
  let audioRecorder = null;
  let audioStream = null;
  let audioChunks = [];
  let audioRecording = false;

  class AuthExpiredError extends Error {
    constructor(message = "Session expired. Sign in again.") {
      super(message);
      this.name = "AuthExpiredError";
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setActiveTenantId(tenantId) {
    state.activeTenantId = String(tenantId || "");
    if (state.activeTenantId) {
      safeStorageSet(tenantKey, state.activeTenantId);
    } else {
      safeStorageRemove(tenantKey);
    }
  }

  function activeTenant() {
    return state.tenants.find(tenant => String(tenant.id) === String(state.activeTenantId)) || null;
  }

  function activeRole() {
    return String(activeTenant()?.role || "").trim().toLowerCase();
  }

  function clearAppState() {
    state.user = null;
    state.tenants = [];
    state.requests = [];
    state.workspace = null;
    state.auditLog = [];
    state.adminTenants = [];
    state.adminStatus = "";
    state.creatingTenant = false;
    state.selectedRequestId = "";
    state.composingNewRequest = false;
    state.historyOpen = false;
    state.expandedRequestId = "";
    state.tenantLoading = false;
    state.activeAction = "";
    state.composerFiles = [];
    state.composerText = "";
    state.recordingStatus = "";
    state.recordingTranscript = "";
    state.replyDrafts = {};
    state.requestListSignature = "";
    setWorkspaceStatus("");
  }

  function setSessionAnonymous() {
    session.status = "anonymous";
    session.bearerToken = "";
  }

  function setSessionAuthenticated(bearerToken = "") {
    session.status = "authenticated";
    session.bearerToken = String(bearerToken || "");
  }

  function isAuthFailure(error) {
    const message = String(error?.message || "").trim();
    return (
      error instanceof AuthExpiredError
      || /request failed \(401\)/i.test(message)
      || /unauthorized/i.test(message)
      || /session expired/i.test(message)
    );
  }

  function handleUnauthorized(message = "Session expired. Sign in again.") {
    clearAppState();
    setSessionAnonymous();
    setActiveTenantId("");
    renderLogin(message);
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

  function userHasElevatedRole() {
    return ["owner", "internal_operator"].includes(activeRole());
  }

  function userCanViewAdminPanel() {
    return activeRole() === "owner";
  }

  function setWorkspaceStatus(message, tone = "info", options = {}) {
    state.workspaceStatus = String(message || "").trim();
    state.workspaceStatusTone = state.workspaceStatus ? String(tone || "info") : "";
    state.workspaceStatusLinkHref = state.workspaceStatus ? String(options.href || "").trim() : "";
    state.workspaceStatusLinkLabel = state.workspaceStatusLinkHref
      ? String(options.label || options.href || "").trim()
      : "";
  }

  function resetTenantScopedState(message = "Loading workspace...") {
    updateRequestListState([]);
    state.workspace = null;
    state.auditLog = [];
    state.adminTenants = [];
    state.adminStatus = "";
    state.creatingTenant = false;
    state.selectedRequestId = "";
    state.composingNewRequest = true;
    state.historyOpen = false;
    state.expandedRequestId = "";
    state.updateGateStatus = "idle";
    state.activeAction = "";
    state.requestSubmitInFlight = false;
    state.composerFiles = [];
    state.recordingStatus = "";
    state.replyDrafts = {};
    state.tenantLoading = true;
    setWorkspaceStatus(message, "info");
  }

  function workspaceRemoteBehind(workspace = state.workspace) {
    const value = Number(workspace?.behind || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function workspaceGateLocked() {
    return state.tenantLoading || ["checking", "syncing", "blocked"].includes(String(state.updateGateStatus || ""));
  }

  function preventWorkspaceUseMessage() {
    if (state.tenantLoading) {
      return state.workspaceStatus || "Loading this workspace...";
    }
    if (state.updateGateStatus === "checking") {
      return "Checking GitHub for the latest version...";
    }
    if (state.updateGateStatus === "syncing") {
      return "Updating this workspace from GitHub before it can be used...";
    }
    if (state.updateGateStatus === "blocked") {
      return state.workspaceStatus || "This workspace is blocked until it updates from GitHub.";
    }
    return "";
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
      if (payload?.sync?.bootstrapped_repo) {
        return { text: "Repository connected and synced." };
      }
      return { text: String(payload?.sync?.summary || "").trim() || "Sync finished." };
    }
    if (action === "discard") {
      return { text: String(payload?.discard?.summary || "").trim() || "Local changes discarded." };
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
      if (isAuthFailure(error)) {
        handleUnauthorized("Session expired. Sign in again.");
        return;
      }
      state.tenantLoading = false;
      setWorkspaceStatus(message, "error");
      renderApp();
    }
  }

  async function apiFetch(path, options = {}) {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const shouldHandleUnauthorized = options.handleUnauthorized !== false;
    const extraHeaders = options.headers || {};
    const requestOptions = { ...options };
    delete requestOptions.handleUnauthorized;
    delete requestOptions.headers;
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      ...requestOptions,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(session.bearerToken ? { Authorization: `Bearer ${session.bearerToken}` } : {}),
        ...extraHeaders,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && shouldHandleUnauthorized) {
        handleUnauthorized("Session expired. Sign in again.");
        throw new AuthExpiredError(payload.error || "Session expired. Sign in again.");
      }
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

  function normalizeFileArray(files) {
    return Array.from(files || []).filter(Boolean);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("\n", " ");
  }

  function describeFiles(files) {
    const normalizedFiles = normalizeFileArray(files);
    if (!normalizedFiles.length) {
      return "No files selected.";
    }
    return normalizedFiles.map(file => `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`).join(", ");
  }

  function syncInputFiles(input, files) {
    if (!input) {
      return;
    }
    if (!normalizeFileArray(files).length) {
      input.value = "";
      return;
    }
    if (typeof DataTransfer === "undefined") {
      return;
    }
    const transfer = new DataTransfer();
    normalizeFileArray(files).forEach(file => transfer.items.add(file));
    input.files = transfer.files;
  }

  function ensureReplyDraft(requestId) {
    const key = String(requestId || "");
    if (!key) {
      return { text: "", files: [] };
    }
    if (!state.replyDrafts[key]) {
      state.replyDrafts[key] = { text: "", files: [] };
    }
    return state.replyDrafts[key];
  }

  function bindDropzone(dropzone, input, updateFiles) {
    if (!dropzone || !input || typeof updateFiles !== "function") {
      return;
    }

    const openPicker = event => {
      if (event.target === input || event.target.closest("button, a, textarea, input, select")) {
        return;
      }
      input.click();
    };

    ["dragenter", "dragover"].forEach(type => {
      dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "dragend", "drop"].forEach(type => {
      dropzone.addEventListener(type, event => {
        event.preventDefault();
        if (type !== "drop") {
          dropzone.classList.remove("is-dragover");
          return;
        }
        dropzone.classList.remove("is-dragover");
        const files = normalizeFileArray(event.dataTransfer?.files);
        if (files.length) {
          updateFiles(files);
        }
      });
    });

    dropzone.addEventListener("click", openPicker);
    dropzone.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      input.click();
    });

    input.addEventListener("change", () => {
      updateFiles(normalizeFileArray(input.files));
    });
  }

  function renderAttachmentList(attachments, className = "shared-attachments") {
    const items = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    if (!items.length) {
      return "";
    }
    return `
      <div class="${escapeAttribute(className)}">
        ${items.map(attachment => `
          <a class="shared-attachment" href="${escapeAttribute(assetUrl(attachment.url || ""))}" target="_blank" rel="noreferrer">
            ${escapeHtml(attachment.original_name || attachment.filename || "attachment")}
          </a>
        `).join("")}
      </div>
    `;
  }

  function passwordManagerIgnoreAttrs() {
    return 'data-bwignore="true" data-1p-ignore="true" data-lpignore="true" autocomplete="off"';
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
    return hasReviewableCompletionScreenshot(request)
      ? "The requested update is complete and a fresh screenshot is ready to review."
      : "The requested update is complete and ready to review.";
  }

  function hasReviewableCompletionScreenshot(request) {
    const screenshot = request?.completion_screenshot;
    const verification = screenshot?.verification || request?.completion_screenshot_verification || {};
    return Boolean(screenshot?.url) && String(verification?.status || "").toLowerCase() !== "failed";
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
    if (stateValue === "interrupted") return "Interrupted";
    if (stateValue === "running") return "In Progress";
    return "Queued";
  }

  function requestAvailableActions(request) {
    const provided = Array.isArray(request?.available_actions) ? request.available_actions : null;
    if (provided) {
      return provided.map(value => String(value || "").trim().toLowerCase()).filter(Boolean);
    }
    const status = requestState(request);
    if (status === "interrupted") {
      return ["retry", "archive"];
    }
    if (["completed", "failed", "blocked", "canceled"].includes(status)) {
      return ["archive"];
    }
    if (["queued", "running"].includes(status)) {
      return ["cancel"];
    }
    return [];
  }

  function requestActionKey(requestId, action) {
    return `${String(requestId || "")}:${String(action || "").trim().toLowerCase()}`;
  }

  function requestActionEndpoint(tenantId, requestId) {
    return `/api/app/tenants/${tenantId}/requests/${requestId}/actions`;
  }

  function tenantMemberActionKey(tenantId, userId) {
    return `${String(tenantId || "")}:${String(userId || "")}`;
  }

  function requestActionButtons(request) {
    const tenant = activeTenant();
    const requestId = String(request.request_id || request.id || "");
    const actions = requestAvailableActions(request);
    if (!tenant || !requestId || !actions.length) {
      return "";
    }
    return `
      <div class="request-actions">
        ${actions.map(action => {
          const isArchive = action === "archive";
          const isRetry = action === "retry";
          const key = requestActionKey(requestId, action);
          const busy = requestActionKeysInFlight.has(key);
          return `
            <button
              class="secondary request-action-btn ${isArchive ? "archive-btn" : isRetry ? "retry-btn" : "cancel-btn"}"
              type="button"
              data-request-id="${escapeHtml(requestId)}"
              data-request-action="${escapeHtml(action)}"
              ${(busy || workspaceGateLocked()) ? "disabled" : ""}
            >
              ${escapeHtml(isArchive ? "Archive" : isRetry ? "Retry" : "Cancel")}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function requestPriorityLabel(request) {
    const priority = requestPriority(request);
    if (priority === "urgent") return "Urgent";
    if (priority === "high") return "High";
    if (priority === "low") return "Low";
    return "Normal";
  }

  function requestIdentity(request) {
    return String(request?.request_id || request?.id || "");
  }

  function activeRequest() {
    return state.requests.find(request => requestIdentity(request) === String(state.selectedRequestId || "")) || null;
  }

  function optimisticThreadIdForNewRequest() {
    return `new:${String(state.activeTenantId || "tenant")}`;
  }

  function selectedOptimisticThreadId() {
    return activeRequest() ? requestIdentity(activeRequest()) : optimisticThreadIdForNewRequest();
  }

  function optimisticMessagesForThread(threadId) {
    return state.optimisticMessages.filter(message => String(message.threadId || "") === String(threadId || ""));
  }

  function addOptimisticMessage(threadId, text, files) {
    const message = {
      id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      threadId,
      text: String(text || "").trim(),
      attachments: normalizeFileArray(files).map(file => ({
        name: file.name,
        original_name: file.name,
        size: file.size,
      })),
      created_at: new Date().toISOString(),
    };
    state.optimisticMessages.push(message);
    return message.id;
  }

  function clearOptimisticMessage(messageId) {
    state.optimisticMessages = state.optimisticMessages.filter(message => message.id !== messageId);
  }

  function ensureSelectedRequest() {
    const selectedExists = state.selectedRequestId
      && state.requests.some(request => requestIdentity(request) === String(state.selectedRequestId));
    if (!selectedExists && state.requests.length && !state.composingNewRequest) {
      state.selectedRequestId = requestIdentity(state.requests[0]);
    }
    if (!state.requests.length) {
      state.selectedRequestId = "";
      state.composingNewRequest = true;
    }
  }

  function compactRequestPreview(request) {
    const text = String(request?.details || request?.latest_message || "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 92) : "No details yet.";
  }

  function historyListMarkup() {
    if (state.tenantLoading) {
      return '<div class="shared-history-empty">Loading this workspace...</div>';
    }
    if (!state.requests.length) {
      return '<div class="shared-history-empty">No requests yet.</div>';
    }
    return state.requests.map(request => {
      const requestId = requestIdentity(request);
      const status = requestState(request);
      const active = requestId && requestId === String(state.selectedRequestId || "");
      return `
        <button class="shared-history-item ${active ? "is-active" : ""}" type="button" data-history-request-id="${escapeHtml(requestId)}">
          <span class="shared-history-title">${escapeHtml(request.title || "Untitled request")}</span>
          <span class="shared-history-preview">${escapeHtml(compactRequestPreview(request))}</span>
          <span class="shared-history-meta">
            <span class="shared-history-pill status-${escapeHtml(status)}">${escapeHtml(requestStatusLabel(request))}</span>
            <span>${escapeHtml(formatDate(request.created_at || request.createdAt))}</span>
          </span>
        </button>
      `;
    }).join("");
  }

  function chatAttachmentMarkup(attachments) {
    return renderAttachmentList(attachments, "shared-attachments shared-chat-attachments");
  }

  function optimisticAttachmentMarkup(attachments) {
    const files = Array.isArray(attachments) ? attachments : [];
    if (!files.length) {
      return "";
    }
    return `
      <div class="shared-attachments shared-chat-attachments">
        ${files.map(file => `
          <span class="attachment-chip">${escapeHtml(file.original_name || file.name || "Attachment")}</span>
        `).join("")}
      </div>
    `;
  }

  function chatMessageMarkup(role, label, body, options = {}) {
    const attachments = options.optimistic
      ? optimisticAttachmentMarkup(options.attachments || [])
      : chatAttachmentMarkup(options.attachments || []);
    const time = options.time ? `<span>${escapeHtml(formatDate(options.time))}</span>` : "";
    const bodyMarkup = body ? `<p>${escapeHtml(body)}</p>` : "";
    const pending = options.pending ? '<span>Sending...</span>' : "";
    return `
      <article class="shared-chat-message role-${escapeHtml(role)}">
        <div class="shared-chat-avatar" aria-hidden="true">${escapeHtml(role === "user" ? "You" : "AI")}</div>
        <div class="shared-chat-bubble">
          <div class="shared-chat-message-head">
            <strong>${escapeHtml(label)}</strong>
            ${time}
            ${pending}
          </div>
          ${bodyMarkup}
          ${attachments}
        </div>
      </article>
    `;
  }

  function queuedReplyMarkup(request) {
    const tenant = activeTenant();
    const requestId = requestIdentity(request);
    const queuedReplies = Array.isArray(request?.reply_queue) ? request.reply_queue.filter(Boolean) : [];
    if (!queuedReplies.length) {
      return "";
    }
    return `
      <div class="shared-task-checklist">
        <div class="shared-detail-label">Queued Replies</div>
        <div class="shared-task-checklist-items">
          ${queuedReplies.map(reply => {
            const replyId = String(reply.id || "");
            const key = requestActionKey(requestId, `queued-reply:${replyId}`);
            const steerKey = requestActionKey(requestId, `queued-reply-steer:${replyId}`);
            const busy = requestActionKeysInFlight.has(key);
            const steering = Boolean(reply.steering) || String(reply.status || "").trim().toLowerCase() === "steering";
            const steerBusy = requestActionKeysInFlight.has(steerKey);
            return `
              <div class="shared-task-checklist-item ${steering ? "is-complete" : ""}">
                <span class="shared-task-checklist-box" aria-hidden="true">${steering ? "→" : "•"}</span>
                <span class="shared-task-checklist-text">
                  ${escapeHtml(reply.text || "Queued attachment")}
                  ${steering ? "<small>Steering next</small>" : ""}
                  ${reply.queued_at || reply.created_at ? `<small>${escapeHtml(formatDate(reply.queued_at || reply.created_at))}</small>` : ""}
                </span>
                <button
                  class="secondary request-action-btn"
                  type="button"
                  data-steer-queued-reply="${escapeHtml(replyId)}"
                  data-request-id="${escapeHtml(requestId)}"
                  ${(steering || !tenant || steerBusy || busy || workspaceGateLocked()) ? "disabled" : ""}
                >${steerBusy ? "Steering..." : "Steer next"}</button>
                <button
                  class="secondary request-action-btn"
                  type="button"
                  data-delete-queued-reply="${escapeHtml(replyId)}"
                  data-request-id="${escapeHtml(requestId)}"
                  ${(!tenant || busy || workspaceGateLocked()) ? "disabled" : ""}
                >${busy ? "Deleting..." : "Delete"}</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function chatChecklistMarkup(request) {
    const taskChecklist = Array.isArray(request?.task_checklist) ? request.task_checklist.filter(Boolean) : [];
    if (!taskChecklist.length) {
      return "";
    }
    return `
      <div class="shared-task-checklist">
        <div class="shared-detail-label">Task Queue</div>
        <div class="shared-task-checklist-items">
          ${taskChecklist.map(item => `
            <div class="shared-task-checklist-item ${item.completed ? "is-complete" : ""}">
              <span class="shared-task-checklist-box" aria-hidden="true">${item.completed ? "✓" : ""}</span>
              <span class="shared-task-checklist-text">${escapeHtml(item.text || "")}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function completionMarkup(request) {
    if (requestState(request) !== "completed") {
      return "";
    }
    const completionScreenshot = hasReviewableCompletionScreenshot(request)
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
    `;
  }

  function selectedRequestFeedMarkup() {
    if (state.tenantLoading) {
      return `
        <section class="shared-empty-chat">
          <p class="eyebrow">Loading</p>
          <h2>Switching workspace...</h2>
          <p>Fetching requests and workspace details.</p>
        </section>
      `;
    }
    const request = activeRequest();
    if (!request) {
      const optimisticMessages = optimisticMessagesForThread(optimisticThreadIdForNewRequest());
      if (optimisticMessages.length) {
        return `
          <section class="shared-chat-thread" aria-label="Queued request conversation">
            <div class="shared-thread-title">
              <div>
                <p class="eyebrow">New Thread</p>
                <h2>Sending request...</h2>
              </div>
              <div class="request-meta">
                <span class="pill">Sending</span>
              </div>
            </div>
            ${optimisticMessages.map(message => chatMessageMarkup("user", "You", message.text, {
              attachments: message.attachments,
              time: message.created_at,
              pending: true,
              optimistic: true,
            })).join("")}
          </section>
        `;
      }
      return `
        <section class="shared-empty-chat">
          <p class="eyebrow">New Request</p>
          <h2>What should Smart Todo work on?</h2>
          <p>Start a new task below. Add screenshots, documents, or a recorded voice note when context is easier to show than type.</p>
        </section>
      `;
    }
    const replies = Array.isArray(request.replies) ? request.replies : [];
    const agentMessages = Array.isArray(request.agent_messages)
      ? request.agent_messages.filter(message => String(message?.text || "").trim())
      : [];
    const optimisticMessages = optimisticMessagesForThread(requestIdentity(request));
    const status = requestState(request);
    const latest = String(request.latest_message || "").trim();
    const progressText = status === "completed"
      ? completedRequestSummary(request)
      : (latest || request.public_status_text || "Smart Todo is ready for the next instruction.");
    const smartTodoMessages = agentMessages.length
      ? agentMessages
      : [{ id: "current-status", text: progressText, created_at: request.completed_at || request.updated_at || request.updatedAt || "" }];
    const smartTodoHistory = smartTodoMessages.slice(0, -1);
    const currentSmartTodoMessage = smartTodoMessages[smartTodoMessages.length - 1];
    return `
      <section class="shared-chat-thread" aria-label="Selected request conversation">
        <div class="shared-thread-title">
          <div>
            <p class="eyebrow">Request Thread</p>
            <h2>${escapeHtml(request.title || "Untitled request")}</h2>
          </div>
          <div class="request-meta">
            <span class="pill status-${escapeHtml(status)}">${escapeHtml(requestStatusLabel(request))}</span>
            <span class="pill priority-${escapeHtml(requestPriority(request))}">${escapeHtml(requestPriorityLabel(request))}</span>
          </div>
        </div>
        ${chatMessageMarkup("user", "You", request.details || request.title || "", {
          attachments: request.attachments,
          time: request.created_at || request.createdAt,
        })}
        ${replies.map(reply => chatMessageMarkup("user", reply.author || "You", reply.text || "", {
          attachments: reply.attachments,
          time: reply.created_at || reply.createdAt,
        })).join("")}
        ${optimisticMessages.map(message => chatMessageMarkup("user", "You", message.text, {
          attachments: message.attachments,
          time: message.created_at,
          pending: true,
          optimistic: true,
        })).join("")}
        ${smartTodoHistory.map(message => chatMessageMarkup("agent", "Smart Todo", message.text, {
          time: message.created_at,
        })).join("")}
        <article class="shared-chat-message role-agent">
          <div class="shared-chat-avatar" aria-hidden="true">AI</div>
          <div class="shared-chat-bubble">
            <div class="shared-chat-message-head">
              <strong>Smart Todo</strong>
              ${currentSmartTodoMessage?.created_at ? `<span>${escapeHtml(formatDate(currentSmartTodoMessage.created_at))}</span>` : ""}
            </div>
            <p>${escapeHtml(currentSmartTodoMessage?.text || progressText)}</p>
            ${queuedReplyMarkup(request)}
            ${chatChecklistMarkup(request)}
            ${completionMarkup(request)}
            ${requestActionButtons(request)}
          </div>
        </article>
      </section>
    `;
  }

  function composerFileChipsMarkup() {
    const files = normalizeFileArray(state.composerFiles);
    if (!files.length) {
      return "";
    }
    return `
      <div class="shared-composer-files">
        ${files.map((file, index) => `
          <span class="shared-composer-file">
            ${escapeHtml(file.name)} (${Math.max(1, Math.round(file.size / 1024))} KB)
            <button type="button" data-remove-composer-file="${index}" aria-label="Remove ${escapeAttribute(file.name)}">×</button>
          </span>
        `).join("")}
      </div>
    `;
  }

  function chatComposerMarkup() {
    const request = activeRequest();
    const locked = workspaceGateLocked();
    const recording = audioRecording;
    return `
      <form id="sharedChatForm" class="shared-chat-composer" ${passwordManagerIgnoreAttrs()}>
        <div class="shared-composer-mode">
          <span>${request ? `Replying to ${escapeHtml(request.title || "request")}` : "New request"}</span>
          ${!request ? `
            <select name="priority" ${passwordManagerIgnoreAttrs()} ${locked ? "disabled" : ""}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="low">Low</option>
            </select>
          ` : ""}
        </div>
        <textarea name="message" rows="3" placeholder="${request ? "Send a follow-up or clarification" : "Describe what you want changed or built"}" ${passwordManagerIgnoreAttrs()} ${locked ? "disabled" : ""}>${escapeHtml(state.composerText || "")}</textarea>
        ${composerFileChipsMarkup()}
        <input class="shared-file-input" id="sharedChatFiles" name="files" type="file" multiple data-bwignore="true" data-1p-ignore="true" data-lpignore="true" />
        <div class="shared-composer-actions">
          <button class="secondary" id="attachFilesButton" type="button" ${locked ? "disabled" : ""}>Attach</button>
          <button class="secondary" id="recordAudioButton" type="button" ${locked ? "disabled" : ""}>${recording ? "Stop Recording" : "Record Audio"}</button>
          <button type="submit" ${locked || state.requestSubmitInFlight ? "disabled" : ""}>${state.requestSubmitInFlight ? "Sending..." : request ? "Send" : "Queue Task"}</button>
        </div>
        <p class="shared-file-list" id="sharedRequestFilesStatus">${escapeHtml(state.recordingStatus || describeFiles(state.composerFiles))}</p>
        <p class="form-status" id="sharedRequestStatus"></p>
      </form>
    `;
  }

  function requestListMarkup() {
    if (state.tenantLoading) {
      return '<div class="empty-state">Loading this workspace...</div>';
    }
    return state.requests.length
      ? state.requests.map(requestCard).join("")
      : '<div class="empty-state">No requests yet.</div>';
  }

  function syncReplyFormDrafts(scope = document) {
    scope.querySelectorAll(".shared-reply-form").forEach(form => {
      form.addEventListener("submit", submitReply);
      const requestId = String(form.dataset.requestId || "");
      const draft = ensureReplyDraft(requestId);
      const textarea = form.querySelector('textarea[name="reply"]');
      const filesInput = form.querySelector('input[name="files"]');
      const dropzone = form.querySelector('[data-dropzone="reply"]');
      const filesStatus = form.querySelector('[data-file-list="reply"]');
      if (textarea) {
        textarea.value = draft.text || "";
        textarea.addEventListener("input", event => {
          ensureReplyDraft(requestId).text = event.currentTarget.value;
        });
      }
      syncInputFiles(filesInput, draft.files);
      bindDropzone(dropzone, filesInput, files => {
        ensureReplyDraft(requestId).files = files;
        if (filesStatus) {
          filesStatus.textContent = describeFiles(files);
        }
        syncInputFiles(filesInput, files);
      });
    });
  }

  function bindRequestBoardInteractions(scope = document) {
    scope.querySelectorAll(".card-toggle").forEach(button => {
      button.addEventListener("click", event => {
        if (workspaceGateLocked()) {
          setWorkspaceStatus(preventWorkspaceUseMessage(), "warn");
          renderApp();
          return;
        }
        const requestId = String(event.currentTarget.dataset.requestId || "");
        state.expandedRequestId = state.expandedRequestId === requestId ? "" : requestId;
        renderRequestList(true);
      });
    });
    syncReplyFormDrafts(scope);
    scope.querySelectorAll(".request-action-btn").forEach(button => {
      button.addEventListener("click", handleRequestAction);
    });
  }

  function requestListHasActiveWork() {
    return state.requests.some(request => ["queued", "running"].includes(requestState(request)));
  }

  function requestSortRank(request) {
    return requestState(request) === "running" ? 0 : 1;
  }

  function updateRequestListState(requests) {
    const nextRequests = Array.isArray(requests)
      ? requests
          .map((request, index) => ({ request, index }))
          .sort((left, right) => {
            const rankDiff = requestSortRank(left.request) - requestSortRank(right.request);
            return rankDiff || (left.index - right.index);
          })
          .map(entry => entry.request)
      : [];
    const nextSignature = JSON.stringify(nextRequests);
    const changed = nextSignature !== state.requestListSignature;
    state.requests = nextRequests;
    state.requestListSignature = nextSignature;
    ensureSelectedRequest();
    return changed;
  }

  function renderRequestList(force = false) {
    if (document.querySelector(".shared-chat-app")) {
      renderApp();
      return;
    }
    const board = document.querySelector(".shared-board-list");
    if (!board) {
      return;
    }
    if (!force && !state.requestListSignature) {
      return;
    }
    board.innerHTML = requestListMarkup();
    bindRequestBoardInteractions(board);
  }

  function stopRequestPolling() {
    if (requestPollTimer) {
      window.clearInterval(requestPollTimer);
      requestPollTimer = 0;
    }
  }

  function requestPollingBlocked() {
    if (document.visibilityState === "hidden" || state.activeAction || state.requestSubmitInFlight || state.tenantLoading) {
      return true;
    }
    const activeElement = document.activeElement;
    return Boolean(activeElement && activeElement.closest(".shared-reply-form"));
  }

  async function pollRequestList() {
    const tenant = activeTenant();
    if (!tenant || requestPollInFlight || !requestListHasActiveWork() || requestPollingBlocked()) {
      return;
    }
    requestPollInFlight = true;
    try {
      const payload = await apiFetch(`/api/app/tenants/${tenant.id}/requests`);
      const changed = updateRequestListState(payload?.requests);
      if (changed) {
        renderRequestList();
      }
    } catch (error) {
      if (isAuthFailure(error)) {
        handleUnauthorized("Session expired. Sign in again.");
      }
    } finally {
      requestPollInFlight = false;
    }
  }

  function ensureRequestPolling() {
    stopRequestPolling();
    requestPollTimer = window.setInterval(() => {
      void pollRequestList();
    }, requestPollIntervalMs);
  }

  function requestCard(request) {
    const requestId = String(request.request_id || request.id || "");
    const replies = Array.isArray(request.replies) ? request.replies : [];
    const attachments = Array.isArray(request.attachments) ? request.attachments : [];
    const isExpanded = requestId && requestId === state.expandedRequestId;
    const status = requestState(request);
    const priority = requestPriority(request);
    const isCompleted = status === "completed";
    const replyDraft = ensureReplyDraft(requestId);
    const taskChecklist = Array.isArray(request.task_checklist) ? request.task_checklist.filter(Boolean) : [];
    const latestMessage = request.latest_message
      ? `<p class="shared-request-note">${escapeHtml(request.latest_message)}</p>`
      : "";
    const checklistMarkup = taskChecklist.length
      ? `
        <div class="shared-task-checklist">
          <div class="shared-detail-label">Task Queue</div>
          <div class="shared-task-checklist-items">
            ${taskChecklist.map(item => `
              <div class="shared-task-checklist-item ${item.completed ? "is-complete" : ""}">
                <span class="shared-task-checklist-box" aria-hidden="true">${item.completed ? "✓" : ""}</span>
                <span class="shared-task-checklist-text">${escapeHtml(item.text || "")}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `
      : "";
    const completionScreenshot = hasReviewableCompletionScreenshot(request)
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
              <button class="secondary card-toggle" type="button" data-request-id="${escapeHtml(requestId)}" ${workspaceGateLocked() ? "disabled" : ""}>${isExpanded ? "Hide" : "View"}</button>
            </div>
          </div>
        </div>
        ${
          isExpanded
            ? `
              <div class="shared-request-detail">
                <p class="shared-request-meta">${escapeHtml(formatDate(request.created_at || request.createdAt))}</p>
                ${request.details ? `<p class="shared-request-details">${escapeHtml(request.details)}</p>` : ""}
                ${checklistMarkup}
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
                ${requestActionButtons(request)}
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
                              ${renderAttachmentList(reply.attachments, "shared-attachments shared-reply-attachments")}
                            </div>
                          `
                        )
                        .join("")}</div>`
                    : ""
                }
                ${attachments.length ? `
                  <div class="shared-request-attachments">
                    <div class="shared-detail-label">Attachments</div>
                    ${renderAttachmentList(attachments)}
                  </div>
                ` : ""}
                <form class="shared-reply-form" data-request-id="${escapeHtml(requestId)}" ${passwordManagerIgnoreAttrs()}>
                  <textarea name="reply" rows="3" placeholder="Add a reply or clarification" ${workspaceGateLocked() ? "disabled" : ""} ${passwordManagerIgnoreAttrs()}>${escapeHtml(replyDraft.text || "")}</textarea>
                  <input class="shared-file-input" id="sharedReplyFiles-${escapeAttribute(requestId)}" name="files" type="file" multiple ${workspaceGateLocked() ? "disabled" : ""} data-bwignore="true" data-1p-ignore="true" data-lpignore="true" />
                  <div
                    class="shared-dropzone"
                    data-dropzone="reply"
                    data-request-id="${escapeHtml(requestId)}"
                    tabindex="0"
                    role="button"
                    aria-label="Attach files to reply"
                  >
                    <div class="shared-dropzone-copy">
                      <strong>Drop files here</strong>
                      <span>or click to upload multiple attachments</span>
                    </div>
                  </div>
                  <p class="shared-file-list" data-file-list="reply" data-request-id="${escapeHtml(requestId)}">${escapeHtml(describeFiles(replyDraft.files))}</p>
                  <div class="form-actions">
                    <button type="submit" ${workspaceGateLocked() ? "disabled" : ""}>Send Reply</button>
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

  function tenantMembersMarkup() {
    const activeAdminTenant = state.adminTenants.find(entry => String(entry.id) === String(state.activeTenantId)) || {};
    const members = Array.isArray(activeAdminTenant.members) ? activeAdminTenant.members : [];
    if (!members.length) {
      return '<div class="empty-state">No members yet.</div>';
    }
    return members
      .map(member => {
        const userId = String(member.user?.id || member.userId || "");
        const memberKey = tenantMemberActionKey(state.activeTenantId, userId);
        const busy = memberActionKeysInFlight.has(memberKey);
        return `
          <div class="shared-member-row">
            <div class="shared-member-copy">
              <strong>${escapeHtml(member.user?.name || member.user?.email || member.userId)}</strong>
              <span>${escapeHtml(member.user?.email || "")}</span>
              <span>${escapeHtml(member.role || "")}</span>
            </div>
            <button
              class="secondary shared-member-remove"
              type="button"
              data-member-user-id="${escapeHtml(userId)}"
              data-member-name="${escapeAttribute(member.user?.name || member.user?.email || "this user")}"
              ${busy || !userId ? "disabled" : ""}
            >
              ${busy ? "Removing..." : "Remove"}
            </button>
          </div>
        `;
      })
      .join("");
  }

  function workspaceActionsMarkup() {
    const workspace = state.workspace || {};
    const enabledActions = Array.isArray(workspace.enabledActions) ? workspace.enabledActions : ["preview", "sync", "discard", "deploy"];
    const actionInFlight = String(state.activeAction || "");
    const locked = workspaceGateLocked();
    return `
      <button class="board-action" data-workspace-action="sync" ${(enabledActions.includes("sync") && !actionInFlight && !locked) ? "" : "disabled"}>${actionInFlight === "sync" ? "Syncing..." : "Sync"}</button>
      <button class="board-action" data-workspace-action="preview" ${(enabledActions.includes("preview") && !actionInFlight && !locked) ? "" : "disabled"}>${actionInFlight === "preview" ? "Starting..." : "Preview"}</button>
      <button class="board-action" data-workspace-action="discard" ${(enabledActions.includes("discard") && !actionInFlight && workspace.dirty && !locked) ? "" : "disabled"}>${actionInFlight === "discard" ? "Discarding..." : "Discard Changes"}</button>
      <button class="board-action" data-workspace-action="deploy" ${(enabledActions.includes("deploy") && !actionInFlight && !locked) ? "" : "disabled"}>${actionInFlight === "deploy" ? "Deploying..." : "Deploy"}</button>
      <button class="board-action" id="refreshWorkspaceButton" type="button" ${(actionInFlight || locked || state.updateGateStatus === "checking" || state.updateGateStatus === "syncing") ? "disabled" : ""}>Refresh</button>
    `;
  }

  function renderAuthLoading(message = "Checking your session...") {
    stopRequestPolling();
    markSharedReady();
    document.body.innerHTML = `
      <div class="page-shell shared-shell">
        <section class="auth-shell">
          <div class="auth-card">
            <p class="eyebrow">${escapeHtml(config.authEyebrow || "Smart Todo")}</p>
            <h2>Loading</h2>
            <p class="hero-copy">${escapeHtml(message)}</p>
          </div>
        </section>
      </div>
    `;
  }

  function renderLogin(message = "") {
    stopRequestPolling();
    markSharedReady();
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
      const form = event.currentTarget;
      const formData = new FormData(form);
      const submitButton = form.querySelector('button[type="submit"]');
      const statusNode = form.querySelector(".form-status");
      if (submitButton) {
        submitButton.disabled = true;
      }
      if (statusNode) {
        statusNode.textContent = "Signing in...";
      }
      try {
        const payload = await apiFetch("/api/auth/login", {
          method: "POST",
          handleUnauthorized: false,
          body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password"),
          }),
        });
        setSessionAuthenticated(payload.token);
        renderAuthLoading("Loading your workspace...");
        await bootstrapAuthenticatedState(payload.user);
      } catch (error) {
        setSessionAnonymous();
        renderLogin(error instanceof AuthExpiredError ? "Session expired. Sign in again." : error.message);
      }
    });
  }

  function adminPanelMarkup(tenantFormSource) {
    if (!userCanViewAdminPanel()) {
      return "";
    }
    return `
      <section class="shared-admin-panel ${state.adminOpen ? "" : "hidden"}" id="sharedAdminPanel">
        <div class="shared-admin-head">
          <p class="eyebrow">Admin</p>
          <h2>Tenant and account management</h2>
          <button class="secondary" id="closeAdminButton" type="button">Close</button>
        </div>
        ${state.adminStatus ? `<p class="shared-board-status tone-warn">${escapeHtml(state.adminStatus)}</p>` : ""}
        <div class="shared-admin-grid">
          <form id="tenantForm" class="shared-admin-form">
            <h3>${state.creatingTenant ? "Create Tenant" : "Edit Active Tenant"}</h3>
            <label><span>Display Name</span><input name="displayName" value="${escapeHtml(tenantFormSource.displayName || "")}" required /></label>
            <label><span>Slug</span><input name="slug" value="${escapeHtml(tenantFormSource.slug || "")}" ${state.creatingTenant ? "" : "readonly"} required /></label>
            <label><span>Public URL</span><input name="publicUrl" value="${escapeHtml(tenantFormSource.workspace?.publicUrl || "")}" /></label>
            <label><span>Repo Path</span><input name="repoPath" value="${escapeHtml(tenantFormSource.workspace?.repoPath || "")}" /></label>
            <label><span>Repo URL</span><input name="repoUrl" value="${escapeHtml(tenantFormSource.workspace?.repoUrl || "")}" placeholder="https://github.com/org/repo.git" /></label>
            <label><span>App Path</span><input name="appPath" value="${escapeHtml(tenantFormSource.workspace?.appPath || tenantFormSource.workspace?.repoPath || "")}" /></label>
            <label><span>Preview Base Path</span><input name="previewBasePath" value="${escapeHtml(tenantFormSource.workspace?.previewBasePath || "")}" /></label>
            <label><span>Preview Port</span><input name="previewPort" type="number" value="${escapeHtml(tenantFormSource.workspace?.previewPort || "")}" /></label>
            <label><span>Deploy Branch</span><input name="deployBranch" value="${escapeHtml(tenantFormSource.workspace?.deployBranch || "main")}" /></label>
            <label><span>Status</span><input name="status" value="${escapeHtml(tenantFormSource.status || "active")}" /></label>
            <label class="shared-checkbox-row"><input type="checkbox" name="enablePreview" ${tenantFormSource.workspace?.enabledActions?.includes("preview") ? "checked" : ""} /> Preview</label>
            <label class="shared-checkbox-row"><input type="checkbox" name="enableSync" ${tenantFormSource.workspace?.enabledActions?.includes("sync") ? "checked" : ""} /> Sync</label>
            <label class="shared-checkbox-row"><input type="checkbox" name="enableDiscard" ${tenantFormSource.workspace?.enabledActions?.includes("discard") ? "checked" : ""} /> Discard Changes</label>
            <label class="shared-checkbox-row"><input type="checkbox" name="enableDeploy" ${tenantFormSource.workspace?.enabledActions?.includes("deploy") ? "checked" : ""} /> Deploy</label>
            <div class="form-actions">
              <button type="submit">${state.creatingTenant ? "Create Tenant" : "Save Tenant"}</button>
              <button class="secondary" id="newTenantButton" type="button">New Tenant</button>
              <p class="form-status" id="tenantFormStatus"></p>
            </div>
          </form>

          <form id="existingUserForm" class="shared-admin-form" data-user-mode="existing">
            <h3>Add Existing User</h3>
            <p class="shared-form-copy">Attach an existing account to this tenant by email.</p>
            <label><span>Email</span><input name="email" type="email" required /></label>
            <label>
              <span>Role</span>
              <select name="role">
                <option value="client_user">client_user</option>
                <option value="internal_operator">internal_operator</option>
                <option value="owner">owner</option>
              </select>
            </label>
            <div class="form-actions">
              <button type="submit">Add to Tenant</button>
              <p class="form-status" id="existingUserFormStatus"></p>
            </div>
          </form>

          <form id="newUserForm" class="shared-admin-form" data-user-mode="new">
            <h3>Create New User</h3>
            <p class="shared-form-copy">Create a brand-new account and add it to this tenant in one step.</p>
            <label><span>Email</span><input name="email" type="email" required /></label>
            <label><span>Name</span><input name="name" required /></label>
            <label><span>Password</span><input name="password" type="password" required minlength="8" /></label>
            <label>
              <span>Role</span>
              <select name="role">
                <option value="client_user">client_user</option>
                <option value="internal_operator">internal_operator</option>
                <option value="owner">owner</option>
              </select>
            </label>
            <div class="form-actions">
              <button type="submit">Create and Add</button>
              <p class="form-status" id="newUserFormStatus"></p>
            </div>
          </form>
        </div>
        <div class="shared-members">
          <h3>Members</h3>
          ${tenantMembersMarkup()}
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
    `;
  }

  function renderApp() {
    markSharedReady();
    const tenant = activeTenant();
    const tenantFormSource = state.creatingTenant
      ? { displayName: "", slug: "", status: "active", workspace: { enabledActions: ["preview", "sync", "discard", "deploy"] } }
      : (tenant || { workspace: {} });
    ensureSelectedRequest();
    applyTheme(tenant?.theme || {});
    document.title = tenant?.displayName ? `${tenant.displayName} · Smart Todo` : (config.portalTitle || "Smart Todo");
    document.body.innerHTML = `
      <div class="shared-chat-app ${state.historyOpen ? "history-open" : ""}">
        <aside class="shared-chat-sidebar">
          <div class="shared-sidebar-top">
            <div>
              <p class="eyebrow">${escapeHtml(config.heroEyebrow || "Smart Todo")}</p>
              <h1>${escapeHtml(tenant?.displayName || "Workspace")}</h1>
            </div>
            <button class="shared-mobile-close" id="closeHistoryButton" type="button">Close</button>
          </div>
          <label class="shared-tenant-switch">
            <span>Workspace</span>
            <select id="tenantSwitch">${state.tenants.map(tenantOption).join("")}</select>
          </label>
          <button class="shared-new-chat" id="newChatButton" type="button" ${workspaceGateLocked() ? "disabled" : ""}>New Chat</button>
          <nav class="shared-history-list" aria-label="Request history">
            ${historyListMarkup()}
          </nav>
          <div class="shared-sidebar-footer">
            <div class="shared-session-line">${escapeHtml(state.user?.name || state.user?.email || "")}</div>
            <div class="shared-utility-actions">
              ${userCanViewAdminPanel() ? `<button class="secondary" id="toggleAdminButton" type="button" ${workspaceGateLocked() ? "disabled" : ""}>Admin</button>` : ""}
              <button class="secondary" id="logoutButton" type="button">Logout</button>
            </div>
          </div>
        </aside>

        <main class="shared-chat-main">
          <header class="shared-chat-header">
            <button class="secondary shared-history-toggle" id="openHistoryButton" type="button">History</button>
            <div class="shared-chat-heading">
              <p class="eyebrow">${activeRequest() ? "Selected Thread" : "New Thread"}</p>
              <h2>${escapeHtml(activeRequest()?.title || "Smart Todo")}</h2>
            </div>
            <div class="shared-board-actions shared-chat-actions">
              ${workspaceActionsMarkup()}
            </div>
          </header>

          ${workspaceGateLocked() ? `<p class="shared-board-status tone-warn">${escapeHtml(preventWorkspaceUseMessage())}</p>` : ""}
          ${workspaceStatusMarkup()}

          <div class="shared-workspace-meta">
            <span>Repo: ${escapeHtml(state.workspace?.repo_path || state.workspace?.repoPath || "n/a")}</span>
            <span>Branch: ${escapeHtml(state.workspace?.branch || "n/a")}</span>
            <span>Preview: ${state.workspace?.preview?.url ? `<a href="${escapeHtml(cacheSafePreviewUrl(state.workspace.preview.url))}" target="_blank" rel="noreferrer">${escapeHtml(state.workspace.preview.url)}</a>` : "n/a"}</span>
          </div>
          <div class="shared-chat-scroll">
            ${selectedRequestFeedMarkup()}
          </div>
          ${chatComposerMarkup()}
        </main>
        ${adminPanelMarkup(tenantFormSource)}
      </div>
    `;

    document.querySelector("#tenantSwitch").value = state.activeTenantId;
    document.querySelector("#tenantSwitch").addEventListener("change", async event => {
      setActiveTenantId(event.currentTarget.value);
      resetTenantScopedState("Switching workspace...");
      renderApp();
      await reloadBoard();
    });
    document.querySelector("#logoutButton").addEventListener("click", async () => {
      try {
        await apiFetch("/api/auth/logout", { method: "POST", handleUnauthorized: false });
      } catch (_error) {
        // Ignore logout failures and clear local state.
      }
      clearAppState();
      setSessionAnonymous();
      setActiveTenantId("");
      renderLogin();
    });
    document.querySelector("#refreshWorkspaceButton").addEventListener("click", () => reloadBoard());
    document.querySelector("#newChatButton").addEventListener("click", () => {
      state.selectedRequestId = "";
      state.composingNewRequest = true;
      state.historyOpen = false;
      state.composerFiles = [];
      state.composerText = "";
      state.recordingStatus = "";
      state.recordingTranscript = "";
      renderApp();
    });
    document.querySelector("#openHistoryButton").addEventListener("click", () => {
      state.historyOpen = true;
      renderApp();
    });
    const closeHistoryButton = document.querySelector("#closeHistoryButton");
    if (closeHistoryButton) {
      closeHistoryButton.addEventListener("click", () => {
        state.historyOpen = false;
        renderApp();
      });
    }
    document.querySelectorAll("[data-history-request-id]").forEach(button => {
      button.addEventListener("click", event => {
        state.selectedRequestId = String(event.currentTarget.dataset.historyRequestId || "");
        state.composingNewRequest = false;
        state.historyOpen = false;
        state.composerFiles = [];
        state.composerText = "";
        state.recordingStatus = "";
        state.recordingTranscript = "";
        renderApp();
      });
    });
    const toggleAdminButton = document.querySelector("#toggleAdminButton");
    if (toggleAdminButton) {
      toggleAdminButton.addEventListener("click", () => {
        setWorkspaceStatus("");
        state.adminOpen = !state.adminOpen;
        renderApp();
      });
    }
    const closeAdminButton = document.querySelector("#closeAdminButton");
    if (closeAdminButton) {
      closeAdminButton.addEventListener("click", () => {
        state.adminOpen = false;
        renderApp();
      });
    }
    document.querySelector("#sharedChatForm").addEventListener("submit", submitRequest);
    const composerTextArea = document.querySelector('#sharedChatForm textarea[name="message"]');
    if (composerTextArea) {
      composerTextArea.addEventListener("input", event => {
        state.composerText = event.currentTarget.value;
      });
    }
    const requestFilesInput = document.querySelector("#sharedChatFiles");
    const requestFilesStatus = document.querySelector("#sharedRequestFilesStatus");
    syncInputFiles(requestFilesInput, state.composerFiles);
    document.querySelector("#attachFilesButton").addEventListener("click", () => requestFilesInput.click());
    requestFilesInput.addEventListener("change", () => {
      state.composerFiles = state.composerFiles.concat(normalizeFileArray(requestFilesInput.files));
      state.recordingStatus = "";
      state.recordingTranscript = "";
      renderApp();
    });
    document.querySelectorAll("[data-remove-composer-file]").forEach(button => {
      button.addEventListener("click", event => {
        const index = Number(event.currentTarget.dataset.removeComposerFile);
        state.composerFiles = state.composerFiles.filter((_file, fileIndex) => fileIndex !== index);
        if (requestFilesStatus) {
          requestFilesStatus.textContent = describeFiles(state.composerFiles);
        }
        renderApp();
      });
    });
    document.querySelector("#recordAudioButton").addEventListener("click", toggleAudioRecording);
    bindRequestBoardInteractions();
    document.querySelectorAll("[data-workspace-action]").forEach(button => {
      button.addEventListener("click", event => runWorkspaceAction(event.currentTarget.dataset.workspaceAction));
    });
    document.querySelectorAll("[data-delete-queued-reply]").forEach(button => {
      button.addEventListener("click", deleteQueuedReply);
    });
    document.querySelectorAll("[data-steer-queued-reply]").forEach(button => {
      button.addEventListener("click", steerQueuedReply);
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
    document.querySelectorAll("[data-user-mode]").forEach(form => {
      form.addEventListener("submit", saveUser);
    });
    document.querySelectorAll("[data-member-user-id]").forEach(button => {
      button.addEventListener("click", removeTenantUser);
    });
    ensureRequestPolling();
  }

  async function bootstrapAuthenticatedState(currentUser = null) {
    const mePayload = currentUser ? { user: currentUser } : await apiFetch("/api/auth/me", { handleUnauthorized: false });
    if (!mePayload?.user) {
      handleUnauthorized("Session expired. Sign in again.");
      throw new AuthExpiredError("Session expired. Sign in again.");
    }
    setSessionAuthenticated(session.bearerToken);
    applyAuthenticatedUser(mePayload.user);
    state.creatingTenant = false;
    await loadTenantData();
  }

  async function initializeSession() {
    session.status = "loading";
    renderAuthLoading();
    try {
      await bootstrapAuthenticatedState();
    } catch (error) {
      if (isAuthFailure(error)) {
        handleUnauthorized("Sign in to access your workspace.");
        return;
      }
      throw error;
    }
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
    let workspacePayload = null;
    try {
      const [requestsResult, workspaceResult] = await Promise.allSettled([
        apiFetch(`/api/app/tenants/${requestedTenantId}/requests`),
        apiFetch(`/api/app/tenants/${requestedTenantId}/workspace`),
      ]);
      if (requestsResult.status === "rejected") {
        throw requestsResult.reason;
      }
      requestsPayload = requestsResult.value;
      if (workspaceResult.status === "fulfilled") {
        workspacePayload = workspaceResult.value;
        setWorkspaceStatus("");
      } else {
        const error = workspaceResult.reason;
        const message = String(error?.message || "").trim().toLowerCase();
        if (!message.includes("tenant not found")) {
          setWorkspaceStatus("Workspace details are temporarily unavailable. The request board is still current.", "warn");
        } else {
          throw error;
        }
      }
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
    updateRequestListState(requestsPayload.requests);
    state.workspace = workspacePayload?.workspace || requestsPayload.workspace || state.workspace || null;
    state.tenantLoading = false;
    renderApp();
    await ensureWorkspaceCurrent(requestedTenantId, loadRequestId);
    if (loadRequestId !== state.loadRequestId || String(state.activeTenantId) !== requestedTenantId) {
      return;
    }
    state.adminStatus = "";
    if (userCanViewAdminPanel()) {
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

  async function ensureWorkspaceCurrent(tenantId, loadRequestId) {
    if (!state.workspace) {
      state.updateGateStatus = "ready";
      return;
    }
    state.updateGateStatus = "checking";
    const remoteError = String(state.workspace.remote_error || "").trim();
    if (remoteError) {
      state.updateGateStatus = "blocked";
      setWorkspaceStatus(`Unable to confirm the latest GitHub version: ${remoteError}`, "error");
      renderApp();
      return;
    }
    const behind = workspaceRemoteBehind();
    if (!behind) {
      state.updateGateStatus = "ready";
      return;
    }

    state.updateGateStatus = "syncing";
    state.activeAction = "sync";
    setWorkspaceStatus(`Updating from GitHub before this workspace can be used (${behind} commit${behind === 1 ? "" : "s"} behind)...`, "info");
    renderApp();
    try {
      const payload = await apiFetch(`/api/app/tenants/${tenantId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action: "sync" }),
      });
      if (loadRequestId !== state.loadRequestId || String(state.activeTenantId) !== String(tenantId)) {
        return;
      }
      state.workspace = payload?.workspace || state.workspace;
      const remainingBehind = workspaceRemoteBehind();
      if (remainingBehind || String(state.workspace?.remote_error || "").trim()) {
        throw new Error("GitHub still has newer commits after sync.");
      }
      state.updateGateStatus = "ready";
      const actionMessage = messageFromActionResult("sync", payload);
      setWorkspaceStatus(actionMessage.text, "success", {
        href: actionMessage.href,
        label: actionMessage.label,
      });
      const requestsPayload = await apiFetch(`/api/app/tenants/${tenantId}/requests`);
      if (loadRequestId === state.loadRequestId && String(state.activeTenantId) === String(tenantId)) {
        updateRequestListState(requestsPayload.requests);
      }
    } catch (error) {
      state.updateGateStatus = "blocked";
      setWorkspaceStatus(
        `This workspace is blocked because it could not update from GitHub: ${String(error?.message || "Sync failed.")}`,
        "error"
      );
      renderApp();
    } finally {
      if (state.activeAction === "sync") {
        state.activeAction = "";
      }
    }
  }

  function appendTranscriptToComposer(transcript) {
    const normalized = String(transcript || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return false;
    }
    const current = String(state.composerText || "").trimEnd();
    state.composerText = current ? `${current} ${normalized}` : normalized;
    return true;
  }

  function setRecordingStatus(message) {
    state.recordingStatus = String(message || "");
    const statusNode = document.querySelector("#sharedRequestFilesStatus");
    if (statusNode) {
      statusNode.textContent = state.recordingStatus || describeFiles(state.composerFiles);
    }
  }

  function stopAudioTracks() {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
  }

  async function transcribeRecordedAudio(blob) {
    const formData = new FormData();
    formData.append("file", blob, "smart-todo-voice.webm");
    const payload = await apiFetch("/api/app/transcriptions", {
      method: "POST",
      body: formData,
    });
    const appended = appendTranscriptToComposer(payload.text || "");
    state.recordingStatus = appended ? "Transcript added to message." : "No speech was transcribed.";
    state.recordingTranscript = "";
    renderApp();
  }

  function finishAudioRecording() {
    const blob = new Blob(audioChunks, { type: audioRecorder?.mimeType || "audio/webm" });
    audioChunks = [];
    audioRecorder = null;
    audioRecording = false;
    stopAudioTracks();
    if (!blob.size) {
      state.recordingStatus = "No audio was recorded.";
      renderApp();
      return;
    }
    setRecordingStatus("Transcribing...");
    transcribeRecordedAudio(blob).catch(error => {
      state.recordingStatus = error.message || "Transcription failed.";
      renderApp();
    });
  }

  async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      state.recordingStatus = "Audio recording is not supported in this browser.";
      renderApp();
      return;
    }
    try {
      audioChunks = [];
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRecorder = new MediaRecorder(audioStream);
      audioRecorder.ondataavailable = event => {
        if (event.data?.size) {
          audioChunks.push(event.data);
        }
      };
      audioRecorder.onerror = event => {
        audioRecording = false;
        stopAudioTracks();
        state.recordingStatus = event.error?.message || "Recording failed.";
        renderApp();
      };
      audioRecorder.onstop = finishAudioRecording;
      audioRecorder.start(1000);
      audioRecording = true;
      state.recordingStatus = "Recording...";
      renderApp();
    } catch (error) {
      audioRecording = false;
      stopAudioTracks();
      state.recordingStatus = error.message || "Unable to start audio recording.";
      renderApp();
    }
  }

  async function toggleAudioRecording() {
    if (audioRecording) {
      setRecordingStatus("Stopping recording...");
      if (audioRecorder && audioRecorder.state !== "inactive") {
        if (typeof audioRecorder.requestData === "function") {
          audioRecorder.requestData();
        }
        audioRecorder.stop();
      } else {
        finishAudioRecording();
      }
      return;
    }
    await startAudioRecording();
  }

  async function submitRequest(event) {
    event.preventDefault();
    const tenant = activeTenant();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const statusNode = document.querySelector("#sharedRequestStatus");
    const submitButton = form.querySelector('button[type="submit"]');
    const selected = activeRequest();
    const message = String(formData.get("message") || "").trim();
    if (!tenant || state.requestSubmitInFlight) return;
    if (workspaceGateLocked()) {
      if (statusNode) {
        statusNode.textContent = preventWorkspaceUseMessage();
      }
      return;
    }
    if (!message && !state.composerFiles.length) {
      if (statusNode) {
        statusNode.textContent = selected ? "Add a message or attachment to send." : "Describe the task or attach a file.";
      }
      return;
    }
    const submittedFiles = normalizeFileArray(state.composerFiles);
    const optimisticThreadId = selected ? requestIdentity(selected) : optimisticThreadIdForNewRequest();
    const optimisticMessageId = addOptimisticMessage(optimisticThreadId, message, submittedFiles);
    state.requestSubmitInFlight = true;
    state.composerFiles = [];
    state.composerText = "";
    state.recordingStatus = "";
    state.recordingTranscript = "";
    renderApp();
    if (submitButton) {
      submitButton.disabled = true;
    }
    const nextStatusNode = document.querySelector("#sharedRequestStatus");
    if (nextStatusNode) {
      nextStatusNode.textContent = "Sending...";
    }
    try {
      const payload = new FormData();
      submittedFiles.forEach(file => {
        payload.append("files", file);
      });
      let responsePayload;
      if (selected) {
        payload.set("requestId", requestIdentity(selected));
        payload.set("text", message);
        responsePayload = await apiFetch(`/api/app/tenants/${tenant.id}/replies`, {
          method: "POST",
          body: payload,
        });
      } else {
        const title = firstReadableSentence(message).slice(0, 140) || submittedFiles[0]?.name || "New request";
        payload.set("title", title);
        payload.set("details", message);
        payload.set("priority", String(formData.get("priority") || "normal").trim());
        responsePayload = await apiFetch(`/api/app/tenants/${tenant.id}/requests`, {
          method: "POST",
          body: payload,
        });
        const nextRequestId = requestIdentity(responsePayload?.request);
        if (nextRequestId) {
          state.selectedRequestId = nextRequestId;
          state.composingNewRequest = false;
        }
      }
      clearOptimisticMessage(optimisticMessageId);
      if (responsePayload?.workspace) {
        state.workspace = responsePayload.workspace;
      }
      const successStatusNode = document.querySelector("#sharedRequestStatus");
      if (successStatusNode) {
        successStatusNode.textContent = selected
          ? (responsePayload?.queued ? "Reply queued." : "Reply sent.")
          : responsePayload?.duplicate ? "Request already queued." : "Request queued.";
      }
      await reloadBoard();
    } catch (error) {
      clearOptimisticMessage(optimisticMessageId);
      state.composerFiles = submittedFiles;
      state.composerText = message;
      renderApp();
      const errorStatusNode = document.querySelector("#sharedRequestStatus");
      if (errorStatusNode) {
        errorStatusNode.textContent = error.message;
      }
    } finally {
      state.requestSubmitInFlight = false;
      renderApp();
    }
  }

  async function handleRequestAction(event) {
    const tenant = activeTenant();
    const button = event.currentTarget;
    const requestId = String(button.dataset.requestId || "");
    const action = String(button.dataset.requestAction || "").trim().toLowerCase();
    if (!tenant || !requestId || !["cancel", "archive", "retry"].includes(action)) {
      return;
    }
    if (workspaceGateLocked()) {
      setWorkspaceStatus(preventWorkspaceUseMessage(), "warn");
      renderApp();
      return;
    }
    const key = requestActionKey(requestId, action);
    if (requestActionKeysInFlight.has(key)) {
      return;
    }
    requestActionKeysInFlight.add(key);
    renderApp();
    try {
      const payload = await apiFetch(requestActionEndpoint(tenant.id, requestId), {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (payload?.workspace) {
        state.workspace = payload.workspace;
      }
      setWorkspaceStatus(
        action === "archive" ? "Request archived." : action === "retry" ? "Request restarted." : "Request canceled.",
        action === "archive" ? "info" : action === "retry" ? "success" : "warn"
      );
      await reloadBoard();
    } catch (error) {
      setWorkspaceStatus(error.message, "error");
      renderApp();
    } finally {
      requestActionKeysInFlight.delete(key);
      if (state.user) {
        renderApp();
      }
    }
  }

  async function deleteQueuedReply(event) {
    const tenant = activeTenant();
    const button = event.currentTarget;
    const requestId = String(button.dataset.requestId || "");
    const replyId = String(button.dataset.deleteQueuedReply || "");
    if (!tenant || !requestId || !replyId) {
      return;
    }
    if (workspaceGateLocked()) {
      setWorkspaceStatus(preventWorkspaceUseMessage(), "warn");
      renderApp();
      return;
    }
    const key = requestActionKey(requestId, `queued-reply:${replyId}`);
    if (requestActionKeysInFlight.has(key)) {
      return;
    }
    requestActionKeysInFlight.add(key);
    renderApp();
    try {
      const payload = await apiFetch(`/api/app/tenants/${tenant.id}/requests/${requestId}/reply-queue/${replyId}`, {
        method: "DELETE",
      });
      if (payload?.request) {
        updateRequestListState(state.requests.map(request => requestIdentity(request) === requestId ? payload.request : request));
      }
      if (payload?.workspace) {
        state.workspace = payload.workspace;
      }
      setWorkspaceStatus("Queued reply deleted.", "success");
    } catch (error) {
      setWorkspaceStatus(error.message, "error");
    } finally {
      requestActionKeysInFlight.delete(key);
      renderApp();
    }
  }

  async function steerQueuedReply(event) {
    const tenant = activeTenant();
    const button = event.currentTarget;
    const requestId = String(button.dataset.requestId || "");
    const replyId = String(button.dataset.steerQueuedReply || "");
    if (!tenant || !requestId || !replyId) {
      return;
    }
    if (workspaceGateLocked()) {
      setWorkspaceStatus(preventWorkspaceUseMessage(), "warn");
      renderApp();
      return;
    }
    const key = requestActionKey(requestId, `queued-reply-steer:${replyId}`);
    if (requestActionKeysInFlight.has(key)) {
      return;
    }
    requestActionKeysInFlight.add(key);
    renderApp();
    try {
      const payload = await apiFetch(`/api/app/tenants/${tenant.id}/requests/${requestId}/reply-queue/${replyId}/steer`, {
        method: "POST",
      });
      if (payload?.request) {
        updateRequestListState(state.requests.map(request => requestIdentity(request) === requestId ? payload.request : request));
      }
      if (payload?.workspace) {
        state.workspace = payload.workspace;
      }
      setWorkspaceStatus("Queued reply will steer the next pass.", "success");
    } catch (error) {
      setWorkspaceStatus(error.message, "error");
    } finally {
      requestActionKeysInFlight.delete(key);
      renderApp();
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    const tenant = activeTenant();
    const requestId = event.currentTarget.dataset.requestId;
    const draft = ensureReplyDraft(requestId);
    const text = String(new FormData(event.currentTarget).get("reply") || "").trim();
    if (!tenant || !requestId || (!text && !draft.files.length)) {
      return;
    }
    if (workspaceGateLocked()) {
      window.alert(preventWorkspaceUseMessage());
      return;
    }
    try {
      const payload = new FormData();
      payload.set("requestId", requestId);
      payload.set("text", text);
      draft.files.forEach(file => {
        payload.append("files", file);
      });
      await apiFetch(`/api/app/tenants/${tenant.id}/replies`, {
        method: "POST",
        body: payload,
      });
      state.replyDrafts[String(requestId)] = { text: "", files: [] };
      setWorkspaceStatus("Reply added.", "success");
      await reloadBoard();
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function runWorkspaceAction(action) {
    const tenant = activeTenant();
    if (!tenant) return;
    if (workspaceGateLocked()) {
      setWorkspaceStatus(preventWorkspaceUseMessage(), "warn");
      renderApp();
      return;
    }
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
        repoUrl: formData.get("repoUrl"),
        appPath: formData.get("appPath"),
        previewBasePath: formData.get("previewBasePath"),
        previewPort: Number(formData.get("previewPort") || 0),
        deployBranch: formData.get("deployBranch"),
        enabledActions: [
          formData.get("enablePreview") ? "preview" : "",
          formData.get("enableSync") ? "sync" : "",
          formData.get("enableDiscard") ? "discard" : "",
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
    const form = event.currentTarget;
    const mode = String(form.dataset.userMode || "existing").trim().toLowerCase();
    const statusNode = form.querySelector(".form-status");
    const formData = new FormData(form);
    statusNode.textContent = "Saving...";
    try {
      const payload = {
        email: String(formData.get("email") || "").trim(),
        role: String(formData.get("role") || "client_user").trim(),
      };
      if (mode === "new") {
        payload.name = String(formData.get("name") || "").trim();
        payload.password = String(formData.get("password") || "");
      }
      await apiFetch(`/api/app/admin/tenants/${state.activeTenantId}/users`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      statusNode.textContent = mode === "new" ? "User created." : "User added to tenant.";
      await reloadBoard();
    } catch (error) {
      statusNode.textContent = error.message;
    }
  }

  async function removeTenantUser(event) {
    const tenantId = String(state.activeTenantId || "");
    const userId = String(event.currentTarget.dataset.memberUserId || "");
    const memberName = String(event.currentTarget.dataset.memberName || "this user");
    if (!tenantId || !userId) {
      return;
    }
    if (!window.confirm(`Remove ${memberName} from this tenant?`)) {
      return;
    }
    const memberKey = tenantMemberActionKey(tenantId, userId);
    if (memberActionKeysInFlight.has(memberKey)) {
      return;
    }
    memberActionKeysInFlight.add(memberKey);
    state.adminStatus = "";
    renderApp();
    try {
      await apiFetch(`/api/app/admin/tenants/${tenantId}/users/${userId}`, {
        method: "DELETE",
      });
      setWorkspaceStatus("User removed from tenant.", "success");
      await reloadBoard();
    } catch (error) {
      state.adminStatus = error.message;
      renderApp();
    } finally {
      memberActionKeysInFlight.delete(memberKey);
      if (state.user) {
        renderApp();
      }
    }
  }

  if (!apiBase) {
    renderLogin("PORTAL_API_BASE is required for shared mode.");
    return;
  }

  initializeSession().catch(error => {
    if (error instanceof AuthExpiredError) {
      return;
    }
    renderAuthLoading(String(error?.message || "Unable to verify your session right now. Refresh to retry."));
  });
}());

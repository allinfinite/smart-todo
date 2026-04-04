if (window.PORTAL_TEMPLATE_CONFIG?.appMode !== "shared") {
const LOCAL_API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:4173"
  : "https://example-api.your-domain.com";

const DEFAULT_PORTAL_CONFIG = {
  portalTitle: "Client Work Portal",
  storageNamespace: "client-portal-template",
  apiBase: LOCAL_API_BASE,
  requestsPath: "/api/portal/gray/requests",
  repliesPath: "/api/portal/gray/replies",
  workspacePath: "",
  siteActionsPath: "",
  showApiBaseLabel: true,
  authEyebrow: "Protected Portal",
  authTitle: "Project updates",
  authCopy: "Enter the portal password to view and submit work requests.",
  heroEyebrow: "Client Delivery Portal",
  heroTitle: "Send work, watch it move, and keep the list growing.",
  heroCopy: "Add a task and keep building your list while work moves in the background.",
  composerEyebrow: "New Request",
  composerTitle: "Send work to the team",
  boardEyebrow: "Todo List",
  boardTitle: "Work board",
  userLabel: "You",
  agentLabel: "Team",
  externalReplyAuthorLabel: "Client",
  labels: {
    password: "Password",
    title: "Title",
    details: "Details",
    priority: "Priority",
    files: "Files or references",
    reply: "Your Reply",
  },
  placeholders: {
    title: "Describe the next update you want made",
    details: "Explain the change, desired outcome, and anything that should stay the same.",
    reply: "Add your response, feedback, or clarification...",
  },
  buttons: {
    unlock: "Unlock portal",
    submit: "Queue task",
    submitBusy: "Queueing...",
    sync: "Sync",
    syncBusy: "Syncing...",
    preview: "Preview",
    previewBusy: "Starting preview...",
    discard: "Discard Changes",
    discardBusy: "Discarding...",
    deploy: "Deploy",
    deployBusy: "Deploying...",
    refresh: "Refresh",
    detailOpen: "View",
    detailHide: "Hide",
    archive: "Archive",
    cancelTask: "Cancel",
    replyDialogTitle: "Reply to Request",
    reply: "Reply",
    replyInMotion: "A reply is in motion",
    replyCancel: "Cancel",
    replySubmit: "Send Reply",
    replySubmitBusy: "Sending...",
  },
  messages: {
    noFilesSelected: "No files selected.",
    queueEmpty: "No work items yet. Add the first todo item above.",
    queueLoading: "Loading work board...",
    loadError: "Unable to load requests.",
    queueError: "Unable to queue request.",
    requestQueued: "Todo item queued. It is in motion.",
    requestQueuedToast: "New todo item added. You can keep adding while work moves.",
    followUpCreatedToast: "New todo item created from that suggestion.",
    passwordRequired: "Enter the password.",
    incorrectPassword: "Incorrect password.",
    blockedPublicText: "This item needs a bit of direction before it keeps moving.",
    failedPublicText: "This item hit a snag. Add a note and it can be reworked.",
    canceledPublicText: "This item was canceled.",
    replyEmptyError: "Please enter a message or attach files.",
    replyMissingRequest: "Missing request ID.",
    replyError: "Unable to send reply.",
    replySuccess: "Reply sent. A refreshed response and screenshot will land here when ready.",
    replyThreadWaiting: "You will see the latest reply here when it lands.",
    completedToast: "Another item moved to done. Review the screenshot and follow-up options when ready.",
    syncError: "Unable to sync from GitHub.",
    syncSuccessToast: "Preview server synced from GitHub.",
    previewError: "Unable to start preview.",
    previewReadyToast: "Preview is ready.",
    discardError: "Unable to discard local changes.",
    discardSuccessToast: "Local changes discarded.",
    deployError: "Unable to deploy.",
    deploySuccessToast: "Deploy pushed to GitHub.",
    followUpUnavailable: "That follow-up suggestion is no longer available.",
    followUpCreateError: "Unable to create follow-up todo.",
    requestArchiveError: "Unable to archive todo.",
    requestCancelError: "Unable to cancel todo.",
    requestArchivedToast: "Todo archived.",
    requestCanceledToast: "Todo canceled.",
  },
  hints: {
    followUp: "Click once to create the next todo item from this suggestion.",
  },
  sections: {
    details: "Task details",
    accomplished: "What you accomplished",
    screenshot: "Updated screenshot",
    references: "References",
    addTodo: "Add another todo item",
    replyThread: "Reply thread",
  },
  states: {
    completed: "Done",
    failed: "Needs review",
    blocked: "Needs input",
    canceled: "Canceled",
    running: "In motion",
    queued: "Queued",
  },
  priorityOptions: [
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
    { value: "low", label: "Low" },
  ],
  waitingMessages: [
    "It is in motion. You can add another item to the list while this moves.",
    "Good things are stacking up here. Add the next priority whenever it comes to mind.",
    "Steady progress is happening in the background. This is a good time to queue the next idea.",
    "Momentum is building on this request. Drop in another task or reference while you wait.",
    "This item has traction. If another improvement is ready, add it now and keep the list warm.",
  ],
  theme: {
    bg: "#f2ece2",
    paper: "rgba(255, 250, 242, 0.9)",
    paperStrong: "rgba(255, 252, 246, 0.96)",
    ink: "#1b1714",
    muted: "#6c6358",
    line: "rgba(52, 41, 28, 0.14)",
    lineStrong: "rgba(52, 41, 28, 0.22)",
    accent: "#d86a38",
    accentDark: "#a94822",
    ok: "#2c8b57",
    warn: "#b67817",
    fail: "#b44c3c",
    shadow: "0 20px 50px rgba(67, 44, 23, 0.12)",
    replyExternal: "#46845a",
    bgTopLeft: "rgba(216, 106, 56, 0.18)",
    bgRight: "rgba(70, 132, 90, 0.16)",
    bgStart: "#efe5d8",
    bgMid: "#f7f2ea",
    bgEnd: "#ece2d1",
  },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePortalConfig(base, override) {
  if (!isPlainObject(override)) {
    return Array.isArray(base) ? [...base] : { ...base };
  }

  const result = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = [...value];
      return;
    }
    if (isPlainObject(value) && isPlainObject(base?.[key])) {
      result[key] = mergePortalConfig(base[key], value);
      return;
    }
    result[key] = value;
  });
  return result;
}

const PORTAL_CONFIG = mergePortalConfig(DEFAULT_PORTAL_CONFIG, window.PORTAL_TEMPLATE_CONFIG || {});
const STORAGE_NAMESPACE = String(PORTAL_CONFIG.storageNamespace || "client-portal-template");
const PASSWORD_STORAGE_KEY = `${STORAGE_NAMESPACE}:password`;
const API_BASE_STORAGE_KEY = `${STORAGE_NAMESPACE}:api-base`;
const API_BASE = window.localStorage.getItem(API_BASE_STORAGE_KEY) || PORTAL_CONFIG.apiBase;
const REQUESTS_ENDPOINT = `${API_BASE}${PORTAL_CONFIG.requestsPath}`;
const REPLY_ENDPOINT = `${API_BASE}${PORTAL_CONFIG.repliesPath}`;
const WORKSPACE_ENDPOINT = PORTAL_CONFIG.workspacePath
  ? `${API_BASE}${PORTAL_CONFIG.workspacePath}`
  : REQUESTS_ENDPOINT;
const SITE_ACTIONS_ENDPOINT = PORTAL_CONFIG.siteActionsPath
  ? `${API_BASE}${PORTAL_CONFIG.siteActionsPath}`
  : "";

const authShell = document.querySelector("#authShell");
const authForm = document.querySelector("#authForm");
const passwordInput = document.querySelector("#passwordInput");
const authStatus = document.querySelector("#authStatus");
const requestForm = document.querySelector("#requestForm");
const titleInput = document.querySelector("#titleInput");
const detailsInput = document.querySelector("#detailsInput");
const priorityInput = document.querySelector("#priorityInput");
const imagesInput = document.querySelector("#imagesInput");
const selectedFiles = document.querySelector("#selectedFiles");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const queueList = document.querySelector("#queueList");
const syncButton = document.querySelector("#syncButton");
const previewButton = document.querySelector("#previewButton");
const discardButton = document.querySelector("#discardButton");
const deployButton = document.querySelector("#deployButton");
const refreshButton = document.querySelector("#refreshButton");
const apiBaseLabel = document.querySelector("#apiBaseLabel");
const toastStack = document.querySelector("#toastStack");
const requestModalShell = document.querySelector("#requestModalShell");
const requestModalTitle = document.querySelector("#requestModalTitle");
const requestModalMeta = document.querySelector("#requestModalMeta");
const requestModalBody = document.querySelector("#requestModalBody");
const requestModalCloseBtn = document.querySelector("#requestModalCloseBtn");

const replyDialogShell = document.querySelector("#replyDialogShell");
const replyDialogTitle = document.querySelector("#replyDialogTitle");
const replyDialogDetails = document.querySelector("#replyDialogDetails");
const replyForm = document.querySelector("#replyForm");
const replyRequestInput = document.querySelector("#replyRequestInput");
const replyTextArea = document.querySelector("#replyTextArea");
const replyFilesInput = document.querySelector("#replyFilesInput");
const replySelectedFiles = document.querySelector("#replySelectedFiles");
const replySubmitButton = document.querySelector("#replySubmitButton");
const replyFormStatus = document.querySelector("#replyFormStatus");
const replyCloseBtn = document.querySelector("#replyCloseBtn");
const replyCancelButton = document.querySelector("#replyCancelButton");

let pollTimer = null;
let helperMessageTimer = null;
let currentReplyRequestId = null;
let hasLoadedRequests = false;
let requestsFetchInFlight = false;
let lastRequestsSignature = "";
let helperMessageTick = 0;
let cachedRequests = [];
let cachedWorkspace = null;
let pendingRevealRequestId = "";
let activeRequestModalId = "";
let pendingModalOpenRequestId = "";
const flashedRequestIds = new Set();
const flashTimeouts = new Map();
const pendingAttentionRequestIds = new Set();
const suggestionCreatesInFlight = new Set();
const requestActionsInFlight = new Set();
const workspaceActionsInFlight = new Set();

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && typeof value === "string") {
    element.textContent = value;
  }
}

function setPlaceholder(selector, value) {
  const element = document.querySelector(selector);
  if (element && typeof value === "string") {
    element.placeholder = value;
  }
}

function applyTheme() {
  const root = document.documentElement;
  const theme = PORTAL_CONFIG.theme || {};
  const themeMapping = {
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

  Object.entries(themeMapping).forEach(([key, cssVar]) => {
    if (theme[key]) {
      root.style.setProperty(cssVar, String(theme[key]));
    }
  });
}

function renderPriorityOptions() {
  const options = Array.isArray(PORTAL_CONFIG.priorityOptions) && PORTAL_CONFIG.priorityOptions.length
    ? PORTAL_CONFIG.priorityOptions
    : DEFAULT_PORTAL_CONFIG.priorityOptions;

  priorityInput.innerHTML = options
    .map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
}

function applyPortalConfig() {
  document.title = PORTAL_CONFIG.portalTitle || DEFAULT_PORTAL_CONFIG.portalTitle;
  setText("#authEyebrow", PORTAL_CONFIG.authEyebrow);
  setText("#authTitle", PORTAL_CONFIG.authTitle);
  setText("#authCopy", PORTAL_CONFIG.authCopy);
  setText("#passwordLabel", PORTAL_CONFIG.labels.password);
  setText("#unlockButton", PORTAL_CONFIG.buttons.unlock);
  setText("#heroEyebrow", PORTAL_CONFIG.heroEyebrow);
  setText("#heroTitle", PORTAL_CONFIG.heroTitle);
  setText("#heroCopy", PORTAL_CONFIG.heroCopy);
  setText("#composerEyebrow", PORTAL_CONFIG.composerEyebrow);
  setText("#composerTitle", PORTAL_CONFIG.composerTitle);
  setText("#boardEyebrow", PORTAL_CONFIG.boardEyebrow);
  setText("#boardTitle", PORTAL_CONFIG.boardTitle);
  setText("#titleLabel", PORTAL_CONFIG.labels.title);
  setText("#detailsLabel", PORTAL_CONFIG.labels.details);
  setText("#priorityLabel", PORTAL_CONFIG.labels.priority);
  setText("#filesLabel", PORTAL_CONFIG.labels.files);
  setText("#submitButton", PORTAL_CONFIG.buttons.submit);
  setText("#syncButton", PORTAL_CONFIG.buttons.sync);
  setText("#previewButton", PORTAL_CONFIG.buttons.preview);
  setText("#discardButton", PORTAL_CONFIG.buttons.discard);
  setText("#deployButton", PORTAL_CONFIG.buttons.deploy);
  setText("#refreshButton", PORTAL_CONFIG.buttons.refresh);
  setText("#replyDialogHeading", PORTAL_CONFIG.buttons.replyDialogTitle);
  setText("#replyInputLabel", PORTAL_CONFIG.labels.reply);
  setText("#replyAttachLabel", PORTAL_CONFIG.buttons.replyAttach || "Attach files (optional)");
  setText("#replyCancelButton", PORTAL_CONFIG.buttons.replyCancel);
  setText("#replySubmitButton", PORTAL_CONFIG.buttons.replySubmit);
  setPlaceholder("#titleInput", PORTAL_CONFIG.placeholders.title);
  setPlaceholder("#detailsInput", PORTAL_CONFIG.placeholders.details);
  setPlaceholder("#replyTextArea", PORTAL_CONFIG.placeholders.reply);
  renderPriorityOptions();
  applyTheme();
  apiBaseLabel.textContent = PORTAL_CONFIG.showApiBaseLabel ? API_BASE.replace(/^https?:\/\//, "") : "";
  apiBaseLabel.classList.toggle("hidden", !PORTAL_CONFIG.showApiBaseLabel);
}

function getPortalPassword() {
  return window.sessionStorage.getItem(PASSWORD_STORAGE_KEY)
    || window.localStorage.getItem(PASSWORD_STORAGE_KEY)
    || "";
}

function setPortalPassword(value) {
  if (value) {
    window.sessionStorage.setItem(PASSWORD_STORAGE_KEY, value);
    window.localStorage.setItem(PASSWORD_STORAGE_KEY, value);
  } else {
    window.sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
    window.localStorage.removeItem(PASSWORD_STORAGE_KEY);
  }
}

function authHeaders() {
  const password = getPortalPassword();
  return password ? { "X-Portal-Password": password } : {};
}

function setLockedState(locked) {
  authShell.classList.toggle("hidden", !locked);
}

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function clampText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function toTitleCase(value) {
  const text = String(value || "").replace(/[-_]+/g, " ").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function hashString(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getRequestId(request) {
  return String(request?.request_id || request?.id || "");
}

function getDomSafeId(value) {
  const slug = slugify(value);
  return slug || `item-${hashString(value)}`;
}

function isRequestCompleted(request) {
  return Boolean(request && (request.done || String(request.status || "").toLowerCase() === "completed"));
}

function normalizeRequestState(request) {
  if (isRequestCompleted(request)) return "completed";
  const status = String(request?.status || "").toLowerCase();
  if (status.includes("cancel")) return "canceled";
  if (status.includes("fail")) return "failed";
  if (status.includes("block") || status.includes("hold") || status.includes("input")) return "blocked";
  if (!status || status === "queued" || status === "pending" || status === "todo") return "queued";
  return "running";
}

function getStatusLabel(state) {
  return PORTAL_CONFIG.states[state] || toTitleCase(state);
}

function getPublicWaitingMessage(request) {
  const waitingMessages = Array.isArray(PORTAL_CONFIG.waitingMessages) && PORTAL_CONFIG.waitingMessages.length
    ? PORTAL_CONFIG.waitingMessages
    : DEFAULT_PORTAL_CONFIG.waitingMessages;
  const id = getRequestId(request) || request?.title || "portal";
  const index = (hashString(id) + helperMessageTick) % waitingMessages.length;
  return waitingMessages[index];
}

function getCompletionSummary(request) {
  if (!isRequestCompleted(request)) return "";
  const explicitSummary = clampText(request?.completion_summary, 220);
  if (explicitSummary) return explicitSummary;

  const latestMessage = clampText(request?.latest_message, 220);
  if (latestMessage) return latestMessage;

  const publicStatus = clampText(request?.public_status_text, 220);
  if (publicStatus) return publicStatus;

  if (request?.completion_screenshot?.url) {
    return "The requested update is complete and a fresh screenshot is ready to review.";
  }

  return "The requested update is complete and ready for review.";
}

function getPublicStatusLine(request) {
  const state = normalizeRequestState(request);
  if (state === "completed") {
    return getCompletionSummary(request);
  }
  if (state === "canceled") {
    return clampText(request?.public_status_text, 160) || PORTAL_CONFIG.messages.canceledPublicText;
  }
  if (state === "blocked") {
    return clampText(request?.public_status_text, 160) || PORTAL_CONFIG.messages.blockedPublicText;
  }
  if (state === "failed") {
    return clampText(request?.public_status_text, 160) || PORTAL_CONFIG.messages.failedPublicText;
  }
  return getPublicWaitingMessage(request);
}

function getRequestActionKey(requestId, action) {
  return `${requestId}:${action}`;
}

function getWorkspaceActionKey(action) {
  return String(action || "").toLowerCase().trim();
}

function getRequestActionEndpoint(requestId) {
  return `${REQUESTS_ENDPOINT}/${encodeURIComponent(requestId)}/actions`;
}

function getAvailableRequestActions(request) {
  const provided = Array.isArray(request?.available_actions) ? request.available_actions : null;
  if (provided) {
    return provided.map(value => String(value || "").toLowerCase()).filter(Boolean);
  }
  const state = normalizeRequestState(request);
  if (state === "completed" || state === "failed" || state === "canceled" || state === "blocked") {
    return ["archive"];
  }
  if (state === "queued" || state === "running") {
    return ["cancel"];
  }
  return [];
}

function getPriorityLabel(priority) {
  const value = String(priority || "normal").toLowerCase();
  const configured = (PORTAL_CONFIG.priorityOptions || []).find(option => option.value === value);
  return configured?.label || toTitleCase(value);
}

function updateSelectedFiles() {
  const files = Array.from(imagesInput.files || []);
  selectedFiles.textContent = files.length
    ? files.map(file => `${file.name} (${Math.round(file.size / 1024)} KB)`).join(" • ")
    : PORTAL_CONFIG.messages.noFilesSelected;
}

function updateReplySelectedFiles() {
  const files = Array.from(replyFilesInput.files || []);
  replySelectedFiles.textContent = files.length
    ? files.map(file => `${file.name} (${Math.round(file.size / 1024)} KB)`).join(" • ")
    : PORTAL_CONFIG.messages.noFilesSelected;
}

function supportsWorkspaceActions() {
  return Boolean(SITE_ACTIONS_ENDPOINT);
}

function getWorkspaceAvailableActions() {
  if (!supportsWorkspaceActions()) return [];
  const provided = Array.isArray(cachedWorkspace?.available_actions)
    ? cachedWorkspace.available_actions
    : [];
  const normalized = provided
    .map(value => String(value || "").toLowerCase().trim())
    .filter(Boolean);
  if (normalized.length) {
    return normalized;
  }
  return ["preview"];
}

function syncWorkspace(workspace) {
  cachedWorkspace = isPlainObject(workspace) ? { ...workspace } : null;
  renderWorkspaceActions();
}

function renderWorkspaceActions() {
  const supported = supportsWorkspaceActions();
  syncButton.classList.toggle("hidden", !supported);
  previewButton.classList.toggle("hidden", !supported);
  discardButton.classList.toggle("hidden", !supported);
  deployButton.classList.toggle("hidden", !supported);
  if (!supported) {
    syncButton.disabled = true;
    previewButton.disabled = true;
    discardButton.disabled = true;
    deployButton.disabled = true;
    return;
  }

  const actions = new Set(getWorkspaceAvailableActions());
  const syncBusy = workspaceActionsInFlight.has("sync");
  const previewBusy = workspaceActionsInFlight.has("preview");
  const discardBusy = workspaceActionsInFlight.has("discard");
  const deployBusy = workspaceActionsInFlight.has("deploy");

  syncButton.disabled = syncBusy || !actions.has("sync");
  syncButton.textContent = syncBusy
    ? PORTAL_CONFIG.buttons.syncBusy
    : PORTAL_CONFIG.buttons.sync;
  previewButton.disabled = previewBusy || !actions.has("preview");
  previewButton.textContent = previewBusy
    ? PORTAL_CONFIG.buttons.previewBusy
    : PORTAL_CONFIG.buttons.preview;
  discardButton.disabled = discardBusy || !Boolean(cachedWorkspace?.dirty) || !actions.has("discard");
  discardButton.textContent = discardBusy
    ? PORTAL_CONFIG.buttons.discardBusy
    : PORTAL_CONFIG.buttons.discard;

  deployButton.disabled = deployBusy || !Boolean(cachedWorkspace?.dirty) || !actions.has("deploy");
  deployButton.textContent = deployBusy
    ? PORTAL_CONFIG.buttons.deployBusy
    : PORTAL_CONFIG.buttons.deploy;
}

function showToast(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast tone-${tone}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("toast-exit");
    window.setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function renderEmpty(message) {
  queueList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function normalizeReplyAuthor(author) {
  const value = String(author || "").toLowerCase();
  if (value === "user") return "user";
  if (["codex", "agent", "assistant"].includes(value)) return "codex";
  return "external";
}

function getReplyAuthorLabel(author) {
  const normalized = normalizeReplyAuthor(author);
  if (normalized === "user") return PORTAL_CONFIG.userLabel;
  if (normalized === "codex") return PORTAL_CONFIG.agentLabel;
  return toTitleCase(author) || PORTAL_CONFIG.externalReplyAuthorLabel;
}

function renderReplies(replies) {
  if (!Array.isArray(replies) || !replies.length) {
    return `<div class="empty-replies">No replies yet.</div>`;
  }

  return replies
    .map(reply => {
      const authorClass = `reply-author-${normalizeReplyAuthor(reply.author || "user")}`;
      const displayAuthor = getReplyAuthorLabel(reply.author || "user");
      const initial = displayAuthor.charAt(0).toUpperCase();
      const attachments = Array.isArray(reply.attachments) ? reply.attachments : [];

      return `
        <div class="reply-item ${authorClass}">
          <div class="reply-meta">
            <span class="reply-avatar">${initial}</span>
            <span>${escapeHtml(displayAuthor)}</span>
            <span>•</span>
            <span>${escapeHtml(formatDate(reply.created_at))}</span>
          </div>
          ${reply.text ? `<p class="reply-text">${escapeHtml(reply.text)}</p>` : ""}
          ${attachments.length ? `
            <div class="reply-attachments">
              ${attachments.map(attachment => `
                <a class="reply-attachment" href="${API_BASE}${escapeHtml(attachment.url || "")}" target="_blank" rel="noreferrer">
                  ${escapeHtml(attachment.original_name || "attachment")}
                </a>
              `).join("")}
            </div>
          ` : ""}
        </div>
      `;
    })
    .join("");
}

function renderAttachments(attachments) {
  if (!attachments.length) return "";
  return `
    <div class="detail-block">
      <div class="section-label">${escapeHtml(PORTAL_CONFIG.sections.references)}</div>
      <div class="attachments">
        ${attachments.map(attachment => `
          <a class="attachment ${attachment.is_screenshot ? "screenshot" : ""}" href="${API_BASE}${escapeHtml(attachment.url || "")}" target="_blank" rel="noreferrer">
            ${attachment.is_screenshot ? "Screenshot" : "File"} · ${escapeHtml(attachment.original_name || "attachment")}
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

function renderFollowUpSuggestions(request) {
  const requestId = getRequestId(request);
  const suggestions = Array.isArray(request.follow_up_suggestions) ? request.follow_up_suggestions : [];
  if (!isRequestCompleted(request) || !suggestions.length) {
    return "";
  }

  return `
    <div class="detail-block">
      <div class="section-label">${escapeHtml(PORTAL_CONFIG.sections.addTodo)}</div>
      <div class="suggestion-list">
        ${suggestions.map((suggestion, index) => {
          const suggestionKey = `${requestId}:${suggestion.suggestion_id || index}`;
          const isSubmitting = suggestionCreatesInFlight.has(suggestionKey);
          return `
            <button
              class="follow-up-btn"
              type="button"
              data-request-id="${escapeHtml(requestId)}"
              data-suggestion-index="${index}"
              ${isSubmitting ? "disabled" : ""}
            >
              ${escapeHtml(suggestion.label || suggestion.title || `Add follow-up ${index + 1}`)}
            </button>
          `;
        }).join("")}
      </div>
      <p class="input-hint">${escapeHtml(PORTAL_CONFIG.hints.followUp)}</p>
    </div>
  `;
}

function renderCardActionButtons(request) {
  const requestId = getRequestId(request);
  const actions = getAvailableRequestActions(request);
  if (!requestId || !actions.length) {
    return "";
  }

  return actions.map(action => {
    const actionKey = getRequestActionKey(requestId, action);
    const busy = requestActionsInFlight.has(actionKey);
    const isArchive = action === "archive";
    return `
      <button
        class="secondary request-action-btn ${isArchive ? "archive-btn" : "cancel-btn"}"
        type="button"
        data-request-id="${escapeHtml(requestId)}"
        data-request-action="${escapeHtml(action)}"
        ${busy ? "disabled" : ""}
      >
        ${escapeHtml(isArchive ? PORTAL_CONFIG.buttons.archive : PORTAL_CONFIG.buttons.cancelTask)}
      </button>
    `;
  }).join("");
}

function getRequestById(requestId) {
  return cachedRequests.find(request => getRequestId(request) === requestId) || null;
}

function renderRequestDetailContent(request) {
  const requestId = getRequestId(request);
  const state = normalizeRequestState(request);
  const isCompleted = state === "completed";
  const canReply = isCompleted || Boolean(request.has_unprocessed_replies);
  const replies = Array.isArray(request.replies) ? request.replies : [];
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
  const completionScreenshot = request.completion_screenshot || null;

  return `
    ${request.details ? `
      <div class="detail-block">
        <div class="section-label">${escapeHtml(PORTAL_CONFIG.sections.details)}</div>
        <p class="request-note">${escapeHtml(request.details)}</p>
      </div>
    ` : ""}

    ${isCompleted ? `
      <div class="detail-block completion-block">
        <div class="section-label">${escapeHtml(PORTAL_CONFIG.sections.accomplished)}</div>
        <p class="completion-summary">${escapeHtml(getCompletionSummary(request))}</p>
      </div>
    ` : ""}

    ${completionScreenshot?.url ? `
      <div class="detail-block">
        <div class="section-label">${escapeHtml(PORTAL_CONFIG.sections.screenshot)}</div>
        <a class="completion-screenshot-link" href="${API_BASE}${escapeHtml(completionScreenshot.url)}" target="_blank" rel="noreferrer">
          <img
            class="completion-screenshot-image"
            src="${API_BASE}${escapeHtml(completionScreenshot.url)}"
            alt="Updated work screenshot for ${escapeHtml(request.title || "completed request")}"
            loading="lazy"
          />
        </a>
      </div>
    ` : ""}

    ${renderAttachments(attachments)}
    ${renderFollowUpSuggestions(request)}

    ${(canReply || replies.length || getAvailableRequestActions(request).length) ? `
      <div class="detail-block">
        <div class="request-actions">
          ${renderCardActionButtons(request)}
          ${canReply ? `
            <button
              class="reply-btn"
              data-request-id="${escapeHtml(requestId)}"
              data-request-title="${escapeHtml(request.title || "")}"
              data-request-details="${escapeHtml(request.details || "")}"
            >
              ${escapeHtml(request.has_unprocessed_replies ? PORTAL_CONFIG.buttons.replyInMotion : PORTAL_CONFIG.buttons.reply)}
            </button>
          ` : ""}
        </div>

        ${replies.length ? `
          <div class="reply-thread">
            <div class="reply-header ${request.has_unprocessed_replies ? "agent-processing" : ""}">
              ${escapeHtml(PORTAL_CONFIG.sections.replyThread)}${request.has_unprocessed_replies ? " • A response is in motion" : ""}
            </div>
            ${renderReplies(replies)}
          </div>
        ` : request.has_unprocessed_replies ? `
          <div class="reply-thread">
            <div class="reply-header agent-processing">${escapeHtml(PORTAL_CONFIG.sections.replyThread)} • A response is in motion</div>
            <div class="empty-replies">${escapeHtml(PORTAL_CONFIG.messages.replyThreadWaiting)}</div>
          </div>
        ` : ""}
      </div>
    ` : ""}

    <p class="mono request-footer">
      Created ${escapeHtml(formatDate(request.created_at))}
      ${request.completed_at ? ` • Completed ${escapeHtml(formatDate(request.completed_at))}` : ""}
    </p>
  `;
}

function buildRequestCard(request) {
  const requestId = getRequestId(request);
  const state = normalizeRequestState(request);
  const isCompleted = state === "completed";
  const flashClass = flashedRequestIds.has(requestId) ? "flash" : "";

  return `
    <article class="request-card state-${state} ${flashClass}" data-request-id="${escapeHtml(requestId)}">
      <div class="request-summary">
        <div class="request-summary-main">
          <div class="summary-title-row">
            <span class="checkbox ${isCompleted ? "done" : ""}">${isCompleted ? "✓" : ""}</span>
            <div class="summary-copy">
              <h3 class="request-title">${escapeHtml(request.title || "Untitled request")}</h3>
              <p class="request-public-line">${escapeHtml(getPublicStatusLine(request))}</p>
            </div>
          </div>
        </div>
        <div class="request-summary-side">
          <div class="request-meta">
            <span class="pill status-${state}">${escapeHtml(getStatusLabel(state))}</span>
            <span class="pill priority-${escapeHtml(String(request.priority || "normal").toLowerCase())}">${escapeHtml(getPriorityLabel(request.priority))}</span>
          </div>
          <div class="summary-buttons">
            <button
              class="secondary card-toggle"
              type="button"
              data-request-id="${escapeHtml(requestId)}"
              aria-haspopup="dialog"
            >
              ${escapeHtml(PORTAL_CONFIG.buttons.detailOpen)}
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function focusPendingCard() {
  if (!pendingRevealRequestId) return;
  const targetId = pendingRevealRequestId;
  pendingRevealRequestId = "";

  window.requestAnimationFrame(() => {
    const targetCard = Array.from(queueList.querySelectorAll(".request-card"))
      .find(card => card.dataset.requestId === targetId);
    if (targetCard) {
      targetCard.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
}

function attachRequestModalEventHandlers() {
  requestModalBody.querySelectorAll(".reply-btn").forEach(button => {
    button.addEventListener("click", openReplyDialog);
  });

  requestModalBody.querySelectorAll(".follow-up-btn").forEach(button => {
    button.addEventListener("click", createFollowUpTodo);
  });

  requestModalBody.querySelectorAll(".request-action-btn").forEach(button => {
    button.addEventListener("click", handleRequestAction);
  });
}

function renderRequestModal(request) {
  const state = normalizeRequestState(request);
  requestModalTitle.textContent = request.title || "Request details";
  requestModalMeta.innerHTML = `
    <span class="pill status-${state}">${escapeHtml(getStatusLabel(state))}</span>
    <span class="pill priority-${escapeHtml(String(request.priority || "normal").toLowerCase())}">${escapeHtml(getPriorityLabel(request.priority))}</span>
  `;
  requestModalBody.innerHTML = renderRequestDetailContent(request);
  attachRequestModalEventHandlers();
}

function syncRequestModal() {
  if (!activeRequestModalId) return;
  const request = getRequestById(activeRequestModalId);
  if (!request) {
    closeRequestModal();
    return;
  }
  renderRequestModal(request);
}

function openRequestModal(eventOrRequestId) {
  const requestId = typeof eventOrRequestId === "string"
    ? eventOrRequestId
    : String(eventOrRequestId?.currentTarget?.dataset?.requestId || "");
  if (!requestId) return;

  const request = getRequestById(requestId);
  if (!request) return;

  activeRequestModalId = requestId;
  renderRequestModal(request);
  requestModalShell.classList.remove("hidden");
}

function closeRequestModal() {
  requestModalShell.classList.add("hidden");
  activeRequestModalId = "";
  requestModalTitle.textContent = "Request details";
  requestModalMeta.innerHTML = "";
  requestModalBody.innerHTML = "";
}

function attachQueueEventHandlers() {
  document.querySelectorAll(".card-toggle").forEach(button => {
    button.addEventListener("click", openRequestModal);
  });

  document.querySelectorAll(".follow-up-btn").forEach(button => {
    button.addEventListener("click", createFollowUpTodo);
  });

  document.querySelectorAll(".request-action-btn").forEach(button => {
    button.addEventListener("click", handleRequestAction);
  });
}

function renderRequests(requests) {
  if (!Array.isArray(requests) || !requests.length) {
    renderEmpty(PORTAL_CONFIG.messages.queueEmpty);
    syncRequestModal();
    return;
  }

  queueList.innerHTML = requests.map(buildRequestCard).join("");
  attachQueueEventHandlers();
  syncRequestModal();
  if (pendingModalOpenRequestId) {
    const requestId = pendingModalOpenRequestId;
    pendingModalOpenRequestId = "";
    openRequestModal(requestId);
  }
  focusPendingCard();
}

function clearFlashLater(requestId) {
  if (!requestId) return;
  flashedRequestIds.add(requestId);
  const existingTimeout = flashTimeouts.get(requestId);
  if (existingTimeout) {
    window.clearTimeout(existingTimeout);
  }
  const timeoutId = window.setTimeout(() => {
    flashedRequestIds.delete(requestId);
    flashTimeouts.delete(requestId);
    if (cachedRequests.some(request => getRequestId(request) === requestId)) {
      renderRequests(cachedRequests);
    }
  }, 3200);
  flashTimeouts.set(requestId, timeoutId);
}

function handleRequestTransitions(nextRequests) {
  const previousById = new Map(cachedRequests.map(request => [getRequestId(request), request]));

  nextRequests.forEach(request => {
    const requestId = getRequestId(request);
    if (!requestId) return;

    if (pendingAttentionRequestIds.has(requestId)) {
      pendingAttentionRequestIds.delete(requestId);
      pendingRevealRequestId = requestId;
      clearFlashLater(requestId);
    }

    if (!hasLoadedRequests) return;

    const previous = previousById.get(requestId);
    if (!isRequestCompleted(previous) && isRequestCompleted(request)) {
      activeRequestModalId = requestId;
      pendingModalOpenRequestId = requestId;
      pendingRevealRequestId = requestId;
      clearFlashLater(requestId);
      showToast(PORTAL_CONFIG.messages.completedToast, "success");
    }
  });
}

async function fetchRequests() {
  if (requestsFetchInFlight) {
    return;
  }
  requestsFetchInFlight = true;
  if (!hasLoadedRequests) {
    renderEmpty(PORTAL_CONFIG.messages.queueLoading);
  }

  try {
    const response = await fetch(REQUESTS_ENDPOINT, {
      cache: "no-store",
      headers: authHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setPortalPassword("");
        setLockedState(true);
        throw new Error(PORTAL_CONFIG.messages.passwordRequired);
      }
      throw new Error(payload.error || PORTAL_CONFIG.messages.loadError);
    }

    setLockedState(false);
    const requests = Array.isArray(payload.requests) ? payload.requests : [];
    syncWorkspace(payload.workspace);
    const signature = JSON.stringify(requests);

    handleRequestTransitions(requests);
    cachedRequests = requests;

    if (!hasLoadedRequests || signature !== lastRequestsSignature) {
      renderRequests(requests);
      lastRequestsSignature = signature;
    }

    hasLoadedRequests = true;
  } catch (error) {
    if (!hasLoadedRequests) {
      renderEmpty(error.message || PORTAL_CONFIG.messages.loadError);
    }
  } finally {
    requestsFetchInFlight = false;
  }
}

async function fetchWorkspace() {
  if (!supportsWorkspaceActions() || WORKSPACE_ENDPOINT === REQUESTS_ENDPOINT) {
    return;
  }

  const response = await fetch(WORKSPACE_ENDPOINT, {
    cache: "no-store",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      setPortalPassword("");
      setLockedState(true);
      throw new Error(PORTAL_CONFIG.messages.passwordRequired);
    }
    throw new Error(payload.error || PORTAL_CONFIG.messages.loadError);
  }

  syncWorkspace(payload.workspace);
}

async function submitRequest(event) {
  event.preventDefault();
  formStatus.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = PORTAL_CONFIG.buttons.submitBusy;

  try {
    const formData = new FormData();
    formData.set("title", titleInput.value.trim());
    formData.set("details", detailsInput.value.trim());
    formData.set("priority", priorityInput.value);

    Array.from(imagesInput.files || []).forEach(file => {
      formData.append("images", file);
    });

    const response = await fetch(REQUESTS_ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        setPortalPassword("");
        setLockedState(true);
        throw new Error(PORTAL_CONFIG.messages.passwordRequired);
      }
      throw new Error(payload.error || PORTAL_CONFIG.messages.queueError);
    }

    const createdRequestId = String(payload.request?.request_id || payload.request_id || "");
    if (createdRequestId) {
      pendingAttentionRequestIds.add(createdRequestId);
    }

    requestForm.reset();
    renderPriorityOptions();
    updateSelectedFiles();
    formStatus.textContent = PORTAL_CONFIG.messages.requestQueued;
    showToast(PORTAL_CONFIG.messages.requestQueuedToast, "success");
    await fetchRequests();
  } catch (error) {
    formStatus.textContent = error.message || PORTAL_CONFIG.messages.queueError;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = PORTAL_CONFIG.buttons.submit;
  }
}

function openReplyDialog(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const requestId = button.dataset.requestId;
  const requestTitle = button.dataset.requestTitle;
  const requestDetails = button.dataset.requestDetails;

  if (!requestId) return;

  closeRequestModal();
  currentReplyRequestId = requestId;
  replyRequestInput.value = requestId;
  replyDialogTitle.textContent = requestTitle;
  replyDialogDetails.textContent = requestDetails;
  replyTextArea.value = "";
  replyFilesInput.value = "";
  updateReplySelectedFiles();
  replyFormStatus.textContent = "";
  replyFormStatus.className = "reply-form-status";
  replyDialogShell.classList.remove("hidden");
}

function closeReplyDialog() {
  replyDialogShell.classList.add("hidden");
  currentReplyRequestId = null;
  replyRequestInput.value = "";
  replyTextArea.value = "";
  replyFilesInput.value = "";
  updateReplySelectedFiles();
  replyFormStatus.textContent = "";
  replyFormStatus.className = "reply-form-status";
}

async function submitReply(event) {
  event.preventDefault();

  const text = replyTextArea.value.trim();
  if (!text && replyFilesInput.files.length === 0) {
    replyFormStatus.textContent = PORTAL_CONFIG.messages.replyEmptyError;
    replyFormStatus.className = "reply-form-status error";
    return;
  }

  if (!currentReplyRequestId) {
    replyFormStatus.textContent = PORTAL_CONFIG.messages.replyMissingRequest;
    replyFormStatus.className = "reply-form-status error";
    return;
  }

  replyFormStatus.textContent = PORTAL_CONFIG.buttons.replySubmitBusy;
  replyFormStatus.className = "reply-form-status";
  replySubmitButton.disabled = true;
  replySubmitButton.textContent = PORTAL_CONFIG.buttons.replySubmitBusy;

  try {
    const formData = new FormData();
    formData.set("request_id", currentReplyRequestId);
    formData.set("text", text);
    formData.set("author", "user");
    Array.from(replyFilesInput.files || []).forEach(file => {
      formData.append("files", file);
    });

    const response = await fetch(REPLY_ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setPortalPassword("");
        setLockedState(true);
        closeReplyDialog();
        throw new Error(PORTAL_CONFIG.messages.passwordRequired);
      }
      throw new Error(payload.error || PORTAL_CONFIG.messages.replyError);
    }

    replyFormStatus.textContent = PORTAL_CONFIG.messages.replySuccess;
    replyFormStatus.className = "reply-form-status success";

    window.setTimeout(() => {
      closeReplyDialog();
      void fetchRequests();
    }, 1500);
  } catch (error) {
    replyFormStatus.textContent = error.message || PORTAL_CONFIG.messages.replyError;
    replyFormStatus.className = "reply-form-status error";
  } finally {
    replySubmitButton.disabled = false;
    replySubmitButton.textContent = PORTAL_CONFIG.buttons.replySubmit;
  }
}

function getSuggestionKey(requestId, suggestionIdOrIndex) {
  return `${requestId}:${suggestionIdOrIndex}`;
}

async function createFollowUpTodo(event) {
  const button = event.currentTarget;
  const requestId = button.dataset.requestId;
  const suggestionIndex = Number(button.dataset.suggestionIndex);
  const request = cachedRequests.find(item => getRequestId(item) === requestId);
  const suggestions = Array.isArray(request?.follow_up_suggestions) ? request.follow_up_suggestions : [];
  const suggestion = suggestions[suggestionIndex];

  if (!request || !suggestion) {
    showToast(PORTAL_CONFIG.messages.followUpUnavailable, "warn");
    return;
  }

  const suggestionKey = getSuggestionKey(requestId, suggestion.suggestion_id || suggestionIndex);
  if (suggestionCreatesInFlight.has(suggestionKey)) {
    return;
  }

  suggestionCreatesInFlight.add(suggestionKey);
  renderRequests(cachedRequests);

  try {
    const formData = new FormData();
    formData.set("title", String(suggestion.title || suggestion.label || `Follow-up for ${request.title}`));
    formData.set("details", String(suggestion.details || `Follow-up to ${request.title}`));
    formData.set("priority", String(suggestion.priority || request.priority || "normal"));
    formData.set("source_request_id", requestId);
    if (suggestion.suggestion_id) {
      formData.set("source_suggestion_id", String(suggestion.suggestion_id));
    }

    const response = await fetch(REQUESTS_ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setPortalPassword("");
        setLockedState(true);
        throw new Error(PORTAL_CONFIG.messages.passwordRequired);
      }
      throw new Error(payload.error || PORTAL_CONFIG.messages.followUpCreateError);
    }

    const createdRequestId = String(payload.request?.request_id || payload.request_id || "");
    if (createdRequestId) {
      pendingAttentionRequestIds.add(createdRequestId);
    }

    showToast(PORTAL_CONFIG.messages.followUpCreatedToast, "success");
    await fetchRequests();
  } catch (error) {
    showToast(error.message || PORTAL_CONFIG.messages.followUpCreateError, "warn");
  } finally {
    suggestionCreatesInFlight.delete(suggestionKey);
    renderRequests(cachedRequests);
  }
}

async function handleRequestAction(event) {
  const button = event.currentTarget;
  const requestId = String(button.dataset.requestId || "");
  const action = String(button.dataset.requestAction || "").toLowerCase();
  if (!requestId || !["archive", "cancel"].includes(action)) {
    return;
  }

  const actionKey = getRequestActionKey(requestId, action);
  if (requestActionsInFlight.has(actionKey)) {
    return;
  }

  requestActionsInFlight.add(actionKey);
  renderRequests(cachedRequests);

  try {
    const response = await fetch(getRequestActionEndpoint(requestId), {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setPortalPassword("");
        setLockedState(true);
        throw new Error(PORTAL_CONFIG.messages.passwordRequired);
      }
      throw new Error(
        payload.error
          || (action === "archive" ? PORTAL_CONFIG.messages.requestArchiveError : PORTAL_CONFIG.messages.requestCancelError)
      );
    }

    showToast(
      action === "archive" ? PORTAL_CONFIG.messages.requestArchivedToast : PORTAL_CONFIG.messages.requestCanceledToast,
      action === "archive" ? "info" : "warn"
    );
    await fetchRequests();
  } catch (error) {
    showToast(
      error.message || (action === "archive" ? PORTAL_CONFIG.messages.requestArchiveError : PORTAL_CONFIG.messages.requestCancelError),
      "warn"
    );
  } finally {
    requestActionsInFlight.delete(actionKey);
    renderRequests(cachedRequests);
  }
}

async function handleWorkspaceAction(event) {
  const action = getWorkspaceActionKey(event.currentTarget?.dataset?.workspaceAction);
  if (!supportsWorkspaceActions() || !["sync", "preview", "discard", "deploy"].includes(action)) {
    return;
  }
  if (workspaceActionsInFlight.has(action)) {
    return;
  }

  workspaceActionsInFlight.add(action);
  renderWorkspaceActions();

  try {
    const response = await fetch(SITE_ACTIONS_ENDPOINT, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setPortalPassword("");
        setLockedState(true);
        throw new Error(PORTAL_CONFIG.messages.passwordRequired);
      }
      throw new Error(
        payload.error
          || (action === "sync"
            ? PORTAL_CONFIG.messages.syncError
            : action === "preview"
              ? PORTAL_CONFIG.messages.previewError
              : action === "discard"
                ? PORTAL_CONFIG.messages.discardError
              : PORTAL_CONFIG.messages.deployError)
      );
    }

    syncWorkspace(payload.workspace);

    if (action === "sync") {
      showToast(PORTAL_CONFIG.messages.syncSuccessToast, "success");
    } else if (action === "preview") {
      const previewUrl = String(payload.workspace?.preview?.url || cachedWorkspace?.preview?.url || "").trim();
      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      }
      showToast(PORTAL_CONFIG.messages.previewReadyToast, "success");
    } else if (action === "discard") {
      showToast(PORTAL_CONFIG.messages.discardSuccessToast, "success");
    } else {
      showToast(PORTAL_CONFIG.messages.deploySuccessToast, "success");
    }

    await fetchRequests();
    if (WORKSPACE_ENDPOINT !== REQUESTS_ENDPOINT) {
      await fetchWorkspace();
    }
  } catch (error) {
    showToast(
      error.message
        || (action === "sync"
          ? PORTAL_CONFIG.messages.syncError
          : action === "preview"
            ? PORTAL_CONFIG.messages.previewError
            : action === "discard"
              ? PORTAL_CONFIG.messages.discardError
            : PORTAL_CONFIG.messages.deployError),
      "warn"
    );
  } finally {
    workspaceActionsInFlight.delete(action);
    renderWorkspaceActions();
  }
}

function startPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
  }
  pollTimer = window.setInterval(() => {
    if (
      document.visibilityState === "hidden"
      || !replyDialogShell.classList.contains("hidden")
      || !requestModalShell.classList.contains("hidden")
    ) {
      return;
    }
    void fetchRequests();
  }, 12000);
}

function startHelperMessageRotation() {
  if (helperMessageTimer) {
    window.clearInterval(helperMessageTimer);
  }
  helperMessageTimer = window.setInterval(() => {
    helperMessageTick += 1;
    if (cachedRequests.length) {
      renderRequests(cachedRequests);
    }
  }, 9000);
}

async function unlockPortal(event) {
  event.preventDefault();
  const password = passwordInput.value.trim();
  authStatus.textContent = "";

  if (!password) {
    authStatus.textContent = PORTAL_CONFIG.messages.passwordRequired;
    return;
  }

  setPortalPassword(password);
  await fetchRequests();

  if (getPortalPassword()) {
    passwordInput.value = "";
  } else {
    authStatus.textContent = PORTAL_CONFIG.messages.incorrectPassword;
  }
}

imagesInput.addEventListener("change", updateSelectedFiles);
replyFilesInput.addEventListener("change", updateReplySelectedFiles);
requestForm.addEventListener("submit", submitRequest);
replyForm.addEventListener("submit", submitReply);
syncButton.dataset.workspaceAction = "sync";
previewButton.dataset.workspaceAction = "preview";
discardButton.dataset.workspaceAction = "discard";
deployButton.dataset.workspaceAction = "deploy";
syncButton.addEventListener("click", handleWorkspaceAction);
previewButton.addEventListener("click", handleWorkspaceAction);
discardButton.addEventListener("click", handleWorkspaceAction);
deployButton.addEventListener("click", handleWorkspaceAction);
refreshButton.addEventListener("click", () => {
  void fetchRequests();
  if (WORKSPACE_ENDPOINT !== REQUESTS_ENDPOINT) {
    void fetchWorkspace();
  }
});
authForm.addEventListener("submit", unlockPortal);
replyCloseBtn.addEventListener("click", closeReplyDialog);
replyCancelButton.addEventListener("click", closeReplyDialog);
requestModalCloseBtn.addEventListener("click", closeRequestModal);

replyDialogShell.addEventListener("click", event => {
  if (event.target === replyDialogShell) {
    closeReplyDialog();
  }
});

requestModalShell.addEventListener("click", event => {
  if (event.target === requestModalShell) {
    closeRequestModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!replyDialogShell.classList.contains("hidden")) {
    closeReplyDialog();
    return;
  }
  if (!requestModalShell.classList.contains("hidden")) {
    closeRequestModal();
  }
});

applyPortalConfig();
renderPriorityOptions();
updateSelectedFiles();
updateReplySelectedFiles();
renderWorkspaceActions();
setLockedState(!getPortalPassword());

if (getPortalPassword()) {
  void fetchRequests();
  if (WORKSPACE_ENDPOINT !== REQUESTS_ENDPOINT) {
    void fetchWorkspace();
  }
}

startPolling();
startHelperMessageRotation();
}

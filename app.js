const LOCAL_API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:4173"
  : "https://example-api.your-domain.com";

const DEFAULT_PORTAL_CONFIG = {
  portalTitle: "Client Work Portal",
  storageNamespace: "client-portal-template",
  apiBase: LOCAL_API_BASE,
  requestsPath: "/api/portal/gray/requests",
  repliesPath: "/api/portal/gray/replies",
  showApiBaseLabel: true,
  authEyebrow: "Protected Portal",
  authTitle: "Project updates",
  authCopy: "Enter the portal password to view and submit work requests.",
  heroEyebrow: "Client Delivery Portal",
  heroTitle: "Send work, watch it move, and keep the list growing.",
  heroCopy: "Add a task, assign the right expert, and keep building your list while work moves in the background.",
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
    expert: "Expert",
    customExpert: "Custom expert",
    reply: "Your Reply",
  },
  placeholders: {
    title: "Describe the next update you want made",
    details: "Explain the change, desired outcome, and anything that should stay the same.",
    customExpert: "Add a custom expert name",
    reply: "Add your response, feedback, or clarification...",
  },
  buttons: {
    unlock: "Unlock portal",
    submit: "Queue task",
    submitBusy: "Queueing...",
    refresh: "Refresh",
    addCustomExpert: "Add",
    detailOpen: "Open",
    detailHide: "Hide",
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
    customExpertExists: "is already available.",
    customExpertAdded: "added to your expert list.",
    addCustomExpertFirst: "Add a name for the custom expert first.",
    passwordRequired: "Enter the password.",
    incorrectPassword: "Incorrect password.",
    blockedPublicText: "This item needs a bit of direction before it keeps moving.",
    failedPublicText: "This item hit a snag. Add a note and it can be reworked.",
    replyEmptyError: "Please enter a message or attach files.",
    replyMissingRequest: "Missing request ID.",
    replyError: "Unable to send reply.",
    replySuccess: "Reply sent. A refreshed response and screenshot will land here when ready.",
    replyThreadWaiting: "You will see the latest reply here when it lands.",
    completedToast: "Another item moved to done. Review the screenshot and follow-up options when ready.",
    followUpUnavailable: "That follow-up suggestion is no longer available.",
    followUpCreateError: "Unable to create follow-up todo.",
  },
  hints: {
    customExpert: "Custom experts stay available on this device and can be reused on future tasks.",
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
    running: "In motion",
    queued: "Queued",
  },
  priorityOptions: [
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
    { value: "low", label: "Low" },
  ],
  experts: [
    { key: "launch-lead", label: "Launch Lead", type: "catalog", description: "Best for end-to-end site changes and coordination." },
    { key: "design-polish", label: "Design Polish", type: "catalog", description: "Best for layout, spacing, and visual refinements." },
    { key: "copy-crafter", label: "Copy Crafter", type: "catalog", description: "Best for messaging, headlines, and clarity edits." },
    { key: "growth-builder", label: "Growth Builder", type: "catalog", description: "Best for conversion, forms, and funnel improvements." },
    { key: "qa-guardian", label: "QA Guardian", type: "catalog", description: "Best for bug hunts, cleanup, and release confidence." },
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
const CUSTOM_EXPERTS_STORAGE_KEY = `${STORAGE_NAMESPACE}:custom-experts`;
const SELECTED_EXPERT_STORAGE_KEY = `${STORAGE_NAMESPACE}:selected-expert`;
const API_BASE_STORAGE_KEY = `${STORAGE_NAMESPACE}:api-base`;
const API_BASE = window.localStorage.getItem(API_BASE_STORAGE_KEY) || PORTAL_CONFIG.apiBase;
const REQUESTS_ENDPOINT = `${API_BASE}${PORTAL_CONFIG.requestsPath}`;
const REPLY_ENDPOINT = `${API_BASE}${PORTAL_CONFIG.repliesPath}`;

const authShell = document.querySelector("#authShell");
const authForm = document.querySelector("#authForm");
const passwordInput = document.querySelector("#passwordInput");
const authStatus = document.querySelector("#authStatus");
const requestForm = document.querySelector("#requestForm");
const titleInput = document.querySelector("#titleInput");
const detailsInput = document.querySelector("#detailsInput");
const priorityInput = document.querySelector("#priorityInput");
const imagesInput = document.querySelector("#imagesInput");
const expertInput = document.querySelector("#expertInput");
const customExpertInput = document.querySelector("#customExpertInput");
const addCustomExpertButton = document.querySelector("#addCustomExpertButton");
const selectedFiles = document.querySelector("#selectedFiles");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const queueList = document.querySelector("#queueList");
const refreshButton = document.querySelector("#refreshButton");
const apiBaseLabel = document.querySelector("#apiBaseLabel");
const toastStack = document.querySelector("#toastStack");

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
let pendingRevealRequestId = "";

const expandedRequestIds = new Set();
const flashedRequestIds = new Set();
const flashTimeouts = new Map();
const pendingAttentionRequestIds = new Set();
const suggestionCreatesInFlight = new Set();

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
  setText("#expertLabel", PORTAL_CONFIG.labels.expert);
  setText("#customExpertLabel", PORTAL_CONFIG.labels.customExpert);
  setText("#customExpertHint", PORTAL_CONFIG.hints.customExpert);
  setText("#addCustomExpertButton", PORTAL_CONFIG.buttons.addCustomExpert);
  setText("#submitButton", PORTAL_CONFIG.buttons.submit);
  setText("#refreshButton", PORTAL_CONFIG.buttons.refresh);
  setText("#replyDialogHeading", PORTAL_CONFIG.buttons.replyDialogTitle);
  setText("#replyInputLabel", PORTAL_CONFIG.labels.reply);
  setText("#replyAttachLabel", PORTAL_CONFIG.buttons.replyAttach || "Attach files (optional)");
  setText("#replyCancelButton", PORTAL_CONFIG.buttons.replyCancel);
  setText("#replySubmitButton", PORTAL_CONFIG.buttons.replySubmit);
  setPlaceholder("#titleInput", PORTAL_CONFIG.placeholders.title);
  setPlaceholder("#detailsInput", PORTAL_CONFIG.placeholders.details);
  setPlaceholder("#customExpertInput", PORTAL_CONFIG.placeholders.customExpert);
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

function getAssignedExpert(request) {
  const assigned = request?.assigned_expert;
  if (assigned && typeof assigned === "object") {
    return {
      key: String(assigned.key || assigned.expert_key || slugify(assigned.label || assigned.name || "expert")),
      label: String(assigned.label || assigned.name || "Expert"),
      type: String(assigned.type || assigned.expert_type || "catalog"),
    };
  }

  const label = request?.expert_label || request?.expert_name;
  const key = request?.expert_key;
  if (label || key) {
    return {
      key: String(key || slugify(label)),
      label: String(label || key || "Expert"),
      type: String(request?.expert_type || "catalog"),
    };
  }

  return null;
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
  if (state === "blocked") {
    return clampText(request?.public_status_text, 160) || PORTAL_CONFIG.messages.blockedPublicText;
  }
  if (state === "failed") {
    return clampText(request?.public_status_text, 160) || PORTAL_CONFIG.messages.failedPublicText;
  }
  return getPublicWaitingMessage(request);
}

function getPriorityLabel(priority) {
  const value = String(priority || "normal").toLowerCase();
  const configured = (PORTAL_CONFIG.priorityOptions || []).find(option => option.value === value);
  return configured?.label || toTitleCase(value);
}

function getDefaultExperts() {
  return Array.isArray(PORTAL_CONFIG.experts) && PORTAL_CONFIG.experts.length
    ? PORTAL_CONFIG.experts
    : DEFAULT_PORTAL_CONFIG.experts;
}

function getCustomExperts() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_EXPERTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(expert => expert && (expert.key || expert.label))
      .map(expert => ({
        key: String(expert.key || slugify(expert.label)),
        label: String(expert.label || expert.key || "Custom Expert"),
        type: "custom",
        description: String(expert.description || "Custom expert"),
      }));
  } catch {
    return [];
  }
}

function saveCustomExperts(experts) {
  window.localStorage.setItem(CUSTOM_EXPERTS_STORAGE_KEY, JSON.stringify(experts));
}

function getExpertCatalog() {
  return [...getDefaultExperts(), ...getCustomExperts()];
}

function getSavedExpertKey() {
  return window.localStorage.getItem(SELECTED_EXPERT_STORAGE_KEY) || getDefaultExperts()[0].key;
}

function saveSelectedExpertKey(value) {
  if (value) {
    window.localStorage.setItem(SELECTED_EXPERT_STORAGE_KEY, value);
  }
}

function renderExpertOptions(selectedKey = getSavedExpertKey()) {
  const catalogExperts = getDefaultExperts();
  const customExperts = getCustomExperts();
  const defaultOptions = catalogExperts
    .map(expert => `<option value="${escapeHtml(expert.key)}">${escapeHtml(expert.label)}</option>`)
    .join("");
  const customOptions = customExperts
    .map(expert => `<option value="${escapeHtml(expert.key)}">${escapeHtml(expert.label)}</option>`)
    .join("");

  expertInput.innerHTML = `
    <optgroup label="Expert Team">
      ${defaultOptions}
    </optgroup>
    ${customOptions ? `
      <optgroup label="Custom Experts">
        ${customOptions}
      </optgroup>
    ` : ""}
  `;

  const availableKeys = new Set(getExpertCatalog().map(expert => expert.key));
  expertInput.value = availableKeys.has(selectedKey) ? selectedKey : catalogExperts[0].key;
  saveSelectedExpertKey(expertInput.value);
}

function getSelectedExpert() {
  const key = expertInput.value;
  return getExpertCatalog().find(expert => expert.key === key) || getDefaultExperts()[0];
}

function addCustomExpert() {
  const label = customExpertInput.value.trim().replace(/\s+/g, " ");
  if (!label) {
    showToast(PORTAL_CONFIG.messages.addCustomExpertFirst, "warn");
    return;
  }

  const currentExperts = getCustomExperts();
  const duplicate = currentExperts.find(expert => expert.label.toLowerCase() === label.toLowerCase());
  if (duplicate) {
    renderExpertOptions(duplicate.key);
    customExpertInput.value = "";
    showToast(`${duplicate.label} ${PORTAL_CONFIG.messages.customExpertExists}`, "info");
    return;
  }

  const expert = {
    key: `custom-${slugify(label)}-${Date.now().toString(36).slice(-4)}`,
    label,
    type: "custom",
    description: "Custom expert",
  };
  saveCustomExperts([...currentExperts, expert]);
  renderExpertOptions(expert.key);
  customExpertInput.value = "";
  showToast(`${expert.label} ${PORTAL_CONFIG.messages.customExpertAdded}`, "success");
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

function buildRequestCard(request) {
  const requestId = getRequestId(request);
  const domId = getDomSafeId(requestId || request.title || "request");
  const state = normalizeRequestState(request);
  const isCompleted = state === "completed";
  const canReply = isCompleted || Boolean(request.has_unprocessed_replies);
  const replies = Array.isArray(request.replies) ? request.replies : [];
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
  const expert = getAssignedExpert(request);
  const completionScreenshot = request.completion_screenshot || null;
  const detailId = `request-detail-${domId}`;
  const expanded = expandedRequestIds.has(requestId);
  const flashClass = flashedRequestIds.has(requestId) ? "flash" : "";
  const detailHidden = expanded ? "" : "hidden";

  return `
    <article class="request-card state-${state} ${expanded ? "expanded" : ""} ${flashClass}" data-request-id="${escapeHtml(requestId)}">
      <div class="request-summary">
        <div class="request-summary-main">
          <div class="summary-title-row">
            <span class="checkbox ${isCompleted ? "done" : ""}">${isCompleted ? "✓" : ""}</span>
            <div class="summary-copy">
              <div class="title-meta-row">
                <h3 class="request-title">${escapeHtml(request.title || "Untitled request")}</h3>
                ${expert ? `<span class="expert-chip ${expert.type === "custom" ? "custom" : ""}">${escapeHtml(expert.label)}</span>` : ""}
              </div>
              <p class="request-public-line">${escapeHtml(getPublicStatusLine(request))}</p>
            </div>
          </div>
        </div>
        <div class="request-summary-side">
          <div class="request-meta">
            <span class="pill status-${state}">${escapeHtml(getStatusLabel(state))}</span>
            <span class="pill priority-${escapeHtml(String(request.priority || "normal").toLowerCase())}">${escapeHtml(getPriorityLabel(request.priority))}</span>
          </div>
          <button
            class="secondary card-toggle"
            type="button"
            data-request-id="${escapeHtml(requestId)}"
            aria-expanded="${expanded ? "true" : "false"}"
            aria-controls="${detailId}"
          >
            ${expanded ? escapeHtml(PORTAL_CONFIG.buttons.detailHide) : escapeHtml(PORTAL_CONFIG.buttons.detailOpen)}
          </button>
        </div>
      </div>

      <div class="request-detail" id="${detailId}" ${detailHidden}>
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

        ${(canReply || replies.length) ? `
          <div class="detail-block">
            <div class="request-actions">
              <button
                class="reply-btn"
                data-request-id="${escapeHtml(requestId)}"
                data-request-title="${escapeHtml(request.title || "")}"
                data-request-details="${escapeHtml(request.details || "")}"
                ${!canReply ? "disabled" : ""}
              >
                ${escapeHtml(request.has_unprocessed_replies ? PORTAL_CONFIG.buttons.replyInMotion : PORTAL_CONFIG.buttons.reply)}
              </button>
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

function attachQueueEventHandlers() {
  document.querySelectorAll(".card-toggle").forEach(button => {
    button.addEventListener("click", event => {
      const requestId = event.currentTarget.dataset.requestId;
      if (!requestId) return;
      if (expandedRequestIds.has(requestId)) {
        expandedRequestIds.delete(requestId);
      } else {
        expandedRequestIds.add(requestId);
      }
      renderRequests(cachedRequests);
    });
  });

  document.querySelectorAll(".reply-btn:not([disabled])").forEach(button => {
    button.addEventListener("click", openReplyDialog);
  });

  document.querySelectorAll(".follow-up-btn").forEach(button => {
    button.addEventListener("click", createFollowUpTodo);
  });
}

function renderRequests(requests) {
  if (!Array.isArray(requests) || !requests.length) {
    renderEmpty(PORTAL_CONFIG.messages.queueEmpty);
    return;
  }

  queueList.innerHTML = requests.map(buildRequestCard).join("");
  attachQueueEventHandlers();
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
      expandedRequestIds.add(requestId);
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

async function submitRequest(event) {
  event.preventDefault();
  formStatus.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = PORTAL_CONFIG.buttons.submitBusy;

  try {
    const selectedExpert = getSelectedExpert();
    const formData = new FormData();
    formData.set("title", titleInput.value.trim());
    formData.set("details", detailsInput.value.trim());
    formData.set("priority", priorityInput.value);
    formData.set("expert_key", selectedExpert.key);
    formData.set("expert_label", selectedExpert.label);
    formData.set("expert_type", selectedExpert.type);

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

    const selectedExpertKey = expertInput.value;
    requestForm.reset();
    renderPriorityOptions();
    renderExpertOptions(selectedExpertKey);
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
    const fallbackExpert = getAssignedExpert(request) || getSelectedExpert();
    const expert = {
      key: suggestion.expert_key || fallbackExpert.key,
      label: suggestion.expert_label || fallbackExpert.label,
      type: suggestion.expert_type || fallbackExpert.type,
    };

    const formData = new FormData();
    formData.set("title", String(suggestion.title || suggestion.label || `Follow-up for ${request.title}`));
    formData.set("details", String(suggestion.details || `Follow-up to ${request.title}`));
    formData.set("priority", String(suggestion.priority || request.priority || "normal"));
    formData.set("expert_key", expert.key);
    formData.set("expert_label", expert.label);
    formData.set("expert_type", expert.type);
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

function startPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
  }
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === "hidden" || !replyDialogShell.classList.contains("hidden")) {
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
refreshButton.addEventListener("click", () => {
  void fetchRequests();
});
authForm.addEventListener("submit", unlockPortal);
replyCloseBtn.addEventListener("click", closeReplyDialog);
replyCancelButton.addEventListener("click", closeReplyDialog);
expertInput.addEventListener("change", event => {
  saveSelectedExpertKey(event.currentTarget.value);
});
addCustomExpertButton.addEventListener("click", addCustomExpert);
customExpertInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCustomExpert();
  }
});

replyDialogShell.addEventListener("click", event => {
  if (event.target === replyDialogShell) {
    closeReplyDialog();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !replyDialogShell.classList.contains("hidden")) {
    closeReplyDialog();
  }
});

applyPortalConfig();
renderPriorityOptions();
renderExpertOptions();
updateSelectedFiles();
updateReplySelectedFiles();
setLockedState(!getPortalPassword());

if (getPortalPassword()) {
  void fetchRequests();
}

startPolling();
startHelperMessageRotation();

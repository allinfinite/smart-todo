import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const targetPath = path.join(cwd, "portal.config.js");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const entries = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function readEnv() {
  const fileEnv = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ].reduce((accumulator, filename) => Object.assign(accumulator, parseEnvFile(path.join(cwd, filename))), {});
  return { ...fileEnv, ...process.env };
}

function parseJsonEnv(value, fallback) {
  if (!value) return fallback;
  let normalized = String(value).trim();
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }
  while (normalized.endsWith("\\n")) {
    normalized = normalized.slice(0, -2).trimEnd();
  }
  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(`Invalid JSON config: ${error.message}`);
  }
}

function setNestedValue(target, pathKey, value) {
  if (value === undefined || value === "") return;
  const segments = pathKey.split(".");
  let current = target;
  while (segments.length > 1) {
    const segment = segments.shift();
    current[segment] = current[segment] || {};
    current = current[segment];
  }
  current[segments[0]] = value;
}

function buildConfig(env) {
  const fromJson = parseJsonEnv(env.PORTAL_TEMPLATE_CONFIG_JSON, {});
  const config = typeof fromJson === "object" && fromJson && !Array.isArray(fromJson) ? { ...fromJson } : {};

  const mappings = {
    PORTAL_TITLE: "portalTitle",
    PORTAL_STORAGE_NAMESPACE: "storageNamespace",
    PORTAL_API_BASE: "apiBase",
    PORTAL_REQUESTS_PATH: "requestsPath",
    PORTAL_REPLIES_PATH: "repliesPath",
    PORTAL_WORKSPACE_PATH: "workspacePath",
    PORTAL_SITE_ACTIONS_PATH: "siteActionsPath",
    PORTAL_AUTH_EYEBROW: "authEyebrow",
    PORTAL_AUTH_TITLE: "authTitle",
    PORTAL_AUTH_COPY: "authCopy",
    PORTAL_HERO_EYEBROW: "heroEyebrow",
    PORTAL_HERO_TITLE: "heroTitle",
    PORTAL_HERO_COPY: "heroCopy",
    PORTAL_COMPOSER_EYEBROW: "composerEyebrow",
    PORTAL_COMPOSER_TITLE: "composerTitle",
    PORTAL_BOARD_EYEBROW: "boardEyebrow",
    PORTAL_BOARD_TITLE: "boardTitle",
    PORTAL_USER_LABEL: "userLabel",
    PORTAL_AGENT_LABEL: "agentLabel",
    PORTAL_EXTERNAL_REPLY_AUTHOR_LABEL: "externalReplyAuthorLabel",
    PORTAL_PASSWORD_LABEL: "labels.password",
    PORTAL_TITLE_LABEL: "labels.title",
    PORTAL_DETAILS_LABEL: "labels.details",
    PORTAL_PRIORITY_LABEL: "labels.priority",
    PORTAL_FILES_LABEL: "labels.files",
    PORTAL_REPLY_LABEL: "labels.reply",
    PORTAL_TITLE_PLACEHOLDER: "placeholders.title",
    PORTAL_DETAILS_PLACEHOLDER: "placeholders.details",
    PORTAL_REPLY_PLACEHOLDER: "placeholders.reply",
    PORTAL_UNLOCK_LABEL: "buttons.unlock",
    PORTAL_SUBMIT_LABEL: "buttons.submit",
    PORTAL_SUBMIT_BUSY_LABEL: "buttons.submitBusy",
    PORTAL_PREVIEW_LABEL: "buttons.preview",
    PORTAL_PREVIEW_BUSY_LABEL: "buttons.previewBusy",
    PORTAL_DEPLOY_LABEL: "buttons.deploy",
    PORTAL_DEPLOY_BUSY_LABEL: "buttons.deployBusy",
    PORTAL_REFRESH_LABEL: "buttons.refresh",
    PORTAL_DETAIL_OPEN_LABEL: "buttons.detailOpen",
    PORTAL_DETAIL_HIDE_LABEL: "buttons.detailHide",
    PORTAL_REPLY_DIALOG_TITLE: "buttons.replyDialogTitle",
    PORTAL_REPLY_BUTTON_LABEL: "buttons.reply",
    PORTAL_REPLY_IN_MOTION_LABEL: "buttons.replyInMotion",
    PORTAL_REPLY_CANCEL_LABEL: "buttons.replyCancel",
    PORTAL_REPLY_SUBMIT_LABEL: "buttons.replySubmit",
    PORTAL_REPLY_SUBMIT_BUSY_LABEL: "buttons.replySubmitBusy",
    PORTAL_REPLY_ATTACH_LABEL: "buttons.replyAttach",
    PORTAL_NO_FILES_TEXT: "messages.noFilesSelected",
    PORTAL_QUEUE_EMPTY_TEXT: "messages.queueEmpty",
    PORTAL_QUEUE_LOADING_TEXT: "messages.queueLoading",
    PORTAL_LOAD_ERROR_TEXT: "messages.loadError",
    PORTAL_QUEUE_ERROR_TEXT: "messages.queueError",
    PORTAL_REQUEST_QUEUED_TEXT: "messages.requestQueued",
    PORTAL_REQUEST_QUEUED_TOAST: "messages.requestQueuedToast",
    PORTAL_FOLLOWUP_CREATED_TOAST: "messages.followUpCreatedToast",
    PORTAL_PASSWORD_REQUIRED_TEXT: "messages.passwordRequired",
    PORTAL_INCORRECT_PASSWORD_TEXT: "messages.incorrectPassword",
    PORTAL_REPLY_EMPTY_ERROR_TEXT: "messages.replyEmptyError",
    PORTAL_REPLY_MISSING_REQUEST_TEXT: "messages.replyMissingRequest",
    PORTAL_REPLY_ERROR_TEXT: "messages.replyError",
    PORTAL_REPLY_SUCCESS_TEXT: "messages.replySuccess",
    PORTAL_COMPLETED_TOAST_TEXT: "messages.completedToast",
    PORTAL_PREVIEW_ERROR_TEXT: "messages.previewError",
    PORTAL_PREVIEW_READY_TOAST: "messages.previewReadyToast",
    PORTAL_DEPLOY_ERROR_TEXT: "messages.deployError",
    PORTAL_DEPLOY_SUCCESS_TOAST: "messages.deploySuccessToast",
    PORTAL_FOLLOWUP_UNAVAILABLE_TEXT: "messages.followUpUnavailable",
    PORTAL_FOLLOWUP_CREATE_ERROR_TEXT: "messages.followUpCreateError",
    PORTAL_FOLLOWUP_HINT: "hints.followUp",
    PORTAL_SECTION_DETAILS: "sections.details",
    PORTAL_SECTION_ACCOMPLISHED: "sections.accomplished",
    PORTAL_SECTION_SCREENSHOT: "sections.screenshot",
    PORTAL_SECTION_REFERENCES: "sections.references",
    PORTAL_SECTION_ADD_TODO: "sections.addTodo",
    PORTAL_SECTION_REPLY_THREAD: "sections.replyThread",
    PORTAL_STATE_COMPLETED: "states.completed",
    PORTAL_STATE_FAILED: "states.failed",
    PORTAL_STATE_BLOCKED: "states.blocked",
    PORTAL_STATE_RUNNING: "states.running",
    PORTAL_STATE_QUEUED: "states.queued",
  };

  Object.entries(mappings).forEach(([envKey, configKey]) => {
    setNestedValue(config, configKey, env[envKey]);
  });

  if (env.PORTAL_SHOW_API_BASE) {
    config.showApiBaseLabel = !["0", "false", "no"].includes(String(env.PORTAL_SHOW_API_BASE).toLowerCase());
  }
  if (env.PORTAL_THEME_JSON) {
    config.theme = parseJsonEnv(env.PORTAL_THEME_JSON, {});
  }
  if (env.PORTAL_WAITING_MESSAGES_JSON) {
    config.waitingMessages = parseJsonEnv(env.PORTAL_WAITING_MESSAGES_JSON, []);
  }
  if (env.PORTAL_PRIORITY_OPTIONS_JSON) {
    config.priorityOptions = parseJsonEnv(env.PORTAL_PRIORITY_OPTIONS_JSON, []);
  }

  return config;
}

const env = readEnv();
const config = buildConfig(env);
const fileContents = `window.PORTAL_TEMPLATE_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(targetPath, fileContents);
console.log(`wrote ${path.relative(cwd, targetPath)}`);

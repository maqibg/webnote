const dataNode = typeof document !== "undefined" ? document.getElementById("__APP_DATA__") : null;
const noteData = dataNode ? JSON.parse(dataNode.textContent || "{}") : null;
const TOOLBAR_GROUPS = [
  [{ label: "H1", action: "formatBlock", value: "h1" }, { label: "H2", action: "formatBlock", value: "h2" }, { label: "H3", action: "formatBlock", value: "h3" }],
  [{ label: "B", action: "bold" }, { label: "I", action: "italic" }, { label: "U", action: "underline" }, { label: "S", action: "strikeThrough" }],
  [{ label: "引用", action: "formatBlock", value: "blockquote" }, { label: "代码块", action: "formatBlock", value: "pre" }],
  [{ label: "有序", action: "insertOrderedList" }, { label: "无序", action: "insertUnorderedList" }],
  [{ label: "下标", action: "subscript" }, { label: "上标", action: "superscript" }],
  [{ label: "缩进-", action: "outdent" }, { label: "缩进+", action: "indent" }],
  [{ label: "颜色", action: "foreColor" }, { label: "背景", action: "hiliteColor" }, { label: "对齐", action: "align" }],
  [{ label: "链接", action: "createLink" }, { label: "图片", action: "insertImage" }, { label: "清除", action: "removeFormat" }]
];

let saveTimer = 0;
let currentUnlockToken = "";
let currentView = "edit";

function el(id) { return document.getElementById(id); }

function renderToolbar() {
  const toolbar = el("editorToolbar");
  if (!toolbar) return;
  toolbar.innerHTML = "";
  for (const group of TOOLBAR_GROUPS) {
    const wrap = document.createElement("div");
    wrap.className = "toolbar-group";
    for (const tool of group) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool-btn";
      button.textContent = tool.label;
      button.addEventListener("click", () => applyTool(tool));
      wrap.appendChild(button);
    }
    toolbar.appendChild(wrap);
  }
}

function updateStatus(text, tone = "ready") {
  el("statusText").textContent = text;
  const indicator = el("statusIndicator");
  indicator.className = "status-indicator";
  if (tone === "saving") indicator.classList.add("saving");
  if (tone === "error") indicator.classList.add("error");
}

async function requestJson(url, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  if (currentUnlockToken) headers.set("x-note-unlock-token", currentUnlockToken);
  const response = await fetch(url, { ...init, headers });
  const payload = await response.json().catch(() => ({ ok: false, error: "Invalid response" }));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed");
  return payload;
}

function setPreview(html) {
  el("previewPane").innerHTML = html || '<p class="placeholder-text">在这里开始记录。</p>';
}

function setEditability(canEdit) {
  const editor = el("editorInput");
  editor.contentEditable = canEdit ? "true" : "false";
  toolbarState(canEdit);
}

function toolbarState(enabled) {
  document.querySelectorAll(".tool-btn").forEach((node) => { node.disabled = !enabled; });
  el("saveBtn").disabled = !enabled;
}

function setView(view) {
  currentView = view;
  el("editTab").classList.toggle("active", view === "edit");
  el("previewTab").classList.toggle("active", view === "preview");
  el("editorInput").hidden = view !== "edit";
  el("previewPane").hidden = view !== "preview";
  if (view === "preview") {
    setPreview(el("editorInput").innerHTML);
  }
}

function execCommand(command, value = null) {
  document.execCommand(command, false, value);
  el("editorInput").focus();
  scheduleSave();
}

function applyTool(tool) {
  if (tool.action === "formatBlock") {
    execCommand("formatBlock", tool.value);
    return;
  }
  if (tool.action === "align") {
    const chosen = prompt("输入对齐方式：left / center / right", "center");
    if (chosen === "center") execCommand("justifyCenter");
    if (chosen === "left") execCommand("justifyLeft");
    if (chosen === "right") execCommand("justifyRight");
    return;
  }
  if (tool.action === "foreColor" || tool.action === "hiliteColor") {
    const chosen = prompt(tool.action === "foreColor" ? "输入颜色值，如 #2563eb" : "输入背景色，如 #fef3c7", "#2563eb");
    if (chosen) execCommand(tool.action, chosen);
    return;
  }
  if (tool.action === "createLink") {
    const url = prompt("输入链接地址", "https://");
    if (url) execCommand("createLink", url);
    return;
  }
  if (tool.action === "insertImage") {
    const url = prompt("输入图片地址", "https://");
    if (url) execCommand("insertImage", url);
    return;
  }
  execCommand(tool.action);
}

function scheduleSave() {
  if (!noteData.canEdit) return;
  clearTimeout(saveTimer);
  updateStatus("保存中...", "saving");
  saveTimer = window.setTimeout(() => saveNote(), 2000);
}

async function saveNote() {
  const payload = { rawContent: el("editorInput").innerHTML };
  try {
    const result = await requestJson(`/api/notes/${noteData.path}`, { method: "PUT", body: JSON.stringify(payload) });
    noteData.rawContent = result.note.rawContent;
    noteData.renderedHtml = result.note.renderedHtml;
    noteData.lastSavedAt = result.note.lastSavedAt;
    el("lastSaved").textContent = result.note.lastSavedAt;
    setPreview(result.note.renderedHtml);
    el("editorInput").innerHTML = result.note.renderedHtml || "";
    updateStatus("已保存");
  } catch (error) {
    updateStatus(error.message, "error");
  }
}

async function unlockNote() {
  try {
    const result = await requestJson(`/api/notes/${noteData.path}/unlock`, {
      method: "POST",
      body: JSON.stringify({ password: el("unlockPassword").value })
    });
    currentUnlockToken = result.unlockToken;
    noteData.canView = true;
    noteData.canEdit = true;
    setEditability(true);
    el("unlockModal").hidden = true;
    const fresh = await requestJson(`/api/notes/${noteData.path}`, { method: "GET" });
    noteData.rawContent = fresh.note.rawContent;
    noteData.renderedHtml = fresh.note.renderedHtml;
    el("editorInput").innerHTML = fresh.note.renderedHtml || "";
    setPreview(fresh.note.renderedHtml);
    updateStatus("已解锁");
  } catch (error) {
    updateStatus(error.message, "error");
  }
}

async function setLock() {
  try {
    const payload = {
      mode: el("lockMode").value,
      password: el("lockPassword").value,
      hintText: el("lockHint").value
    };
    await requestJson(`/api/notes/${noteData.path}/lock`, { method: "POST", body: JSON.stringify(payload) });
    el("lockModal").hidden = true;
    updateStatus("锁定已更新");
  } catch (error) {
    updateStatus(error.message, "error");
  }
}

async function registerView() {
  const key = `view:${noteData.path}`;
  const last = Number(sessionStorage.getItem(key) || "0");
  if (Date.now() - last < 60000) return;
  sessionStorage.setItem(key, String(Date.now()));
  try {
    const result = await requestJson(`/api/notes/${noteData.path}/view`, { method: "POST", body: JSON.stringify({}) });
    el("viewCount").textContent = result.viewCount;
  } catch {}
}

function bindEvents() {
  el("newBtn").addEventListener("click", () => { window.location.href = "/"; });
  el("saveBtn").addEventListener("click", () => saveNote());
  el("editTab").addEventListener("click", () => setView("edit"));
  el("previewTab").addEventListener("click", () => setView("preview"));
  el("editorInput").addEventListener("input", () => scheduleSave());
  el("editorInput").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveNote();
    }
  });
  el("unlockTrigger")?.addEventListener("click", () => { el("unlockModal").hidden = false; });
  el("lockBtn").addEventListener("click", async () => {
    if (noteData.locked && confirm("确认解除锁定？")) {
      try {
        await requestJson(`/api/notes/${noteData.path}/lock`, { method: "DELETE", body: JSON.stringify({}) });
        noteData.locked = false;
        noteData.canEdit = true;
        el("lockBtn").textContent = "未锁定";
        setEditability(true);
        updateStatus("锁定已解除");
        return;
      } catch (error) {
        updateStatus(error.message, "error");
        return;
      }
    }
    el("lockModal").hidden = false;
  });
  el("unlockCancel").addEventListener("click", () => { el("unlockModal").hidden = true; });
  el("unlockSubmit").addEventListener("click", () => unlockNote());
  el("lockCancel").addEventListener("click", () => { el("lockModal").hidden = true; });
  el("lockSubmit").addEventListener("click", () => setLock());
}

function start() {
  if (!noteData) return;
  renderToolbar();
  bindEvents();
  setPreview(noteData.renderedHtml);
  el("editorInput").innerHTML = noteData.renderedHtml || "";
  setEditability(Boolean(noteData.canEdit));
  setView(noteData.canEdit ? "edit" : "preview");
  registerView();
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", start, { once: true });
}

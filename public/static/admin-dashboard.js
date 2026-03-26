let currentPath = "";

function tableRow(note, alt = false) {
  const statusClass = note.lockMode ? "status-lock" : note.isBlank ? "status-blank" : "status-open";
  const statusText = note.lockMode === "edit" ? "编辑锁定" : note.lockMode === "access" ? "访问锁定" : note.isBlank ? "空白占位" : "公开可读";
  return `
    <div class="notes-table-row${alt ? " alt" : ""}" data-path="${note.path}">
      <div class="mono">${note.path}</div>
      <div class="${statusClass}">${statusText}</div>
      <div>${note.viewCount}</div>
      <div>${(note.createdAt || "").replace("T", " ").slice(0, 16)}</div>
      <div>${(note.updatedAt || "").replace("T", " ").slice(0, 16)}</div>
      <div class="action-cell"><button class="btn btn-small btn-danger" data-delete="${note.path}">删除</button></div>
    </div>
  `;
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "请求失败");
  return payload;
}

async function loadDashboard() {
  const [stats, notes, logs] = await Promise.all([
    requestJson("/api/admin/stats"),
    requestJson(`/api/admin/notes?search=${encodeURIComponent(document.getElementById("searchInput").value)}`),
    requestJson("/api/admin/logs")
  ]);

  document.getElementById("statsGrid").innerHTML = `
    <article><h3>总笔记</h3><div class="value">${stats.stats.totalNotes}</div><p>全部路径笔记</p></article>
    <article><h3>锁定笔记</h3><div class="value">${stats.stats.lockedNotes}</div><p>访问锁定与编辑锁定</p></article>
    <article><h3>今日写入</h3><div class="value">${stats.stats.writtenToday}</div><p>自动保存与手动保存合计</p></article>
    <article><h3>总查看量</h3><div class="value">${stats.stats.totalViews}</div><p>已排除管理员访问</p></article>
  `;

  document.getElementById("tableCount").textContent = `共 ${notes.notes.length} 条`;
  document.getElementById("notesTable").innerHTML = `
    <div class="notes-table-row header">
      <div>路径</div><div>状态</div><div>访问量</div><div>创建时间</div><div>更新时间</div><div>操作</div>
    </div>
    ${notes.notes.map((note, index) => tableRow(note, index % 2 === 1)).join("")}
  `;

  document.getElementById("logsList").innerHTML = logs.logs.map((log) => `
    <div class="log-row"><div class="mono">${log.created_at.replace("T", " ").slice(0, 16)}  ${log.action}  ${log.target_path || "-"}</div><div>admin</div></div>
  `).join("");

  bindTableEvents(notes.notes);
}

function bindTableEvents(notes) {
  for (const row of document.querySelectorAll(".notes-table-row[data-path]")) {
    row.addEventListener("click", () => {
      const note = notes.find((item) => item.path === row.dataset.path);
      if (!note) return;
      currentPath = note.path;
      document.getElementById("editorTitle").textContent = `编辑 ${note.path}`;
      document.getElementById("editorMeta").innerHTML = `
        路径：${note.path}<br>状态：${note.lockMode || (note.isBlank ? "空白占位" : "公开可读")}<br>最后保存：${note.lastSavedAt || "未保存"}
      `;
      document.getElementById("adminEditor").value = note.rawContent || "";
      document.getElementById("deleteBtn").disabled = false;
    });
  }

  for (const button of document.querySelectorAll("[data-delete]")) {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!confirm(`确认删除 ${button.dataset.delete} ?`)) return;
      await requestJson(`/api/admin/notes/${button.dataset.delete}`, { method: "DELETE", body: "{}" });
      await loadDashboard();
    });
  }
}

async function saveCurrentNote() {
  if (!currentPath) return;
  await requestJson(`/api/admin/notes/${currentPath}`, {
    method: "PATCH",
    body: JSON.stringify({ rawContent: document.getElementById("adminEditor").value })
  });
  await loadDashboard();
}

async function configureLock() {
  if (!currentPath) return;
  const mode = prompt("输入锁定模式：access 或 edit", "edit");
  if (!mode) return;
  const password = prompt("输入锁定密码");
  if (!password) return;
  const hintText = prompt("输入锁定说明（未解锁不可见）", "") || "";
  await requestJson(`/api/notes/${currentPath}/lock`, {
    method: "POST",
    body: JSON.stringify({ mode, password, hintText })
  });
  await loadDashboard();
}

async function logout() {
  await requestJson("/api/admin/logout", { method: "POST", body: "{}" });
  window.location.href = "/admin";
}

async function exportNotes() {
  window.location.href = "/api/admin/export";
}

async function importNotes() {
  const raw = prompt("粘贴导出的 JSON 内容");
  if (!raw) return;
  await requestJson("/api/admin/import", { method: "POST", body: raw });
  await loadDashboard();
}

function createBlankNote() {
  requestJson("/api/admin/blank", { method: "POST", body: "{}" })
    .then((payload) => { window.location.href = `/${payload.path}`; })
    .catch((error) => { console.error(error); });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("refreshBtn").addEventListener("click", loadDashboard);
    document.getElementById("saveAdminBtn").addEventListener("click", saveCurrentNote);
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("exportBtn").addEventListener("click", exportNotes);
    document.getElementById("importBtn").addEventListener("click", importNotes);
    document.getElementById("createBlankBtn").addEventListener("click", createBlankNote);
    document.getElementById("lockConfigBtn").addEventListener("click", configureLock);
    document.getElementById("searchInput").addEventListener("change", loadDashboard);
    document.getElementById("deleteBtn").addEventListener("click", async () => {
      if (!currentPath || !confirm(`确认删除 ${currentPath} ?`)) return;
      await requestJson(`/api/admin/notes/${currentPath}`, { method: "DELETE", body: "{}" });
      currentPath = "";
      await loadDashboard();
    });
    loadDashboard().catch((error) => { console.error(error); });
  }, { once: true });
}

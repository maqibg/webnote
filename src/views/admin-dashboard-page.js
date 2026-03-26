import { pageDocument } from "./shared.js";

export function renderAdminDashboardPage() {
  return pageDocument({
    title: "后台管理",
    cssPath: "/static/admin.css",
    scriptPath: "/static/admin-dashboard.js",
    body: `
      <div class="admin-shell">
        <header class="admin-toolbar">
          <div class="admin-toolbar-left">
            <div class="admin-brand">CloudNote Admin</div>
            <div class="admin-badge">单管理员模式</div>
          </div>
          <div class="admin-toolbar-right">
            <button class="btn btn-small" id="importBtn">导入 JSON</button>
            <button class="btn btn-small" id="exportBtn">导出 JSON</button>
            <button class="btn btn-small btn-primary" id="logoutBtn">退出登录</button>
          </div>
        </header>
        <main class="admin-main">
          <section id="statsGrid" class="stats-grid"></section>
          <section class="controls-bar">
            <input id="searchInput" type="search" placeholder="搜索路径或正文片段">
            <div class="controls-actions">
              <button class="btn btn-small" id="refreshBtn">刷新列表</button>
              <button class="btn btn-small btn-primary" id="createBlankBtn">创建空白笔记</button>
            </div>
          </section>
          <section class="workspace">
            <div class="table-panel">
              <div class="panel-head">
                <h2>全部笔记</h2>
                <span id="tableCount">共 0 条</span>
              </div>
              <div id="notesTable" class="notes-table"></div>
            </div>
            <aside class="editor-panel">
              <div class="panel-head">
                <h2 id="editorTitle">选择一条笔记</h2>
                <button class="btn btn-small btn-danger" id="deleteBtn" disabled>删除笔记</button>
              </div>
              <div id="editorMeta" class="editor-meta"></div>
              <textarea id="adminEditor" placeholder="在这里编辑笔记内容"></textarea>
              <div class="editor-actions">
                <button class="btn btn-small" id="lockConfigBtn">锁定设置</button>
                <button class="btn btn-small btn-primary" id="saveAdminBtn">保存改动</button>
              </div>
            </aside>
          </section>
          <section class="logs-panel">
            <div class="panel-head">
              <h2>操作日志</h2>
              <span>最近 20 条后台操作</span>
            </div>
            <div id="logsList" class="logs-list"></div>
          </section>
        </main>
      </div>
    `
  });
}

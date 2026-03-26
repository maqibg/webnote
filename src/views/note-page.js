import { pageDocument } from "./shared.js";

function lockNotice(note) {
  if (!note.locked) {
    return "";
  }

  const button = note.canView ? "输入密码以编辑" : "输入密码";
  return `
    <div class="lock-notice${note.locked ? " show" : ""}" id="lockNotice">
      <span id="lockNoticeText">${note.lockMode === "edit" ? "此笔记已启用编辑锁定" : "此笔记已锁定"}</span>
      <button type="button" id="unlockTrigger">${button}</button>
    </div>
  `;
}

export function renderNotePage(noteView) {
  const content = noteView.canView ? noteView.renderedHtml : '<p class="placeholder-text">内容已锁定，输入密码后查看。</p>';
  const mode = noteView.canEdit ? "编辑" : "预览";

  return pageDocument({
    title: noteView.path,
    cssPath: "/static/note.css",
    scriptPath: "/static/note.js",
    inlineData: noteView,
    body: `
      <div id="app" class="app-shell">
        <header class="toolbar">
          <div class="toolbar-left">
            <a href="/" class="logo">CloudNote</a>
            <div class="path-info">/${noteView.path}</div>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-small" id="lockBtn">${noteView.locked ? "已锁定" : "未锁定"}</button>
            <button class="btn btn-small btn-primary" id="saveBtn">保存</button>
            <button class="btn btn-small" id="newBtn">新建</button>
          </div>
        </header>
        <main class="main-content">
          <div class="editor-container">
            ${lockNotice(noteView)}
            <div class="editor-shell">
              <div class="editor-mode-row">
                <div class="editor-title">${noteView.isBlank ? "未命名笔记" : noteView.path}</div>
                <div class="mode-badges">
                  <button class="mode-btn active" id="editTab">编辑</button>
                  <button class="mode-btn" id="previewTab">预览</button>
                </div>
              </div>
              <div class="editor-toolbar" id="editorToolbar"></div>
              <div class="editor-body">
                <div id="editorInput" class="editor-input" contenteditable="${noteView.canEdit ? "true" : "false"}">${content || ""}</div>
                <div id="previewPane" class="preview-pane" hidden>${content}</div>
              </div>
            </div>
          </div>
        </main>
        <footer class="status-bar">
          <div class="status-left">
            <div class="status-item"><span class="status-indicator" id="statusIndicator"></span><span id="statusText">就绪</span></div>
            <div class="status-item"><span id="viewCount">${noteView.viewCount}</span> 次查看</div>
            <div class="status-item">${mode}模式</div>
          </div>
          <div class="status-right"><span id="lastSaved">${noteView.lastSavedAt || "未保存"}</span></div>
        </footer>
      </div>
      <div class="modal" id="unlockModal" hidden>
        <div class="modal-card">
          <h3>输入密码</h3>
          <input id="unlockPassword" type="password" placeholder="请输入密码">
          <div class="modal-actions">
            <button type="button" class="btn btn-small" id="unlockCancel">取消</button>
            <button type="button" class="btn btn-small btn-primary" id="unlockSubmit">解锁</button>
          </div>
        </div>
      </div>
      <div class="modal" id="lockModal" hidden>
        <div class="modal-card">
          <h3>设置锁定</h3>
          <select id="lockMode">
            <option value="access">访问锁定</option>
            <option value="edit">编辑锁定</option>
          </select>
          <input id="lockPassword" type="password" placeholder="设置密码">
          <input id="lockHint" type="text" placeholder="锁定说明（未解锁不可见）">
          <div class="modal-actions">
            <button type="button" class="btn btn-small" id="lockCancel">取消</button>
            <button type="button" class="btn btn-small btn-primary" id="lockSubmit">保存锁定</button>
          </div>
        </div>
      </div>
    `
  });
}

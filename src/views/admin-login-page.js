import { pageDocument } from "./shared.js";

export function renderAdminLoginPage() {
  return pageDocument({
    title: "后台登录",
    cssPath: "/static/admin.css",
    scriptPath: "/static/admin-login.js",
    body: `
      <main class="login-page">
        <section class="login-card">
          <h1>CloudNote Admin</h1>
          <p>登录后台以管理全部笔记、导入导出数据并查看日志。</p>
          <form id="adminLoginForm" class="login-form">
            <label>管理员账号<input type="text" id="username" value="admin" autocomplete="username"></label>
            <label>管理密码<input type="password" id="password" autocomplete="current-password"></label>
            <button type="submit" class="btn btn-primary btn-block">登录后台</button>
          </form>
          <div id="loginMessage" class="login-message">生产环境请通过 Workers Secrets 配置后台凭据。</div>
        </section>
      </main>
    `
  });
}


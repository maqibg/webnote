# Webnote

`Webnote` 是一个只运行在 `Cloudflare Workers` 上的云端笔记应用。

已实现的核心能力：

- 动态路径笔记：任意合法路径都是笔记地址
- 根路径优先跳最近空白笔记，否则生成随机路径
- Markdown 编辑、预览、工具栏与 2 秒自动保存
- 访问锁定 / 编辑锁定
- JWT 后台认证
- `/admin` 登录页与 `/admin/dashboard` 管理后台
- 后台笔记列表、删除、直接修改、日志查看、JSON 导入导出
- D1 真相源 + KV 热点缓存 + Cache API 本地二级缓存

## 技术栈

- Cloudflare Workers
- Workers Static Assets
- D1
- Workers KV
- 原生 ESM JavaScript

## 目录

- `src/worker.js`: Worker 入口
- `src/lib/`: 安全、Markdown、HTTP、路径工具
- `src/services/`: 笔记、缓存、后台服务
- `src/views/`: 前台、后台、登录页模板
- `public/static/`: 前台与后台脚本、样式
- `migrations/0001_init.sql`: D1 初始化结构

## 生产初始化

### 1. 安装依赖

```powershell
npm install
```

### 2. 创建 D1 数据库

```powershell
npx wrangler d1 create webnote-db
```

把返回的 `database_id` 写回 [wrangler.jsonc](./wrangler.jsonc) 的 `d1_databases[0].database_id`。

### 3. 创建 KV 命名空间

```powershell
npx wrangler kv namespace create HOT_CACHE
```

把返回的 `id` 写回 [wrangler.jsonc](./wrangler.jsonc) 的 `kv_namespaces[0].id`。

### 4. 生成后台密码哈希

```powershell
npm run hash:admin -- "你的后台密码"
```

记录输出里的：

- `ADMIN_PASSWORD_SALT`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET_EXAMPLE`

### 5. 配置 Workers Secrets

```powershell
npx wrangler secret put ADMIN_PASSWORD_SALT
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put JWT_SECRET
```

如果你希望后台用户名不是默认的 `admin`，请直接修改 [wrangler.jsonc](./wrangler.jsonc) 里的 `ADMIN_USERNAME`。

### 6. 应用数据库迁移

```powershell
npx wrangler d1 migrations apply webnote-db --local
npx wrangler d1 migrations apply webnote-db --remote
```

### 7. 本地检查

```powershell
npm run check
```

### 8. 本地开发

```powershell
npm run dev
```

### 9. 部署

```powershell
npm run deploy
```

## 运行约束

- 保留路径：`admin`、`api`、`static`
- 仅允许字母数字路径
- 空白内容禁止保存
- 未解锁状态不显示锁定说明
- 后台搜索范围仅限路径和正文纯文本

## JSON 导出格式

导出接口：

```text
GET /api/admin/export
```

导出的 JSON 主体：

```json
{
  "exportedAt": "2026-03-22T12:00:00.000Z",
  "notes": [
    {
      "path": "abc123",
      "rawContent": "# hello",
      "renderedHtml": "<h1>hello</h1>",
      "viewCount": 12,
      "createdAt": "2026-03-22T12:00:00.000Z",
      "updatedAt": "2026-03-22T12:05:00.000Z",
      "lastSavedAt": "2026-03-22T12:05:00.000Z",
      "lockMode": "edit",
      "passwordHash": "base64url",
      "salt": "base64url",
      "hintText": ""
    }
  ]
}
```

导入接口：

```text
POST /api/admin/import
```

请求体直接提交同结构 JSON。

## 校验命令

```powershell
npm run check
```

它会做模块导入检查，覆盖 Worker、服务层和前后端脚本的语法与基础依赖链。

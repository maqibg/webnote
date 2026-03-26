import { SQL, all, first, run } from "../data/sql.js";
import { hashIp } from "../lib/security.js";
import { nowIso } from "../lib/time.js";

function mapSession(row) {
  return row ? { ...row } : null;
}

export async function createAdminSession(env, sessionId, jti, expiresAt, ip) {
  await run(env.DB, SQL.insertAdminSession, [
    sessionId,
    jti,
    nowIso(),
    expiresAt,
    await hashIp(ip)
  ]);
}

export async function findAdminSession(env, jti) {
  return mapSession(await first(env.DB, SQL.findAdminSession, [jti]));
}

export async function revokeAdminSession(env, jti) {
  await run(env.DB, SQL.revokeAdminSession, [nowIso(), jti]);
}

export async function insertAdminLog(env, action, targetPath, detail = {}) {
  await run(env.DB, SQL.insertAdminLog, [
    crypto.randomUUID(),
    action,
    targetPath || "",
    JSON.stringify(detail),
    nowIso()
  ]);
}

export async function listAdminLogs(env, limit = 20) {
  return all(env.DB, SQL.listAdminLogs, [limit]);
}

export async function buildDashboardStats(env) {
  const rows = await all(env.DB, `
    SELECT
      COUNT(*) AS totalNotes,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM note_locks l WHERE l.note_id = notes.id) THEN 1 ELSE 0 END) AS lockedNotes,
      SUM(view_count) AS totalViews,
      SUM(CASE WHEN date(updated_at) = date('now') THEN 1 ELSE 0 END) AS writtenToday
    FROM notes
  `);

  const stats = rows[0] || {};
  return {
    totalNotes: Number(stats.totalNotes || 0),
    lockedNotes: Number(stats.lockedNotes || 0),
    totalViews: Number(stats.totalViews || 0),
    writtenToday: Number(stats.writtenToday || 0)
  };
}

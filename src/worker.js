import { ADMIN_COOKIE, NOTE_UNLOCK_HEADER, VIEW_SESSION_COOKIE, getAppConfig } from "./config.js";
import { badRequest, clearCookie, clientIp, html, json, notFound, readCookie, redirect, setCookie, unauthorized } from "./lib/http.js";
import { validatePath } from "./lib/paths.js";
import { createJwt, createNoteUnlockToken, verifyJwt, verifyPassword } from "./lib/security.js";
import { toSqlLike } from "./lib/time.js";
import { clearHotNote, readEdgeCache, readHotNote, writeEdgeCache, writeHotNote } from "./services/cache-service.js";
import { buildDashboardStats, createAdminSession, findAdminSession, insertAdminLog, listAdminLogs, revokeAdminSession } from "./services/admin-service.js";
import { clearLock, createAdminBlankNote, deleteNote, getOrCreateLatestBlank, getOrCreateNoteByPath, importNote, incrementViewCount, listNotes, saveNote, setLock } from "./services/note-service.js";
import { renderAdminDashboardPage } from "./views/admin-dashboard-page.js";
import { renderAdminLoginPage } from "./views/admin-login-page.js";
import { renderNotePage } from "./views/note-page.js";

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function requireAdmin(request, env) {
  if (!env.JWT_SECRET) return null;
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return null;

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;

  const session = await findAdminSession(env, payload.jti);
  if (!session || session.revoked_at) return null;

  return payload;
}

async function resolveUnlockPayload(request, env) {
  if (!env.JWT_SECRET) return null;
  const token = request.headers.get(NOTE_UNLOCK_HEADER) || "";
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  return payload?.scope === "note_unlock" ? payload : null;
}

function buildNoteView(note, unlockPayload) {
  const locked = Boolean(note.lockMode);
  const accessLocked = note.lockMode === "access";
  const editLocked = note.lockMode === "edit";
  const unlocked = unlockPayload && unlockPayload.noteId === note.id;
  const canView = !accessLocked || unlocked;
  const canEdit = !locked || unlocked;

  return {
    path: note.path,
    rawContent: canView ? note.rawContent : "",
    renderedHtml: canView ? note.renderedHtml : "",
    viewCount: note.viewCount,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    lastSavedAt: note.lastSavedAt,
    lockMode: note.lockMode,
    hintText: unlocked ? note.hintText : "",
    locked,
    canView,
    canEdit,
    isBlank: note.isBlank,
    editLocked
  };
}

async function handleRoot(request, env, config) {
  const blankNote = await getOrCreateLatestBlank(env, config);
  const response = redirect(`/${blankNote.path}`);
  if (!readCookie(request, VIEW_SESSION_COOKIE)) {
    setCookie(response.headers, VIEW_SESSION_COOKIE, crypto.randomUUID(), {
      httpOnly: false,
      secure: new URL(request.url).protocol === "https:"
    });
  }
  return response;
}

async function handleNotePage(request, env, config, path) {
  const note = await getOrCreateNoteByPath(env, path);
  const unlockPayload = await resolveUnlockPayload(request, env);
  const noteView = buildNoteView(note, unlockPayload);
  const response = html(renderNotePage(noteView));
  if (!readCookie(request, VIEW_SESSION_COOKIE)) {
    setCookie(response.headers, VIEW_SESSION_COOKIE, crypto.randomUUID(), {
      httpOnly: false,
      secure: new URL(request.url).protocol === "https:"
    });
  }
  return response;
}

async function handleGetNote(request, env, config, path, adminPayload) {
  const unlockPayload = await resolveUnlockPayload(request, env);
  const allowCache = !unlockPayload && !adminPayload;

  if (allowCache) {
    const edge = await readEdgeCache(request);
    if (edge) return edge;
    const hot = await readHotNote(env, path);
    if (hot) return writeEdgeCache(request, hot);
  }

  const note = await getOrCreateNoteByPath(env, path);
  const noteView = buildNoteView(note, unlockPayload);
  if (!noteView.canView) {
    return json({ ok: true, note: noteView });
  }

  await writeHotNote(env, config, noteView);
  return allowCache ? writeEdgeCache(request, noteView) : json({ ok: true, note: noteView });
}

async function handleSaveNote(request, env, config, path) {
  const payload = await parseJson(request);
  if (!payload?.rawContent) return badRequest("Missing rawContent");
  const note = await getOrCreateNoteByPath(env, path);
  const unlockPayload = await resolveUnlockPayload(request, env);
  const locked = Boolean(note.lockMode);
  if (locked && unlockPayload?.noteId !== note.id) {
    return unauthorized("This note is locked");
  }
  const saved = await saveNote(env, note, payload.rawContent);
  await clearHotNote(env, request, path);
  return json({ ok: true, note: buildNoteView(saved, unlockPayload) });
}

async function handleSetLock(request, env, path) {
  if (!env.JWT_SECRET) return badRequest("JWT_SECRET is not configured");
  const payload = await parseJson(request);
  if (!payload?.mode || !payload?.password) return badRequest("Missing lock payload");
  const note = await getOrCreateNoteByPath(env, path);
  const unlockPayload = await resolveUnlockPayload(request, env);
  if (note.lockMode && unlockPayload?.noteId !== note.id) {
    return unauthorized("Edit permission required");
  }
  const locked = await setLock(env, note, payload.mode, payload.password, payload.hintText || "");
  await clearHotNote(env, request, path);
  return json({ ok: true, lockMode: locked.lockMode });
}

async function handleUnlock(request, env, path) {
  if (!env.JWT_SECRET) return badRequest("JWT_SECRET is not configured");
  const payload = await parseJson(request);
  if (!payload?.password) return badRequest("Missing password");
  const note = await getOrCreateNoteByPath(env, path);
  if (!note.lockMode) return json({ ok: true, unlockToken: "" });
  const matches = await verifyPassword(payload.password, note.salt, note.passwordHash);
  if (!matches) return unauthorized("Password is incorrect");
  const token = await createNoteUnlockToken(note.id, note.lockMode, env.JWT_SECRET);
  await clearHotNote(env, request, path);
  return json({ ok: true, unlockToken: token.token });
}

async function handleClearLock(request, env, path) {
  const note = await getOrCreateNoteByPath(env, path);
  const unlockPayload = await resolveUnlockPayload(request, env);
  if (unlockPayload?.noteId !== note.id) {
    return unauthorized("Unlock token required");
  }
  await clearLock(env, note.id);
  await clearHotNote(env, request, path);
  return json({ ok: true });
}

async function handleView(request, env, path, adminPayload) {
  if (!adminPayload) {
    const note = await getOrCreateNoteByPath(env, path);
    await incrementViewCount(env, note.id);
    await clearHotNote(env, request, path);
    return json({ ok: true, viewCount: note.viewCount + 1 });
  }
  return json({ ok: true, viewCount: 0 });
}

async function handleAdminLogin(request, env, config) {
  if (!env.JWT_SECRET || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT) {
    return badRequest("Admin secrets are not configured");
  }
  const payload = await parseJson(request);
  if (!payload?.username || !payload?.password) return badRequest("Missing login fields");
  if (payload.username !== config.adminUsername) return unauthorized("Login failed");
  const matches = await verifyPassword(payload.password, env.ADMIN_PASSWORD_SALT, env.ADMIN_PASSWORD_HASH);
  if (!matches) return unauthorized("Login failed");
  const sessionId = crypto.randomUUID();
  const jwt = await createJwt({ sub: config.adminUsername, role: "admin" }, env.JWT_SECRET, 60 * 60 * 8);
  await createAdminSession(env, sessionId, jwt.jti, jwt.expiresAt, clientIp(request));
  await insertAdminLog(env, "login", "", { username: config.adminUsername });
  const response = json({ ok: true });
  setCookie(response.headers, ADMIN_COOKIE, jwt.token, {
    maxAge: 60 * 60 * 8,
    secure: new URL(request.url).protocol === "https:"
  });
  return response;
}

async function handleAdminLogout(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin) await revokeAdminSession(env, admin.jti);
  const response = json({ ok: true });
  clearCookie(response.headers, ADMIN_COOKIE);
  return response;
}

async function handleAdminNotes(request, env) {
  const search = new URL(request.url).searchParams.get("search") || "";
  const notes = await listNotes(env, search ? toSqlLike(search) : "");
  return json({ ok: true, notes });
}

async function handleAdminPatch(request, env, path) {
  const payload = await parseJson(request);
  if (!payload?.rawContent) return badRequest("Missing rawContent");
  const note = await getOrCreateNoteByPath(env, path);
  const saved = await saveNote(env, note, payload.rawContent);
  await insertAdminLog(env, "save", path, { admin: true });
  await clearHotNote(env, request, path);
  return json({ ok: true, note: buildNoteView(saved, null) });
}

async function handleAdminDelete(request, env, path) {
  await deleteNote(env, path);
  await insertAdminLog(env, "delete", path, {});
  await clearHotNote(env, request, path);
  return json({ ok: true });
}

async function handleAdminExport(env) {
  const notes = await listNotes(env, "");
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), notes }, null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="webnote-export.json"`
    }
  });
}

async function handleAdminImport(request, env, config) {
  const payload = await parseJson(request);
  if (!payload?.notes || !Array.isArray(payload.notes)) return badRequest("Invalid import payload");
  for (const note of payload.notes) {
    if (!validatePath(note.path, config.pathMinLength, config.pathMaxLength)) {
      return badRequest(`Invalid imported path: ${note.path}`);
    }
    await importNote(env, note);
  }
  await insertAdminLog(env, "import", "", { count: payload.notes.length });
  return json({ ok: true, imported: payload.notes.length });
}

async function routeRequest(request, env) {
  const config = getAppConfig(env);
  const url = new URL(request.url);
  const { pathname } = url;
  const admin = await requireAdmin(request, env);

  if (pathname === "/") return handleRoot(request, env, config);
  if (pathname === "/admin") return admin ? redirect("/admin/dashboard") : html(renderAdminLoginPage());
  if (pathname === "/admin/dashboard") return admin ? html(renderAdminDashboardPage()) : redirect("/admin");
  if (pathname === "/api/admin/login" && request.method === "POST") return handleAdminLogin(request, env, config);
  if (pathname === "/api/admin/logout" && request.method === "POST") return handleAdminLogout(request, env);
  if (pathname.startsWith("/api/admin/") && !admin) return unauthorized("Admin login required");
  if (pathname === "/api/admin/stats" && admin) return json({ ok: true, stats: await buildDashboardStats(env) });
  if (pathname === "/api/admin/notes" && admin) return handleAdminNotes(request, env);
  if (pathname === "/api/admin/export" && admin) return handleAdminExport(env);
  if (pathname === "/api/admin/import" && admin && request.method === "POST") return handleAdminImport(request, env, config);
  if (pathname === "/api/admin/logs" && admin) return json({ ok: true, logs: await listAdminLogs(env) });
  if (pathname === "/api/admin/blank" && admin && request.method === "POST") {
    const note = await createAdminBlankNote(env, config);
    await insertAdminLog(env, "create_blank", note.path, {});
    return json({ ok: true, path: note.path });
  }

  const adminNoteMatch = pathname.match(/^\/api\/admin\/notes\/([A-Za-z0-9]+)$/);
  if (adminNoteMatch && admin && request.method === "PATCH") return handleAdminPatch(request, env, adminNoteMatch[1]);
  if (adminNoteMatch && admin && request.method === "DELETE") return handleAdminDelete(request, env, adminNoteMatch[1]);

  const noteApiMatch = pathname.match(/^\/api\/notes\/([A-Za-z0-9]+)(?:\/(view|lock|unlock))?$/);
  if (noteApiMatch) {
    const [, path, action] = noteApiMatch;
    if (!validatePath(path, config.pathMinLength, config.pathMaxLength)) return badRequest("Invalid path");
    if (!action && request.method === "GET") return handleGetNote(request, env, config, path, admin);
    if (!action && request.method === "PUT") return handleSaveNote(request, env, config, path);
    if (action === "view" && request.method === "POST") return handleView(request, env, path, admin);
    if (action === "lock" && request.method === "POST") return handleSetLock(request, env, path);
    if (action === "lock" && request.method === "DELETE") return handleClearLock(request, env, path);
    if (action === "unlock" && request.method === "POST") return handleUnlock(request, env, path);
  }

  if (pathname.startsWith("/static/")) return env.ASSETS.fetch(request);
  if (!validatePath(pathname.slice(1), config.pathMinLength, config.pathMaxLength)) return notFound();
  return handleNotePage(request, env, config, pathname.slice(1));
}

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      console.error(error);
      return json({ ok: false, error: "Internal Server Error" }, { status: 500 });
    }
  }
};

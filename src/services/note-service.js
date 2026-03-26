import { SQL, all, first, run } from "../data/sql.js";
import { isBlankContent, renderMarkdown, sanitizeRawInput } from "../lib/markdown.js";
import { randomPath } from "../lib/paths.js";
import { generateSalt, hashPassword } from "../lib/security.js";
import { nowIso } from "../lib/time.js";

function baseNote(path) {
  const timestamp = nowIso();
  return {
    id: crypto.randomUUID(),
    path,
    rawContent: "",
    sanitizedContent: "",
    renderedHtml: "",
    isBlank: 1,
    viewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSavedAt: null,
    lastViewedAt: null
  };
}

async function createBlankNote(env, path) {
  const note = baseNote(path);
  await run(env.DB, SQL.insertNote, [
    note.id,
    note.path,
    note.rawContent,
    note.sanitizedContent,
    note.renderedHtml,
    note.isBlank,
    note.viewCount,
    note.createdAt,
    note.updatedAt,
    note.lastSavedAt,
    note.lastViewedAt
  ]);
  return note;
}

function mapNoteRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    path: row.path,
    rawContent: row.raw_content,
    sanitizedContent: row.sanitized_content,
    renderedHtml: row.rendered_html,
    isBlank: Boolean(row.is_blank),
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSavedAt: row.last_saved_at,
    lastViewedAt: row.last_viewed_at,
    lockMode: row.lock_mode || "",
    passwordHash: row.password_hash || "",
    salt: row.salt || "",
    hintText: row.hint_text || ""
  };
}

export async function getOrCreateLatestBlank(env, config) {
  const existing = mapNoteRow(await first(env.DB, SQL.findLatestBlank));
  if (existing) {
    return existing;
  }

  const targetLength = Math.max(config.pathMinLength, Math.min(config.pathMaxLength, 8));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const path = randomPath(targetLength);

    try {
      return await createBlankNote(env, path);
    } catch (error) {
      if (!String(error.message || "").includes("UNIQUE")) {
        throw error;
      }
    }
  }

  throw new Error("Could not create a blank note");
}

export async function getOrCreateNoteByPath(env, path) {
  const found = mapNoteRow(await first(env.DB, SQL.findNoteByPath, [path]));
  if (found) {
    return found;
  }

  return createBlankNote(env, path);
}

export async function saveNote(env, note, rawContent) {
  if (isBlankContent(rawContent)) {
    throw new Error("Empty content is not allowed");
  }

  const sanitizedContent = sanitizeRawInput(rawContent);
  const renderedHtml = renderMarkdown(sanitizedContent);
  const timestamp = nowIso();

  await run(env.DB, SQL.updateNoteContent, [
    rawContent,
    sanitizedContent,
    renderedHtml,
    timestamp,
    timestamp,
    note.id
  ]);

  return {
    ...note,
    rawContent,
    sanitizedContent,
    renderedHtml,
    isBlank: false,
    updatedAt: timestamp,
    lastSavedAt: timestamp
  };
}

export async function incrementViewCount(env, noteId) {
  const timestamp = nowIso();
  await run(env.DB, SQL.incrementViewCount, [timestamp, timestamp, noteId]);
}

export async function setLock(env, note, mode, password, hintText) {
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const timestamp = nowIso();

  await run(env.DB, SQL.upsertLock, [
    note.id,
    mode,
    passwordHash,
    salt,
    hintText || "",
    timestamp
  ]);

  return { ...note, lockMode: mode, passwordHash, salt, hintText: hintText || "" };
}

export async function clearLock(env, noteId) {
  await run(env.DB, SQL.deleteLock, [noteId]);
}

export async function deleteNote(env, path) {
  await run(env.DB, SQL.deleteNote, [path]);
}

export async function importNote(env, note) {
  await run(env.DB, SQL.importNote, [
    note.id || crypto.randomUUID(),
    note.path,
    note.rawContent || "",
    note.sanitizedContent || sanitizeRawInput(note.rawContent || ""),
    note.renderedHtml || renderMarkdown(note.rawContent || ""),
    note.isBlank ? 1 : 0,
    note.viewCount || 0,
    note.createdAt || nowIso(),
    note.updatedAt || nowIso(),
    note.lastSavedAt || null,
    note.lastViewedAt || null
  ]);

  const imported = await getOrCreateNoteByPath(env, note.path);
  if (note.lockMode && note.passwordHash && note.salt) {
    await run(env.DB, SQL.upsertLock, [
      imported.id,
      note.lockMode,
      note.passwordHash,
      note.salt,
      note.hintText || "",
      note.updatedAt || nowIso()
    ]);
  }
}

export async function createAdminBlankNote(env, config) {
  const targetLength = Math.max(config.pathMinLength, Math.min(config.pathMaxLength, 8));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const path = randomPath(targetLength);
    try {
      return await createBlankNote(env, path);
    } catch (error) {
      if (!String(error.message || "").includes("UNIQUE")) {
        throw error;
      }
    }
  }

  throw new Error("Could not create a blank note");
}

export async function listNotes(env, searchTerm = "") {
  const filters = [];
  const bindings = [];
  let sql = `
    SELECT n.*, l.lock_mode, l.password_hash, l.salt, l.hint_text
    FROM notes n
    LEFT JOIN note_locks l ON l.note_id = n.id
  `;

  if (searchTerm) {
    filters.push("(n.path LIKE ? ESCAPE '\\' OR n.sanitized_content LIKE ? ESCAPE '\\')");
    bindings.push(searchTerm, searchTerm);
  }

  if (filters.length) {
    sql += ` WHERE ${filters.join(" AND ")}`;
  }

  sql += " ORDER BY n.updated_at DESC LIMIT 200";

  const rows = await all(env.DB, sql, bindings);
  return rows.map(mapNoteRow);
}

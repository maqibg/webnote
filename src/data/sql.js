export const SQL = {
  findLatestBlank: `
    SELECT * FROM notes
    WHERE is_blank = 1
    ORDER BY created_at DESC
    LIMIT 1
  `,
  findNoteByPath: `
    SELECT n.*, l.lock_mode, l.password_hash, l.salt, l.hint_text
    FROM notes n
    LEFT JOIN note_locks l ON l.note_id = n.id
    WHERE n.path = ?
    LIMIT 1
  `,
  insertNote: `
    INSERT INTO notes (
      id, path, raw_content, sanitized_content, rendered_html,
      is_blank, view_count, created_at, updated_at, last_saved_at, last_viewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  importNote: `
    INSERT INTO notes (
      id, path, raw_content, sanitized_content, rendered_html,
      is_blank, view_count, created_at, updated_at, last_saved_at, last_viewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      raw_content = excluded.raw_content,
      sanitized_content = excluded.sanitized_content,
      rendered_html = excluded.rendered_html,
      is_blank = excluded.is_blank,
      view_count = excluded.view_count,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_saved_at = excluded.last_saved_at,
      last_viewed_at = excluded.last_viewed_at
  `,
  updateNoteContent: `
    UPDATE notes
    SET raw_content = ?, sanitized_content = ?, rendered_html = ?,
        is_blank = 0, updated_at = ?, last_saved_at = ?
    WHERE id = ?
  `,
  incrementViewCount: `
    UPDATE notes
    SET view_count = view_count + 1, updated_at = ?, last_viewed_at = ?
    WHERE id = ?
  `,
  deleteNote: `DELETE FROM notes WHERE path = ?`,
  upsertLock: `
    INSERT INTO note_locks (note_id, lock_mode, password_hash, salt, hint_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(note_id) DO UPDATE SET
      lock_mode = excluded.lock_mode,
      password_hash = excluded.password_hash,
      salt = excluded.salt,
      hint_text = excluded.hint_text,
      updated_at = excluded.updated_at
  `,
  deleteLock: `DELETE FROM note_locks WHERE note_id = ?`,
  insertAdminSession: `
    INSERT INTO admin_sessions (session_id, jwt_jti, created_at, expires_at, revoked_at, ip_hash)
    VALUES (?, ?, ?, ?, NULL, ?)
  `,
  findAdminSession: `
    SELECT * FROM admin_sessions
    WHERE jwt_jti = ?
    LIMIT 1
  `,
  revokeAdminSession: `
    UPDATE admin_sessions
    SET revoked_at = ?
    WHERE jwt_jti = ?
  `,
  insertAdminLog: `
    INSERT INTO admin_logs (id, action, target_path, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  listAdminLogs: `
    SELECT * FROM admin_logs
    ORDER BY created_at DESC
    LIMIT ?
  `
};

export async function first(db, sql, bindings = []) {
  return db.prepare(sql).bind(...bindings).first();
}

export async function all(db, sql, bindings = []) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return result.results || [];
}

export async function run(db, sql, bindings = []) {
  return db.prepare(sql).bind(...bindings).run();
}

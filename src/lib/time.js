export function nowIso() {
  return new Date().toISOString();
}

export function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

export function toSqlLike(text) {
  return `%${text.replace(/[%_]/g, "\\$&")}%`;
}


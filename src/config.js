export const RESERVED_PATHS = new Set(["admin", "api", "static"]);
export const NOTE_UNLOCK_HEADER = "x-note-unlock-token";
export const ADMIN_COOKIE = "cn_admin";
export const VIEW_SESSION_COOKIE = "cn_view_sid";

function readInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAppConfig(env) {
  return {
    pathMinLength: readInt(env.PATH_MIN_LENGTH, 1),
    pathMaxLength: readInt(env.PATH_MAX_LENGTH, 32),
    hotCacheThreshold: readInt(env.HOT_CACHE_THRESHOLD, 10),
    hotCacheTtlLow: readInt(env.HOT_CACHE_TTL_LOW, 300),
    hotCacheTtlMid: readInt(env.HOT_CACHE_TTL_MID, 1800),
    hotCacheTtlHigh: readInt(env.HOT_CACHE_TTL_HIGH, 7200),
    viewDedupeSeconds: readInt(env.VIEW_DEDUPE_SECONDS, 60),
    adminUsername: env.ADMIN_USERNAME || "admin"
  };
}

export function resolveHotCacheTtl(viewCount, config) {
  if (viewCount >= 200) {
    return config.hotCacheTtlHigh;
  }

  if (viewCount >= 50) {
    return config.hotCacheTtlMid;
  }

  return config.hotCacheTtlLow;
}

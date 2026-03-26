import { resolveHotCacheTtl } from "../config.js";
import { json } from "../lib/http.js";

function cacheKey(path) {
  return `note:hot:${path}`;
}

export async function readHotNote(env, path) {
  const value = await env.HOT_CACHE.get(cacheKey(path), { type: "json" });
  return value || null;
}

export async function writeHotNote(env, config, noteView) {
  if (noteView.viewCount < config.hotCacheThreshold) {
    return;
  }

  const ttl = resolveHotCacheTtl(noteView.viewCount, config);
  await env.HOT_CACHE.put(cacheKey(noteView.path), JSON.stringify(noteView), {
    expirationTtl: ttl
  });
}

export async function clearHotNote(env, request, path) {
  await env.HOT_CACHE.delete(cacheKey(path));
  const url = new URL(request.url);
  url.pathname = `/api/notes/${path}`;
  await caches.default.delete(new Request(url.toString(), { method: "GET" }));
}

export async function readEdgeCache(request) {
  return caches.default.match(new Request(request.url, { method: "GET" }));
}

export async function writeEdgeCache(request, noteView) {
  const response = json({ ok: true, note: noteView });
  response.headers.set("cache-control", "public, max-age=60");
  await caches.default.put(new Request(request.url, { method: "GET" }), response.clone());
  return response;
}

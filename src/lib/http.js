function encodeCookieValue(value) {
  return encodeURIComponent(value);
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(markup, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(markup, { ...init, headers });
}

export function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: { location }
  });
}

export function badRequest(message, extras = {}) {
  return json({ ok: false, error: message, ...extras }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return json({ ok: false, error: message }, { status: 401 });
}

export function notFound(message = "Not found") {
  return json({ ok: false, error: message }, { status: 404 });
}

export function setCookie(headers, name, value, options = {}) {
  const parts = [`${name}=${encodeCookieValue(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.secure !== false) {
    parts.push("Secure");
  }

  headers.append("set-cookie", parts.join("; "));
}

export function clearCookie(headers, name, options = {}) {
  setCookie(headers, name, "", { ...options, maxAge: 0 });
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  const segments = cookieHeader.split(/;\s*/);

  for (const segment of segments) {
    const [cookieName, ...rest] = segment.split("=");
    if (cookieName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return "";
}

export function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "";
}


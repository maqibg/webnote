const PATH_PATTERN = /^[a-zA-Z0-9]+$/;

export function isReservedPath(path) {
  return path === "admin" || path === "api" || path === "static";
}

export function normalizePath(value) {
  return (value || "").trim();
}

export function validatePath(path, minLength, maxLength) {
  if (!path) {
    return false;
  }

  if (isReservedPath(path)) {
    return false;
  }

  if (!PATH_PATTERN.test(path)) {
    return false;
  }

  return path.length >= minLength && path.length <= maxLength;
}

export function randomPath(length) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";

  for (let index = 0; index < length; index += 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length;
    value += alphabet[random];
  }

  return value;
}

export function stripInvisibleText(text) {
  return text.replace(/[\s\u200B-\u200D\uFEFF]/g, "");
}


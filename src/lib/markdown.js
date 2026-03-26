import { stripInvisibleText } from "./paths.js";

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeRawInput(value) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(javascript:|vbscript:)/gi, " $1=$2");
}

function renderInline(value) {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderMarkdown(rawValue) {
  const sanitized = sanitizeRawInput(rawValue);
  if (/<[a-z][\s\S]*>/i.test(sanitized)) {
    return sanitizeRenderedHtml(sanitized);
  }
  const escaped = escapeHtml(sanitized);
  const lines = escaped.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inOrderedList = false;
  let inCodeBlock = false;

  const closeLists = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (inOrderedList) {
      html.push("</ol>");
      inOrderedList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      closeLists();
      html.push(inCodeBlock ? "</pre>" : "<pre>");
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      html.push(`${line}\n`);
      continue;
    }

    if (!stripInvisibleText(line)) {
      closeLists();
      html.push("");
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      closeLists();
      const level = line.match(/^#+/)[0].length;
      html.push(`<h${level}>${renderInline(line.slice(level + 1))}</h${level}>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (!inOrderedList) {
        closeLists();
        html.push("<ol>");
        inOrderedList = true;
      }
      html.push(`<li>${renderInline(line.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    }

    if (/^-\s/.test(line)) {
      if (!inList) {
        closeLists();
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }

    closeLists();

    if (/^>\s/.test(line)) {
      html.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`);
      continue;
    }

    html.push(`<p>${renderInline(line)}</p>`);
  }

  closeLists();
  if (inCodeBlock) {
    html.push("</pre>");
  }

  return sanitizeRenderedHtml(html.join(""));
}

export function sanitizeRenderedHtml(value) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\sstyle\s*=\s*(['"])(?![^'"]*(color|background-color|text-align))[^'"]*\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(javascript:|vbscript:)/gi, " $1=$2")
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, "");
}

export function isBlankContent(value) {
  const withoutTags = sanitizeRawInput(value).replace(/<[^>]+>/g, "");
  return stripInvisibleText(withoutTags) === "";
}

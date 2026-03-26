function shellTitle(title) {
  return `${title} - CloudNote`;
}

export function pageDocument({ title, body, scriptPath, cssPath, inlineData }) {
  const serialized = inlineData
    ? `<script id="__APP_DATA__" type="application/json">${JSON.stringify(inlineData)}</script>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${shellTitle(title)}</title>
    <link rel="stylesheet" href="${cssPath}">
  </head>
  <body>
    ${body}
    ${serialized}
    <script type="module" src="${scriptPath}"></script>
  </body>
</html>`;
}


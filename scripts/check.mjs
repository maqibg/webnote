const modules = [
  "../src/config.js",
  "../src/lib/http.js",
  "../src/lib/paths.js",
  "../src/lib/security.js",
  "../src/lib/markdown.js",
  "../src/services/cache-service.js",
  "../src/services/note-service.js",
  "../src/services/admin-service.js",
  "../src/views/note-page.js",
  "../src/views/admin-login-page.js",
  "../src/views/admin-dashboard-page.js",
  "../src/worker.js",
  "../public/static/note.js",
  "../public/static/admin-login.js",
  "../public/static/admin-dashboard.js"
];

for (const mod of modules) {
  await import(mod);
}

console.log("Module imports passed");

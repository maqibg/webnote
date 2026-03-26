async function login(event) {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "登录失败");
    }
    window.location.href = "/admin/dashboard";
  } catch (error) {
    message.textContent = error.message;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("adminLoginForm").addEventListener("submit", login);
  }, { once: true });
}


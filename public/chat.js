(function () {
  var API_CHAT = "/api/chat";
  var API_HEALTH = "/api/health";

  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var log = document.getElementById("chat-log");
  var sendBtn = document.getElementById("chat-send");
  var busyEl = document.getElementById("chat-busy");
  var statusEl = document.getElementById("api-status");

  if (!form || !input || !log || !sendBtn) return;

  var messages = [];

  function formatDetail(detail) {
    if (detail == null) return "Something went wrong.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map(function (x) {
          return x.msg || JSON.stringify(x);
        })
        .join(" ");
    }
    return String(detail);
  }

  function appendMessage(role, text, isError) {
    var wrap = document.createElement("div");
    wrap.className = "msg " + (role === "user" ? "msg-user" : "msg-agent");
    if (isError) wrap.classList.add("msg-error");

    var bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);

    var label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "You" : isError ? "Error" : "Tutor";
    wrap.insertBefore(label, bubble);

    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function setLoading(on) {
    sendBtn.disabled = on;
    input.disabled = on;
    if (busyEl) busyEl.textContent = on ? "Tutor is thinking." : "";
  }

  fetch(API_HEALTH)
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (!statusEl) return;
      if (data && data.api_key_configured) {
        statusEl.textContent = "Model: " + (data.model || "gemini-2.5-flash") + " · API ready";
        statusEl.classList.remove("chat-api-status--bad");
      } else {
        statusEl.textContent =
          "API key not configured. Copy .env.example to .env and set GEMINI_API_KEY, then restart the server.";
        statusEl.classList.add("chat-api-status--bad");
      }
    })
    .catch(function () {
      if (statusEl) {
        statusEl.textContent =
          "Cannot reach /api/health. Serve the site with uvicorn (see app.py), not as a file:// page.";
        statusEl.classList.add("chat-api-status--bad");
      }
    });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = (input.value || "").trim();
    if (!text) return;

    appendMessage("user", text);
    messages.push({ role: "user", text: text });
    input.value = "";
    setLoading(true);

    fetch(API_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(formatDetail(data.detail) || r.statusText);
          return data;
        });
      })
      .then(function (data) {
        var reply = (data && data.text) || "";
        messages.push({ role: "assistant", text: reply });
        appendMessage("assistant", reply);
      })
      .catch(function (err) {
        appendMessage("assistant", err.message || "Request failed.", true);
      })
      .finally(function () {
        setLoading(false);
        input.focus();
      });
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
})();

(function () {
  const cfg = window.INTAKE_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // Opens the flow's Start Link in a modal when any .js-start-matter is clicked
  function bindStartLink(url) {
    const modal = $("flow-modal");
    const frame = $("flow-frame");
    const open = (e) => {
      e.preventDefault();
      if (!frame.src) frame.src = url;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      modal.hidden = true;
      document.body.style.overflow = "";
    };
    document.querySelectorAll(".js-start-matter").forEach((b) => b.addEventListener("click", open));
    modal.querySelector(".modal-close").addEventListener("click", close);
    modal.addEventListener("click", (e) => e.target === modal && close());
    document.addEventListener("keydown", (e) => e.key === "Escape" && !modal.hidden && close());
    window.addEventListener("message", (e) => {
      if (e.source === frame.contentWindow && e.data && e.data.type === "moxo:launcher:close") close();
    });
  }

  // ── Launcher mode: our buttons open the Moxo Flow Launcher ──
  if (cfg.mode !== "webhook") {
    if (cfg.startLinkUrl) {
      $("launcher").hidden = false;
      bindStartLink(cfg.startLinkUrl);
      return;
    }
    if (!cfg.launcherKey) {
      $("launcher-missing").hidden = false;
      return;
    }
    $("launcher").hidden = false;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://app.moxo.com/moxo-launcher.js";
    s.setAttribute("data-moxo-launcher-key", cfg.launcherKey);
    s.setAttribute("data-moxo-launcher-style", "button");
    // Bind to the site's own buttons instead of injecting Moxo's default one
    s.setAttribute("data-moxo-launcher-trigger", ".js-start-matter");
    if (cfg.launcherThemeColor) s.setAttribute("data-moxo-launcher-theme-color", cfg.launcherThemeColor);
    document.body.appendChild(s);
    return;
  }

  // ── Webhook mode: our own form → /api/intake → Moxo webhook trigger ──
  const form = $("intake-form");
  form.hidden = false;

  const syncClientType = () => {
    const isOrg = form.client_type.value === "Organization";
    form.querySelectorAll(".org-only").forEach((el) => (el.hidden = !isOrg));
  };
  form.querySelectorAll('[name="client_type"]').forEach((r) => r.addEventListener("change", syncClientType));
  syncClientType();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("form-error");
    err.hidden = true;

    let firstBad = null;
    form.querySelectorAll("[required]").forEach((el) => {
      if (el.closest("[hidden]")) return;
      const bad = el.type === "checkbox" ? !el.checked : !el.checkValidity() || !el.value.trim();
      el.classList.toggle("invalid", bad);
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) {
      err.textContent = "Please complete the highlighted fields.";
      err.hidden = false;
      firstBad.focus();
      return;
    }

    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = typeof v === "string" ? v.trim() : v));
    data.existing_client = data.existing_client ? "Yes" : "No";
    delete data.consent;

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Opening your secure portal…";
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      form.hidden = true;
      $("success-email").textContent = data.client_email;
      if (body.flowId) $("success-ref").textContent = `Reference: ${body.flowId}`;
      $("form-success").hidden = false;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit & open my secure portal";
    }
  });
})();

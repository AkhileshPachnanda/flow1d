(function () {
  const cfg = window.INTAKE_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // Shared modal: opens a flow's Start Link in an iframe
  const modal = $("flow-modal");
  const frame = $("flow-frame");
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  };
  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => e.target === modal && close());
  document.addEventListener("keydown", (e) => e.key === "Escape" && !modal.hidden && close());
  window.addEventListener("message", (e) => {
    if (e.source === frame.contentWindow && e.data && e.data.type === "moxo:launcher:close") close();
  });

  // Every element matching `selector` opens `url` in the modal
  function bindStartLink(selector, url) {
    const open = (e) => {
      e.preventDefault();
      if (frame.getAttribute("src") !== url) frame.src = url;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    };
    document.querySelectorAll(selector).forEach((b) => b.addEventListener("click", open));
  }

  // ── Flow 2: Multi-State Regulatory Compliance (.js-start-compliance) ──
  if ($("launcher-compliance")) {
    if (cfg.complianceStartLinkUrl) {
      $("launcher-compliance").hidden = false;
      bindStartLink(".js-start-compliance", cfg.complianceStartLinkUrl);
    } else {
      $("launcher-compliance-missing").hidden = false;
    }
  }
  if (!$("launcher")) return; // page has no Flow 1 panel

  // ── Flow 1: Client intake (.js-start-matter) ──
  // ── Launcher mode: our buttons open the Moxo Flow Launcher ──
  if (cfg.mode !== "webhook") {
    if (cfg.startLinkUrl) {
      $("launcher").hidden = false;
      bindStartLink(".js-start-matter", cfg.startLinkUrl);
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

// ─────────────────────────────────────────────────────────────
//  Demo configuration — edit this file only.
// ─────────────────────────────────────────────────────────────
window.INTAKE_CONFIG = {
  // "launcher" → site buttons open the Moxo Flow Launcher (no backend needed)
  // "webhook"  → shows the firm's own intake form, which POSTs to /api/intake
  //              (server.py forwards it to the Moxo webhook trigger)
  mode: "launcher",

  // Start Link of the flow to launch. When set, site buttons open this exact flow
  // in a popup. Leave blank to fall back to the Flow Launcher (launcherKey) below.
  startLinkUrl: "https://app.moxo.com/embed/b70b517b-67a1-4e9f-8da8-e8c9879ff670",

  // Start Link for Flow 2 — Multi-State Regulatory Compliance (regulatory.html)
  complianceStartLinkUrl: "https://app.moxo.com/embed/d30b0337-b802-432d-86b3-3a6dc561b01d",

  // Moxo Flow Launcher public key (from the launcher embed snippet)
  launcherKey: "mxo_launcher__ywCae-5oRHgdfAJqYZQJAFJODVNfSjHkLUK922Tkzc",

  // Optional: accent colour for the launcher window
  launcherThemeColor: "#b08d57",
};

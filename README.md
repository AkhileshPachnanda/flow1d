# Calder & Vance LLP: Moxo Legal Flow 1 demo

Demo law-firm website (fictional firm) whose "Start a Matter" section starts the
**Legal Flow 1: Client Intake & Matter Opening** flow in Moxo.

## Run

```bash
python3 server.py        # → http://localhost:3000
```

## Choose how the flow is triggered (`config.js`)

### A) `mode: "launcher"` (default, no backend)
1. In Moxo: flow template → Template Settings → Start Modes → enable **Start Link / Flow Launcher (embed)**.
2. Add your demo site's origin to the allowlist (for example `http://localhost:3000`).
3. Paste the launcher URL into `config.js` → `launcherUrl`.

The launcher is embedded in the intake section. The visitor fills in Moxo's start form, verifies their email and lands in the flow.

### B) `mode: "webhook"` (the firm's own branded form)
1. In Moxo: Template Settings → Start Modes → **Webhook**. Copy the URL and the token or key.
2. `cp .env.example .env` and fill in `MOXO_WEBHOOK_URL` (plus `MOXO_WEBHOOK_API_KEY` if you use key auth).
3. Set `ROLE_CLIENT` (and optionally `ROLE_SIGNATORY` / `ROLE_FINANCE`) to the role names **exactly** as they appear in the template.
4. In `server.py`, edit `FIELD_MAP` so its values match your template's start-form field keys.
   If a key is unknown, Moxo returns a 400 that lists the valid names, and `server.py` prints it in the console.

If `MOXO_WEBHOOK_URL` isn't set, the server runs in **dry-run** mode: it prints the payload it would send and shows the success screen.

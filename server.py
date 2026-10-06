#!/usr/bin/env python3
"""Zero-dependency demo server: serves the site and forwards intake
submissions to the Moxo webhook trigger (keeps the secret server-side).
Run: python3 server.py
"""
import hashlib, hmac, json, os, re, sys, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

sys.stdout.reconfigure(line_buffering=True)
ROOT = os.path.dirname(os.path.abspath(__file__))

# Minimal .env loader
env_file = os.path.join(ROOT, ".env")
if os.path.exists(env_file):
    for line in open(env_file):
        m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip("\"'")

PORT = int(os.environ.get("PORT", 3000))
WEBHOOK_URL = os.environ.get("MOXO_WEBHOOK_URL", "")  # full URL incl. path token, or base URL with API key
WEBHOOK_API_KEY = os.environ.get("MOXO_WEBHOOK_API_KEY", "")  # optional: sent as X-API-Key
EVENTS_SECRET = os.environ.get("MOXO_EVENTS_SECRET", "")  # Secret from the template's Outgoing Webhooks endpoint
ROLE_CLIENT = os.environ.get("ROLE_CLIENT", "Client")
ROLE_SIGNATORY = os.environ.get("ROLE_SIGNATORY", "")  # e.g. "Client Authorized Signatory"
ROLE_FINANCE = os.environ.get("ROLE_FINANCE", "")  # e.g. "Client Finance Contact"

# Form field -> Moxo start-form field key. Edit to match the field keys in your template.
FIELD_MAP = {
    "client_type": "Client Type",
    "client_name": "Client Name",
    "client_email": "Client Email",
    "client_phone": "Phone",
    "client_title": "Title",
    "company_name": "Company Name",
    "existing_client": "Existing Client",
    "practice_area": "Practice Area",
    "urgency": "Urgency",
    "matter_description": "Matter Description",
    "adverse_parties": "Other Parties Involved",
    "jurisdiction": "Jurisdiction",
    "budget": "Estimated Budget",
    "signatory_name": "Signatory Name",
    "signatory_email": "Signatory Email",
    "finance_name": "Finance Contact Name",
    "finance_email": "Finance Contact Email",
}

PUBLIC = {"/index.html", "/regulatory.html", "/styles.css", "/app.js", "/config.js"}


def build_payload(d):
    client = {"email": d["client_email"], "name": d["client_name"]}
    roles = {ROLE_CLIENT: client}
    for role, prefix in ((ROLE_SIGNATORY, "signatory"), (ROLE_FINANCE, "finance")):
        if role:
            email = d.get(f"{prefix}_email")
            roles[role] = {"email": email, "name": d.get(f"{prefix}_name") or email} if email else client
    fields = {key: d[k] for k, key in FIELD_MAP.items() if d.get(k)}
    who = d.get("company_name") or d["client_name"]
    return {"name": f"Intake – {who} – {d['practice_area']}", "roleAssignments": roles, "fieldValues": fields}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def send_json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            path = "/index.html"
        if path not in PUBLIC:  # never serve .env, server.py, etc.
            return self.send_error(404)
        self.path = path
        return super().do_GET()

    def do_HEAD(self):
        return self.do_GET()

    def handle_moxo_event(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 1_000_000:
            return self.send_json(413, {"error": "Payload too large"})
        raw = self.rfile.read(length)
        if EVENTS_SECRET:
            expected = hmac.new(EVENTS_SECRET.encode(), raw, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, self.headers.get("X-Webhook-Signature", "")):
                print("[moxo-event] rejected: bad signature")
                return self.send_json(401, {"error": "Invalid signature"})
        try:
            ev = json.loads(raw or b"{}")
        except ValueError:
            return self.send_json(400, {"error": "Invalid JSON"})
        flow, step = ev.get("flow") or {}, ev.get("step") or {}
        print(f"[moxo-event] {ev.get('event')} flow={flow.get('name')!r} ({flow.get('status')})"
              + (f" step={step.get('name')!r}" if step else "") + f" id={self.headers.get('X-Webhook-Id')}")
        return self.send_json(200, {"ok": True})

    def do_POST(self):
        if self.path.split("?")[0] == "/api/moxo-events":
            return self.handle_moxo_event()
        if self.path.split("?")[0] != "/api/intake":
            return self.send_error(404)
        length = int(self.headers.get("Content-Length") or 0)
        if length > 100_000:
            return self.send_json(413, {"error": "Payload too large"})
        try:
            d = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self.send_json(400, {"error": "Invalid JSON"})
        if not (d.get("client_name") and re.match(r"^\S+@\S+\.\S+$", d.get("client_email") or "")
                and d.get("practice_area") and d.get("matter_description")):
            return self.send_json(400, {"error": "Name, a valid email, practice area and description are required."})

        payload = build_payload(d)
        if not WEBHOOK_URL:
            print("[dry-run] MOXO_WEBHOOK_URL not set. Would send:\n" + json.dumps(payload, indent=2, ensure_ascii=False))
            return self.send_json(200, {"flowId": "DRY-RUN", "dryRun": True})

        headers = {"Content-Type": "application/json"}
        if WEBHOOK_API_KEY:
            headers["X-API-Key"] = WEBHOOK_API_KEY
        req = urllib.request.Request(WEBHOOK_URL, data=json.dumps(payload).encode(), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                text = r.read().decode()
                print(f"[moxo] {r.status} {text[:500]}")
        except urllib.error.HTTPError as e:
            print(f"[moxo] {e.code} {e.read().decode()[:500]}")
            return self.send_json(502, {"error": "We couldn't open your intake right now. Please try again shortly."})
        except Exception as e:
            print(f"[moxo] request failed: {e}")
            return self.send_json(502, {"error": "We couldn't reach our client portal. Please try again shortly."})
        try:
            body = json.loads(text)
        except ValueError:
            body = {}
        flow_id = (body.get("data") or {}).get("flowId") or body.get("flowId")
        return self.send_json(200, {"flowId": flow_id})


if __name__ == "__main__":
    note = "" if WEBHOOK_URL else "  (dry-run: MOXO_WEBHOOK_URL not set)"
    print(f"Calder & Vance demo → http://localhost:{PORT}{note}")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()

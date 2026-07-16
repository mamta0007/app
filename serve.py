"""
Tiny static file server for the Redline frontend — with SPA fallback.

Normal `python -m http.server` only serves files that actually exist
on disk. Since the backend emails links like:
  http://192.168.1.26:5500/activate?token=...
  http://192.168.1.26:5500/reset-password?token=...
...and there's no real "activate" or "reset-password" file, that
would normally 404.

This server fixes that: if the requested path isn't a real file,
it just serves index.html instead (index.html + app.js figure out
what to show based on the URL). That means you only need ONE
index.html — no /activate or /reset-password folders required.

USAGE:
    python serve.py
    (then open http://<host>:5500)

To use a different port:
    python serve.py 8080
"""

import http.server
import os
import sys
from dotenv import load_dotenv

load_dotenv()


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def address_string(self):
        return self.client_address[0]

    def send_head(self):
        path_only = self.path.split("?", 1)[0]
        fs_path = self.translate_path(path_only)

        if not os.path.exists(fs_path):
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            self.path = "/index.html" + (("?" + query) if query else "")

        return super().send_head()


if __name__ == "__main__":
    base = os.getenv("BASE_URL", "http://localhost")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500

    server = http.server.HTTPServer(("", port), SPARequestHandler)

    base_host = base.replace("http://", "").replace("https://", "")

    print(f"Serving Redline frontend at http://{base_host}:{port}")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
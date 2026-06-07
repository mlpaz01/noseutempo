from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import request, error
import sys


BASE = Path(__file__).parent
ROOT = BASE / "apps" / "site"
if not ROOT.exists():
    ROOT = BASE / "home" / "user_1" / "htdocs" / "noseutempo.app"
API_BASE = "https://api.noseutempo.app"


class LocalProxy(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.proxy()
            return
        super().do_POST()

    def proxy(self):
        body = None
        if self.command in {"POST", "PUT", "PATCH"}:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else None

        headers = {
            "Content-Type": self.headers.get("Content-Type", "application/json"),
        }
        auth = self.headers.get("Authorization")
        if auth:
            headers["Authorization"] = auth

        req = request.Request(
            API_BASE + self.path,
            data=body,
            headers=headers,
            method=self.command,
        )
        try:
            with request.urlopen(req, timeout=30) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except error.HTTPError as exc:
            payload = exc.read()
            self.send_response(exc.code)
            self.send_header("Content-Type", exc.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:
            payload = ('{"error":"Proxy local falhou: %s"}' % str(exc).replace('"', "'")).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8088
    server = ThreadingHTTPServer(("127.0.0.1", port), LocalProxy)
    print(f"Serving {ROOT} with /api proxy on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()

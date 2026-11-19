# Lille udviklingsserver til prototypen. Den slår browserens cache fra, så en ændring i
# balance.js eller koden altid ses, når siden genindlæses.
#
#   python3 serve.py          (port 5180)
#   python3 serve.py 8000
#
# Serveren lytter på alle netværkskort, så en telefon på samme wifi kan åbne http://<pc'ens ip>:5180.

import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.ThreadingHTTPServer(("", port), NoCacheHandler)
    print(f"The Maw prototype: http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()

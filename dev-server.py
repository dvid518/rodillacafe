#!/usr/bin/env python3
"""Servidor de desarrollo local para Rodilla (SPA).

Sirve archivos estáticos y hace fallback de ruta limpia (history API):
  /dashboard/*  -> dashboard.html
  /auth/*       -> auth.html
  cualquier otro -> index.html

Uso:
    python dev-server.py
Luego abre http://localhost:8000/dashboard
"""
import http.server
import socketserver
import os
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).resolve().parent


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        # Si la ruta no corresponde a un archivo real, servi el shell SPA apropiado.
        super_path = super().translate_path(path)
        if not os.path.exists(super_path) or not os.path.isfile(super_path):
            if path.startswith("/dashboard"):
                return str(ROOT / "dashboard.html")
            if path.startswith("/auth"):
                return str(ROOT / "auth.html")
            return str(ROOT / "index.html")
        return super_path

    def end_headers(self):
        # Evita que el navegador cachee en desarrollo.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    with socketserver.TCPServer(("127.0.0.1", PORT), SPAHandler) as httpd:
        print(f"Servidor Rodilla en http://localhost:{PORT}")
        print("  /dashboard/* -> dashboard.html")
        print("  /auth/*      -> auth.html")
        print("  resto        -> index.html")
        print("Ctrl+C para detener")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDetenido.")

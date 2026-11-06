#!/usr/bin/env python3
"""Servidor HTTP simple para desarrollo de Rodilla.

Sirve archivos estaticos con los Content-Type correctos para modulos ES6
y hace reescritura de rutas SPA (History API) para que URLs limpias como
/dashboard/ventas funcionen sin recargar la pagina.

Uso:
    python server.py [puerto]

Por defecto escucha en http://localhost:8000
"""
import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Rutas SPA: prefijo -> archivo shell
SPA_ROUTES = {
    "/dashboard": "dashboard.html",
    "/auth": "auth.html",
    "/": "index.html",
}

def ruta_shell(path):
    """Devuelve el archivo shell HTML correspondiente para una ruta SPA,
    o None si la ruta no coincide con ningún prefijo."""
    # Los assets (con extensión) nunca son rutas SPA: si no existen, que el
    # servidor devuelva 404 en vez de HTML disfrazado de JS/CSS.
    if "." in path.rsplit("/", 1)[-1]:
        return None
    for prefijo, shell in SPA_ROUTES.items():
        if path == prefijo or path.startswith(prefijo + "/"):
            return shell
    return None

class RodillaHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".avif": "image/avif",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".ttf": "font/ttf",
        ".ico": "image/x-icon",
        ".manifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]  # quitar query string

        # Si la ruta coincide con un SPA, servir el shell HTML
        shell = ruta_shell(path)
        if shell:
            shell_path = os.path.join(BASE_DIR, shell)
            if os.path.exists(shell_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                with open(shell_path, "rb") as f:
                    self.wfile.write(f.read())
                return

        # Archivo estatico normal
        super().do_GET()

    def log_message(self, format, *args):
        sys.stdout.write("%s - - [%s] %s\n" %
                         (self.address_string(),
                          self.log_date_time_string(),
                          format % args))

with socketserver.TCPServer(("127.0.0.1", PORT), RodillaHandler) as httpd:
    print(f"Servidor Rodilla escuchando en http://127.0.0.1:{PORT}")
    print(f"Panel:   http://127.0.0.1:{PORT}/dashboard.html")
    print(f"Login:   http://127.0.0.1:{PORT}/auth.html")
    print(f"Inicio:  http://127.0.0.1:{PORT}/index.html")
    print()
    print("Rutas SPA soportadas:")
    print("  /dashboard/*  -> dashboard.html")
    print("  /auth/*       -> auth.html")
    print("  /             -> index.html")
    print("Presiona Ctrl+C para detener")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        httpd.server_close()

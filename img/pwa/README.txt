Aquí deben ir los iconos de la PWA, pero todavía no se han creado:
- icon-192.png (192x192 px)
- icon-512.png (512x512 px)
- favicon.ico (opcional)

Mientras tanto, manifest.webmanifest se publicó SIN el array "icons" y se
quitó el <link rel="apple-touch-icon"> de los HTML. Referencias a archivos
inexistentes solo producen 404 en consola y warnings de instalabilidad.

Cuando se creen los PNG, hay que volver a añadir "icons" al manifest y el
apple-touch-icon a los HTML.

# Pruebas de integración DNI/RUC

Las pruebas simuladas deben poder ejecutarse sin sesión cloud, datos personales ni consumo de Factiliza. Los resultados de staging se registran aparte de los mocks.

## Reproducir localmente

Desde la raíz de la rama, con Node 24 y Git:

```sh
node --test tests/*.test.mjs
```

| Verificación | Esperado | Observado | Estado |
|---|---|---|---|
| `document-public.test.mjs` | Excluir artefactos y respaldos; no hay endpoint directo ni firmas privadas detectables en código cliente | 4/11 inicial, 11/11 tras la primera corrección y 12/12 tras cubrir los informes | Aprobado, análisis estático |
| `document-edge.test.mjs` | Validación, roles, secretos, errores, 429, 503, aborto y reintentos acotados | 11/11 con transporte y reloj inyectados; una verificación independiente confirmó el resultado | Aprobado, mocks |
| `document-browser.test.mjs` | Consulta local, contrato HTTP, timeout, respuestas obsoletas y edición manual | 9/9; pruebas de servicios y del auxiliar de UI, no de las pantallas completas | Aprobado, mocks |
| `document-flow.test.mjs` | Servicios reales del frontend y handler de Edge juntos: acierto local, error BD, acierto externo, 404 y 429 | 2/2, DNI `01234567` y RUC `01234567890` sintéticos; SDK, Auth, BD y proveedor simulados | Aprobado, integración local |
| Sintaxis y tipos | Imports existentes y entrypoints Edge con tipos válidos | 88 archivos JS/MJS, 279 imports relativos y `deno check` aprobado | Aprobado, estático |
| Dashboard real con Auth/RLS y proveedor | Usuarios, Empresas y Ventas funcionan con los roles previstos | No ejecutado | Bloqueado: staging, roles y cuota autorizada |

**Resultado consolidado: 34/34, exit 0.** Ver [`suite-local.txt`](evidencias/suite-local.txt), [`sintaxis-imports.txt`](evidencias/sintaxis-imports.txt) y [`deno-check-final.txt`](evidencias/deno-check-final.txt). `node --check` no analizó el handler TypeScript; se usó `npm exec --yes --package=deno@2.6.8 -- deno check supabase/functions/consultar-dni/index.ts supabase/functions/consultar-ruc/index.ts`. El primer chequeo Deno detectó TS2345/TS2322; se corrigió el tipo del documento validado y el chequeo final dio exit 0. No se agregó la herramienta como dependencia del repositorio.

La cobertura UI ejercita guardas y actualización de campos con mocks, no un navegador en ejecución. El caso Ventas/RUC sin cliente se revisó en el código; falta probarlo en staging. El análisis de exclusión prueba `.vercelignore`, no los archivos de un despliegue.

## Verificar desde el navegador en staging

1. Abrí una ventana privada y DevTools → **Network**. Activá **Disable cache**, no guardes el HAR ni copies headers de autorización.
2. Con Admin, probá el DNI de un fixture existente en Usuarios y el RUC de una empresa de prueba. Confirmá una consulta a Supabase sin `functions/v1/consultar-*` cuando el dato esté en BD.
3. En Ventas repetí con Admin y Cajero. Para la rama de proveedor, solo con cuota de staging autorizada, usá el fixture aprobado. En **Network** debe aparecer `consultar-dni` o `consultar-ruc` en Supabase; nunca una solicitud del navegador a Factiliza.
4. Usá un valor inválido, dos clics rápidos, y cambiá el documento con la red ralentizada. Confirmá que no salen consultas duplicadas ni se aplican resultados sobre el documento nuevo o campos editados manualmente.
5. Con el formulario abierto, elegí **Offline** y consultá. Confirmá que se informa falta de conexión, no inexistencia. Restaurá la red y probá con el dato de BD. No simules caídas de los servicios reales.

Ver [coordinación de infraestructura](05_COORDINACION_INFRAESTRUCTURA.md) para permisos, configuración y criterios de aprobación del smoke test.

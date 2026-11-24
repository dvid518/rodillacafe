# Integración cloud DNI/RUC
Base: `bebb1b9` · Rama: `feat/mateo-integracion-cloud`
Alcance local; sin consultas pagadas, push, merge ni despliegue.

## Specs
- S1: «Revisar la integración actual de DNI/RUC.» «Verificar que el frontend consuma las Edge Functions de Supabase.» «Eliminar cualquier llamada directa a Factiliza desde el frontend.»
- S2: «Comprobar que no existan credenciales privadas expuestas.» «No sustituyas la autorización por CORS.»
- S3: «Implementar manejo de errores, timeouts y reintentos seguros cuando corresponda.» «No devuelvas 404 cuando Factiliza simplemente está caído o no responde.»
- S4: «No se sobrescriban datos introducidos manualmente.» «Una respuesta antigua no modifique un formulario que ya contiene otro documento.»
- S5: «Realizar pruebas de integración.» «Comprobar el comportamiento ante la indisponibilidad de servicios.» «No confundas las pruebas con mocks con las pruebas reales de integración en producción.»
- S6: «Crea una carpeta: `docs/mateo-integracion/`» «No inventes capturas, registros, resultados, métricas ni evidencias.»

## Tasks
- T1 [S1–S2] Auditoría inicial y preparación — parent — relevamiento completado; informe con T4.
- T2 [S2–S3,S5] Edge Functions — `b456e29`; 11 mocks y Deno OK, revisión nativa bloqueada (`review-2253aa87e0686fff`, `correction_required`).
- T3 [S1,S3–S5] Servicios y formularios — `4067d41`, `854b2f8`; verificación local independiente OK, staging pendiente.
- T4 [S2,S5–S6] Exposición estática, evidencias e informes — 12/12 chequeos estáticos, informes terminados; commit de cierre.
- T5 [S1–S6] Verificación integral y entrega — 34/34 pruebas locales, 88 archivos JS/MJS y 279 imports comprobados, Deno aprobado; verificación real y cierre de revisión bloqueantes para publicar.

## Log
- L1: Pedido de Mateo: implementar y comprobar la integración DNI/RUC existente, fases 0–13; solicitud completa en la conversación de origen.
- L2: `main` limpio en `bebb1b9`; rama de trabajo creada. Node v24.21.0; Deno y Supabase CLI no detectados en PATH.
- L3: Navegador conserva consulta previa PERSONA/EMPRESA bajo RLS. Edge preserva `{ok:true,data}` con campos permitidos en los nombres del proveedor, y `{ok:false,error:string,code:string}` con `Retry-After` cuando corresponda. Usar HTTP 404 solo para ausencia documentada. No reintentar cuota, credenciales ni timeout ambiguo facturable. Rol del servidor: ADMINISTRADOR o CAJERO vía funciones SQL existentes, no metadata de cliente.
- L4: Límites de revisión por frontera, sin publicar: Edge `b456e29` (612 líneas de diff), servicios `4067d41` (649), formularios `854b2f8` (794), exposición y evidencia en el commit de cierre. Exceden la guía de 400 por conservar pruebas y lógica asociadas; no acumular en un único candidato de revisión.
- L5: `review-2253aa87e0686fff` exige corregir compatibilidad del proveedor y cuestiona el rechazo de DNI formateado, que contradice «Se rechacen entradas inválidas antes de consumir servicios externos». No se autorizó corrección ni mantenimiento. La verificación independiente local no reemplaza su cierre.

# Resiliencia: qué falla y cómo se recupera

Pruebas controladas del handler, sin afectar Supabase ni Factiliza reales. Evidencia: [`edge-mocks.txt`](evidencias/edge-mocks.txt).

| Simulación | Esperado | Observado localmente |
|---|---|---|
| Auth de Supabase responde 503 o con cuerpo inválido | 503; no se consulta el proveedor | Aprobado con mock |
| Factiliza responde 429 con `Retry-After: 15` | Mantener 429 y cabecera; no cambiar de clave ni reintentar | Aprobado con mock |
| Factiliza devuelve 503 dos veces | Reintentar como máximo una vez si hay margen; conservar 503 al agotar | Aprobado con reloj y transportes simulados |
| Factiliza se recupera después de 503 | La segunda respuesta válida se entrega sin un tercer intento | Aprobado con mock |
| `Retry-After` excede el margen o es inválido | No reintentar | Aprobado con mock |
| Respuesta lenta que no termina de leerse | Abortar el intento al límite de 5 s; 504 sin repetir | Aprobado con temporizador inyectado; no se midió latencia cloud |
| Auth ya consumió parte del presupuesto | Ajustar el intento al tiempo restante del total de 12 s | Aprobado: el mock consume 8 s y recibe 4 s; no se repite |
| Fallo de red | Error de conexión, nunca 404 | Aprobado con excepción de transporte simulada |
| JSON inválido o documento ajeno | 502 sin datos personales en el error | Aprobado con mock |
| Secret ausente o inválido | 500 de configuración o 502 del proveedor, respectivamente | Aprobado con mocks; sin rotación automática |
| Desconexión real, throttling y recuperación en navegador | Estado del formulario recuperable y consulta manual posterior | Pendiente de ejecución en staging; pasos en [pruebas](03_PRUEBAS_INTEGRACION.md) |

El 404 solo representa una ausencia con el formato documentado de Factiliza y el mismo documento solicitado. Los aciertos de BD no dependen de Factiliza, pero una caída de Supabase puede impedir tanto la búsqueda de BD como la autorización. No hay cola de ventas ni persistencia de consultas offline.

**Riesgo residual:** el proveedor puede cobrar incluso un intento fallido. Solo se repite un 503 explícito, con la misma credencial y dentro del presupuesto; no se repiten desconexiones o timeouts ambiguos. Validar términos y métricas con infraestructura antes de producción.

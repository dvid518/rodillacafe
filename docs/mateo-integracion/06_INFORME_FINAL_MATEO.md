# Informe de Mateo: integración cloud DNI/RUC

**Resultado:** las consultas existentes se endurecieron y las **34 pruebas locales** pasaron. El despliegue, la prueba en navegador con roles reales y la confirmación de rotación de credenciales no se realizaron. La revisión nativa del commit Edge tampoco está cerrada.

## Objetivo y situación inicial

Mantener la arquitectura Vanilla JS → Supabase → Factiliza, mejorar seguridad y recuperación y producir evidencia sin datos personales ni consumo pagado. Inicialmente ambos servicios ya llamaban a Edge, pero una falla de base de datos podía verse como ausencia, y Edge podía recorrer varias claves y terminar devolviendo 404 aunque el proveedor estuviera caído.

## Resultados

| Responsabilidad | Estado | Evidencia y límite |
|---|---|---|
| Revisar la integración DNI/RUC | CUMPLIDA Y VERIFICADA | [Auditoría](01_AUDITORIA_INICIAL.md), flujos y contratos contrastados con código y documentación oficial. |
| Verificar frontend → Edge | IMPLEMENTADA, PENDIENTE DE VERIFICACIÓN REAL | Los dos servicios se probaron contra el handler con transportes sintéticos; falta Supabase de staging y navegador. |
| Eliminar llamadas directas | CUMPLIDA Y VERIFICADA | No había ejecución directa en el flujo actual; se retiraron dos endpoints obsoletos y se agregó una prueba estática. |
| Comprobar credenciales no expuestas | PARCIALMENTE CUMPLIDA | Sin firmas privadas detectadas en el código cliente probado; la `publishable` es pública. Hay indicios de tokens históricos; falta confirmar revocación, revisar configuración y verificar el artefacto servido. |
| Manejar errores, timeouts y reintentos | IMPLEMENTADA, PENDIENTE DE VERIFICACIÓN REAL | 15 s cliente / 12 s Edge / 5 s intento externo, único reintento de 503 si hay margen; verificaciones sintéticas y de tipos superadas. Revisión nativa pendiente. |
| Realizar pruebas de integración | PARCIALMENTE CUMPLIDA | Dos flujos completos simulados; 34/34 en el total. No se hizo integración cloud real. |
| Comprobar indisponibilidad | IMPLEMENTADA, PENDIENTE DE VERIFICACIÓN REAL | Mocks de errores, cuota, pérdida de conexión y latencia. Falta ver la reacción en las pantallas reales de staging. |

## Evidencia y límites de entrega

- [Implementación y diagrama](02_IMPLEMENTACION.md), [suite y guía de navegador](03_PRUEBAS_INTEGRACION.md), [escenarios de resiliencia](04_RESILIENCIA_Y_DISPONIBILIDAD.md).
- [Coordinación con Jianpierre](05_COORDINACION_INFRAESTRUCTURA.md): verificar JWT, RLS, roles, orígenes, secrets, rotación y monitoreo; desplegar en staging bajo autorización.
- `b456e29`: revisión nativa `review-2253aa87e0686fff` en `correction_required`. Se observó incompatibilidad potencial con un formato histórico de éxito (`success: true` sin `status`); hay que confirmar alcance antes de producción. También se señaló el rechazo de caracteres no numéricos, que es un requisito explícito del trabajo. No se debilitó la validación para cerrar la revisión.
- Un RUC externo no puede generar una persona natural ni iniciar dos escrituras desde la consulta de Ventas: la empresa y el cliente jurídico se registran mediante los flujos existentes. Probar esa recuperación con los roles de staging.
- Sin push, merge, despliegue, modificación del esquema, desactivación de RLS ni consumo de Factiliza real.

## Conclusión

Buscar primero en la base reduce la dependencia y el costo de Factiliza. Validar sesión, rol e identidad del resultado reduce accesos y asociaciones indebidas. Distinguir ausencia de indisponibilidad evita decisiones equivocadas y acotar la espera permite que el operador vuelva a consultar sin dejar el formulario bloqueado. El siguiente paso es cerrar la revisión y validar el despliegue en staging; los mocks no son permiso para publicar.

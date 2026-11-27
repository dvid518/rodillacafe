# Guía de sustentación: consultas DNI/RUC

**En una frase:** reforcé el flujo que ya existía para que Rodilla Café use primero su base de datos y consulte al proveedor por una función de servidor solo cuando haga falta.

## Cómo explicarlo

1. **El problema:** la integración ya tenía servicios JavaScript y Edge Functions. Sin embargo, un fallo de Supabase podía iniciar una consulta externa y una falla de Factiliza podía mostrarse como «no encontrado».
2. **El recorrido:** Usuarios, Empresas o Ventas valida el documento. Busca el DNI en `PERSONA` o el RUC en `EMPRESA`. Si no hay un registro visible y la consulta fue exitosa, invoca la Edge Function correspondiente. La respuesta se verifica antes de actualizar el formulario.
3. **La seguridad:** una Edge Function es código que se ejecuta del lado servidor en Supabase. Usa una credencial que no se envía al navegador. La clave pública de Supabase sí puede estar en el frontend: identifica el proyecto, pero no reemplaza al JWT del usuario ni a RLS.
4. **La disponibilidad:** un timeout limita cuánto se espera. Un reintento seguro repite solo un fallo seleccionado, bajo un límite de tiempo e intentos. Un timeout no prueba que el proveedor no procesó la consulta, por eso repetirlo podría generar otro cargo.
5. **La evidencia:** las pruebas usan documentos sintéticos y respuestas simuladas. No consumen cuota, pero tampoco prueban los secrets, las políticas RLS o el despliegue real. La verificación real queda a cargo del equipo en staging.

## Preguntas típicas

| Pregunta | Respuesta |
|---|---|
| ¿Por qué no consultar directamente a Factiliza? | El navegador no puede guardar un secreto: un usuario puede leer el código o inspeccionar la red. En Edge se controla quién puede llamar y qué datos se devuelven. |
| ¿CORS protege el endpoint? | No. Solo limita cómo lo usa un navegador desde otro origen. El servidor debe verificar sesión y permisos. |
| ¿Qué pasa si Factiliza se cae? | Si el dato ya está en BD, no se necesita Factiliza. Si hace falta el proveedor, el formulario informa un fallo temporal y no lo confunde con un documento inexistente. |
| ¿Por qué no cambiar de clave después de un 429? | Un 429 indica cuota o límite. Cambiar de clave para seguir consultando burlaría ese límite y podría aumentar el costo. |
| ¿Qué falta demostrar en vivo? | Despliegue de ambas Edge, secretos, roles y RLS efectivos, y una consulta permitida por el proveedor en staging. |

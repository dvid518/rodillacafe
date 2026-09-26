-- ============================================================================
-- 021_producto_publico.sql
-- Cierra la fuga de datos internos de PRODUCTO (Costo, Stock, Marca, barcode)
--
-- CONTEXTO
--   014_rls_policies.sql creo "p_productos_select_all" ... using (true), para
--   que el menu público pudiera leer el catalogo. El problema: using (true)
--   no filtra COLUMNAS, solo filas. Con la publishable key (que va dentro del
--   bundle publico) cualquiera podia pedir:
--       GET /rest/v1/PRODUCTO?select=N_Producto,Precio,Costo
--   y obtener el costo y el margen de los 16 productos.
--
-- QUE HACE ESTE ARCHIVO
--   1. Crea la vista PRODUCTO_PUBLICO: solo las columnas que el menu necesita.
--   2. Le da SELECT a anon y authenticated.
--   3. Quita el SELECT de anon sobre la tabla base.
--   4. Elimina la policy using (true).
--   5. Deja p_productos_admin_all como unica puerta a la tabla completa.
--
-- ORDEN DE DESPLIEGUE
--   Ejecuta ESTE archivo DESPUES de desplegar el ProductAdapter.js que lee de
--   PRODUCTO_PUBLICO. Al reves, el menu se queda sin productos durante la
--   ventana de despliegue.
--
-- NOTA SOBRE LA VISTA Y RLS
--   La vista se crea SIN security_invoker a proposito. Asi corre con los
--   permisos de su dueno (postgres) y ignora las policies de PRODUCTO, que es
--   justo lo que queremos: la vista filtra ella misma con ESTADO = '1'.
--   Si alguien le pone security_invoker=true, la vista pasara a exigirle
--   permisos a PRODUCTO al visitante, que ya no tendra, y dejara de funcionar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vista publica
-- ----------------------------------------------------------------------------
create or replace view public."PRODUCTO_PUBLICO" as
    select
        "ID_Producto",
        "ID_CategoriaProducto",
        "ID_UnidadMedida",
        "N_Producto",
        "Detalle",
        "Precio",
        "Imagen",
        "ESTADO"
    from public."PRODUCTO"
    where "ESTADO" = '1';

comment on view public."PRODUCTO_PUBLICO" is
    'Catalogo publico. No expone Costo, Stock_Actual, Stock_Minimo, Marca ni Codigo_Barras.';

grant select on public."PRODUCTO_PUBLICO" to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. La tabla base deja de ser legible para anon
--    (no se toca el grant de authenticated: el admin la necesita, y las
--     policies ya se encargan de decidir quien ve filas)
-- ----------------------------------------------------------------------------
revoke select on public."PRODUCTO" from anon;
revoke insert, update, delete on public."PRODUCTO" from anon;

-- ----------------------------------------------------------------------------
-- 3. Se cierra la policy que abria la tabla entera
--    OJO: el nombre real es p_productos_select_all (en plural), no
--    p_producto_select. Con el nombre equivocado, el "drop ... if exists"
--    no hace nada, se ejecuta sin error, y la fuga sigue abierta.
-- ----------------------------------------------------------------------------
drop policy if exists "p_productos_select_all" on public."PRODUCTO";

-- ----------------------------------------------------------------------------
-- 4. Comprobacion: no debe quedar ninguna policy permisiva de solo lectura
--    sobre PRODUCTO. p_productos_admin_all (for all, using is_admin()) es la
--    que queda, y cubre tambien el SELECT: solo un ADMINISTRADOR pasa.
--
--    select policyname, cmd, qual
--      from pg_policies
--     where schemaname = 'public' and tablename = 'PRODUCTO';
--
--    Debe salir unica p_productos_admin_all.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 5. Misma comprobacion para las demas catalogos (solo informativo)
--    CATEGORIA_PRODUCTO y UNIDAD_MEDIDA tambien tienen using (true), pero no
--    tienen datos internos, asi que se dejan como estan.
-- ----------------------------------------------------------------------------

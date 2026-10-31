-- ============================================================================
-- 022_auditoria_usuario_120.sql
-- Ensancha las columnas de auditoría USUCRE/USUMOD/PCCRE/PCMOD de varchar(30)
-- a varchar(120) en todas las tablas de public.
--
-- Motivo: USUARIO.Logeo pasó a varchar(120) (ver 018_fixes.sql, C1) porque
-- almacena el email completo. Sin embargo, las columnas de auditoría seguían
-- en varchar(30), por lo que cualquier inserción/actualización que enviara el
-- Logeo completo fallaba con:
--     ERROR 22001: value too long for type character varying(30)
--
-- Afectaba, entre otras, a APERTURA_CAJA y MOVIMIENTO_CAJA (cierre de caja y
-- registro de movimientos). Además PCCRE/PCMOD almacenan IPs, y una IPv6
-- puede ocupar hasta 45 caracteres.
--
-- Migración idempotente: solo actúa sobre columnas que aún sean más angostas
-- que 120 caracteres.
-- ============================================================================

do $$
declare
    r record;
begin
    for r in
        select c.table_name, c.column_name, c.character_maximum_length
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema
         and t.table_name = c.table_name
        where c.table_schema = 'public'
          and t.table_type = 'BASE TABLE'
          and c.data_type = 'character varying'
          and c.column_name in ('USUCRE', 'USUMOD', 'PCCRE', 'PCMOD')
          and (c.character_maximum_length is null or c.character_maximum_length < 120)
    loop
        execute format(
            'alter table public.%I alter column %I type varchar(120)',
            r.table_name, r.column_name
        );
    end loop;
end $$;

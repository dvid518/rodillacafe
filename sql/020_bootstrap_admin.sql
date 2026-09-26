-- ============================================================================
-- 020_bootstrap_admin.sql (CORREGIDO)
-- Bootstrap del primer administrador de Rodilla.
-- Deshabilita temporalmente tr_usuario_proteger_cols para permitir el cambio.
-- ============================================================================

do $$
declare
    v_auth_id    uuid;
    v_id_usuario int;
    v_email      varchar(120) := 'admin@rodilla.web.app';
begin
    -- 1. Buscar el usuario en auth.users
    select id into v_auth_id
      from auth.users
     where email = v_email
     limit 1;

    if v_auth_id is null then
        raise exception 'Crea primero el usuario % en Supabase Auth', v_email;
    end if;

    -- 2. Localizar la fila USUARIO con ese Logeo
    select "ID_Usuario" into v_id_usuario
      from public."USUARIO"
     where "Logeo" = v_email
     limit 1;

    if v_id_usuario is null then
        raise exception 'No existe USUARIO con Logeo = %', v_email;
    end if;

    -- 3. DESHABILITAR el trigger temporalmente (bootstrap)
    alter table public."USUARIO" disable trigger tr_usuario_proteger_cols;

    -- 4. Vincular auth_id y asegurar tipo ADMINISTRADOR
    update public."USUARIO"
       set "auth_id"        = v_auth_id,
           "ID_TipoUsuario" = 1,
           "Logeo"          = v_email,
           "USUMOD"         = 'BOOTSTRAP',
           "FECMOD"         = now()
     where "ID_Usuario" = v_id_usuario;

    -- 5. Rol ADMINISTRADOR
    insert into public."USUARIO_ROL"(
        "ID_Usuario", "ID_Rol", "Vigente", "USUCRE"
    ) values (
        v_id_usuario, 1, '1', 'BOOTSTRAP'
    )
    on conflict ("ID_Usuario", "ID_Rol")
    do update set "Vigente" = '1', "ESTADO" = '1',
                  "USUMOD" = 'BOOTSTRAP', "FECMOD" = now();

    -- 6. Revocar otros roles
    update public."USUARIO_ROL"
       set "Vigente" = '0',
           "ESTADO"  = '0',
           "USUMOD"  = 'BOOTSTRAP',
           "FECMOD"  = now()
     where "ID_Usuario" = v_id_usuario
       and "ID_Rol" <> 1;

    -- 7. REHABILITAR el trigger
    alter table public."USUARIO" enable trigger tr_usuario_proteger_cols;

    raise notice 'Admin % vinculado correctamente (ID_Usuario=%)', v_email, v_id_usuario;
end $$;

-- Verificación
select
    u."ID_Usuario",
    u."Logeo",
    u."auth_id",
    u."ID_TipoUsuario",
    ur."ID_Rol",
    ur."Vigente"
  from public."USUARIO" u
  left join public."USUARIO_ROL" ur on ur."ID_Usuario" = u."ID_Usuario"
 where u."Logeo" = 'admin@rodilla.web.app';
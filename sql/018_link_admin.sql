-- ============================================================================
-- 018_link_admin.sql
-- C16: vincular un usuario de Supabase Auth a una fila USUARIO existente,
--      buscando el auth_id por email en auth.users.
-- C17: promover un usuario a ADMINISTRADOR (ID_Rol = 1).
-- Solo pueden ejecutarlas un administrador autenticado.
-- ============================================================================

-- ============================================================================
-- C16: vincular auth_id a un USUARIO existente por email
-- ----------------------------------------------------------------------------
-- Uso:
--   call public.usp_LinkAuthUser(p_email => 'admin@cafeteria.pe');
--
-- Qué hace:
--   1. Busca el UUID del usuario en auth.users por email.
--   2. Lo asigna a USUARIO.auth_id.
--   3. Actualiza USUARIO.Logeo al email (por consistencia).
-- ============================================================================
create or replace procedure public.usp_LinkAuthUser(p_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_auth_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Permiso denegado';
    end if;

    select id into v_auth_id
      from auth.users
     where email = p_email
     limit 1;

    if v_auth_id is null then
        raise exception 'No existe usuario en auth.users con email %', p_email;
    end if;

    update public."USUARIO"
       set "auth_id" = v_auth_id,
           "Logeo"   = p_email,
           "USUMOD"  = 'ADMIN',
           "FECMOD"  = now()
     where "Logeo" = p_email
        or "auth_id" is null;

    if not found then
        raise exception 'No se encontró fila en USUARIO para vincular (Logeo=%)', p_email;
    end if;
end;
$$;

-- ============================================================================
-- C17: promover a administrador (ID_Rol = 1)
-- ----------------------------------------------------------------------------
-- Uso:
--   call public.usp_PromoverAdmin(p_email => 'nuevo.admin@cafeteria.pe');
--
-- Qué hace:
--   1. Cambia USUARIO.ID_TipoUsuario a 1 (ADMINISTRADOR).
--   2. Activa rol ADMINISTRADOR en USUARIO_ROL.
--   3. Revoca cualquier otro rol vigente (CLIENTE, CAJERO, MOZO).
-- Idempotente.
-- ============================================================================
create or replace procedure public.usp_PromoverAdmin(p_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id_usuario int;
begin
    if not public.is_admin() then
        raise exception 'Permiso denegado';
    end if;

    select "ID_Usuario" into v_id_usuario
      from public."USUARIO"
     where "Logeo" = p_email
     limit 1;

    if v_id_usuario is null then
        raise exception 'Usuario no encontrado: %', p_email;
    end if;

    update public."USUARIO"
       set "ID_TipoUsuario" = 1,
           "USUMOD" = 'ADMIN',
           "FECMOD" = now()
     where "ID_Usuario" = v_id_usuario;

    insert into public."USUARIO_ROL"(
        "ID_Usuario", "ID_Rol", "Vigente", "USUCRE"
    ) values (
        v_id_usuario, 1, '1', 'ADMIN'
    )
    on conflict ("ID_Usuario", "ID_Rol")
    do update set "Vigente" = '1', "ESTADO" = '1',
                  "USUMOD" = 'ADMIN', "FECMOD" = now();

    -- Revocar cualquier otro rol vigente
    update public."USUARIO_ROL"
       set "Vigente" = '0',
           "ESTADO"  = '0',
           "USUMOD"  = 'ADMIN',
           "FECMOD"  = now()
     where "ID_Usuario" = v_id_usuario
       and "ID_Rol" <> 1;
end;
$$;
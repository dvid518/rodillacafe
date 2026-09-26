-- ============================================================================
-- 013_auth_trigger.sql
-- Trigger que crea PERSONA + CLIENTE + USUARIO cuando se registra en auth.users
-- ============================================================================

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id_persona  integer;
    v_id_cliente  integer;
    v_id_usuario  integer;
    v_id_tipo_doc integer;
    v_id_rol_cli  integer;
    v_nombre      varchar(80);
    v_documento   varchar(15);
begin
    begin
        -- 1) Localizar tipo de documento DNI, con fallbacks
        select "ID_TipoIdentidad" into v_id_tipo_doc
          from public."TIPO_IDENTIDAD"
         where "Abreviatura" = 'DNI' limit 1;

        if v_id_tipo_doc is null then
            select "ID_TipoIdentidad" into v_id_tipo_doc
              from public."TIPO_IDENTIDAD" limit 1;
        end if;

        if v_id_tipo_doc is null then
            -- último recurso: crear un tipo genérico
            insert into public."TIPO_IDENTIDAD"(
                "N_TipoIdentidad","Abreviatura","Longitud","USUCRE"
            ) values ('GENERICO','GEN',20,'AUTH')
            returning "ID_TipoIdentidad" into v_id_tipo_doc;
        end if;

        -- 2) Nombre desde metadata o desde email (truncado a 80)
        v_nombre := coalesce(
            substring(new.raw_user_meta_data->>'nombre', 1, 80),
            substring(split_part(new.email, '@', 1), 1, 80)
        );

        -- 3) Documento placeholder único (derivado del uuid)
        v_documento := 'P' || substring(replace(new.id::text, '-', '') from 1 for 10);

        -- 4) Crear PERSONA
        insert into public."PERSONA" (
            "ID_TipoIdentidad", "N_Documento", "Nombre", "EMAIL", "USUCRE"
        ) values (
            v_id_tipo_doc, v_documento, v_nombre,
            substring(new.email, 1, 50), 'AUTH'
        )
        returning "ID_Persona" into v_id_persona;

        -- 5) Crear CLIENTE
        insert into public."CLIENTE" (
            "ID_Persona", "Tipo_Cliente", "USUCRE"
        ) values (
            v_id_persona, 'N', 'AUTH'
        )
        returning "ID_Cliente" into v_id_cliente;

        -- 6) Crear USUARIO (Logeo = email, truncado a 120)
        insert into public."USUARIO" (
            "ID_TipoUsuario", "ID_Cliente", "auth_id", "Logeo", "USUCRE"
        ) values (
            3, v_id_cliente, new.id, substring(new.email, 1, 120), 'AUTH'
        )
        returning "ID_Usuario" into v_id_usuario;

        -- 7) Asignar rol CLIENTE (ID_Rol = 4)
        select "ID_Rol" into v_id_rol_cli
          from public."ROL"
         where "N_Rol" = 'CLIENTE' limit 1;

        if v_id_rol_cli is not null then
            insert into public."USUARIO_ROL" (
                "ID_Usuario", "ID_Rol", "USUCRE"
            ) values (v_id_usuario, v_id_rol_cli, 'AUTH');
        end if;
    exception when others then
        -- Log a AUDITORIA y NO abortar el alta del usuario
        insert into public."AUDITORIA" (
            "N_Tabla", "Accion", "Valor_Nuevo", "USUCRE"
        ) values (
            'AUTH_TRIGGER', 'ERROR',
            substring(sqlerrm, 1, 500), 'AUTH'
        );
        -- opcional: raise;  -- si quieres abortar el alta, descomenta esta línea
    end;

    return new;
end;
$$;

drop trigger if exists tr_handle_new_user on auth.users;

create trigger tr_handle_new_user
after insert on auth.users
for each row execute function public.fn_handle_new_user();
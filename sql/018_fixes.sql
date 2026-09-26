-- ============================================================================
-- 018_fixes.sql
-- Migración idempotente: alinea una BD ya desplegada con las correcciones
-- C1..C14 aplicadas a los scripts originales. Re-ejecutable sin errores.
--
-- C1  Logeo varchar(30) -> varchar(120)
-- C2  CHECKs de USUARIO (Bloqueado en '0'/'1', Intentos >= 0)
-- C3  CK_CLIENTE_TIPO exige ID_Persona null en clientes jurídicos
-- C4  CK_PRODUCTO_COSTO (0 <= Costo <= Precio)
-- C5  IP varchar(20) -> varchar(45) en AUDITORIA y MOVIMIENTO_CAJA
-- C6  Índice único parcial UX_APERTURA_CAJA_ABIERTA
-- C8  Trigger tr_usuario_proteger_cols
-- C9  Helpers is_admin / is_rol / is_operativo endurecidos
-- C10 Policies de operativos en PEDIDO, DETALLE_PEDIDO, RESERVA, MENSAJE, MESA
-- C11 Trigger fn_handle_new_user con manejo de errores y ancho correcto
-- C12 Procedimientos en security definer con guard de rol
-- C13 fn_tr_movimiento_caja_acumula en security definer
-- C14 Correlativo de serie robusto en usp_FacturarPedido
-- ============================================================================

-- ============================================================================
-- C1: ensanchar Logeo (soporta emails completos)
-- ============================================================================
alter table public."USUARIO" alter column "Logeo" type varchar(120);

-- ============================================================================
-- C2: CHECKs de USUARIO
-- ============================================================================
do $$
begin
    if not exists (select 1 from pg_constraint
                    where conname = 'CK_USUARIO_BLOQUEADO'
                      and conrelid = 'public."USUARIO"'::regclass) then
        alter table public."USUARIO"
            add constraint "CK_USUARIO_BLOQUEADO" check ("Bloqueado" in ('0','1'));
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint
                    where conname = 'CK_USUARIO_INTENTOS'
                      and conrelid = 'public."USUARIO"'::regclass) then
        alter table public."USUARIO"
            add constraint "CK_USUARIO_INTENTOS" check ("Intentos" >= 0);
    end if;
end $$;

-- ============================================================================
-- C3: CK_CLIENTE_TIPO corregido (jurídico no puede tener persona natural)
-- ============================================================================
alter table public."CLIENTE" drop constraint if exists "CK_CLIENTE_TIPO";
alter table public."CLIENTE" add constraint "CK_CLIENTE_TIPO" check (
    ("Tipo_Cliente" = 'N' and "ID_Persona" is not null and "ID_Empresa" is null) or
    ("Tipo_Cliente" = 'J' and "ID_Empresa" is not null and "ID_Persona" is null)
);

-- ============================================================================
-- C4: CK_PRODUCTO_COSTO
-- ============================================================================
do $$
begin
    if not exists (select 1 from pg_constraint
                    where conname = 'CK_PRODUCTO_COSTO'
                      and conrelid = 'public."PRODUCTO"'::regclass) then
        alter table public."PRODUCTO"
            add constraint "CK_PRODUCTO_COSTO" check ("Costo" >= 0 and "Costo" <= "Precio");
    end if;
end $$;

-- ============================================================================
-- C5: IP IPv4/IPv6 (varchar(45))
-- ============================================================================
alter table public."AUDITORIA"      alter column "IP" type varchar(45);
alter table public."MOVIMIENTO_CAJA" alter column "IP" type varchar(45);

-- ============================================================================
-- C6: una sola caja abierta por turno
-- ============================================================================
create unique index if not exists "UX_APERTURA_CAJA_ABIERTA"
    on public."APERTURA_CAJA"("ID_Caja")
    where "Situacion" = 'A' and "ESTADO" = '1';

-- ============================================================================
-- C9: helpers endurecidos (admin valida ESTADO/Bloqueado, operativos por rol)
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
          from public."USUARIO" u
          join public."USUARIO_ROL" ur on ur."ID_Usuario" = u."ID_Usuario"
          join public."ROL" r on r."ID_Rol" = ur."ID_Rol"
         where u."auth_id" = auth.uid()
           and u."ESTADO" = '1'
           and u."Bloqueado" = '0'
           and ur."Vigente" = '1'
           and ur."ESTADO" = '1'
           and r."N_Rol" = 'ADMINISTRADOR'
           and r."ESTADO" = '1'
    );
$$;

create or replace function public.is_rol(p_rol text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
          from public."USUARIO" u
          join public."USUARIO_ROL" ur on ur."ID_Usuario" = u."ID_Usuario"
          join public."ROL" r on r."ID_Rol" = ur."ID_Rol"
         where u."auth_id" = auth.uid()
           and u."ESTADO" = '1'
           and u."Bloqueado" = '0'
           and ur."Vigente" = '1'
           and ur."ESTADO" = '1'
           and r."N_Rol" = p_rol
           and r."ESTADO" = '1'
    );
$$;

create or replace function public.is_operativo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select public.is_rol('CAJERO') or public.is_rol('MOZO');
$$;

-- ============================================================================
-- C8: protección de columnas sensibles de USUARIO
-- ============================================================================
create or replace function public.fn_usuario_proteger_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        if new."ID_TipoUsuario" is distinct from old."ID_TipoUsuario"
           or new."ID_Empleado" is distinct from old."ID_Empleado"
           or new."ID_Cliente" is distinct from old."ID_Cliente"
           or new."auth_id" is distinct from old."auth_id" then
            raise exception 'No tiene permiso para modificar datos sensibles del usuario';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists tr_usuario_proteger_cols on public."USUARIO";
create trigger tr_usuario_proteger_cols
before update on public."USUARIO"
for each row execute function public.fn_usuario_proteger_cols();

-- ============================================================================
-- C10: operativos (CAJERO/MOZO) en flujo de pedidos, reservas y mensajes
-- ============================================================================
drop policy if exists "p_pedido_select_own_or_admin" on public."PEDIDO";
drop policy if exists "p_pedido_insert_own_or_admin" on public."PEDIDO";
drop policy if exists "p_pedido_update_own_or_admin" on public."PEDIDO";
create policy "p_pedido_select_own_or_admin"
    on public."PEDIDO" for select
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());
create policy "p_pedido_insert_own_or_admin"
    on public."PEDIDO" for insert
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());
create policy "p_pedido_update_own_or_admin"
    on public."PEDIDO" for update
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo())
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());

drop policy if exists "p_detped_select_own_or_admin" on public."DETALLE_PEDIDO";
drop policy if exists "p_detped_insert_own_or_admin" on public."DETALLE_PEDIDO";
drop policy if exists "p_detped_update_own_or_admin" on public."DETALLE_PEDIDO";
create policy "p_detped_select_own_or_admin"
    on public."DETALLE_PEDIDO" for select
    using (
        public.is_admin() or public.is_operativo()
        or exists (
            select 1 from public."PEDIDO" p
             where p."ID_Pedido" = "DETALLE_PEDIDO"."ID_Pedido"
               and public.is_owner_cliente(p."ID_Cliente")
        )
    );
create policy "p_detped_insert_own_or_admin"
    on public."DETALLE_PEDIDO" for insert
    with check (
        public.is_admin() or public.is_operativo()
        or exists (
            select 1 from public."PEDIDO" p
             where p."ID_Pedido" = "DETALLE_PEDIDO"."ID_Pedido"
               and public.is_owner_cliente(p."ID_Cliente")
        )
    );
create policy "p_detped_update_own_or_admin"
    on public."DETALLE_PEDIDO" for update
    using (
        public.is_admin() or public.is_operativo()
        or exists (
            select 1 from public."PEDIDO" p
             where p."ID_Pedido" = "DETALLE_PEDIDO"."ID_Pedido"
               and public.is_owner_cliente(p."ID_Cliente")
        )
    )
    with check (
        public.is_admin() or public.is_operativo()
        or exists (
            select 1 from public."PEDIDO" p
             where p."ID_Pedido" = "DETALLE_PEDIDO"."ID_Pedido"
               and public.is_owner_cliente(p."ID_Cliente")
        )
    );

drop policy if exists "p_reserva_select_own_or_admin" on public."RESERVA";
drop policy if exists "p_reserva_insert_own_or_admin" on public."RESERVA";
drop policy if exists "p_reserva_update_own_or_admin" on public."RESERVA";
create policy "p_reserva_select_own_or_admin"
    on public."RESERVA" for select
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());
create policy "p_reserva_insert_own_or_admin"
    on public."RESERVA" for insert
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());
create policy "p_reserva_update_own_or_admin"
    on public."RESERVA" for update
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo())
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());

drop policy if exists "p_mensaje_select_own_or_admin" on public."MENSAJE";
drop policy if exists "p_mensaje_insert_own_or_admin" on public."MENSAJE";
drop policy if exists "p_mensaje_update_own_or_admin" on public."MENSAJE";
create policy "p_mensaje_select_own_or_admin"
    on public."MENSAJE" for select
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());
create policy "p_mensaje_insert_own_or_admin"
    on public."MENSAJE" for insert
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());
create policy "p_mensaje_update_own_or_admin"
    on public."MENSAJE" for update
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo())
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin() or public.is_operativo());

drop policy if exists "p_mesa_operativo_update" on public."MESA";
create policy "p_mesa_operativo_update"
    on public."MESA" for update
    using (public.is_operativo())
    with check (public.is_operativo());

-- ============================================================================
-- C11: trigger de registro de nuevos usuarios autenticados
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
        select "ID_TipoIdentidad" into v_id_tipo_doc
          from public."TIPO_IDENTIDAD"
         where "Abreviatura" = 'DNI' limit 1;

        if v_id_tipo_doc is null then
            select "ID_TipoIdentidad" into v_id_tipo_doc
              from public."TIPO_IDENTIDAD" limit 1;
        end if;

        if v_id_tipo_doc is null then
            insert into public."TIPO_IDENTIDAD"(
                "N_TipoIdentidad","Abreviatura","Longitud","USUCRE"
            ) values ('GENERICO','GEN',20,'AUTH')
            returning "ID_TipoIdentidad" into v_id_tipo_doc;
        end if;

        v_nombre := coalesce(
            substring(new.raw_user_meta_data->>'nombre', 1, 80),
            substring(split_part(new.email, '@', 1), 1, 80)
        );

        v_documento := 'P' || substring(replace(new.id::text, '-', '') from 1 for 10);

        insert into public."PERSONA" (
            "ID_TipoIdentidad", "N_Documento", "Nombre", "EMAIL", "USUCRE"
        ) values (
            v_id_tipo_doc, v_documento, v_nombre,
            substring(new.email, 1, 50), 'AUTH'
        )
        returning "ID_Persona" into v_id_persona;

        insert into public."CLIENTE" (
            "ID_Persona", "Tipo_Cliente", "USUCRE"
        ) values (
            v_id_persona, 'N', 'AUTH'
        )
        returning "ID_Cliente" into v_id_cliente;

        insert into public."USUARIO" (
            "ID_TipoUsuario", "ID_Cliente", "auth_id", "Logeo", "USUCRE"
        ) values (
            3, v_id_cliente, new.id, substring(new.email, 1, 120), 'AUTH'
        )
        returning "ID_Usuario" into v_id_usuario;

        select "ID_Rol" into v_id_rol_cli
          from public."ROL"
         where "N_Rol" = 'CLIENTE' limit 1;

        if v_id_rol_cli is not null then
            insert into public."USUARIO_ROL" (
                "ID_Usuario", "ID_Rol", "USUCRE"
            ) values (v_id_usuario, v_id_rol_cli, 'AUTH');
        end if;
    exception when others then
        insert into public."AUDITORIA" (
            "N_Tabla", "Accion", "Valor_Nuevo", "USUCRE"
        ) values (
            'AUTH_TRIGGER', 'ERROR',
            substring(sqlerrm, 1, 500), 'AUTH'
        );
    end;

    return new;
end;
$$;

drop trigger if exists tr_handle_new_user on auth.users;
create trigger tr_handle_new_user
after insert on auth.users
for each row execute function public.fn_handle_new_user();

-- ============================================================================
-- C13: acumulado de caja en security definer
-- ============================================================================
create or replace function public.fn_tr_movimiento_caja_acumula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Ingresos numeric(12,2);
    v_Egresos numeric(12,2);
    v_Signo char(1);
begin
    select "Signo" into v_Signo from public."TIPO_MOVIMIENTO_CAJA"
     where "ID_TipoMovimiento" = new."ID_TipoMovimiento";

    if (v_Signo = '+' and new."Afecta_Efectivo" = '1') then
        v_Ingresos := new."Monto"; v_Egresos := 0;
    elsif (v_Signo = '-' and new."Afecta_Efectivo" = '1') then
        v_Ingresos := 0; v_Egresos := new."Monto";
    else
        v_Ingresos := 0; v_Egresos := 0;
    end if;

    update public."APERTURA_CAJA"
       set "Total_Ingresos" = "Total_Ingresos" + v_Ingresos,
           "Total_Egresos"  = "Total_Egresos" + v_Egresos,
           "Monto_Sistema"  = "Monto_Inicial" + ("Total_Ingresos" + v_Ingresos) - ("Total_Egresos" + v_Egresos),
           "FECMOD" = now()
     where "ID_AperturaCaja" = new."ID_AperturaCaja";

    return new;
end;
$$;

drop trigger if exists tr_movimiento_caja_acumula on public."MOVIMIENTO_CAJA";
create trigger tr_movimiento_caja_acumula
after insert on public."MOVIMIENTO_CAJA"
for each row execute function public.fn_tr_movimiento_caja_acumula();

-- ============================================================================
-- C12 + C14: procedimientos en security definer con guard de rol y correlativo
-- robusto. (create or replace para adoptar la nueva definición en la BD ya
-- desplegada)
-- ============================================================================

create or replace procedure public.usp_AperturarCaja(
    p_ID_Caja        int,
    p_ID_Usuario     int,
    p_Monto_Inicial  numeric(12,2),
    p_Numero_Turno   varchar(20) default null,
    p_Observacion    varchar(200) default null,
    inout p_ID_AperturaCaja int default null
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Count int;
    v_Logeo varchar(120);
    v_NumTurno varchar(20);
begin
    if not (public.is_admin() or public.is_rol('CAJERO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_Usuario is null then
        select "ID_Usuario" into p_ID_Usuario from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_Usuario is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    if exists (select 1 from public."APERTURA_CAJA"
                where "ID_Caja" = p_ID_Caja and "Situacion" = 'A' and "ESTADO" = '1') then
        raise exception 'La caja seleccionada ya tiene un turno abierto.';
    end if;

    select count(*)+1 into v_Count from public."APERTURA_CAJA"
     where "ID_Caja" = p_ID_Caja and "F_Apertura"::date = current_date;

    v_NumTurno := coalesce(p_Numero_Turno,
        'T' || to_char(current_timestamp, 'YYYYMMDD') || '-' || lpad(v_Count::text, 2, '0'));

    select "Logeo" into v_Logeo from public."USUARIO" where "ID_Usuario" = p_ID_Usuario;

    insert into public."APERTURA_CAJA"(
        "ID_Caja","ID_Usuario","Numero_Turno","Monto_Inicial",
        "Monto_Sistema","Situacion","Observacion","USUCRE","PCCRE"
    ) values (
        p_ID_Caja, p_ID_Usuario, v_NumTurno, p_Monto_Inicial,
        p_Monto_Inicial, 'A', p_Observacion, v_Logeo, inet_client_addr()::text
    ) returning "ID_AperturaCaja" into p_ID_AperturaCaja;

    update public."CAJA" set "Aperturada" = '1', "FECMOD" = now()
     where "ID_Caja" = p_ID_Caja;
end;
$$;

create or replace procedure public.usp_RegistrarMovimientoCaja(
    p_ID_AperturaCaja  int,
    p_ID_Concepto      int,
    p_ID_MetodoPago    int,
    p_ID_Usuario       int,
    p_Monto            numeric(12,2),
    p_Descripcion      varchar(200) default null,
    p_Documento        varchar(200) default null,
    p_Numero_Operacion varchar(30)  default null,
    p_ID_Venta         int          default null,
    p_ID_Pedido        int          default null
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ID_TipoMovimiento int;
    v_Afecta char(1);
    v_EsEfectivo char(1);
    v_Logeo varchar(120);
begin
    if not (public.is_admin() or public.is_rol('CAJERO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_Usuario is null then
        select "ID_Usuario" into p_ID_Usuario from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_Usuario is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    if not exists (select 1 from public."APERTURA_CAJA"
                    where "ID_AperturaCaja" = p_ID_AperturaCaja and "Situacion" = 'A') then
        raise exception 'El turno de caja no existe o ya fue cerrado.';
    end if;

    select "ID_TipoMovimiento","Afecta_Efectivo"
      into v_ID_TipoMovimiento, v_Afecta
      from public."CONCEPTO_CAJA" where "ID_Concepto" = p_ID_Concepto;

    select "Es_Efectivo" into v_EsEfectivo
      from public."METODO_PAGO" where "ID_MetodoPago" = p_ID_MetodoPago;

    select "Logeo" into v_Logeo from public."USUARIO" where "ID_Usuario" = p_ID_Usuario;

    insert into public."MOVIMIENTO_CAJA"(
        "ID_AperturaCaja","ID_TipoMovimiento","ID_Concepto","ID_MetodoPago","ID_Usuario",
        "ID_Pedido","ID_Venta","Numero_Operacion","Documento","Descripcion","Monto",
        "Afecta_Efectivo","IP","Terminal","USUCRE","PCCRE"
    ) values (
        p_ID_AperturaCaja, v_ID_TipoMovimiento, p_ID_Concepto, p_ID_MetodoPago, p_ID_Usuario,
        p_ID_Pedido, p_ID_Venta, p_Numero_Operacion, p_Documento, p_Descripcion, p_Monto,
        case when v_Afecta = '1' and v_EsEfectivo = '1' then '1' else '0' end,
        current_setting('app.ip', true), inet_client_addr()::text, v_Logeo, inet_client_addr()::text
    );
end;
$$;

create or replace procedure public.usp_CerrarCaja(
    p_ID_AperturaCaja  int,
    p_ID_UsuarioCierre int,
    p_Monto_Declarado  numeric(12,2),
    p_Observacion      varchar(200) default null
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Ing numeric(12,2); v_Egr numeric(12,2);
    v_Ini numeric(12,2); v_Sis numeric(12,2);
    v_Logeo varchar(120);
begin
    if not (public.is_admin() or public.is_rol('CAJERO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_UsuarioCierre is null then
        select "ID_Usuario" into p_ID_UsuarioCierre from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_UsuarioCierre is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    if not exists (select 1 from public."APERTURA_CAJA"
                    where "ID_AperturaCaja" = p_ID_AperturaCaja and "Situacion" = 'A') then
        raise exception 'El turno de caja no existe o ya fue cerrado.';
    end if;

    select "Monto_Inicial" into v_Ini from public."APERTURA_CAJA"
     where "ID_AperturaCaja" = p_ID_AperturaCaja;

    select "Logeo" into v_Logeo from public."USUARIO"
     where "ID_Usuario" = p_ID_UsuarioCierre;

    select coalesce(sum(case when t."Signo" = '+' then m."Monto" else 0 end), 0),
           coalesce(sum(case when t."Signo" = '-' then m."Monto" else 0 end), 0)
      into v_Ing, v_Egr
      from public."MOVIMIENTO_CAJA" m
      join public."TIPO_MOVIMIENTO_CAJA" t on t."ID_TipoMovimiento" = m."ID_TipoMovimiento"
     where m."ID_AperturaCaja" = p_ID_AperturaCaja
       and m."Afecta_Efectivo" = '1' and m."ESTADO" = '1';

    v_Sis := v_Ini + v_Ing - v_Egr;

    update public."APERTURA_CAJA"
       set "ID_UsuarioCierre" = p_ID_UsuarioCierre,
           "F_Cierre" = now(),
           "Total_Ingresos" = v_Ing, "Total_Egresos" = v_Egr,
           "Monto_Sistema" = v_Sis,
           "Monto_Declarado" = p_Monto_Declarado,
           "Diferencia" = p_Monto_Declarado - v_Sis,
           "Situacion" = 'C',
           "Observacion" = coalesce(p_Observacion, "Observacion"),
           "USUMOD" = v_Logeo, "PCMOD" = inet_client_addr()::text, "FECMOD" = now()
     where "ID_AperturaCaja" = p_ID_AperturaCaja;

    update public."CAJA" c set "Aperturada" = '0', "FECMOD" = now()
      from public."APERTURA_CAJA" a
     where a."ID_Caja" = c."ID_Caja" and a."ID_AperturaCaja" = p_ID_AperturaCaja;

    insert into public."AUDITORIA"("ID_Usuario","N_Tabla","Accion","ID_Registro","Valor_Nuevo","Terminal","USUCRE")
    values (p_ID_UsuarioCierre,'APERTURA_CAJA','CIERRE',p_ID_AperturaCaja,
            'Sistema=' || v_Sis || '|Declarado=' || p_Monto_Declarado || '|Diferencia=' || (p_Monto_Declarado - v_Sis),
            inet_client_addr()::text, current_user);
end;
$$;

create or replace procedure public.usp_AbrirPedido(
    p_ID_Mesa         int,
    p_ID_Usuario      int,
    p_ID_TipoAtencion int,
    p_N_Comensales    int default 1,
    p_ID_Cliente      int default null,
    p_Observacion     varchar(200) default null,
    inout p_ID_Pedido int default null
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Count int; v_Nro varchar(15); v_Logeo varchar(120);
begin
    if not (public.is_admin() or public.is_rol('CAJERO') or public.is_rol('MOZO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_Usuario is null then
        select "ID_Usuario" into p_ID_Usuario from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_Usuario is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    select count(*)+1 into v_Count from public."PEDIDO" where "F_Pedido"::date = current_date;
    v_Nro := 'P' || to_char(current_timestamp, 'YYYYMMDD') || '-' || lpad(v_Count::text, 4, '0');
    select "Logeo" into v_Logeo from public."USUARIO" where "ID_Usuario" = p_ID_Usuario;

    insert into public."PEDIDO"(
        "ID_Mesa","ID_Cliente","ID_Usuario","ID_TipoAtencion","Numero_Pedido",
        "N_Comensales","Situacion","Observacion","USUCRE","PCCRE"
    ) values (
        p_ID_Mesa, p_ID_Cliente, p_ID_Usuario, p_ID_TipoAtencion, v_Nro,
        p_N_Comensales, 'P', p_Observacion, v_Logeo, inet_client_addr()::text
    ) returning "ID_Pedido" into p_ID_Pedido;

    if p_ID_Mesa is not null then
        update public."MESA" set "ID_EstadoMesa" = 2, "FECMOD" = now()
         where "ID_Mesa" = p_ID_Mesa;
    end if;
end;
$$;

create or replace procedure public.usp_AgregarItemPedido(
    p_ID_Pedido   int,
    p_ID_Producto int,
    p_Cantidad    numeric(10,2),
    p_Descuento   numeric(8,2) default 0,
    p_Nota        varchar(100) default null,
    p_ID_Usuario  int default null
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Precio numeric(8,2); v_Logeo varchar(120);
begin
    if not (public.is_admin() or public.is_rol('CAJERO') or public.is_rol('MOZO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_Usuario is null then
        select "ID_Usuario" into p_ID_Usuario from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_Usuario is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    if not exists (select 1 from public."PEDIDO"
                    where "ID_Pedido" = p_ID_Pedido and "Situacion" = 'P') then
        raise exception 'El pedido no existe o ya no admite modificaciones.';
    end if;

    select "Precio" into v_Precio from public."PRODUCTO"
     where "ID_Producto" = p_ID_Producto and "ESTADO" = '1';

    if v_Precio is null then
        raise exception 'Producto inexistente o inactivo.';
    end if;

    select "Logeo" into v_Logeo from public."USUARIO" where "ID_Usuario" = p_ID_Usuario;

    insert into public."DETALLE_PEDIDO"(
        "ID_Pedido","ID_Producto","Cantidad","Precio","Descuento","Nota","USUCRE","PCCRE"
    ) values (
        p_ID_Pedido, p_ID_Producto, p_Cantidad, v_Precio, p_Descuento, p_Nota,
        v_Logeo, inet_client_addr()::text
    );

    update public."PEDIDO" p
       set "Total" = (
            select coalesce(sum("Sub_Total"),0) from public."DETALLE_PEDIDO"
             where "ID_Pedido" = p_ID_Pedido and "Situacion" <> 'X' and "ESTADO" = '1'
           ),
           "FECMOD" = now()
     where p."ID_Pedido" = p_ID_Pedido;
end;
$$;

create or replace procedure public.usp_FacturarPedido(
    p_ID_Pedido       int,
    p_ID_Cliente      int,
    p_ID_Usuario      int,
    p_ID_AperturaCaja int,
    p_TipoDocumento   char(2),
    p_ID_MetodoPago   int,
    p_MontoRecibido   numeric(10,2),
    p_Referencia      varchar(50) default null,
    p_Descuento       numeric(10,2) default 0,
    inout p_ID_Venta  int default null
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Total numeric(10,2); v_SubTotal numeric(10,2); v_IGV numeric(10,2);
    v_Tasa numeric(5,4) := 0.18;
    v_Count int; v_NroVenta varchar(15); v_Logeo varchar(120);
    v_Serie char(4); v_Corr int;
    v_EsEfectivo char(1); v_NomMetodo varchar(30);
    v_ID_Concepto int;
begin
    if not (public.is_admin() or public.is_rol('CAJERO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_Usuario is null then
        select "ID_Usuario" into p_ID_Usuario from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_Usuario is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    if not exists (select 1 from public."PEDIDO"
                    where "ID_Pedido" = p_ID_Pedido and "Situacion" in ('P','A')) then
        raise exception 'El pedido no existe o ya fue facturado/anulado.';
    end if;

    if not exists (select 1 from public."APERTURA_CAJA"
                    where "ID_AperturaCaja" = p_ID_AperturaCaja and "Situacion" = 'A') then
        raise exception 'No existe un turno de caja abierto para registrar la venta.';
    end if;

    if p_TipoDocumento = '01' and not exists (
        select 1 from public."CLIENTE"
         where "ID_Cliente" = p_ID_Cliente and "Tipo_Cliente" = 'J') then
        raise exception 'Solo se puede emitir FACTURA a un cliente juridico con RUC.';
    end if;

    select coalesce(sum("Sub_Total"),0) into v_Total
      from public."DETALLE_PEDIDO"
     where "ID_Pedido" = p_ID_Pedido and "Situacion" <> 'X' and "ESTADO" = '1';

    v_Total := v_Total - coalesce(p_Descuento,0);
    v_SubTotal := round(v_Total / (1 + v_Tasa), 2);
    v_IGV := v_Total - v_SubTotal;

    if p_MontoRecibido < v_Total then
        raise exception 'El monto recibido es menor al total de la venta.';
    end if;

    select count(*)+1 into v_Count from public."VENTA" where "F_Venta"::date = current_date;
    v_NroVenta := 'V' || to_char(current_timestamp, 'YYYYMMDD') || '-' || lpad(v_Count::text, 4, '0');
    select "Logeo" into v_Logeo from public."USUARIO" where "ID_Usuario" = p_ID_Usuario;

    insert into public."VENTA"(
        "ID_Pedido","ID_Cliente","ID_Usuario","ID_AperturaCaja","Numero_Venta",
        "TipoDocumento","Sub_Total","Descuento","IGV","Total","T_Pagado","Vuelto",
        "Situacion","USUCRE","PCCRE"
    ) values (
        p_ID_Pedido, p_ID_Cliente, p_ID_Usuario, p_ID_AperturaCaja, v_NroVenta,
        p_TipoDocumento, v_SubTotal, coalesce(p_Descuento,0), v_IGV, v_Total,
        p_MontoRecibido, p_MontoRecibido - v_Total, 'E', v_Logeo, inet_client_addr()::text
    ) returning "ID_Venta" into p_ID_Venta;

    insert into public."DETALLE_VENTA"(
        "ID_Venta","ID_Producto","Cantidad","Precio","Descuento","Sub_Total","USUCRE","PCCRE"
    )
    select p_ID_Venta, d."ID_Producto", d."Cantidad", d."Precio", d."Descuento",
           d."Sub_Total", v_Logeo, inet_client_addr()::text
      from public."DETALLE_PEDIDO" d
     where d."ID_Pedido" = p_ID_Pedido and d."Situacion" <> 'X' and d."ESTADO" = '1';

    select "Serie", "Correlativo" into v_Serie, v_Corr
      from public."SERIE_COMPROBANTE"
     where "TipoDocumento" = p_TipoDocumento and "ESTADO" = '1'
     limit 1
       for update;

    if v_Serie is null then
        raise exception 'No hay serie configurada para el tipo de documento.';
    end if;

    v_Corr := v_Corr + 1;

    update public."SERIE_COMPROBANTE"
       set "Correlativo" = v_Corr, "FECMOD" = now()
     where "TipoDocumento" = p_TipoDocumento and "ESTADO" = '1';

    if p_TipoDocumento = '03' then
        insert into public."BOLETA"("ID_Venta","Serie","Numero","Cliente_Doc","Cliente_Nombre","USUCRE","PCCRE")
        select p_ID_Venta, v_Serie, lpad(v_Corr::text, 8, '0'),
               p."N_Documento", trim(p."Ap_Paterno" || ' ' || p."Ap_Materno" || ' ' || p."Nombre"),
               v_Logeo, inet_client_addr()::text
          from public."CLIENTE" c
          left join public."PERSONA" p on p."ID_Persona" = c."ID_Persona"
         where c."ID_Cliente" = p_ID_Cliente;
    else
        insert into public."FACTURA"("ID_Venta","Serie","Numero","RUC","Razon_Social","Direccion_Fiscal","USUCRE","PCCRE")
        select p_ID_Venta, v_Serie, lpad(v_Corr::text, 8, '0'),
               e."RUC", e."Razon_Social", e."Direccion", v_Logeo, inet_client_addr()::text
          from public."CLIENTE" c
          join public."EMPRESA" e on e."ID_Empresa" = c."ID_Empresa"
         where c."ID_Cliente" = p_ID_Cliente;
    end if;

    insert into public."PAGO_VENTA"("ID_Venta","ID_MetodoPago","Monto","Referencia","USUCRE","PCCRE")
    values (p_ID_Venta, p_ID_MetodoPago, v_Total, p_Referencia, v_Logeo, inet_client_addr()::text);

    select "Es_Efectivo","N_MetodoPago" into v_EsEfectivo, v_NomMetodo
      from public."METODO_PAGO" where "ID_MetodoPago" = p_ID_MetodoPago;

    if v_EsEfectivo = '1' then
        select "ID_Concepto" into v_ID_Concepto from public."CONCEPTO_CAJA" where "N_Concepto" = 'VENTA AL CONTADO';
    elsif v_NomMetodo like 'TARJETA%' then
        select "ID_Concepto" into v_ID_Concepto from public."CONCEPTO_CAJA" where "N_Concepto" = 'VENTA CON TARJETA';
    else
        select "ID_Concepto" into v_ID_Concepto from public."CONCEPTO_CAJA" where "N_Concepto" = 'VENTA BILLETERA DIGITAL';
    end if;

    call public.usp_RegistrarMovimientoCaja(
         p_ID_AperturaCaja := p_ID_AperturaCaja,
         p_ID_Concepto     := v_ID_Concepto,
         p_ID_MetodoPago   := p_ID_MetodoPago,
         p_ID_Usuario      := p_ID_Usuario,
         p_Monto           := v_Total,
         p_Descripcion     := 'Cobro de venta',
         p_Documento       := v_NroVenta,
         p_Numero_Operacion:= p_Referencia,
         p_ID_Venta        := p_ID_Venta,
         p_ID_Pedido       := p_ID_Pedido
    );

    update public."PRODUCTO" p
       set "Stock_Actual" = p."Stock_Actual" - dv."Cantidad",
           "FECMOD" = now(), "USUMOD" = v_Logeo
      from public."DETALLE_VENTA" dv
     where dv."ID_Producto" = p."ID_Producto"
       and dv."ID_Venta" = p_ID_Venta
       and p."Controla_Stock" = '1';

    update public."PEDIDO"
       set "Situacion" = 'F', "F_Cierre" = now(), "ID_Cliente" = p_ID_Cliente,
           "USUMOD" = v_Logeo, "PCMOD" = inet_client_addr()::text, "FECMOD" = now()
     where "ID_Pedido" = p_ID_Pedido;

    update public."MESA" m set "ID_EstadoMesa" = 1, "FECMOD" = now()
      from public."PEDIDO" p
     where p."ID_Mesa" = m."ID_Mesa" and p."ID_Pedido" = p_ID_Pedido;
end;
$$;

create or replace procedure public.usp_AnularVenta(
    p_ID_Venta   int,
    p_ID_Usuario int,
    p_Motivo     varchar(200)
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_Logeo varchar(120); v_Apert int; v_Total numeric(12,2);
    v_Met int; v_Concepto int;
begin
    if not (public.is_admin() or public.is_rol('CAJERO')) then
        raise exception 'Permiso denegado';
    end if;

    if p_ID_Usuario is null then
        select "ID_Usuario" into p_ID_Usuario from public."USUARIO"
         where "auth_id" = auth.uid() limit 1;
        if p_ID_Usuario is null then
            raise exception 'No se pudo resolver el usuario de sesión';
        end if;
    end if;

    if not exists (select 1 from public."VENTA"
                    where "ID_Venta" = p_ID_Venta and "Situacion" = 'E') then
        raise exception 'La venta no existe o ya se encuentra anulada.';
    end if;

    select "Logeo" into v_Logeo from public."USUARIO" where "ID_Usuario" = p_ID_Usuario;
    select "ID_AperturaCaja","Total" into v_Apert, v_Total
      from public."VENTA" where "ID_Venta" = p_ID_Venta;
    select "ID_MetodoPago" into v_Met
      from public."PAGO_VENTA" where "ID_Venta" = p_ID_Venta limit 1;

    update public."VENTA"
       set "Situacion" = 'X', "Observacion" = p_Motivo,
           "USUMOD" = v_Logeo, "PCMOD" = inet_client_addr()::text, "FECMOD" = now()
     where "ID_Venta" = p_ID_Venta;

    update public."PRODUCTO" p
       set "Stock_Actual" = p."Stock_Actual" + dv."Cantidad", "FECMOD" = now()
      from public."DETALLE_VENTA" dv
     where dv."ID_Producto" = p."ID_Producto"
       and dv."ID_Venta" = p_ID_Venta
       and p."Controla_Stock" = '1';

    if exists (select 1 from public."APERTURA_CAJA"
                where "ID_AperturaCaja" = v_Apert and "Situacion" = 'A') then
        select "ID_Concepto" into v_Concepto
          from public."CONCEPTO_CAJA" where "N_Concepto" = 'VUELTO / DEVOLUCION';

        call public.usp_RegistrarMovimientoCaja(
             p_ID_AperturaCaja := v_Apert,
             p_ID_Concepto     := v_Concepto,
             p_ID_MetodoPago   := v_Met,
             p_ID_Usuario      := p_ID_Usuario,
             p_Monto           := v_Total,
             p_Descripcion     := 'Anulacion de venta',
             p_ID_Venta        := p_ID_Venta
        );
    end if;
end;
$$;
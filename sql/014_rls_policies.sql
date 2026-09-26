-- ============================================================================
-- 014_rls_policies.sql
-- Row Level Security + función is_admin()
-- ============================================================================

-- Helper: ¿el usuario autenticado es admin?
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

-- Helper: ¿el usuario autenticado tiene un rol concreto?
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

-- Helper: ¿es operativo (CAJERO o MOZO)?
create or replace function public.is_operativo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select public.is_rol('CAJERO') or public.is_rol('MOZO');
$$;

-- Helper: ¿el auth.uid() es el dueño del cliente X?
create or replace function public.is_owner_cliente(p_id_cliente integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
          from public."USUARIO" u
         where u."auth_id" = auth.uid()
           and u."ID_Cliente" = p_id_cliente
           and u."ESTADO" = '1'
    );
$$;

-- ---------------------------------------------------------------------------
-- Protección de columnas sensibles en USUARIO
-- Un cliente puede editar su fila pero NO cambiar ID_TipoUsuario, ID_Empleado,
-- ID_Cliente ni auth_id salvo que sea admin.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Habilitar RLS en todas las tablas
-- ---------------------------------------------------------------------------
alter table public."DEPARTAMENTO"         enable row level security;
alter table public."PROVINCIA"            enable row level security;
alter table public."DISTRITO"             enable row level security;
alter table public."TIPO_IDENTIDAD"       enable row level security;
alter table public."PERSONA"              enable row level security;
alter table public."EMPRESA"              enable row level security;
alter table public."CLIENTE"              enable row level security;
alter table public."CARGO"                enable row level security;
alter table public."CONTRATO"             enable row level security;
alter table public."EMPLEADO"             enable row level security;
alter table public."TIPO_USUARIO"         enable row level security;
alter table public."USUARIO"              enable row level security;
alter table public."MODULO"               enable row level security;
alter table public."ROL"                  enable row level security;
alter table public."PERMISO"              enable row level security;
alter table public."ROL_PERMISO"          enable row level security;
alter table public."USUARIO_ROL"          enable row level security;
alter table public."AUDITORIA"            enable row level security;
alter table public."UNIDAD_MEDIDA"        enable row level security;
alter table public."CATEGORIA_PRODUCTO"   enable row level security;
alter table public."PRODUCTO"             enable row level security;
alter table public."ZONA"                 enable row level security;
alter table public."ESTADO_MESA"          enable row level security;
alter table public."MESA"                 enable row level security;
alter table public."TIPO_ATENCION"        enable row level security;
alter table public."METODO_PAGO"          enable row level security;
alter table public."SERIE_COMPROBANTE"    enable row level security;
alter table public."CAJA"                 enable row level security;
alter table public."APERTURA_CAJA"        enable row level security;
alter table public."TIPO_MOVIMIENTO_CAJA" enable row level security;
alter table public."CONCEPTO_CAJA"        enable row level security;
alter table public."MOVIMIENTO_CAJA"      enable row level security;
alter table public."PEDIDO"               enable row level security;
alter table public."DETALLE_PEDIDO"       enable row level security;
alter table public."VENTA"                enable row level security;
alter table public."DETALLE_VENTA"        enable row level security;
alter table public."BOLETA"               enable row level security;
alter table public."FACTURA"              enable row level security;
alter table public."PAGO_VENTA"           enable row level security;
alter table public."RESERVA"              enable row level security;
alter table public."MENSAJE"              enable row level security;

-- ---------------------------------------------------------------------------
-- Catálogo público (solo lectura para todos, escritura para admin)
-- ---------------------------------------------------------------------------
create policy "p_categorias_select_all"
    on public."CATEGORIA_PRODUCTO" for select using (true);
create policy "p_categorias_admin_all"
    on public."CATEGORIA_PRODUCTO" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_productos_select_all"
    on public."PRODUCTO" for select using (true);
create policy "p_productos_admin_all"
    on public."PRODUCTO" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_unidad_medida_select_all"
    on public."UNIDAD_MEDIDA" for select using (true);
create policy "p_unidad_medida_admin_all"
    on public."UNIDAD_MEDIDA" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_tipo_atencion_select_all"
    on public."TIPO_ATENCION" for select using (true);
create policy "p_tipo_atencion_admin_all"
    on public."TIPO_ATENCION" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_metodo_pago_select_all"
    on public."METODO_PAGO" for select using (true);
create policy "p_metodo_pago_admin_all"
    on public."METODO_PAGO" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_zona_select_all"
    on public."ZONA" for select using (true);
create policy "p_zona_admin_all"
    on public."ZONA" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_estado_mesa_select_all"
    on public."ESTADO_MESA" for select using (true);
create policy "p_estado_mesa_admin_all"
    on public."ESTADO_MESA" for all using (public.is_admin()) with check (public.is_admin());

create policy "p_mesa_select_all"
    on public."MESA" for select using (true);
create policy "p_mesa_admin_all"
    on public."MESA" for all using (public.is_admin()) with check (public.is_admin());
create policy "p_mesa_operativo_update"
    on public."MESA" for update
    using (public.is_operativo())
    with check (public.is_operativo());

-- ---------------------------------------------------------------------------
-- USUARIO: cada usuario ve/edita su fila; admin todo
-- ---------------------------------------------------------------------------
create policy "p_usuario_select_own"
    on public."USUARIO" for select
    using ("auth_id" = auth.uid() or public.is_admin());

create policy "p_usuario_update_own"
    on public."USUARIO" for update
    using ("auth_id" = auth.uid() or public.is_admin())
    with check ("auth_id" = auth.uid() or public.is_admin());

create policy "p_usuario_admin_all"
    on public."USUARIO" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- CLIENTE: dueño o admin
-- ---------------------------------------------------------------------------
create policy "p_cliente_select_own_or_admin"
    on public."CLIENTE" for select
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin());

create policy "p_cliente_update_own_or_admin"
    on public."CLIENTE" for update
    using (public.is_owner_cliente("ID_Cliente") or public.is_admin())
    with check (public.is_owner_cliente("ID_Cliente") or public.is_admin());

create policy "p_cliente_admin_all"
    on public."CLIENTE" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PERSONA: dueño o admin
-- ---------------------------------------------------------------------------
create policy "p_persona_select_own_or_admin"
    on public."PERSONA" for select
    using (
        public.is_admin()
        or exists (
            select 1 from public."CLIENTE" c
             where c."ID_Persona" = "PERSONA"."ID_Persona"
               and public.is_owner_cliente(c."ID_Cliente")
        )
    );

create policy "p_persona_update_own_or_admin"
    on public."PERSONA" for update
    using (
        public.is_admin()
        or exists (
            select 1 from public."CLIENTE" c
             where c."ID_Persona" = "PERSONA"."ID_Persona"
               and public.is_owner_cliente(c."ID_Cliente")
        )
    )
    with check (
        public.is_admin()
        or exists (
            select 1 from public."CLIENTE" c
             where c."ID_Persona" = "PERSONA"."ID_Persona"
               and public.is_owner_cliente(c."ID_Cliente")
        )
    );

create policy "p_persona_admin_all"
    on public."PERSONA" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PEDIDO: dueño o admin
-- ---------------------------------------------------------------------------
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

create policy "p_pedido_admin_all"
    on public."PEDIDO" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- DETALLE_PEDIDO: depende del pedido padre
-- ---------------------------------------------------------------------------
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

create policy "p_detped_admin_all"
    on public."DETALLE_PEDIDO" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RESERVA: dueño o admin
-- ---------------------------------------------------------------------------
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

create policy "p_reserva_admin_all"
    on public."RESERVA" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- MENSAJE: dueño o admin
-- ---------------------------------------------------------------------------
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

create policy "p_mensaje_admin_all"
    on public."MENSAJE" for all
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Resto de tablas: solo admin
-- ---------------------------------------------------------------------------
do $$
declare
    t text;
    tablas_admin text[] := array[
        'DEPARTAMENTO','PROVINCIA','DISTRITO','TIPO_IDENTIDAD','EMPRESA',
        'CARGO','CONTRATO','EMPLEADO','TIPO_USUARIO','MODULO','ROL',
        'PERMISO','ROL_PERMISO','USUARIO_ROL','AUDITORIA',
        'SERIE_COMPROBANTE','CAJA','APERTURA_CAJA','TIPO_MOVIMIENTO_CAJA',
        'CONCEPTO_CAJA','MOVIMIENTO_CAJA','VENTA','DETALLE_VENTA',
        'BOLETA','FACTURA','PAGO_VENTA'
    ];
begin
    foreach t in array tablas_admin loop
        execute format(
            'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin());',
            'p_' || lower(t) || '_admin_all',
            t
        );
    end loop;
end $$;
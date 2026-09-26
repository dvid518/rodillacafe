-- ============================================================================
-- 010_ventas.sql
-- PEDIDO, DETALLE_PEDIDO, VENTA, DETALLE_VENTA, BOLETA, FACTURA, PAGO_VENTA
-- + ALTER TABLE para añadir las FK de MOVIMIENTO_CAJA -> PEDIDO / VENTA
-- ============================================================================

-- drop table if exists public."PAGO_VENTA" cascade;
-- drop table if exists public."FACTURA" cascade;
-- drop table if exists public."BOLETA" cascade;
-- drop table if exists public."DETALLE_VENTA" cascade;
-- drop table if exists public."VENTA" cascade;
-- drop table if exists public."DETALLE_PEDIDO" cascade;
-- drop table if exists public."PEDIDO" cascade;

-- ----------------------------------------------------------------------------
-- PEDIDO
-- ----------------------------------------------------------------------------
create table public."PEDIDO" (
    "ID_Pedido"       integer       generated always as identity primary key,
    "ID_Mesa"         integer       null,
    "ID_Cliente"      integer       null,
    "ID_Usuario"      integer       not null,
    "ID_TipoAtencion" integer       not null,
    "Numero_Pedido"   varchar(15)   not null,
    "F_Pedido"        timestamptz   not null default now(),
    "F_Cierre"        timestamptz   null,
    "N_Comensales"    integer       not null default 1,
    "Total"           numeric(10,2) not null default 0,
    "Situacion"       char(1)       not null default 'P',
    "Observacion"     varchar(200)  null,
    "USUCRE"          varchar(30)   not null,
    "PCCRE"           varchar(30)   null,
    "FECCRE"          timestamptz   not null default now(),
    "USUMOD"          varchar(30)   null,
    "PCMOD"           varchar(30)   null,
    "FECMOD"          timestamptz   null,
    "ESTADO"          char(1)       not null default '1',
    constraint "FK_PEDIDO_MESA"
        foreign key ("ID_Mesa") references public."MESA"("ID_Mesa"),
    constraint "FK_PEDIDO_CLIENTE"
        foreign key ("ID_Cliente") references public."CLIENTE"("ID_Cliente"),
    constraint "FK_PEDIDO_USUARIO"
        foreign key ("ID_Usuario") references public."USUARIO"("ID_Usuario"),
    constraint "FK_PEDIDO_TIPOATENCION"
        foreign key ("ID_TipoAtencion")
        references public."TIPO_ATENCION"("ID_TipoAtencion"),
    constraint "UQ_PEDIDO_NUMERO" unique ("Numero_Pedido"),
    constraint "CK_PEDIDO_SITUACION" check ("Situacion" in ('P','A','F','X'))
);

-- ----------------------------------------------------------------------------
-- DETALLE_PEDIDO
-- ----------------------------------------------------------------------------
create table public."DETALLE_PEDIDO" (
    "ID_DetallePedido" integer       generated always as identity primary key,
    "ID_Pedido"        integer       not null,
    "ID_Producto"      integer       not null,
    "Cantidad"         numeric(10,2) not null,
    "Precio"           numeric(8,2)  not null,
    "Descuento"        numeric(8,2)  not null default 0,
    "Sub_Total"        numeric(10,2)
        generated always as (("Cantidad" * "Precio") - "Descuento") stored,
    "Nota"             varchar(100)  null,
    "Situacion"        char(1)       not null default 'P',
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_DETPED_PEDIDO"
        foreign key ("ID_Pedido") references public."PEDIDO"("ID_Pedido"),
    constraint "FK_DETPED_PRODUCTO"
        foreign key ("ID_Producto") references public."PRODUCTO"("ID_Producto"),
    constraint "CK_DETPED_CANTIDAD" check ("Cantidad" > 0)
);

-- ----------------------------------------------------------------------------
-- VENTA
-- ----------------------------------------------------------------------------
create table public."VENTA" (
    "ID_Venta"        integer       generated always as identity primary key,
    "ID_Pedido"       integer       null,
    "ID_Cliente"      integer       not null,
    "ID_Usuario"      integer       not null,
    "ID_AperturaCaja" integer       not null,
    "Numero_Venta"    varchar(15)   not null,
    "F_Venta"         timestamptz   not null default now(),
    "TipoDocumento"   char(2)       not null,
    "Sub_Total"       numeric(10,2) not null default 0,
    "Descuento"       numeric(10,2) not null default 0,
    "IGV"             numeric(10,2) not null default 0,
    "Total"           numeric(10,2) not null default 0,
    "T_Pagado"        numeric(10,2) not null default 0,
    "Vuelto"          numeric(10,2) not null default 0,
    "Situacion"       char(1)       not null default 'E',
    "Observacion"     varchar(200)  null,
    "USUCRE"          varchar(30)   not null,
    "PCCRE"           varchar(30)   null,
    "FECCRE"          timestamptz   not null default now(),
    "USUMOD"          varchar(30)   null,
    "PCMOD"           varchar(30)   null,
    "FECMOD"          timestamptz   null,
    "ESTADO"          char(1)       not null default '1',
    constraint "FK_VENTA_PEDIDO"
        foreign key ("ID_Pedido") references public."PEDIDO"("ID_Pedido"),
    constraint "FK_VENTA_CLIENTE"
        foreign key ("ID_Cliente") references public."CLIENTE"("ID_Cliente"),
    constraint "FK_VENTA_USUARIO"
        foreign key ("ID_Usuario") references public."USUARIO"("ID_Usuario"),
    constraint "FK_VENTA_APERTURACAJA"
        foreign key ("ID_AperturaCaja")
        references public."APERTURA_CAJA"("ID_AperturaCaja"),
    constraint "UQ_VENTA_NUMERO" unique ("Numero_Venta"),
    constraint "CK_VENTA_TIPODOC" check ("TipoDocumento" in ('01','03')),
    constraint "CK_VENTA_SITUACION" check ("Situacion" in ('E','X'))
);

-- ----------------------------------------------------------------------------
-- DETALLE_VENTA
-- ----------------------------------------------------------------------------
create table public."DETALLE_VENTA" (
    "ID_Detalle"  integer       generated always as identity primary key,
    "ID_Venta"    integer       not null,
    "ID_Producto" integer       not null,
    "Cantidad"    numeric(10,2) not null,
    "Precio"      numeric(8,2)  not null,
    "Descuento"   numeric(8,2)  not null default 0,
    "Sub_Total"   numeric(10,2) not null,
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1',
    constraint "FK_DETVEN_VENTA"
        foreign key ("ID_Venta") references public."VENTA"("ID_Venta"),
    constraint "FK_DETVEN_PRODUCTO"
        foreign key ("ID_Producto") references public."PRODUCTO"("ID_Producto"),
    constraint "CK_DETVEN_CANTIDAD" check ("Cantidad" > 0)
);

-- ----------------------------------------------------------------------------
-- BOLETA
-- ----------------------------------------------------------------------------
create table public."BOLETA" (
    "ID_Boleta"       integer       generated always as identity primary key,
    "ID_Venta"        integer       not null,
    "F_Emision"       timestamptz   not null default now(),
    "Serie"           char(4)       not null,
    "Numero"          char(8)       not null,
    "Cliente_Doc"     varchar(15)   null,
    "Cliente_Nombre"  varchar(200)  null,
    "Hash_SUNAT"      varchar(100)  null,
    "Situacion_SUNAT" char(1)       not null default 'P',
    "USUCRE"          varchar(30)   not null,
    "PCCRE"           varchar(30)   null,
    "FECCRE"          timestamptz   not null default now(),
    "USUMOD"          varchar(30)   null,
    "PCMOD"           varchar(30)   null,
    "FECMOD"          timestamptz   null,
    "ESTADO"          char(1)       not null default '1',
    constraint "FK_BOLETA_VENTA"
        foreign key ("ID_Venta") references public."VENTA"("ID_Venta"),
    constraint "UQ_BOLETA_NUMERO" unique ("Serie", "Numero"),
    constraint "UQ_BOLETA_VENTA" unique ("ID_Venta")
);

-- ----------------------------------------------------------------------------
-- FACTURA
-- ----------------------------------------------------------------------------
create table public."FACTURA" (
    "ID_Factura"       integer       generated always as identity primary key,
    "ID_Venta"         integer       not null,
    "F_Emision"        timestamptz   not null default now(),
    "Serie"            char(4)       not null,
    "Numero"           char(8)       not null,
    "RUC"              char(11)      not null,
    "Razon_Social"     varchar(140)  not null,
    "Direccion_Fiscal" varchar(150)  null,
    "Hash_SUNAT"       varchar(100)  null,
    "Situacion_SUNAT"  char(1)       not null default 'P',
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_FACTURA_VENTA"
        foreign key ("ID_Venta") references public."VENTA"("ID_Venta"),
    constraint "UQ_FACTURA_NUMERO" unique ("Serie", "Numero"),
    constraint "UQ_FACTURA_VENTA" unique ("ID_Venta")
);

-- ----------------------------------------------------------------------------
-- PAGO_VENTA
-- ----------------------------------------------------------------------------
create table public."PAGO_VENTA" (
    "ID_PagoVenta"  integer       generated always as identity primary key,
    "ID_Venta"      integer       not null,
    "ID_MetodoPago" integer       not null,
    "Monto"         numeric(10,2) not null,
    "Referencia"    varchar(50)   null,
    "F_Pago"        timestamptz   not null default now(),
    "USUCRE"        varchar(30)   not null,
    "PCCRE"         varchar(30)   null,
    "FECCRE"        timestamptz   not null default now(),
    "USUMOD"        varchar(30)   null,
    "PCMOD"         varchar(30)   null,
    "FECMOD"        timestamptz   null,
    "ESTADO"        char(1)       not null default '1',
    constraint "FK_PAGOVEN_VENTA"
        foreign key ("ID_Venta") references public."VENTA"("ID_Venta"),
    constraint "FK_PAGOVEN_METODOPAGO"
        foreign key ("ID_MetodoPago")
        references public."METODO_PAGO"("ID_MetodoPago"),
    constraint "CK_PAGOVEN_MONTO" check ("Monto" > 0)
);

-- ============================================================================
-- FK PENDIENTES DE MOVIMIENTO_CAJA
-- (creada en 009_caja.sql SIN estas dos FK porque PEDIDO y VENTA
--  todavía no existían)
-- ============================================================================
alter table public."MOVIMIENTO_CAJA"
    add constraint "FK_MOVCAJA_PEDIDO"
        foreign key ("ID_Pedido") references public."PEDIDO"("ID_Pedido"),
    add constraint "FK_MOVCAJA_VENTA"
        foreign key ("ID_Venta") references public."VENTA"("ID_Venta");
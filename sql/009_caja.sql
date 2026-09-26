-- ============================================================================
-- 009_caja.sql
-- CAJA, APERTURA_CAJA, TIPO_MOVIMIENTO_CAJA, CONCEPTO_CAJA, MOVIMIENTO_CAJA
--
-- IMPORTANTE:
--   MOVIMIENTO_CAJA NO crea aquí las FK hacia PEDIDO ni VENTA
--   porque esas tablas todavía no existen. Se añaden al final de
--   010_ventas.sql mediante ALTER TABLE.
-- ============================================================================

-- drop table if exists public."MOVIMIENTO_CAJA" cascade;
-- drop table if exists public."CONCEPTO_CAJA" cascade;
-- drop table if exists public."TIPO_MOVIMIENTO_CAJA" cascade;
-- drop table if exists public."APERTURA_CAJA" cascade;
-- drop table if exists public."CAJA" cascade;

-- ----------------------------------------------------------------------------
-- CAJA
-- ----------------------------------------------------------------------------
create table public."CAJA" (
    "ID_Caja"        integer       generated always as identity primary key,
    "N_Caja"         varchar(50)   not null,
    "Descripcion"    varchar(100)  null,
    "Ubicacion"      varchar(100)  null,
    "Serie_Terminal" varchar(30)   null,
    "Moneda"         char(3)       not null default 'PEN',
    "Monto_Base"     numeric(12,2) not null default 0,
    "Aperturada"     char(1)       not null default '0',
    "F_Creacion"     timestamptz   not null default now(),
    "USUCRE"         varchar(30)   not null,
    "PCCRE"          varchar(30)   null,
    "FECCRE"         timestamptz   not null default now(),
    "USUMOD"         varchar(30)   null,
    "PCMOD"          varchar(30)   null,
    "FECMOD"         timestamptz   null,
    "ESTADO"         char(1)       not null default '1'
);

-- ----------------------------------------------------------------------------
-- APERTURA_CAJA
-- ----------------------------------------------------------------------------
create table public."APERTURA_CAJA" (
    "ID_AperturaCaja"  integer       generated always as identity primary key,
    "ID_Caja"          integer       not null,
    "ID_Usuario"       integer       not null,
    "ID_UsuarioCierre" integer       null,
    "Numero_Turno"     varchar(20)   not null,
    "F_Apertura"       timestamptz   not null default now(),
    "F_Cierre"         timestamptz   null,
    "Monto_Inicial"    numeric(12,2) not null default 0,
    "Total_Ingresos"   numeric(12,2) not null default 0,
    "Total_Egresos"    numeric(12,2) not null default 0,
    "Monto_Sistema"    numeric(12,2) not null default 0,
    "Monto_Declarado"  numeric(12,2) not null default 0,
    "Diferencia"       numeric(12,2) not null default 0,
    "Situacion"        char(1)       not null default 'A',
    "Observacion"      varchar(200)  null,
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_APERCAJA_CAJA"
        foreign key ("ID_Caja") references public."CAJA"("ID_Caja"),
    constraint "FK_APERCAJA_USUARIO"
        foreign key ("ID_Usuario") references public."USUARIO"("ID_Usuario"),
    constraint "FK_APERCAJA_USUARIOCIERRE"
        foreign key ("ID_UsuarioCierre") references public."USUARIO"("ID_Usuario"),
    constraint "CK_APERCAJA_SITUACION" check ("Situacion" in ('A','C'))
);

-- ----------------------------------------------------------------------------
-- TIPO_MOVIMIENTO_CAJA
-- ----------------------------------------------------------------------------
create table public."TIPO_MOVIMIENTO_CAJA" (
    "ID_TipoMovimiento" integer      generated always as identity primary key,
    "N_TipoMovimiento"  varchar(30)  not null,
    "Abreviatura"       varchar(10)  not null,
    "Signo"             char(1)      not null,
    "F_Creacion"        timestamptz  not null default now(),
    "USUCRE"            varchar(30)  not null,
    "PCCRE"             varchar(30)  null,
    "FECCRE"            timestamptz  not null default now(),
    "USUMOD"            varchar(30)  null,
    "PCMOD"             varchar(30)  null,
    "FECMOD"            timestamptz  null,
    "ESTADO"            char(1)      not null default '1',
    constraint "CK_TIPOMOVCAJA_SIGNO" check ("Signo" in ('+','-'))
);

-- ----------------------------------------------------------------------------
-- CONCEPTO_CAJA
-- ----------------------------------------------------------------------------
create table public."CONCEPTO_CAJA" (
    "ID_Concepto"       integer       generated always as identity primary key,
    "ID_TipoMovimiento" integer       not null,
    "N_Concepto"        varchar(60)   not null,
    "Descripcion"       varchar(150)  null,
    "Afecta_Efectivo"   char(1)       not null default '1',
    "F_Creacion"        timestamptz   not null default now(),
    "USUCRE"            varchar(30)   not null,
    "PCCRE"             varchar(30)   null,
    "FECCRE"            timestamptz   not null default now(),
    "USUMOD"            varchar(30)   null,
    "PCMOD"             varchar(30)   null,
    "FECMOD"            timestamptz   null,
    "ESTADO"            char(1)       not null default '1',
    constraint "FK_CONCAJA_TIPOMOV"
        foreign key ("ID_TipoMovimiento")
        references public."TIPO_MOVIMIENTO_CAJA"("ID_TipoMovimiento")
);

-- ----------------------------------------------------------------------------
-- MOVIMIENTO_CAJA
--   Sin FK a PEDIDO ni VENTA (se añaden en 010_ventas.sql).
-- ----------------------------------------------------------------------------
create table public."MOVIMIENTO_CAJA" (
    "ID_MovimientoCaja" integer       generated always as identity primary key,
    "ID_AperturaCaja"   integer       not null,
    "ID_TipoMovimiento" integer       not null,
    "ID_Concepto"       integer       not null,
    "ID_MetodoPago"     integer       not null,
    "ID_Usuario"        integer       not null,
    "ID_Pedido"         integer       null,   -- FK se añade en 010
    "ID_Venta"          integer       null,   -- FK se añade en 010
    "Numero_Operacion"  varchar(30)   null,
    "Documento"         varchar(200)  null,
    "Descripcion"       varchar(200)  null,
    "Monto"             numeric(12,2) not null,
    "Afecta_Efectivo"   char(1)       not null default '1',
    "F_Movimiento"      timestamptz   not null default now(),
    "IP"                varchar(45)   null,
    "Terminal"          varchar(30)   null,
    "USUCRE"            varchar(30)   not null,
    "PCCRE"             varchar(30)   null,
    "FECCRE"            timestamptz   not null default now(),
    "USUMOD"            varchar(30)   null,
    "PCMOD"             varchar(30)   null,
    "FECMOD"            timestamptz   null,
    "ESTADO"            char(1)       not null default '1',
    constraint "FK_MOVCAJA_APERTURACAJA"
        foreign key ("ID_AperturaCaja")
        references public."APERTURA_CAJA"("ID_AperturaCaja"),
    constraint "FK_MOVCAJA_TIPOMOV"
        foreign key ("ID_TipoMovimiento")
        references public."TIPO_MOVIMIENTO_CAJA"("ID_TipoMovimiento"),
    constraint "FK_MOVCAJA_CONCEPTO"
        foreign key ("ID_Concepto")
        references public."CONCEPTO_CAJA"("ID_Concepto"),
    constraint "FK_MOVCAJA_METODOPAGO"
        foreign key ("ID_MetodoPago")
        references public."METODO_PAGO"("ID_MetodoPago"),
    constraint "FK_MOVCAJA_USUARIO"
        foreign key ("ID_Usuario")
        references public."USUARIO"("ID_Usuario"),
    constraint "CK_MOVCAJA_MONTO" check ("Monto" > 0)
);
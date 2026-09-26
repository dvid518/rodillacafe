-- ============================================================================
-- 008_pago.sql
-- METODO_PAGO, SERIE_COMPROBANTE
-- ============================================================================

-- drop table if exists public."SERIE_COMPROBANTE" cascade;
-- drop table if exists public."METODO_PAGO" cascade;

create table public."METODO_PAGO" (
    "ID_MetodoPago" integer      generated always as identity primary key,
    "N_MetodoPago"  varchar(30)  not null,
    "Es_Efectivo"   char(1)      not null default '0',
    "Requiere_Ref"  char(1)      not null default '0',
    "USUCRE"        varchar(30)  not null,
    "PCCRE"         varchar(30)  null,
    "FECCRE"        timestamptz  not null default now(),
    "USUMOD"        varchar(30)  null,
    "PCMOD"         varchar(30)  null,
    "FECMOD"        timestamptz  null,
    "ESTADO"        char(1)      not null default '1'
);

create table public."SERIE_COMPROBANTE" (
    "ID_Serie"     integer      generated always as identity primary key,
    "TipoDocumento" char(2)     not null,
    "Serie"        char(4)      not null,
    "Correlativo"  integer      not null default 0,
    "Descripcion"  varchar(50)  null,
    "USUCRE"       varchar(30)  not null,
    "PCCRE"        varchar(30)  null,
    "FECCRE"       timestamptz  not null default now(),
    "USUMOD"       varchar(30)  null,
    "PCMOD"        varchar(30)  null,
    "FECMOD"       timestamptz  null,
    "ESTADO"       char(1)      not null default '1',
    constraint "UQ_SERIE" unique ("TipoDocumento", "Serie"),
    constraint "CK_SERIE_TIPODOC" check ("TipoDocumento" in ('01','03','07','08'))
);
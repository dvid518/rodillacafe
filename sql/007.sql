-- ============================================================================
-- 007_salon.sql
-- ZONA, ESTADO_MESA, MESA, TIPO_ATENCION
-- ============================================================================

-- drop table if exists public."MESA" cascade;
-- drop table if exists public."ESTADO_MESA" cascade;
-- drop table if exists public."ZONA" cascade;
-- drop table if exists public."TIPO_ATENCION" cascade;

create table public."ZONA" (
    "ID_Zona"     integer       generated always as identity primary key,
    "N_Zona"      varchar(50)   not null,
    "Descripcion" varchar(100)  null,
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1'
);

create table public."ESTADO_MESA" (
    "ID_EstadoMesa" integer      generated always as identity primary key,
    "Descripcion"   varchar(50)  not null,
    "Color"         varchar(10)  null,
    "F_Creacion"    timestamptz  not null default now(),
    "USUCRE"        varchar(30)  not null,
    "PCCRE"         varchar(30)  null,
    "FECCRE"        timestamptz  not null default now(),
    "USUMOD"        varchar(30)  null,
    "PCMOD"         varchar(30)  null,
    "FECMOD"        timestamptz  null,
    "ESTADO"        char(1)      not null default '1'
);

create table public."MESA" (
    "ID_Mesa"       integer       generated always as identity primary key,
    "ID_Zona"       integer       not null,
    "ID_EstadoMesa" integer       not null,
    "Numero"        varchar(5)    not null,
    "Capacidad"     integer       not null default 4,
    "Detalle"       varchar(100)  null,
    "USUCRE"        varchar(30)   not null,
    "PCCRE"         varchar(30)   null,
    "FECCRE"        timestamptz   not null default now(),
    "USUMOD"        varchar(30)   null,
    "PCMOD"         varchar(30)   null,
    "FECMOD"        timestamptz   null,
    "ESTADO"        char(1)       not null default '1',
    constraint "FK_MESA_ZONA"
        foreign key ("ID_Zona") references public."ZONA"("ID_Zona"),
    constraint "FK_MESA_ESTADOMESA"
        foreign key ("ID_EstadoMesa") references public."ESTADO_MESA"("ID_EstadoMesa"),
    constraint "UQ_MESA_NUMERO" unique ("ID_Zona", "Numero")
);

create table public."TIPO_ATENCION" (
    "ID_TipoAtencion" integer      generated always as identity primary key,
    "N_TipoAtencion"  varchar(30)  not null,
    "Requiere_Mesa"   char(1)      not null default '1',
    "USUCRE"          varchar(30)  not null,
    "PCCRE"           varchar(30)  null,
    "FECCRE"          timestamptz  not null default now(),
    "USUMOD"          varchar(30)  null,
    "PCMOD"           varchar(30)  null,
    "FECMOD"          timestamptz  null,
    "ESTADO"          char(1)      not null default '1'
);
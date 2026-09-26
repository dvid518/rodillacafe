-- ============================================================================
-- 002_geografia.sql
-- DEPARTAMENTO, PROVINCIA, DISTRITO
-- ============================================================================

-- drop table if exists public."DISTRITO" cascade;
-- drop table if exists public."PROVINCIA" cascade;
-- drop table if exists public."DEPARTAMENTO" cascade;

create table public."DEPARTAMENTO" (
    "ID_Departamento"  integer       generated always as identity primary key,
    "N_Departamento"   varchar(30)   not null,
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1'
);

create table public."PROVINCIA" (
    "ID_Provincia"     integer       generated always as identity primary key,
    "ID_Departamento"  integer       not null,
    "N_Provincia"      varchar(30)   not null,
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_PROVINCIA_DEPARTAMENTO"
        foreign key ("ID_Departamento") references public."DEPARTAMENTO"("ID_Departamento")
);

create table public."DISTRITO" (
    "ID_Distrito"      integer       generated always as identity primary key,
    "ID_Provincia"     integer       not null,
    "D_Distrito"       varchar(40)   not null,
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_DISTRITO_PROVINCIA"
        foreign key ("ID_Provincia") references public."PROVINCIA"("ID_Provincia")
);
-- ============================================================================
-- 004_rrhh.sql
-- CARGO, CONTRATO, EMPLEADO
-- ============================================================================

-- drop table if exists public."EMPLEADO" cascade;
-- drop table if exists public."CONTRATO" cascade;
-- drop table if exists public."CARGO" cascade;

create table public."CARGO" (
    "ID_Cargo"  integer       generated always as identity primary key,
    "N_Cargo"   varchar(40)   not null,
    "USUCRE"    varchar(30)   not null,
    "PCCRE"     varchar(30)   null,
    "FECCRE"    timestamptz   not null default now(),
    "USUMOD"    varchar(30)   null,
    "PCMOD"     varchar(30)   null,
    "FECMOD"    timestamptz   null,
    "ESTADO"    char(1)       not null default '1'
);

create table public."CONTRATO" (
    "ID_Contrato" integer       generated always as identity primary key,
    "N_Contrato"  varchar(40)   not null,
    "Descripcion" varchar(150)  null,
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1'
);

create table public."EMPLEADO" (
    "ID_Empleado" integer       generated always as identity primary key,
    "ID_Persona"  integer       not null,
    "ID_Contrato" integer       not null,
    "ID_Cargo"    integer       not null,
    "Salario"     numeric(8,2)  not null,
    "Turno"       varchar(18)   null,
    "Fondo_Pension" char(3)     null,
    "N_Hips"      char(11)      null,
    "ESSALUD"     char(6)       null,
    "F_Ingreso"   date          not null default current_date,
    "F_Cese"      date          null,
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1',
    constraint "FK_EMPLEADO_PERSONA"
        foreign key ("ID_Persona") references public."PERSONA"("ID_Persona"),
    constraint "FK_EMPLEADO_CONTRATO"
        foreign key ("ID_Contrato") references public."CONTRATO"("ID_Contrato"),
    constraint "FK_EMPLEADO_CARGO"
        foreign key ("ID_Cargo") references public."CARGO"("ID_Cargo"),
    constraint "UQ_EMPLEADO_PERSONA" unique ("ID_Persona")
);
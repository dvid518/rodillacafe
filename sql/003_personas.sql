-- ============================================================================
-- 003_personas.sql
-- TIPO_IDENTIDAD, PERSONA, EMPRESA, CLIENTE
-- ============================================================================

-- drop table if exists public."CLIENTE" cascade;
-- drop table if exists public."EMPRESA" cascade;
-- drop table if exists public."PERSONA" cascade;
-- drop table if exists public."TIPO_IDENTIDAD" cascade;

create table public."TIPO_IDENTIDAD" (
    "ID_TipoIdentidad" integer      generated always as identity primary key,
    "N_TipoIdentidad"  varchar(20)  not null,
    "Abreviatura"      varchar(10)  not null,
    "Longitud"         integer      not null,
    "Codigo_SUNAT"     char(1)      null,
    "USUCRE"           varchar(30)  not null,
    "PCCRE"            varchar(30)  null,
    "FECCRE"           timestamptz  not null default now(),
    "USUMOD"           varchar(30)  null,
    "PCMOD"            varchar(30)  null,
    "FECMOD"           timestamptz  null,
    "ESTADO"           char(1)      not null default '1'
);

create table public."PERSONA" (
    "ID_Persona"       integer       generated always as identity primary key,
    "ID_Distrito"      integer       null,
    "ID_TipoIdentidad" integer       not null,
    "N_Documento"      varchar(15)   not null,
    "Nombre"           varchar(80)   not null,
    "Ap_Paterno"       varchar(80)   null,
    "Ap_Materno"       varchar(80)   null,
    "F_Nacimiento"     date          null,
    "EMAIL"            varchar(50)   null,
    "Celular"          char(9)       null,
    "Genero"           char(1)       null,
    "Direccion"        varchar(100)  null,
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_PERSONA_DISTRITO"
        foreign key ("ID_Distrito") references public."DISTRITO"("ID_Distrito"),
    constraint "FK_PERSONA_TIPOIDENTIDAD"
        foreign key ("ID_TipoIdentidad") references public."TIPO_IDENTIDAD"("ID_TipoIdentidad"),
    constraint "UQ_PERSONA_DOCUMENTO" unique ("ID_TipoIdentidad", "N_Documento"),
    constraint "CK_PERSONA_GENERO"
        check ("Genero" in ('M','F') or "Genero" is null)
);

create table public."EMPRESA" (
    "ID_Empresa"       integer       generated always as identity primary key,
    "ID_Distrito"      integer       null,
    "RUC"              char(11)      not null,
    "Razon_Social"     varchar(140)  not null,
    "Nombre_Comercial" varchar(140)  null,
    "Direccion"        varchar(150)  null,
    "Telefono"         varchar(15)   null,
    "EMAIL"            varchar(50)   null,
    "USUCRE"           varchar(30)   not null,
    "PCCRE"            varchar(30)   null,
    "FECCRE"           timestamptz   not null default now(),
    "USUMOD"           varchar(30)   null,
    "PCMOD"            varchar(30)   null,
    "FECMOD"           timestamptz   null,
    "ESTADO"           char(1)       not null default '1',
    constraint "FK_EMPRESA_DISTRITO"
        foreign key ("ID_Distrito") references public."DISTRITO"("ID_Distrito"),
    constraint "UQ_EMPRESA_RUC" unique ("RUC")
);

create table public."CLIENTE" (
    "ID_Cliente"    integer       generated always as identity primary key,
    "ID_Persona"    integer       null,
    "ID_Empresa"    integer       null,
    "Tipo_Cliente"  char(1)       not null,
    "Puntos"        integer       not null default 0,
    "F_Registro"    timestamptz   not null default now(),
    "Observacion"   varchar(200)  null,
    "USUCRE"        varchar(30)   not null,
    "PCCRE"         varchar(30)   null,
    "FECCRE"        timestamptz   not null default now(),
    "USUMOD"        varchar(30)   null,
    "PCMOD"         varchar(30)   null,
    "FECMOD"        timestamptz   null,
    "ESTADO"        char(1)       not null default '1',
    constraint "FK_CLIENTE_PERSONA"
        foreign key ("ID_Persona") references public."PERSONA"("ID_Persona"),
    constraint "FK_CLIENTE_EMPRESA"
        foreign key ("ID_Empresa") references public."EMPRESA"("ID_Empresa"),
    constraint "CK_CLIENTE_TIPO" check (
        ("Tipo_Cliente" = 'N' and "ID_Persona" is not null and "ID_Empresa" is null) or
        ("Tipo_Cliente" = 'J' and "ID_Empresa" is not null and "ID_Persona" is null)
    )
);
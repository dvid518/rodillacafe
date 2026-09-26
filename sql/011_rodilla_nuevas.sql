-- ============================================================================
-- 011_rodilla_nuevas.sql
-- RESERVA, MENSAJE  (nuevas para Rodilla)
-- ============================================================================

-- drop table if exists public."MENSAJE" cascade;
-- drop table if exists public."RESERVA" cascade;

create table public."RESERVA" (
    "ID_Reserva"   integer       generated always as identity primary key,
    "ID_Cliente"   integer       not null,
    "ID_Mesa"      integer       null,
    "Numero_Mesa"  integer       null,
    "N_Comensales" integer       not null,
    "F_Reserva"    timestamptz   not null,
    "Situacion"    char(1)       not null default 'P',
    "Observacion"  varchar(200)  null,
    "USUCRE"       varchar(30)   not null,
    "PCCRE"        varchar(30)   null,
    "FECCRE"       timestamptz   not null default now(),
    "USUMOD"       varchar(30)   null,
    "PCMOD"        varchar(30)   null,
    "FECMOD"       timestamptz   null,
    "ESTADO"       char(1)       not null default '1',
    constraint "FK_RESERVA_CLIENTE"
        foreign key ("ID_Cliente") references public."CLIENTE"("ID_Cliente"),
    constraint "FK_RESERVA_MESA"
        foreign key ("ID_Mesa") references public."MESA"("ID_Mesa"),
    constraint "CK_RESERVA_COMENSALES" check ("N_Comensales" > 0),
    constraint "CK_RESERVA_SITUACION" check ("Situacion" in ('P','A','C','X'))
);

create table public."MENSAJE" (
    "ID_Mensaje" integer       generated always as identity primary key,
    "ID_Cliente" integer       not null,
    "Asunto"     varchar(100)  not null,
    "Mensaje"    text          not null,
    "Situacion"  char(1)       not null default 'P',
    "F_Envio"    timestamptz   not null default now(),
    "USUCRE"     varchar(30)   not null,
    "PCCRE"      varchar(30)   null,
    "FECCRE"     timestamptz   not null default now(),
    "USUMOD"     varchar(30)   null,
    "PCMOD"      varchar(30)   null,
    "FECMOD"     timestamptz   null,
    "ESTADO"     char(1)       not null default '1',
    constraint "FK_MENSAJE_CLIENTE"
        foreign key ("ID_Cliente") references public."CLIENTE"("ID_Cliente"),
    constraint "CK_MENSAJE_SITUACION" check ("Situacion" in ('P','L','R'))
);
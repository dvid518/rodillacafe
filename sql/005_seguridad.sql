-- ============================================================================
-- 005_seguridad.sql
-- TIPO_USUARIO, USUARIO, MODULO, ROL, PERMISO, ROL_PERMISO, USUARIO_ROL, AUDITORIA
-- ============================================================================

-- drop table if exists public."AUDITORIA" cascade;
-- drop table if exists public."USUARIO_ROL" cascade;
-- drop table if exists public."ROL_PERMISO" cascade;
-- drop table if exists public."PERMISO" cascade;
-- drop table if exists public."ROL" cascade;
-- drop table if exists public."MODULO" cascade;
-- drop table if exists public."USUARIO" cascade;
-- drop table if exists public."TIPO_USUARIO" cascade;

create table public."TIPO_USUARIO" (
    "ID_TipoUsuario" integer      generated always as identity primary key,
    "N_TipoUsuario"  varchar(50)  not null,
    "USUCRE"         varchar(30)  not null,
    "PCCRE"          varchar(30)  null,
    "FECCRE"         timestamptz  not null default now(),
    "USUMOD"         varchar(30)  null,
    "PCMOD"          varchar(30)  null,
    "FECMOD"         timestamptz  null,
    "ESTADO"         char(1)      not null default '1'
);

-- USUARIO: se desata de EMPLEADO (nullable) y se vincula a auth.users via auth_id.
-- Clave ELIMINADA. ID_Cliente nullable para clientes autenticados.
create table public."USUARIO" (
    "ID_Usuario"     integer      generated always as identity primary key,
    "ID_TipoUsuario" integer      not null,
    "ID_Empleado"    integer      null,
    "ID_Cliente"     integer      null,
    "auth_id"        uuid         null,
    "Logeo"          varchar(120) not null,
    "Intentos"       smallint     not null default 0,
    "Bloqueado"      char(1)      not null default '0',
    "F_UltimoAcceso" timestamptz  null,
    "USUCRE"         varchar(30)  not null,
    "PCCRE"          varchar(30)  null,
    "FECCRE"         timestamptz  not null default now(),
    "USUMOD"         varchar(30)  null,
    "PCMOD"          varchar(30)  null,
    "FECMOD"         timestamptz  null,
    "ESTADO"         char(1)      not null default '1',
    constraint "FK_USUARIO_TIPOUSUARIO"
        foreign key ("ID_TipoUsuario") references public."TIPO_USUARIO"("ID_TipoUsuario"),
    constraint "FK_USUARIO_EMPLEADO"
        foreign key ("ID_Empleado") references public."EMPLEADO"("ID_Empleado"),
    constraint "FK_USUARIO_CLIENTE"
        foreign key ("ID_Cliente") references public."CLIENTE"("ID_Cliente"),
    constraint "UQ_USUARIO_LOGEO" unique ("Logeo"),
    constraint "UQ_USUARIO_AUTHID" unique ("auth_id"),
    constraint "CK_USUARIO_BLOQUEADO" check ("Bloqueado" in ('0','1')),
    constraint "CK_USUARIO_INTENTOS" check ("Intentos" >= 0)
);

create table public."MODULO" (
    "ID_Modulo"   integer       generated always as identity primary key,
    "N_Modulo"    varchar(50)   not null,
    "Descripcion" varchar(100)  null,
    "Icono"       varchar(50)   null,
    "Orden"       integer       not null default 0,
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1'
);

create table public."ROL" (
    "ID_Rol"      integer       generated always as identity primary key,
    "N_Rol"       varchar(50)   not null,
    "Descripcion" varchar(100)  null,
    "Nivel"       integer       not null default 1,
    "F_Creacion"  timestamptz   not null default now(),
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1',
    constraint "UQ_ROL_NOMBRE" unique ("N_Rol")
);

create table public."PERMISO" (
    "ID_Permiso"  integer       generated always as identity primary key,
    "ID_Modulo"   integer       not null,
    "N_Permiso"   varchar(50)   not null,
    "Clave"       varchar(50)   not null,
    "Descripcion" varchar(100)  null,
    "USUCRE"      varchar(30)   not null,
    "PCCRE"       varchar(30)   null,
    "FECCRE"      timestamptz   not null default now(),
    "USUMOD"      varchar(30)   null,
    "PCMOD"       varchar(30)   null,
    "FECMOD"      timestamptz   null,
    "ESTADO"      char(1)       not null default '1',
    constraint "FK_PERMISO_MODULO"
        foreign key ("ID_Modulo") references public."MODULO"("ID_Modulo"),
    constraint "UQ_PERMISO_CLAVE" unique ("Clave")
);

create table public."ROL_PERMISO" (
    "ID_RolPermiso" integer      generated always as identity primary key,
    "ID_Rol"        integer      not null,
    "ID_Permiso"    integer      not null,
    "Concedido"     char(1)      not null default '1',
    "USUCRE"        varchar(30)  not null,
    "PCCRE"         varchar(30)  null,
    "FECCRE"        timestamptz  not null default now(),
    "USUMOD"        varchar(30)  null,
    "PCMOD"         varchar(30)  null,
    "FECMOD"        timestamptz  null,
    "ESTADO"        char(1)      not null default '1',
    constraint "FK_ROLPERMISO_ROL"
        foreign key ("ID_Rol") references public."ROL"("ID_Rol"),
    constraint "FK_ROLPERMISO_PERMISO"
        foreign key ("ID_Permiso") references public."PERMISO"("ID_Permiso"),
    constraint "UQ_ROL_PERMISO" unique ("ID_Rol", "ID_Permiso")
);

create table public."USUARIO_ROL" (
    "ID_UsuarioRol" integer      generated always as identity primary key,
    "ID_Usuario"    integer      not null,
    "ID_Rol"        integer      not null,
    "F_Asignacion"  timestamptz  not null default now(),
    "Vigente"       char(1)      not null default '1',
    "USUCRE"        varchar(30)  not null,
    "PCCRE"         varchar(30)  null,
    "FECCRE"        timestamptz  not null default now(),
    "USUMOD"        varchar(30)  null,
    "PCMOD"         varchar(30)  null,
    "FECMOD"        timestamptz  null,
    "ESTADO"        char(1)      not null default '1',
    constraint "FK_USUARIOROL_USUARIO"
        foreign key ("ID_Usuario") references public."USUARIO"("ID_Usuario"),
    constraint "FK_USUARIOROL_ROL"
        foreign key ("ID_Rol") references public."ROL"("ID_Rol"),
    constraint "UQ_USUARIO_ROL" unique ("ID_Usuario", "ID_Rol")
);

create table public."AUDITORIA" (
    "ID_Auditoria"   integer       generated always as identity primary key,
    "ID_Usuario"     integer       null,
    "N_Tabla"        varchar(50)   not null,
    "Accion"         varchar(20)   not null,
    "ID_Registro"    integer       null,
    "Valor_Anterior" varchar(500)  null,
    "Valor_Nuevo"    varchar(500)  null,
    "F_Evento"       timestamptz   not null default now(),
    "IP"             varchar(45)   null,
    "Terminal"       varchar(30)   null,
    "USUCRE"         varchar(30)   not null default current_user,
    "PCCRE"          varchar(30)   null,
    "FECCRE"         timestamptz   not null default now(),
    "USUMOD"         varchar(30)   null,
    "PCMOD"          varchar(30)   null,
    "FECMOD"         timestamptz   null,
    "ESTADO"         char(1)       not null default '1',
    constraint "FK_AUDITORIA_USUARIO"
        foreign key ("ID_Usuario") references public."USUARIO"("ID_Usuario")
);
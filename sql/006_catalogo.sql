-- ============================================================================
-- 006_catalogo.sql
-- UNIDAD_MEDIDA, CATEGORIA_PRODUCTO, PRODUCTO
-- ============================================================================

-- drop table if exists public."PRODUCTO" cascade;
-- drop table if exists public."CATEGORIA_PRODUCTO" cascade;
-- drop table if exists public."UNIDAD_MEDIDA" cascade;

create table public."UNIDAD_MEDIDA" (
    "ID_UnidadMedida" integer      generated always as identity primary key,
    "N_UnidadMedida"  varchar(30)  not null,
    "Abreviatura"     varchar(10)  not null,
    "USUCRE"          varchar(30)  not null,
    "PCCRE"           varchar(30)  null,
    "FECCRE"          timestamptz  not null default now(),
    "USUMOD"          varchar(30)  null,
    "PCMOD"           varchar(30)  null,
    "FECMOD"          timestamptz  null,
    "ESTADO"          char(1)      not null default '1'
);

create table public."CATEGORIA_PRODUCTO" (
    "ID_CategoriaProducto" integer       generated always as identity primary key,
    "N_CategoriaProducto"  varchar(50)   not null,
    "Descripcion"          varchar(100)  null,
    "Area_Preparacion"     varchar(20)   null,
    "F_Creacion"           timestamptz   not null default now(),
    "USUCRE"               varchar(30)   not null,
    "PCCRE"                varchar(30)   null,
    "FECCRE"               timestamptz   not null default now(),
    "USUMOD"               varchar(30)   null,
    "PCMOD"                varchar(30)   null,
    "FECMOD"               timestamptz   null,
    "ESTADO"               char(1)       not null default '1'
);

create table public."PRODUCTO" (
    "ID_Producto"          integer       generated always as identity primary key,
    "ID_CategoriaProducto" integer       not null,
    "ID_UnidadMedida"      integer       not null,
    "N_Producto"           varchar(50)   not null,
    "Detalle"              varchar(100)  null,
    "Precio"               numeric(8,2)  not null,
    "Costo"                numeric(8,2)  not null default 0,
    "Marca"                varchar(50)   null,
    "Codigo_Barras"        varchar(30)   null,
    "Controla_Stock"       char(1)       not null default '1',
    "Stock_Actual"         numeric(10,2) not null default 0,
    "Stock_Minimo"         numeric(10,2) not null default 0,
    "Es_Preparado"         char(1)       not null default '0',
    "Afecto_IGV"           char(1)       not null default '1',
    "Imagen"               varchar(200)  null,
    "USUCRE"               varchar(30)   not null,
    "PCCRE"                varchar(30)   null,
    "FECCRE"               timestamptz   not null default now(),
    "USUMOD"               varchar(30)   null,
    "PCMOD"                varchar(30)   null,
    "FECMOD"               timestamptz   null,
    "ESTADO"               char(1)       not null default '1',
    constraint "FK_PRODUCTO_CATEGORIA"
        foreign key ("ID_CategoriaProducto") references public."CATEGORIA_PRODUCTO"("ID_CategoriaProducto"),
    constraint "FK_PRODUCTO_UNIDAD"
        foreign key ("ID_UnidadMedida") references public."UNIDAD_MEDIDA"("ID_UnidadMedida"),
    constraint "CK_PRODUCTO_PRECIO" check ("Precio" >= 0),
    constraint "CK_PRODUCTO_COSTO" check ("Costo" >= 0 and "Costo" <= "Precio")
);
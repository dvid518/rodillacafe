-- ============================================================================
-- 017_seed_transaccional.sql
-- Datos de prueba transaccionales (pedidos, reservas, mensajes)
-- ============================================================================

-- Nota: como ahora PEDIDO/RESERVA/MENSAJE referencian CLIENTE (no USUARIO),
-- primero generamos clientes adicionales de prueba.

do $$
declare
    u varchar(30) := 'SEED';
    v_id_persona int;
    v_id_cliente int;
    v_id_tipo_dni int;
    i int;
    nombres text[] := array[
        'Mateo Salazar','Sofia Guerrero','Diego Fernandez','Valeria Rios',
        'Carlos Mendoza','Lucia Torres','Camila Vargas','Gabriel Silva',
        'Andres Castro','Mariana Benitez','Bruno Damas','Leonardo Guia','David Berrocal'
    ];
begin
    select "ID_TipoIdentidad" into v_id_tipo_dni
      from public."TIPO_IDENTIDAD" where "Abreviatura" = 'DNI' limit 1;

    -- 50 clientes de prueba
    for i in 1..50 loop
        insert into public."PERSONA"(
            "ID_Distrito","ID_TipoIdentidad","N_Documento","Nombre","EMAIL","USUCRE"
        ) values (
            1, v_id_tipo_dni, lpad((70000000 + i)::text, 8, '0'),
            nombres[1 + (i % array_length(nombres,1))],
            'cliente' || i || '@rodilla.pe', u
        ) returning "ID_Persona" into v_id_persona;

        insert into public."CLIENTE"("ID_Persona","Tipo_Cliente","USUCRE")
        values (v_id_persona,'N',u);
    end loop;
end $$;

-- 100 pedidos de prueba
insert into public."PEDIDO"(
    "ID_Mesa","ID_Cliente","ID_Usuario","ID_TipoAtencion","Numero_Pedido",
    "N_Comensales","Total","Situacion","USUCRE"
)
select
    case when random() < 0.5 then (floor(random()*8)+1)::int else null end,
    (floor(random()*50)+1)::int + 2,     -- ids 3..52 (los 2 primeros ya existen)
    2,
    (floor(random()*3)+1)::int,
    'P' || to_char(now() - (random()*interval '180 days'), 'YYYYMMDD') || '-' || lpad(g::text,4,'0'),
    (floor(random()*4)+1)::int,
    0,
    (array['P','A','F','X'])[1 + floor(random()*4)::int],
    'SEED'
from generate_series(1, 100) g;

-- Detalle de pedidos
insert into public."DETALLE_PEDIDO"(
    "ID_Pedido","ID_Producto","Cantidad","Precio","Descuento","USUCRE"
)
select
    p."ID_Pedido",
    rnd."ID_Producto",
    (floor(random()*3)+1)::int,
    rnd."Precio",
    0,
    'SEED'
from public."PEDIDO" p
cross join lateral (
    select pr."ID_Producto", pr."Precio"
      from public."PRODUCTO" pr
     order by random()
     limit 1
) rnd
where p."USUCRE" = 'SEED';

-- Actualizar totales
update public."PEDIDO" p
   set "Total" = coalesce((
        select sum("Sub_Total") from public."DETALLE_PEDIDO"
         where "ID_Pedido" = p."ID_Pedido"
       ), 0)
 where p."USUCRE" = 'SEED';

-- 50 reservas
insert into public."RESERVA"(
    "ID_Cliente","ID_Mesa","Numero_Mesa","N_Comensales",
    "F_Reserva","Situacion","USUCRE"
)
select
    (floor(random()*50)+1)::int + 2,
    (floor(random()*8)+1)::int,
    (floor(random()*8)+1)::int,
    (floor(random()*6)+1)::int,
    now() + (random()*interval '60 days') - (random()*interval '30 days'),
    (array['P','A','C','X'])[1 + floor(random()*4)::int],
    'SEED'
from generate_series(1, 50);

-- 50 mensajes
insert into public."MENSAJE"(
    "ID_Cliente","Asunto","Mensaje","Situacion","USUCRE"
)
select
    (floor(random()*50)+1)::int + 2,
    (array[
        'Consulta sobre reservas de grupo',
        'Información de granos de café',
        'Sugerencia de menú vegano',
        'Consulta sobre eventos o talleres',
        'Duda sobre horarios de atención'
    ])[1 + floor(random()*5)::int],
    'Consulta registrada por el cliente para la cafetería Rodilla.',
    (array['P','L','R'])[1 + floor(random()*3)::int],
    'SEED'
from generate_series(1, 50);
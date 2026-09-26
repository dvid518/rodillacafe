-- ============================================================================
-- 015_seed_data.sql
-- Datos iniciales
-- ============================================================================

do $$
declare
    u varchar(30) := 'ADMIN';
    v_id_persona int;
    v_id_cliente_generico int;
begin
    -- Geografía
    insert into public."DEPARTAMENTO"("N_Departamento","USUCRE") values ('ICA', u);
    insert into public."PROVINCIA"("ID_Departamento","N_Provincia","USUCRE") values
        (1,'ICA',u),(1,'CHINCHA',u),(1,'PISCO',u);
    insert into public."DISTRITO"("ID_Provincia","D_Distrito","USUCRE") values
        (1,'ICA',u),(1,'LA TINGUINA',u),(1,'PARCONA',u),(1,'SUBTANJALLA',u);

    -- Tipo identidad
    insert into public."TIPO_IDENTIDAD"("N_TipoIdentidad","Abreviatura","Longitud","Codigo_SUNAT","USUCRE") values
        ('DNI','DNI',8,'1',u),
        ('RUC','RUC',11,'6',u),
        ('CARNET EXTRANJERIA','CE',12,'4',u),
        ('PASAPORTE','PAS',12,'7',u);

    -- Unidades
    insert into public."UNIDAD_MEDIDA"("N_UnidadMedida","Abreviatura","USUCRE") values
        ('UNIDAD','UND',u),('TAZA','TZA',u),('VASO','VAS',u),
        ('PORCION','POR',u),('BOTELLA','BOT',u),('KILOGRAMO','KG',u);

    -- Categorías (las 6 del modelo A)
    insert into public."CATEGORIA_PRODUCTO"("N_CategoriaProducto","Descripcion","Area_Preparacion","USUCRE") values
        ('CAFES CALIENTES','Espresso, americano, capuccino, latte','BARRA',u),
        ('BEBIDAS FRIAS','Frappes, iced coffee, jugos y gaseosas','BARRA',u),
        ('POSTRES','Tortas, pies, cheesecakes y galletas','VITRINA',u),
        ('SANDWICHES','Sandwiches, wraps y triples','COCINA',u),
        ('DESAYUNOS','Combos de desayuno','COCINA',u),
        ('ADICIONALES','Shots extra, jarabes, toppings','BARRA',u);

    -- Productos
    insert into public."PRODUCTO"("ID_CategoriaProducto","ID_UnidadMedida","N_Producto","Detalle","Precio","Costo","Controla_Stock","Stock_Actual","Stock_Minimo","Es_Preparado","USUCRE") values
        (1,2,'ESPRESSO','Cafe espresso simple 30 ml',6.00,1.80,'0',0,0,'1',u),
        (1,2,'AMERICANO','Espresso con agua caliente',8.00,2.00,'0',0,0,'1',u),
        (1,2,'CAPUCCINO','Espresso, leche vaporizada y espuma',11.00,3.20,'0',0,0,'1',u),
        (1,2,'CAFE LATTE','Espresso con leche vaporizada',12.00,3.50,'0',0,0,'1',u),
        (1,2,'MOCACCINO','Latte con chocolate',13.50,4.10,'0',0,0,'1',u),
        (2,3,'FRAPPE DE CAFE','Bebida helada batida de cafe',14.00,4.50,'0',0,0,'1',u),
        (2,5,'AGUA MINERAL 600ML','Agua sin gas',4.00,1.50,'1',80,20,'0',u),
        (2,5,'GASEOSA 500ML','Gaseosa personal',5.50,2.20,'1',60,15,'0',u),
        (3,4,'CHEESECAKE DE MARACUYA','Porcion individual',12.00,4.00,'1',18,5,'0',u),
        (3,4,'TORTA DE CHOCOLATE','Porcion individual',11.00,3.80,'1',20,5,'0',u),
        (3,1,'ALFAJOR ARTESANAL','Alfajor de manjarblanco',4.50,1.60,'1',40,10,'0',u),
        (4,1,'SANDWICH DE POLLO','Pan ciabatta, pollo y vegetales',15.00,5.50,'0',0,0,'1',u),
        (4,1,'TRIPLE CLASICO','Palta, huevo y tomate',9.50,3.20,'1',15,5,'0',u),
        (5,1,'DESAYUNO CONTINENTAL','Cafe, jugo, pan y huevos',19.90,7.00,'0',0,0,'1',u),
        (6,1,'SHOT EXTRA DE ESPRESSO','Adicional de espresso',3.00,0.90,'0',0,0,'1',u),
        (6,1,'LECHE VEGETAL','Cambio a leche de almendras',3.50,1.20,'0',0,0,'1',u);

    -- Salón
    insert into public."ZONA"("N_Zona","Descripcion","USUCRE") values
        ('SALON PRINCIPAL','Area interior',u),('TERRAZA','Area exterior',u),('BARRA','Atencion en barra',u);
    insert into public."ESTADO_MESA"("Descripcion","Color","USUCRE") values
        ('LIBRE','#2ECC71',u),('OCUPADA','#E74C3C',u),('RESERVADA','#F1C40F',u),('POR COBRAR','#3498DB',u);
    insert into public."MESA"("ID_Zona","ID_EstadoMesa","Numero","Capacidad","USUCRE") values
        (1,1,'01',4,u),(1,1,'02',4,u),(1,1,'03',2,u),(1,1,'04',6,u),
        (2,1,'05',4,u),(2,1,'06',2,u),(3,1,'B1',2,u),(3,1,'B2',2,u);
    insert into public."TIPO_ATENCION"("N_TipoAtencion","Requiere_Mesa","USUCRE") values
        ('EN SALON','1',u),('PARA LLEVAR','0',u),('DELIVERY','0',u);

    -- Pago
    insert into public."METODO_PAGO"("N_MetodoPago","Es_Efectivo","Requiere_Ref","USUCRE") values
        ('EFECTIVO','1','0',u),('TARJETA DEBITO','0','1',u),('TARJETA CREDITO','0','1',u),
        ('YAPE','0','1',u),('PLIN','0','1',u),('TRANSFERENCIA','0','1',u);
    insert into public."SERIE_COMPROBANTE"("TipoDocumento","Serie","Correlativo","Descripcion","USUCRE") values
        ('03','B001',0,'BOLETA DE VENTA ELECTRONICA',u),
        ('01','F001',0,'FACTURA ELECTRONICA',u);

    -- RRHH
    insert into public."CARGO"("N_Cargo","USUCRE") values
        ('ADMINISTRADOR',u),('CAJERO',u),('BARISTA',u),('MOZO',u),('AYUDANTE DE COCINA',u);
    insert into public."CONTRATO"("N_Contrato","Descripcion","USUCRE") values
        ('PLAZO INDETERMINADO','Contrato a plazo indeterminado',u),
        ('PLAZO FIJO','Contrato sujeto a modalidad',u),
        ('PART TIME','Jornada parcial',u);

    -- Seguridad
    insert into public."MODULO"("N_Modulo","Descripcion","Icono","Orden","USUCRE") values
        ('SEGURIDAD','Usuarios, roles y permisos','shield',1,u),
        ('CLIENTES','Gestion de clientes, personas y empresas','users',2,u),
        ('PRODUCTOS','Catalogo y stock','coffee',3,u),
        ('PEDIDOS','Comandas y mesas','clipboard',4,u),
        ('VENTAS','Ventas y comprobantes','receipt',5,u),
        ('CAJA','Apertura, movimientos y arqueo','cash',6,u),
        ('REPORTES','Reportes y dashboards','chart',7,u),
        ('AUDITORIA','Bitacora del sistema','history',8,u);

    insert into public."PERMISO"("ID_Modulo","N_Permiso","Clave","Descripcion","USUCRE") values
        (1,'Gestionar usuarios','SEG_USUARIO','Crear y editar usuarios',u),
        (1,'Gestionar roles','SEG_ROL','Crear roles y asignar permisos',u),
        (2,'Gestionar clientes','CLI_GESTIONAR','Registrar y editar clientes',u),
        (3,'Gestionar productos','PRO_GESTIONAR','Registrar y editar productos',u),
        (3,'Modificar precios','PRO_PRECIO','Cambiar precios de venta',u),
        (4,'Registrar pedido','PED_REGISTRAR','Abrir comandas y agregar items',u),
        (4,'Anular pedido','PED_ANULAR','Anular comandas o items',u),
        (5,'Registrar venta','VEN_REGISTRAR','Emitir boleta o factura',u),
        (5,'Anular venta','VEN_ANULAR','Anular comprobantes emitidos',u),
        (5,'Aplicar descuento','VEN_DESCUENTO','Aplicar descuentos sobre la venta',u),
        (6,'Aperturar caja','CAJ_APERTURAR','Iniciar turno de caja',u),
        (6,'Registrar movimiento','CAJ_MOVIMIENTO','Ingresos y egresos de caja',u),
        (6,'Cerrar caja','CAJ_CERRAR','Arqueo y cierre de turno',u),
        (7,'Ver reportes','REP_VER','Consultar reportes de venta y caja',u),
        (8,'Ver auditoria','AUD_VER','Consultar bitacora del sistema',u);

    insert into public."ROL"("N_Rol","Descripcion","Nivel","USUCRE") values
        ('ADMINISTRADOR','Acceso total al sistema',1,u),
        ('CAJERO','Ventas, comprobantes y caja',2,u),
        ('MOZO','Solo toma de pedidos',3,u),
        ('CLIENTE','Cliente registrado de Rodilla',4,u);

    insert into public."ROL_PERMISO"("ID_Rol","ID_Permiso","Concedido","USUCRE")
    select 1, "ID_Permiso", '1', u from public."PERMISO";

    insert into public."ROL_PERMISO"("ID_Rol","ID_Permiso","Concedido","USUCRE")
    select 2, "ID_Permiso", '1', u from public."PERMISO"
     where "Clave" in ('CLI_GESTIONAR','PED_REGISTRAR','VEN_REGISTRAR',
                       'CAJ_APERTURAR','CAJ_MOVIMIENTO','CAJ_CERRAR','REP_VER');

    insert into public."ROL_PERMISO"("ID_Rol","ID_Permiso","Concedido","USUCRE")
    select 3, "ID_Permiso", '1', u from public."PERMISO"
     where "Clave" in ('PED_REGISTRAR');

    insert into public."TIPO_USUARIO"("N_TipoUsuario","USUCRE") values
        ('ADMINISTRADOR',u),('OPERATIVO',u),('CLIENTE',u);

    -- Personas
    insert into public."PERSONA"("ID_Distrito","ID_TipoIdentidad","N_Documento","Nombre","Ap_Paterno","Ap_Materno","F_Nacimiento","EMAIL","Celular","Genero","Direccion","USUCRE") values
        (1,1,'44556677','LUIS ALFREDO','CASTILLON','SIGUAS','1985-05-12','admin@cafeteria.pe','987654321','M','AV. LOS MAESTROS 123',u),
        (1,1,'70123456','ANA MARIA','TORRES','QUISPE','1998-03-20','ana.torres@cafeteria.pe','912345678','F','CALLE LIMA 456',u),
        (2,1,'71234567','CARLOS','MENDOZA','ROJAS','2000-11-02','carlos.mendoza@cafeteria.pe','923456789','M','AV. GRAU 789',u),
        (1,1,'40987654','MARIA','FLORES','DIAZ','1990-07-15','maria.flores@gmail.com','934567890','F','URB. SAN ISIDRO C-12',u);

    -- Empleados
    insert into public."EMPLEADO"("ID_Persona","ID_Contrato","ID_Cargo","Salario","Turno","Fondo_Pension","F_Ingreso","USUCRE") values
        (1,1,1,3500.00,'ROTATIVO','AFP','2024-01-01',u),
        (2,2,2,1500.00,'MANANA','ONP','2024-02-01',u),
        (3,3,4,1200.00,'TARDE','ONP','2024-03-01',u);

    -- Usuarios (sin Clave)
    insert into public."USUARIO"("ID_TipoUsuario","ID_Empleado","Logeo","USUCRE") values
        (1,1,'admin',u),
        (2,2,'cajero1',u),
        (2,3,'mozo1',u);

    insert into public."USUARIO_ROL"("ID_Usuario","ID_Rol","USUCRE") values
        (1,1,u),(2,2,u),(3,3,u);

    -- Empresa y clientes
    insert into public."EMPRESA"("ID_Distrito","RUC","Razon_Social","Nombre_Comercial","Direccion","Telefono","EMAIL","USUCRE") values
        (1,'20123456789','INVERSIONES DEL SUR S.A.C.','INVERSUR','AV. SAN MARTIN 500 - ICA','056234567','facturacion@inversur.pe',u);

    insert into public."CLIENTE"("ID_Persona","ID_Empresa","Tipo_Cliente","USUCRE") values
        (4, NULL, 'N', u),
        (NULL, 1,  'J', u);

    -- Cliente genérico
    insert into public."PERSONA"("ID_Distrito","ID_TipoIdentidad","N_Documento","Nombre","Ap_Paterno","Ap_Materno","USUCRE")
    values (1,1,'00000000','CLIENTES','VARIOS','',u)
    returning "ID_Persona" into v_id_persona;

    insert into public."CLIENTE"("ID_Persona","Tipo_Cliente","Observacion","USUCRE")
    values (v_id_persona,'N','Cliente generico para ventas al publico',u);

    -- Caja
    insert into public."CAJA"("N_Caja","Descripcion","Ubicacion","Serie_Terminal","Moneda","Monto_Base","USUCRE") values
        ('CAJA 01','Caja principal de mostrador','BARRA','TERM-001','PEN',100.00,u);

    -- Movimientos caja
    insert into public."TIPO_MOVIMIENTO_CAJA"("N_TipoMovimiento","Abreviatura","Signo","USUCRE") values
        ('INGRESO','ING','+',u),('EGRESO','EGR','-',u);

    insert into public."CONCEPTO_CAJA"("ID_TipoMovimiento","N_Concepto","Descripcion","Afecta_Efectivo","USUCRE") values
        (1,'VENTA AL CONTADO','Cobro de venta de productos','1',u),
        (1,'VENTA CON TARJETA','Cobro con POS - no afecta efectivo','0',u),
        (1,'VENTA BILLETERA DIGITAL','Cobro por Yape/Plin - no afecta efectivo','0',u),
        (1,'FONDO DE APERTURA','Monto inicial entregado al cajero','1',u),
        (1,'SOBRANTE DE CAJA','Diferencia positiva detectada en arqueo','1',u),
        (2,'RETIRO PARCIAL','Retiro de efectivo a boveda','1',u),
        (2,'PAGO A PROVEEDOR','Compra menor pagada de caja','1',u),
        (2,'GASTO OPERATIVO','Movilidad, insumos menores','1',u),
        (2,'VUELTO / DEVOLUCION','Devolucion por anulacion de venta','1',u),
        (2,'FALTANTE DE CAJA','Diferencia negativa detectada en arqueo','1',u);
end $$;
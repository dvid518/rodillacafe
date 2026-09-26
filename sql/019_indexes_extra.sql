-- ============================================================================
-- 019_indexes_extra.sql
-- C7: índices para todas las columnas FK que carecían de uno y limpieza
-- del índice redundante IX_USUARIO_AUTHID (la constraint única UQ_USUARIO_AUTHID
-- ya crea uno equivalente). Idempotente.
-- ============================================================================

-- Limpieza del índice redundante sobre auth_id
drop index if exists public."IX_USUARIO_AUTHID";

-- Geografía
create index if not exists "IX_PROVINCIA_DEPARTAMENTO"   on public."PROVINCIA"("ID_Departamento");
create index if not exists "IX_DISTRITO_PROVINCIA"       on public."DISTRITO"("ID_Provincia");

-- Personas y RRHH
create index if not exists "IX_PERSONA_DISTRITO"         on public."PERSONA"("ID_Distrito");
create index if not exists "IX_PERSONA_TIPOIDENTIDAD"    on public."PERSONA"("ID_TipoIdentidad");
create index if not exists "IX_EMPRESA_DISTRITO"         on public."EMPRESA"("ID_Distrito");
create index if not exists "IX_EMPLEADO_PERSONA"         on public."EMPLEADO"("ID_Persona");
create index if not exists "IX_EMPLEADO_CONTRATO"        on public."EMPLEADO"("ID_Contrato");
create index if not exists "IX_EMPLEADO_CARGO"           on public."EMPLEADO"("ID_Cargo");

-- Seguridad
create index if not exists "IX_USUARIO_TIPOUSUARIO"      on public."USUARIO"("ID_TipoUsuario");
create index if not exists "IX_PERMISO_MODULO"           on public."PERMISO"("ID_Modulo");
create index if not exists "IX_ROLPERMISO_ROL"           on public."ROL_PERMISO"("ID_Rol");
create index if not exists "IX_ROLPERMISO_PERMISO"       on public."ROL_PERMISO"("ID_Permiso");
create index if not exists "IX_USUARIOROL_USUARIO"       on public."USUARIO_ROL"("ID_Usuario");
create index if not exists "IX_USUARIOROL_ROL"           on public."USUARIO_ROL"("ID_Rol");
create index if not exists "IX_AUDITORIA_USUARIO"        on public."AUDITORIA"("ID_Usuario");

-- Catálogo
create index if not exists "IX_PRODUCTO_UNIDADMEDIDA"    on public."PRODUCTO"("ID_UnidadMedida");

-- Salón
create index if not exists "IX_MESA_ZONA"                on public."MESA"("ID_Zona");
create index if not exists "IX_MESA_ESTADOMESA"          on public."MESA"("ID_EstadoMesa");

-- Caja
create index if not exists "IX_CONCEPTO_CAJA_TIPOMOV"    on public."CONCEPTO_CAJA"("ID_TipoMovimiento");
create index if not exists "IX_APERTURA_USUARIO"         on public."APERTURA_CAJA"("ID_Usuario");
create index if not exists "IX_APERTURA_USUARIOCIERRE"   on public."APERTURA_CAJA"("ID_UsuarioCierre");
create index if not exists "IX_MOVCAJA_TIPOMOVIMIENTO"   on public."MOVIMIENTO_CAJA"("ID_TipoMovimiento");
create index if not exists "IX_MOVCAJA_CONCEPTO"         on public."MOVIMIENTO_CAJA"("ID_Concepto");
create index if not exists "IX_MOVCAJA_METODOPAGO"       on public."MOVIMIENTO_CAJA"("ID_MetodoPago");
create index if not exists "IX_MOVCAJA_USUARIO"          on public."MOVIMIENTO_CAJA"("ID_Usuario");
create index if not exists "IX_MOVCAJA_VENTA"            on public."MOVIMIENTO_CAJA"("ID_Venta");
create index if not exists "IX_MOVCAJA_PEDIDO"           on public."MOVIMIENTO_CAJA"("ID_Pedido");

-- Ventas
create index if not exists "IX_PEDIDO_USUARIO"           on public."PEDIDO"("ID_Usuario");
create index if not exists "IX_PEDIDO_TIPOATENCION"      on public."PEDIDO"("ID_TipoAtencion");
create index if not exists "IX_DETPED_PRODUCTO"          on public."DETALLE_PEDIDO"("ID_Producto");
create index if not exists "IX_VENTA_PEDIDO"             on public."VENTA"("ID_Pedido");
create index if not exists "IX_VENTA_CLIENTE"            on public."VENTA"("ID_Cliente");
create index if not exists "IX_VENTA_USUARIO"            on public."VENTA"("ID_Usuario");
create index if not exists "IX_BOLETA_VENTA"             on public."BOLETA"("ID_Venta");
create index if not exists "IX_FACTURA_VENTA"            on public."FACTURA"("ID_Venta");
create index if not exists "IX_PAGOVENTA_VENTA"          on public."PAGO_VENTA"("ID_Venta");
create index if not exists "IX_PAGOVENTA_METODOPAGO"     on public."PAGO_VENTA"("ID_MetodoPago");
create index if not exists "IX_RESERVA_MESA"             on public."RESERVA"("ID_Mesa");
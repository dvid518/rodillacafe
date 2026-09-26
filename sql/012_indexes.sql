-- ============================================================================
-- 012_indexes.sql
-- ============================================================================

create index "IX_PERSONA_DOCUMENTO"   on public."PERSONA"("N_Documento");
create index "IX_CLIENTE_PERSONA"     on public."CLIENTE"("ID_Persona");
create index "IX_CLIENTE_EMPRESA"     on public."CLIENTE"("ID_Empresa");
create index "IX_USUARIO_AUTHID"      on public."USUARIO"("auth_id");
create index "IX_USUARIO_CLIENTE"     on public."USUARIO"("ID_Cliente");
create index "IX_USUARIO_EMPLEADO"    on public."USUARIO"("ID_Empleado");
create index "IX_PRODUCTO_CATEGORIA"  on public."PRODUCTO"("ID_CategoriaProducto");
create index "IX_PEDIDO_SITUACION"    on public."PEDIDO"("Situacion", "F_Pedido");
create index "IX_PEDIDO_MESA"         on public."PEDIDO"("ID_Mesa");
create index "IX_PEDIDO_CLIENTE"      on public."PEDIDO"("ID_Cliente");
create index "IX_DETPED_PEDIDO"       on public."DETALLE_PEDIDO"("ID_Pedido");
create index "IX_VENTA_FECHA"         on public."VENTA"("F_Venta");
create index "IX_VENTA_APERTURACAJA"  on public."VENTA"("ID_AperturaCaja");
create index "IX_DETVEN_VENTA"        on public."DETALLE_VENTA"("ID_Venta");
create index "IX_DETVEN_PRODUCTO"     on public."DETALLE_VENTA"("ID_Producto");
create index "IX_MOVCAJA_APERTURA"    on public."MOVIMIENTO_CAJA"("ID_AperturaCaja", "F_Movimiento");
create index "IX_AUDITORIA_TABLA"     on public."AUDITORIA"("N_Tabla", "F_Evento");
create index "IX_RESERVA_CLIENTE"     on public."RESERVA"("ID_Cliente");
create index "IX_RESERVA_FECHA"       on public."RESERVA"("F_Reserva");
create index "IX_MENSAJE_CLIENTE"     on public."MENSAJE"("ID_Cliente");
create index "IX_MENSAJE_SITUACION"   on public."MENSAJE"("Situacion");

-- Índice único parcial: una sola caja abierta por turno
create unique index "UX_APERTURA_CAJA_ABIERTA"
    on public."APERTURA_CAJA"("ID_Caja")
    where "Situacion" = 'A' and "ESTADO" = '1';
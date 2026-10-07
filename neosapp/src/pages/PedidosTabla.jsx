import expedienteIcon from "../components/img/expediente.png";
import { obtenerResumenPrealistamiento } from "../utils/pedidos";

export default function PedidosTabla({
  pedidos,
  mensajeVacio,
  obtenerNombreRepartidor,
  onAsignarRepartidor,
  onVerDetalle,
  onDescargarRemision,
  onEliminarPedido,
}) {
  return (
    <table className="pedidos-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Fecha de entrega</th>
          <th>Valor</th>
          <th>Estado</th>
          <th>Asignación de repartidor</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        {pedidos.length === 0 ? (
          <tr>
            <td colSpan="7" className="sin-pedidos">{mensajeVacio}</td>
          </tr>
        ) : (
          pedidos.map((pedido) => {
            const resumenPrealistamiento = obtenerResumenPrealistamiento(pedido);
            return (
              <tr key={pedido.id}>
                <td data-label="ID">{pedido.id}</td>
                <td data-label="Nombre">
                  <div className="pedido-cliente-resumen">
                    <span>{pedido.cliente}</span>
                    {resumenPrealistamiento.total > 0 && (
                      <small className={`pedido-prealistamiento-aviso ${resumenPrealistamiento.confirmado ? (resumenPrealistamiento.faltantes > 0 ? "confirmado-con-faltantes" : "confirmado") : "pendiente"}`}>
                        {resumenPrealistamiento.confirmado
                          ? resumenPrealistamiento.faltantes > 0
                            ? "Pre-alistamiento confirmado con unidades faltantes"
                            : "Pre-alistamiento confirmado"
                          : "Hay unidades pendientes por alistar"}
                      </small>
                    )}
                  </div>
                </td>
                <td data-label="Fecha">{pedido.fecha}</td>
                <td data-label="Valor">${Number(pedido.total || 0).toLocaleString()}</td>
                <td data-label="Estado">
                  <span className={`estado-badge estado-${(pedido.estado ?? "").toLowerCase().replace(" ", "-")}`}>
                    {pedido.estado}
                  </span>
                </td>
                <td data-label="Asignación de repartidor">
                  <div className="repartidor-asignacion">
                    {pedido.repartidor_id ? (
                      <span className="repartidor-nombre">{obtenerNombreRepartidor(pedido.repartidor_id)}</span>
                    ) : (
                      <span className="sin-repartidor">No asignado</span>
                    )}
                    <button
                      type="button"
                      className="admin-action-control"
                      onClick={() => onAsignarRepartidor(pedido)}
                      aria-label={`${pedido.repartidor_id ? "Cambiar" : "Asignar"} repartidor del pedido ${pedido.id}`}
                    >
                      {pedido.repartidor_id ? "Cambiar" : "Asignar"}
                    </button>
                  </div>
                </td>
                <td data-label="Acción">
                  <div className="acciones-pedido">
                    <button className="btn-detalle" onClick={() => onVerDetalle(pedido)} title="Ver detalle">
                      Ver Detalle
                    </button>
                    <button
                      type="button"
                      className="btn-pdf"
                      onClick={() => onDescargarRemision(pedido)}
                      title="Descargar remisión PDF"
                      aria-label={`Descargar remisión del pedido ${pedido.id}`}
                    >
                      <img src={expedienteIcon} alt="" />
                    </button>
                    <button
                      type="button"
                      className="btn-delete admin-action-control admin-action-control--danger"
                      onClick={() => onEliminarPedido(pedido)}
                      title={`Eliminar pedido ${pedido.id}`}
                      aria-label={`Eliminar pedido ${pedido.id}`}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

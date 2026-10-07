import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import "../styles/repartidor-perfil.css";

export default function RepartidorPerfil() {
  const { user } = useAuth();
  const { pedidos, repartidores, cambiarEstadoPedido } = useStore();
  const [filtroEstado, setFiltroEstado] = useState("Todos");

  // Obtener datos del repartidor actual por ID de usuario
  const repartidorActual = repartidores.find((r) => String(r.id) === String(user?.id));

  // Filtrar pedidos por repartidor_id
  const pedidosRepartidor = pedidos.filter(
    (p) => String(p.repartidor_id) === String(user?.id)
  );

  // Cambiar estado del pedido
  const handleCambiarEstado = async (id, nuevoEstado) => {
    await cambiarEstadoPedido(id, nuevoEstado, true);
  };

  const pedidosFiltrados =
    filtroEstado === "Todos"
      ? pedidosRepartidor
      : pedidosRepartidor.filter((p) => p.estado === filtroEstado);

  const estadisticas = {
    pendientes: pedidosRepartidor.filter((p) => p.estado === "Pendiente").length,
    enCamino: pedidosRepartidor.filter((p) => p.estado === "En camino").length,
    entregados: pedidosRepartidor.filter((p) => p.estado === "Entregado").length,
    total: pedidosRepartidor.length,
  };

  const getEstadoClase = (estado) => {
    if (!estado) return "";
    return estado.toLowerCase().replace(" ", "-");
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "";
    const date = new Date(fecha);
    return date.toLocaleDateString("es-CO");
  };

  if (!repartidorActual) {
    return (
      <div className="repartidor-perfil">
        <p>Cargando datos del repartidor...</p>
      </div>
    );
  }

  return (
    <div className="repartidor-perfil">
      {/* Encabezado del perfil */}
      <div className="perfil-header">
        <h2>{repartidorActual.nombre}</h2>
        <p>Zona: <strong>{repartidorActual.zona}</strong></p>
      </div>

      {/* Estadísticas */}
      <div className="estadisticas-container">
        <div className="estadistica pendiente">
          <h4>Pendientes</h4>
          <div className="numero">{estadisticas.pendientes}</div>
        </div>
        <div className="estadistica en-camino">
          <h4>En camino</h4>
          <div className="numero">{estadisticas.enCamino}</div>
        </div>
        <div className="estadistica entregado">
          <h4>Entregados</h4>
          <div className="numero">{estadisticas.entregados}</div>
        </div>
        <div className="estadistica total">
          <h4>Total</h4>
          <div className="numero">{estadisticas.total}</div>
        </div>
      </div>

      {/* Encabezado de pedidos y filtro */}
      <div className="pedidos-header">
        <h3>Mis Pedidos</h3>
        <div className="filtro-container">
          <label>Filtrar:</label>
          <select
            className="filtro-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En camino">En camino</option>
            <option value="Entregado">Entregado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Lista de pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className="sin-pedidos">
          <p>
            {filtroEstado === "Todos"
              ? "No tienes pedidos asignados"
              : `No tienes pedidos en estado "${filtroEstado}"`}
          </p>
        </div>
      ) : (
        <div className="pedidos-lista">
          {pedidosFiltrados.map((pedido) => (
            <div key={pedido.id} className={`pedido-card ${getEstadoClase(pedido.estado)}`}>
              {/* Encabezado de la tarjeta */}
              <div className="pedido-card-header">
                <div className="pedido-numero-estado">
                  <h4>Pedido #{pedido.id}</h4>
                  <span className={`estado-badge ${getEstadoClase(pedido.estado)}`}>
                    {pedido.estado}
                  </span>
                </div>
                <p className="pedido-fecha">{formatFecha(pedido.fechaEntrega)}</p>
              </div>

              {/* Información del cliente */}
              <div className="pedido-cliente-info">
                <div className="cliente-detalle">
                  <div className="detalle-item">
                    <label>Cliente</label>
                    <p>{pedido.cliente}</p>
                  </div>
                  <div className="detalle-item">
                    <label>Cédula</label>
                    <p>{pedido.clienteCedula || "N/A"}</p>
                  </div>
                  <div className="detalle-item">
                    <label>Dirección</label>
                    <p className="direccion">{pedido.direccion || "No especificada"}</p>
                  </div>
                  <div className="detalle-item">
                    <label>Valor</label>
                    <p className="valor">${pedido.total?.toLocaleString()}</p>
                  </div>
                  <div className="detalle-item">
                    <label>Forma de pago</label>
                    <span className={`pago-badge ${pedido.formaPago?.toLowerCase()}`}>
                      {pedido.formaPago || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer con selector de estado */}
              <div className="pedido-card-footer">
                <div className="cambiar-estado">
                  <label htmlFor={`estado-${pedido.id}`}>Cambiar estado:</label>
                  <select
                    id={`estado-${pedido.id}`}
                    className="estado-select"
                    value={pedido.estado}
                    onChange={(e) => handleCambiarEstado(pedido.id, e.target.value)}
                    disabled={pedido.estado === "Confirmado"}
                    title={pedido.estado === "Confirmado" ? "El pedido confirmado no se puede actualizar" : "Cambiar estado del pedido"}
                  >
                    <option value="Pendiente" disabled>Pendiente</option>
                    <option value="En camino">En camino</option>
                    <option value="Entregado">Entregado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
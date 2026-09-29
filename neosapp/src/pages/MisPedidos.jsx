import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import HorizontalScroll from "../components/HorizontalScroll";
import "../styles/mis-pedidos.css";

export default function MisPedidos() {
  const { user } = useAuth();
  const { clientes, pedidos } = useStore();
  const [misPedidos, setMisPedidos] = useState([]);

  // Obtener el cliente actual (el usuario logueado)
  const clienteActual = clientes.find((c) => c.usuario_id === user?.id || c.correo === user?.email);

  useEffect(() => {
    console.log("🔍 MisPedidos - Usuario:", user?.id, user?.email);
    console.log("👤 Cliente Actual:", clienteActual);
    console.log("📋 Todos los Clientes:", clientes);
    console.log("📦 Todos los Pedidos:", pedidos);
    
    if (clienteActual) {
      // Filtrar pedidos: primero por cliente_id, luego por cedula como fallback
      const pedidosFiltrados = pedidos.filter((p) => {
        const porId = p.cliente_id && clienteActual.id && p.cliente_id === clienteActual.id;
        const porCedula = p.clienteCedula && clienteActual.cedula && p.clienteCedula === clienteActual.cedula;
        const resultado = porId || porCedula;
        
        console.log(`  Pedido ${p.id}: cliente_id(${p.cliente_id}==${clienteActual.id}?${porId}) || cedula(${p.clienteCedula}==${clienteActual.cedula}?${porCedula}) = ${resultado}`);
        
        return resultado;
      });
      console.log("✅ Pedidos Filtrados:", pedidosFiltrados);
      setMisPedidos(pedidosFiltrados);
    }
  }, [clienteActual, pedidos]);

  const getEstadoClase = (estado) => {
    return estado?.toLowerCase().replace(" ", "-") || "pendiente";
  };

  if (!clienteActual) {
    return (
      <div className="mis-pedidos-page">
        <div className="sin-datos-mensaje">
          <p>No se encontró información de tu perfil</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mis-pedidos-page">
      <div className="mis-pedidos-header">
        <h1>📦 Mis Pedidos</h1>
        <p className="cliente-nombre">Hola, {clienteActual.nombre}</p>
      </div>

      <div className="mis-pedidos-container">
        {misPedidos.length === 0 ? (
          <div className="sin-pedidos-mensaje">
            <p>No tienes pedidos registrados aún</p>
          </div>
        ) : (
          <>
            {/* Vista de tabla para desktop */}
            <HorizontalScroll className="pedidos-tabla-container">
              <table className="pedidos-tabla">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th>Repartidor</th>
                  </tr>
                </thead>
                <tbody>
                  {misPedidos.map((pedido) => (
                    <tr key={pedido.id}>
                      <td data-label="ID">#{pedido.id}</td>
                      <td data-label="Fecha">{pedido.fecha}</td>
                      <td data-label="Valor">${pedido.total?.toLocaleString()}</td>
                      <td data-label="Estado">
                        <span className={`estado-badge estado-${getEstadoClase(pedido.estado)}`}>
                          {pedido.estado}
                        </span>
                      </td>
                      <td data-label="Repartidor">
                        {pedido.repartidor || "No asignado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalScroll>

            {/* Vista de tarjetas para móvil */}
            <div className="pedidos-cards-container">
              {misPedidos.map((pedido) => (
                <div key={pedido.id} className={`pedido-card-mini ${getEstadoClase(pedido.estado)}`}>
                  <div className="pedido-card-header-mini">
                    <h4>Pedido #{pedido.id}</h4>
                    <span className={`estado-badge estado-${getEstadoClase(pedido.estado)}`}>
                      {pedido.estado}
                    </span>
                  </div>
                  <div className="pedido-card-body-mini">
                    <p><strong>Fecha:</strong> {pedido.fecha}</p>
                    <p><strong>Valor:</strong> ${pedido.total?.toLocaleString()}</p>
                    <p><strong>Repartidor:</strong> {pedido.repartidor || "No asignado"}</p>
                    <p><strong>Dirección:</strong> {pedido.direccion || "No especificada"}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="transacciones-section">
        <h2>💳 Historial de Transacciones</h2>
        {Array.isArray(clienteActual.transacciones) && clienteActual.transacciones.length > 0 ? (
          <div className="transacciones-list">
            {clienteActual.transacciones.map((trans) => {
              const tipo = String(trans.tipo).toLowerCase();
              const signo = tipo === "pedido" ? "+" : "-";
              const claseMonto = tipo === "pedido" ? "pedido" : "pago";
              const descripcion = trans.descripcion || (tipo === "pedido" ? "Pedido" : "Pago/Abono");

              return (
                <div key={trans.id} className={`transaccion-item ${tipo}`}>
                  <div className="trans-info">
                    <p className="trans-descripcion">{descripcion}</p>
                    <p className="trans-fecha">{trans.fecha}</p>
                  </div>
                  <p className={`trans-monto ${claseMonto}`}>
                    {signo}${Number(trans.monto || 0).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sin-transacciones">
            <p>No hay transacciones registradas aún</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useStore } from "../context/StoreContext";
import "../styles/vendedores.css";

export default function Vendedores() {
  const {
    vendedoresConUsuarios,
    obtenerClientesPorVendedor,
    calcularVentasPorVendedor,
    crearVendedor,
    eliminarVendedor,
    pedidos,
  } = useStore();
  
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevazona, setNuevazona] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleSeleccionarVendedor = (vendedorId) => {
    setVendedorSeleccionado(vendedorSeleccionado === vendedorId ? null : vendedorId);
  };

  const handleEliminarVendedor = async (vendedorId) => {
    if (!vendedorId) return;
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas eliminar este vendedor? Esta acción desasignará sus clientes."
    );
    if (!confirmar) return;

    const resultado = await eliminarVendedor(vendedorId);
    if (resultado.error) {
      setMensaje(`❌ ${resultado.error}`);
      return;
    }
    setMensaje("✅ Vendedor eliminado correctamente");
    setVendedorSeleccionado(null);
    setTimeout(() => setMensaje(""), 3000);
  };

  return (
    <div className="vendedores-page">
      <div className="vendedores-header">
        <h2>Gestión de Vendedores</h2>
        <p className="total-vendedores">
          Total de vendedores: {vendedoresConUsuarios.length}
        </p>
      </div>

      <div className="vendedores-formulario">
        <h3>Agregar nuevo vendedor</h3>
        {mensaje && <div className={`mensaje ${mensaje.includes("✅") ? "exito" : "error"}`}>{mensaje}</div>}
        <div className="form-group">
          <input
            type="text"
            placeholder="Nombre del vendedor"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
          />
          <input
            type="text"
            placeholder="zona"
            value={nuevazona}
            onChange={(e) => setNuevazona(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email del vendedor"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
          />
          <button
            className="btn-crear-vendedor"
            onClick={async () => {
              const resultado = await crearVendedor(
                nuevoNombre.trim(),
                nuevazona.trim(),
                nuevoEmail.trim(),
                nuevaPassword
              );
              if (resultado.error) {
                setMensaje(`❌ ${resultado.error}`);
                return;
              }
              setMensaje(`✅ Vendedor ${resultado.vendedor.nombre} creado`);
              setNuevoNombre("");
              setNuevazona("");
              setNuevoEmail("");
              setNuevaPassword("");
              setTimeout(() => setMensaje(""), 3000);
            }}
          >
            <span className="btn-icon">➕</span>
            Crear vendedor
          </button>
        </div>
      </div>

      <div className="vendedores-grid">
        {vendedoresConUsuarios.map((vendedor) => {
          const clienteVendedorId = vendedor.id;
          const clientesVendedor = obtenerClientesPorVendedor(clienteVendedorId);
          const totalVentas = calcularVentasPorVendedor(clienteVendedorId);
          const isSeleccionado = vendedorSeleccionado === vendedor.usuario_id;

          return (
              <div key={vendedor.usuario_id} className="vendedor-card">
                <div
                  className="vendedor-header"
                  onClick={() => handleSeleccionarVendedor(vendedor.usuario_id)}
                >
                  <div className="vendedor-info">
                    <h3>{vendedor.nombre}</h3>
                    <div className="zona-badge">{vendedor.zona || "Sin zona"}</div>
                  </div>
                  <div className="vendedor-stats">
                    <div className="stat">
                      <span className="stat-label">Clientes</span>
                      <span className="stat-value">{clientesVendedor.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Ventas</span>
                      <span className="stat-value">
                        ${totalVentas.toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>
                  <div className="vendedor-actions">
                    <button
                      className="btn-accion-vendedor btn-eliminar-vendedor admin-action-control admin-action-control--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminarVendedor(vendedor.usuario_id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                  <span className={`expand-icon ${isSeleccionado ? "expanded" : ""}`}>
                    ▼
                  </span>
                </div>

                {isSeleccionado && (
                  <div className="vendedor-clientes">
                    {clientesVendedor.length > 0 ? (
                      <div className="clientes-list">
                        <h4>Clientes Asignados</h4>
                        <div className="clientes-table">
                          <div className="table-header">
                            <div className="col-nombre">Nombre</div>
                            <div className="col-cedula">Cédula</div>
                            <div className="col-correo">Correo</div>
                            <div className="col-ventas">Ventas</div>
                          </div>
                          {clientesVendedor.map((cliente) => {
                            const ventasCliente = (pedidos || [])
                              .filter((p) => String(p.cliente_id) === String(cliente.id) || String(p.clienteCedula) === String(cliente.cedula))
                              .reduce((sum, p) => sum + Number(p.total || 0), 0);

                            return (
                              <div key={cliente.id} className="table-row">
                                <div className="col-nombre">{cliente.nombre}</div>
                                <div className="col-cedula">{cliente.cedula}</div>
                                <div className="col-correo">
                                  {cliente.correo || "-"}
                                </div>
                                <div className="col-ventas">
                                  ${ventasCliente.toLocaleString("es-CO")}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="sin-clientes">
                        <p>📭 Este vendedor no tiene clientes asignados</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {vendedoresConUsuarios.length === 0 && (
        <div className="empty-state">
          <p>No hay vendedores registrados</p>
        </div>
      )}
    </div>
  );
}

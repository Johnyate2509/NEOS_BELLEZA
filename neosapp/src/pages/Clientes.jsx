import { useEffect, useState } from "react";
import { useStore } from "../context/StoreContext";
import HorizontalScroll from "../components/HorizontalScroll";
import "../styles/clientes.css";


export default function Clientes() {
  const {
    clientes,
    pedidos,
    registrarPago,
    actualizarClienteTelefono,
    actualizarClienteDireccion,
  } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [descripcionPago, setDescripcionPago] = useState("");
  const [telefonoTemporal, setTelefonoTemporal] = useState("");
  const [direccionTemporal, setDireccionTemporal] = useState("");
  const [pestanaActiva, setPestanaActiva] = useState("informacion");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const clientesFiltrados = normalizedSearch
    ? clientes.filter((cliente) =>
        [
          cliente.nombre,
          cliente.cedula,
          cliente.direccion,
          cliente.telefono,
          cliente.correo,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : clientes;

  // Obtener cliente actual del contexto
  const clienteSeleccionado = clienteSeleccionadoId 
    ? clientes.find((c) => c.id === clienteSeleccionadoId) 
    : null;

  const pedidosCliente = clienteSeleccionado
    ? pedidos.filter((p) => p.clienteCedula === clienteSeleccionado.cedula)
    : [];

  useEffect(() => {
    if (!clienteSeleccionado) {
      setTelefonoTemporal("");
      setDireccionTemporal("");
      setPestanaActiva("informacion");
      return;
    }

    setTelefonoTemporal(clienteSeleccionado.telefono || "");
    setDireccionTemporal(clienteSeleccionado.direccion || "");
  }, [clienteSeleccionado]);

  const handleRegistrarPago = async () => {
    if (!clienteSeleccionado || !montoPago || parseFloat(montoPago) <= 0) {
      alert("Por favor completa los datos");
      return;
    }

    const descripcion = descripcionPago.trim() || "Pago/Abono";
    const registrado = await registrarPago(clienteSeleccionado.id, parseFloat(montoPago), metodoPago, descripcion);
    if (!registrado) {
      alert("No se pudo registrar el pago. Verifica la conexión y los permisos.");
      return;
    }
    
    setMontoPago("");
    setDescripcionPago("");
    setMetodoPago("efectivo");
    alert("Pago registrado correctamente");
  };

  const handleActualizarTelefono = async () => {
    if (!clienteSeleccionado) {
      alert("Selecciona un cliente primero");
      return;
    }

    const telefono = telefonoTemporal.trim();

    if (!telefono) {
      alert("Ingresa un número de celular");
      return;
    }

    const actualizado = await actualizarClienteTelefono(clienteSeleccionado.id, telefono);

    if (actualizado) {
      alert("Número de celular actualizado correctamente");
    } else {
      alert("No se pudo actualizar el número de celular");
    }
  };

  const handleActualizarDireccion = async () => {
    if (!clienteSeleccionado) {
      alert("Selecciona un cliente primero");
      return;
    }

    const direccion = direccionTemporal.trim();

    if (!direccion) {
      alert("Ingresa una dirección de residencia");
      return;
    }

    const actualizado = await actualizarClienteDireccion(clienteSeleccionado.id, direccion);

    if (actualizado) {
      alert("Dirección de residencia actualizada correctamente");
    } else {
      alert("No se pudo actualizar la dirección de residencia");
    }
  };

  return (
    <div className="clientes-page">
      <h2>Cartera de Clientes</h2>
      <p>Gestión de clientes, saldos y pagos</p>

      <div className="clientes-contenedor">
        {/* Lista de clientes */}
        <div className="clientes-lista">
          <div className="clientes-lista-header">
            <h3>Clientes ({clientesFiltrados.length}{searchTerm ? ` de ${clientes.length}` : ""})</h3>
            <input
              type="search"
              placeholder="Buscar clientes por nombre, cédula o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="busqueda-clientes"
            />
          </div>
          <div className="clientes-scroll">
            {clientesFiltrados.map((cliente) => (
              <div
                key={cliente.id}
                className={`cliente-item ${clienteSeleccionadoId === cliente.id ? "activo" : ""}`}
                onClick={() => setClienteSeleccionadoId(cliente.id)}
              >
                <p className="cliente-nombre">{cliente.nombre}</p>
                <p className="cliente-cedula">{cliente.cedula}</p>
                <p className="cliente-saldo">
                  Saldo: <span className={cliente.saldo > 0 ? "debe" : cliente.saldo < 0 ? "favor" : "al-dia"}>
                    {cliente.saldo > 0 ? "$" : cliente.saldo < 0 ? "-$" : "$"}{Math.abs(cliente.saldo).toLocaleString()}
                  </span>
                </p>
                <p className="cliente-pedidos">{pedidos.filter((p) => p.clienteCedula === cliente.cedula).length} pedidos</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detalles del cliente */}
        {clienteSeleccionado && (
          <div className="cliente-detalle">
            <div className="detalle-header">
              <h3>{clienteSeleccionado.nombre}</h3>
            </div>

            {/* Pestañas */}
            <div className="tabs-container">
              <button
                className={`tab-button ${pestanaActiva === "informacion" ? "activa" : ""}`}
                onClick={() => setPestanaActiva("informacion")}
              >
                ℹ️ Información
              </button>
              <button
                className={`tab-button ${pestanaActiva === "pedidos" ? "activa" : ""}`}
                onClick={() => setPestanaActiva("pedidos")}
              >
                📦 Pedidos ({pedidosCliente.length})
              </button>
              <button
                className={`tab-button ${pestanaActiva === "transacciones" ? "activa" : ""}`}
                onClick={() => setPestanaActiva("transacciones")}
              >
                💳 Transacciones
              </button>
            </div>

            {/* PESTAÑA: INFORMACIÓN */}
            {pestanaActiva === "informacion" && (
              <>
                {/* Información del cliente */}
                <div className="info-cliente">
                  <div className="info-group">
                    <label>Cédula:</label>
                    <p>{clienteSeleccionado.cedula}</p>
                  </div>

                  <div className="info-group">
                    <label>Dirección:</label>
                    <p>{clienteSeleccionado.direccion}</p>
                  </div>

                  <div className="info-group">
                    <label>Teléfono:</label>
                    <p>{clienteSeleccionado.telefono || "No asignado"}</p>
                  </div>

                  <div className="info-group">
                    <label>Saldo actual:</label>
                    <p className={`saldo-grande ${clienteSeleccionado.saldo > 0 ? "debe" : clienteSeleccionado.saldo < 0 ? "favor" : "al-dia"}`}>
                      {clienteSeleccionado.saldo > 0 ? "$" : clienteSeleccionado.saldo < 0 ? "-$" : "$"}{Math.abs(clienteSeleccionado.saldo).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Actualizar teléfono */}
                <div className="seccion-telefono">
                  <h4>Actualizar teléfono</h4>
                  <div className="input-group">
                    <input
                      type="tel"
                      placeholder="Ej: 3001234567"
                      value={telefonoTemporal}
                      onChange={(e) => setTelefonoTemporal(e.target.value)}
                    />
                    <button onClick={handleActualizarTelefono} className="btn-actualizar">
                      Actualizar
                    </button>
                  </div>
                </div>

                {/* Actualizar dirección */}
                <div className="seccion-direccion">
                  <h4>Actualizar dirección</h4>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="Ej: Calle 123 #45-67"
                      value={direccionTemporal}
                      onChange={(e) => setDireccionTemporal(e.target.value)}
                    />
                    <button onClick={handleActualizarDireccion} className="btn-actualizar">
                      Actualizar
                    </button>
                  </div>
                </div>

                {/* Registrar pago */}
                {clienteSeleccionado && (
                  <div className="seccion-pago">
                    <h4>Registrar Pago/Abono</h4>
                    {clienteSeleccionado.saldo === 0 && (
                      <p style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>
                        💡 Abono anticipado para próximos pedidos
                      </p>
                    )}
                    <div className="pago-group">
                      <input
                        type="number"
                        placeholder="Monto del pago"
                        value={montoPago}
                        onChange={(e) => setMontoPago(e.target.value)}
                        min="0"
                      />
                      <select
                        value={metodoPago}
                        onChange={(e) => setMetodoPago(e.target.value)}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="consignacion">Consignación</option>
                        <option value="credito">Crédito</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Descripción (Ej: Abono anticipado, Consignación)"
                        value={descripcionPago}
                        onChange={(e) => setDescripcionPago(e.target.value)}
                      />
                      <button onClick={handleRegistrarPago} className="btn-pago">
                        Registrar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PESTAÑA: PEDIDOS */}
            {pestanaActiva === "pedidos" && (
              <div className="seccion-pedidos-tabla">
                {pedidosCliente.length === 0 ? (
                  <div className="sin-pedidos-mensaje">
                    <p>Este cliente no tiene pedidos registrados</p>
                  </div>
                ) : (
                  <>
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
                          {pedidosCliente.map((pedido) => (
                            <tr key={pedido.id}>
                              <td data-label="ID">#{pedido.id}</td>
                              <td data-label="Fecha">{pedido.fecha}</td>
                              <td data-label="Valor">${pedido.total?.toLocaleString()}</td>
                              <td data-label="Estado">
                                <span className={`estado-badge estado-${pedido.estado?.toLowerCase().replace(" ", "-")}`}>
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

                    {/* Tarjetas de pedidos para móvil */}
                    <div className="pedidos-cards-container">
                      {pedidosCliente.map((pedido) => (
                        <div key={pedido.id} className={`pedido-card-mini ${pedido.estado?.toLowerCase().replace(" ", "-")}`}>
                          <div className="pedido-card-header-mini">
                            <h4>Pedido #{pedido.id}</h4>
                            <span className={`estado-badge estado-${pedido.estado?.toLowerCase().replace(" ", "-")}`}>
                              {pedido.estado}
                            </span>
                          </div>
                          <div className="pedido-card-body-mini">
                            <p><strong>Fecha:</strong> {pedido.fecha}</p>
                            <p><strong>Valor:</strong> ${pedido.total?.toLocaleString()}</p>
                            <p><strong>Repartidor:</strong> {pedido.repartidor || "No asignado"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PESTAÑA: TRANSACCIONES */}
            {pestanaActiva === "transacciones" && (
              <div className="seccion-transacciones">
                <div className="transacciones-list">
                  {clienteSeleccionado.transacciones.length > 0 ? (
                    clienteSeleccionado.transacciones.map((trans) => (
                      <div key={trans.id} className={`transaccion-item ${trans.tipo}`}>
                        <div className="trans-info">
                          <p className="trans-descripcion">{trans.descripcion}</p>
                          <p className="trans-fecha">{trans.fecha}</p>
                        </div>
                        <p className={`trans-monto ${trans.tipo}`}>
                          {trans.tipo === "pedido" ? "+" : "-"}${trans.monto.toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="sin-transacciones">Sin transacciones</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sin cliente seleccionado */}
        {!clienteSeleccionado && (
          <div className="sin-seleccion">
            <p>Selecciona un cliente para ver sus detalles</p>
          </div>
        )}
      </div>
    </div>
  );
}

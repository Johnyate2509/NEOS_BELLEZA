import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { validarDatosPedido, validarCarrito } from "../utils/validaciones";
import "../styles/vendedor-dashboard.css";

export default function VendedorDashboard() {
  const { user, obtenerDatosUsuario } = useAuth();
  const { clientes, pedidos, productos, crearPedido } = useStore();
  const vendedorData = obtenerDatosUsuario();
  const vendedorId = vendedorData?.id ?? vendedorData?.usuario_id ?? user?.id ?? null;

  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [descripcionPago, setDescripcionPago] = useState("");
  const [mostrarCrearPedido, setMostrarCrearPedido] = useState(false);
  const [itemsPedido, setItemsPedido] = useState([]);
  const [formaPagoPedido, setFormaPagoPedido] = useState("Crédito");
  const [erroresValidacion, setErroresValidacion] = useState([]);
  const [emailCliente, setEmailCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [cargandoPedido, setCargandoPedido] = useState(false);

  // Obtener clientes del vendedor
  const clientesVendedor = clientes.filter((cliente) => {
    const vendedorAsignado = cliente.vendedor_usuario_id ?? cliente.vendedor_id ?? null;
    return String(vendedorAsignado) === String(vendedorId);
  });

  const totalPedidosVendedor = pedidos.filter(p => 
    clientesVendedor.some(c => c.cedula === p.clienteCedula)
  ).length;

  console.log("👨‍💼 VendedorDashboard - Datos:", {
    vendedorId: vendedorData?.id,
    clientesVendedor: clientesVendedor.map(c => ({ id: c.id, nombre: c.nombre, cedula: c.cedula, vendedor_id: c.vendedor_id })),
    totalClientes: clientesVendedor.length,
    totalPedidos: totalPedidosVendedor,
    pedidosFiltrados: pedidos.filter(p => 
      clientesVendedor.some(c => {
        const match = c.cedula === p.clienteCedula;
        console.log(`  Comparando pedido ${p.id} (cedula: "${p.clienteCedula}") con cliente ${c.id} (cedula: "${c.cedula}") = ${match}`);
        return match;
      })
    ).map(p => ({ id: p.id, cliente: p.cliente, clienteCedula: p.clienteCedula }))
  });

  const clienteSeleccionado = clienteSeleccionadoId
    ? clientesVendedor.find((c) => c.id === clienteSeleccionadoId)
    : null;

  const pedidosCliente = clienteSeleccionado
    ? pedidos.filter((p) => p.clienteCedula === clienteSeleccionado.cedula)
    : [];

  // Actualizar email y teléfono cuando se selecciona un cliente
  const handleSeleccionarCliente = (clienteId) => {
    setClienteSeleccionadoId(clienteId);
    const cliente = clientesVendedor.find((c) => c.id === clienteId);
    if (cliente) {
      setEmailCliente(cliente.correo || "");
      setTelefonoCliente(cliente.telefono || "");
    }
    setErroresValidacion([]);
  };

  const handleAgregarProducto = (producto) => {
    const itemExistente = itemsPedido.find(item => item.id === producto.id);
    
    if (itemExistente) {
      setItemsPedido(
        itemsPedido.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      setItemsPedido([
        ...itemsPedido,
        {
          id: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          stock: producto.stock,
          cantidad: 1
        }
      ]);
    }
    setErroresValidacion([]);
  };

  const handleEliminarProducto = (productoId) => {
    setItemsPedido(itemsPedido.filter(item => item.id !== productoId));
  };

  const handleCambiarCantidad = (productoId, cantidad) => {
    if (cantidad <= 0) {
      handleEliminarProducto(productoId);
      return;
    }
    setItemsPedido(
      itemsPedido.map(item =>
        item.id === productoId
          ? { ...item, cantidad }
          : item
      )
    );
    setErroresValidacion([]);
  };

  const handleCrearPedido = async () => {
    setErroresValidacion([]);

    if (!clienteSeleccionado || itemsPedido.length === 0) {
      setErroresValidacion(["Por favor selecciona un cliente y agrega productos"]);
      return;
    }

    // Validar datos del pedido
    const datosValidar = {
      cedula: clienteSeleccionado.cedula,
      nombre: clienteSeleccionado.nombre,
      direccion: clienteSeleccionado.direccion,
      email: emailCliente,
      telefono: telefonoCliente,
      formaPago: formaPagoPedido,
      carrito: itemsPedido,
    };

    const validacion = validarDatosPedido(datosValidar);
    if (!validacion.valido) {
      setErroresValidacion(validacion.errores);
      return;
    }

    // Validar carrito específicamente
    const validacionCarrito = validarCarrito(itemsPedido);
    if (!validacionCarrito.valido) {
      setErroresValidacion(validacionCarrito.errores);
      return;
    }

    setCargandoPedido(true);

    try {
      const resultado = await crearPedido(
        clienteSeleccionado.cedula,
        clienteSeleccionado.nombre,
        clienteSeleccionado.direccion,
        itemsPedido,
        formaPagoPedido,
        emailCliente,
        telefonoCliente
      );

      if (resultado.success) {
        alert("✓ Pedido creado correctamente y confirmación enviada al cliente");
        setItemsPedido([]);
        setMostrarCrearPedido(false);
        setErroresValidacion([]);
        setEmailCliente("");
        setTelefonoCliente("");
      } else {
        setErroresValidacion([resultado.error || "Error al crear el pedido"]);
      }
    } catch (error) {
      setErroresValidacion([error.message || "Error inesperado"]);
    } finally {
      setCargandoPedido(false);
    }
  };

  const totalPedido = itemsPedido.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0
  );

  return (
    <div className="vendedor-dashboard">
      <div className="vendedor-header">
        <div>
          <h2>Mi Cartera de Clientes</h2>
          <p>Bienvenido, {vendedorData?.nombre} - Zona: {vendedorData?.zona}</p>
        </div>
        <div className="vendor-stats">
          <div className="stat-card">
            <span className="stat-label">Total Clientes</span>
            <span className="stat-value">{clientesVendedor.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pedidos Totales</span>
            <span className="stat-value">
              {totalPedidosVendedor}
            </span>
          </div>
        </div>
      </div>

      <div className="vendedor-contenedor">
        {/* Lista de clientes */}
        <div className="clientes-lista">
          <h3>Mis Clientes ({clientesVendedor.length})</h3>
          <div className="clientes-scroll">
            {clientesVendedor.length === 0 ? (
              <p className="texto-vacio">No tienes clientes asignados</p>
            ) : (
              clientesVendedor.map((cliente) => (
                <div
                  key={cliente.id}
                  className={`cliente-item ${clienteSeleccionadoId === cliente.id ? "activo" : ""}`}
                  onClick={() => handleSeleccionarCliente(cliente.id)}
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
              ))
            )}
          </div>
        </div>

        {/* Detalles del cliente */}
        {clienteSeleccionado && (
          <div className="cliente-detalle">
            <div className="detalle-header">
              <h3>{clienteSeleccionado.nombre}</h3>
              <button 
                className="btn-crear-pedido"
                onClick={() => setMostrarCrearPedido(!mostrarCrearPedido)}
              >
                {mostrarCrearPedido ? "Cancelar" : "➕ Crear Pedido"}
              </button>
            </div>

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
                <label>Saldo:</label>
                <p className={clienteSeleccionado.saldo > 0 ? "debe" : clienteSeleccionado.saldo < 0 ? "favor" : "al-dia"}>
                  {clienteSeleccionado.saldo > 0 ? "Debe: $" : clienteSeleccionado.saldo < 0 ? "A Favor: $" : "Al día: $"}
                  {Math.abs(clienteSeleccionado.saldo).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Crear Pedido */}
            {mostrarCrearPedido && (
              <div className="crear-pedido-section">
                <h4>Crear Nuevo Pedido</h4>

                {/* Mostrar errores de validación */}
                {erroresValidacion.length > 0 && (
                  <div className="errores-validacion">
                    <h5>⚠️ Errores de Validación:</h5>
                    <ul>
                      {erroresValidacion.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Datos de contacto del cliente */}
                <div className="datos-contacto">
                  <h5>Datos de Contacto</h5>
                  <div className="contacto-fields">
                    <div className="form-group">
                      <label>Email del Cliente:</label>
                      <input
                        type="email"
                        value={emailCliente}
                        onChange={(e) => setEmailCliente(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="input-email"
                      />
                      <small>Se usará para enviar la confirmación del pedido</small>
                    </div>

                    <div className="form-group">
                      <label>Teléfono del Cliente:</label>
                      <input
                        type="tel"
                        value={telefonoCliente}
                        onChange={(e) => setTelefonoCliente(e.target.value)}
                        placeholder="Teléfono (opcional)"
                        className="input-telefono"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="productos-disponibles">
                  <h5>Productos Disponibles</h5>
                  <div className="productos-grid">
                    {productos.map((producto) => (
                      <div key={producto.id} className="producto-item">
                        <div className="producto-info">
                          <p className="producto-nombre">{producto.nombre}</p>
                          <p className="producto-precio">${producto.precio.toLocaleString()}</p>
                          <p className="producto-stock">Stock: {producto.stock}</p>
                        </div>
                        <button
                          className="btn-agregar"
                          onClick={() => handleAgregarProducto(producto)}
                          disabled={producto.stock === 0}
                        >
                          Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {itemsPedido.length > 0 && (
                  <div className="pedido-resumen">
                    <h5>Resumen del Pedido</h5>
                    <table className="tabla-pedido">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Precio</th>
                          <th>Cantidad</th>
                          <th>Subtotal</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsPedido.map((item) => (
                          <tr key={item.id}>
                            <td>{item.nombre}</td>
                            <td>${item.precio.toLocaleString()}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                value={item.cantidad}
                                onChange={(e) =>
                                  handleCambiarCantidad(
                                    item.id,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="input-cantidad"
                              />
                            </td>
                            <td>${(item.precio * item.cantidad).toLocaleString()}</td>
                            <td>
                              <button
                                className="btn-eliminar admin-action-control admin-action-control--danger admin-action-control--icon"
                                onClick={() => handleEliminarProducto(item.id)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pedido-total">
                      <label>Total: ${totalPedido.toLocaleString()}</label>
                    </div>

                    <div className="forma-pago">
                      <label>Forma de Pago:</label>
                      <select
                        value={formaPagoPedido}
                        onChange={(e) => setFormaPagoPedido(e.target.value)}
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Crédito">Crédito</option>
                        <option value="Abono">Abono</option>
                        <option value="Tarjeta">Tarjeta</option>
                      </select>
                    </div>

                    <button
                      className="btn-confirmar-pedido"
                      onClick={handleCrearPedido}
                      disabled={cargandoPedido}
                    >
                      {cargandoPedido ? "Procesando..." : "✓ Confirmar Pedido"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Historial de pedidos */}
            <div className="pedidos-historial">
              <h4>Pedidos del Cliente ({pedidosCliente.length})</h4>
              {pedidosCliente.length === 0 ? (
                <p className="texto-vacio">No hay pedidos registrados</p>
              ) : (
                <div className="pedidos-list">
                  {pedidosCliente.map((pedido) => (
                    <div key={pedido.id} className="pedido-card">
                      <div className="pedido-header">
                        <span className="pedido-id">Pedido #{pedido.id}</span>
                        <span className={`estado-badge ${pedido.estado.toLowerCase().replace(" ", "-")}`}>
                          {pedido.estado}
                        </span>
                      </div>
                      <div className="pedido-info">
                        <p><strong>Fecha:</strong> {pedido.fecha}</p>
                        <p><strong>Total:</strong> ${pedido.total.toLocaleString()}</p>
                        <p><strong>Forma de Pago:</strong> {pedido.formaPago}</p>
                        <p><strong>Repartidor:</strong> {pedido.repartidor || "No asignado"}</p>
                      </div>
                      <div className="pedido-items">
                        <strong>Items:</strong>
                        <ul>
                          {pedido.items.map((item, idx) => (
                            <li key={idx}>
                              {item.nombre} · Catálogo: {item.tipo_catalogo || "General"} · ${Number(item.precio || 0).toLocaleString()} c/u · Total: ${(item.precio * item.cantidad).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

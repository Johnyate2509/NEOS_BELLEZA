import { useState } from "react";
import { useStore } from "../context/StoreContext";
import "../styles/admin-clientes.css";


export default function AdminClientes() {
  const { clientes, crearCliente, actualizarClienteCompleto, eliminarCliente, vendedoresConUsuarios } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState(null);
  const [clienteEdicion, setClienteEdicion] = useState(null);
  const [mensajeEdicion, setMensajeEdicion] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    cedula: "",
    nombre: "",
    direccion: "",
    telefono: "",
    correo: "",
    vendedor_id: null,
  });
  const [mensaje, setMensaje] = useState("");

  const cerrarFormulario = () => {
    setMostrarForm(false);
    setMensaje("");
  };

  const cerrarModalEdicion = () => {
    setClienteEditandoId(null);
    setClienteEdicion(null);
    setMensajeEdicion("");
  };

  const handleGuardarCliente = async () => {
    if (!nuevoCliente.cedula || !nuevoCliente.nombre || !nuevoCliente.direccion) {
      setMensaje("❌ Cédula, nombre y dirección son requeridos");
      return;
    }

    const resultado = await crearCliente(
      nuevoCliente.nombre,
      nuevoCliente.cedula,
      nuevoCliente.direccion,
      nuevoCliente.telefono,
      nuevoCliente.correo,
      nuevoCliente.vendedor_id || null
    );

    if (resultado?.error) {
      setMensaje(`❌ ${resultado.error}`);
      return;
    }

    setMensaje(`✅ Cliente ${nuevoCliente.nombre} creado correctamente`);
    setNuevoCliente({
      cedula: "",
      nombre: "",
      direccion: "",
      telefono: "",
      correo: "",
      vendedor_id: null,
    });
    setTimeout(() => {
      setMostrarForm(false);
      setMensaje("");
    }, 2000);
  };

  const editarCliente = (cliente) => {
    setClienteEditandoId(cliente.id);
    setClienteEdicion({
      cedula: cliente.cedula || "",
      nombre: cliente.nombre || "",
      direccion: cliente.direccion || "",
      telefono: cliente.telefono || "",
      correo: cliente.correo || "",
      vendedor_id: String(cliente.vendedor_usuario_id ?? cliente.vendedor_id ?? ""),
    });
    setMensajeEdicion("");
  };

  const guardarEdicionCliente = async (event) => {
    event.preventDefault();
    if (!clienteEdicion?.cedula || !clienteEdicion.nombre || !clienteEdicion.direccion) {
      setMensajeEdicion("Cédula, nombre y dirección son requeridos.");
      return;
    }

    setGuardandoEdicion(true);
    try {
      const resultado = await actualizarClienteCompleto(clienteEditandoId, clienteEdicion);
      if (resultado?.error) {
        setMensajeEdicion(resultado.error);
        return;
      }
      cerrarModalEdicion();
    } catch (error) {
      setMensajeEdicion(error.message || "No se pudo actualizar el cliente.");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const confirmarEliminarCliente = async (cliente) => {
    if (!window.confirm(`¿Eliminar definitivamente al cliente “${cliente.nombre}”?`)) return;
    const resultado = await eliminarCliente(cliente.id);
    if (resultado?.error) {
      window.alert(`No se pudo eliminar el cliente: ${resultado.error}`);
      return;
    }
    if (String(clienteEditandoId) === String(cliente.id)) cerrarModalEdicion();
  };

  const alternarFormulario = () => {
    if (mostrarForm) {
      cerrarFormulario();
      return;
    }
    setNuevoCliente({ cedula: "", nombre: "", direccion: "", telefono: "", correo: "", vendedor_id: "" });
    setMensaje("");
    setMostrarForm(true);
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const clientesFiltrados = normalizedSearch
    ? clientes.filter((cliente) => {
        const vendedorNombre = vendedoresConUsuarios.find((v) => v.id === cliente.vendedor_id)?.nombre || "";
        return [
          cliente.nombre,
          cliente.cedula,
          cliente.direccion,
          cliente.telefono,
          cliente.correo,
          vendedorNombre,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
    : clientes;

  return (
    <div className="admin-clientes-page">
      <div className="admin-header">
        <h2>Administrar clientes</h2>
        <button className="btn-crear" type="button" onClick={alternarFormulario}>
          {mostrarForm ? "✕ Cancelar" : "+ Crear Cliente"}
        </button>
      </div>

      {/* Formulario de creación */}
      {mostrarForm && (
        <div className="form-crear-cliente">
          <h3>Registrar Nuevo Cliente</h3>
          {mensaje && <div className={`mensaje ${mensaje.includes("✅") ? "exito" : "error"}`}>{mensaje}</div>}
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Cédula o NIT"
              value={nuevoCliente.cedula}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, cedula: e.target.value })}
            />
            <input
              type="text"
              placeholder="Nombre Completo"
              value={nuevoCliente.nombre}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
            />
            <input
              type="text"
              placeholder="Dirección"
              value={nuevoCliente.direccion}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
            />
            <input
              type="tel"
              placeholder="Teléfono (Opcional)"
              value={nuevoCliente.telefono}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
            />
            <input
              type="email"
              placeholder="Correo (Opcional)"
              value={nuevoCliente.correo}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, correo: e.target.value })}
            />
            <select
              className="select-vendedor"
              value={nuevoCliente.vendedor_id || ""}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, vendedor_id: e.target.value })}
            >
              <option value="">Seleccionar Vendedor (Opcional)</option>
              {vendedoresConUsuarios.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nombre} - {vendedor.zona || vendedor.email}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-guardar" type="button" onClick={handleGuardarCliente}>
            Guardar Cliente
          </button>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="clientes-grid">
        <div className="clientes-grid-header">
          <h3>Total de Clientes: {clientesFiltrados.length}{searchTerm ? ` de ${clientes.length}` : ""}</h3>
          <input
            type="search"
            placeholder="Buscar cliente por nombre, cédula, correo o vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="busqueda-clientes"
          />
        </div>
        <div className="clientes-table">
          <div className="table-header">
            <div className="col-cedula">Cédula</div>
            <div className="col-nombre">Nombre</div>
            <div className="col-direccion">Dirección</div>
            <div className="col-telefono">Teléfono</div>
            <div className="col-correo">Correo</div>
            <div className="col-vendedor">Vendedor</div>
            <div className="col-acciones">Acciones</div>
          </div>

          {clientesFiltrados.length > 0 ? (
            clientesFiltrados.map((cliente) => {
              const vendedor = vendedoresConUsuarios.find((item) => String(item.id) === String(cliente.vendedor_usuario_id ?? cliente.vendedor_id));
              return (
                <div key={cliente.id} className="table-row">
                  <div className="col-cedula">{cliente.cedula}</div>
                  <div className="col-nombre">{cliente.nombre}</div>
                  <div className="col-direccion">{cliente.direccion}</div>
                  <div className="col-telefono">{cliente.telefono || "-"}</div>
                  <div className="col-correo">{cliente.correo || "-"}</div>
                  <div className="col-vendedor">{vendedor?.nombre || "Sin vendedor"}</div>
                  <div className="col-acciones">
                    <button type="button" className="btn-cliente-editar admin-action-control" onClick={() => editarCliente(cliente)}>Editar</button>
                    <button type="button" className="btn-cliente-eliminar admin-action-control admin-action-control--danger" onClick={() => confirmarEliminarCliente(cliente)}>Eliminar</button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="table-empty">No hay clientes registrados</div>
          )}
        </div>
      </div>

      {clienteEdicion && (
        <div className="admin-cliente-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardandoEdicion) cerrarModalEdicion(); }}>
          <section className="admin-cliente-modal" role="dialog" aria-modal="true" aria-labelledby="admin-cliente-editar-titulo">
            <header className="admin-cliente-modal-header">
              <div><span>ADMINISTRACIÓN</span><h2 id="admin-cliente-editar-titulo">Editar cliente</h2></div>
              <button type="button" aria-label="Cerrar" onClick={cerrarModalEdicion} disabled={guardandoEdicion}>×</button>
            </header>
            <form onSubmit={guardarEdicionCliente}>
              <div className="admin-cliente-modal-fields">
                <label>Cédula o NIT<input value={clienteEdicion.cedula} onChange={(event) => setClienteEdicion({ ...clienteEdicion, cedula: event.target.value })} required /></label>
                <label>Nombre completo<input value={clienteEdicion.nombre} onChange={(event) => setClienteEdicion({ ...clienteEdicion, nombre: event.target.value })} required /></label>
                <label className="span-two">Dirección<input value={clienteEdicion.direccion} onChange={(event) => setClienteEdicion({ ...clienteEdicion, direccion: event.target.value })} required /></label>
                <label>Teléfono<input type="tel" value={clienteEdicion.telefono} onChange={(event) => setClienteEdicion({ ...clienteEdicion, telefono: event.target.value })} /></label>
                <label>Correo<input type="email" value={clienteEdicion.correo} onChange={(event) => setClienteEdicion({ ...clienteEdicion, correo: event.target.value })} /></label>
                <label className="span-two">Vendedor<select value={clienteEdicion.vendedor_id} onChange={(event) => setClienteEdicion({ ...clienteEdicion, vendedor_id: event.target.value })}>
                  <option value="">Sin vendedor</option>
                  {vendedoresConUsuarios.map((vendedor) => <option key={vendedor.id} value={vendedor.id}>{vendedor.nombre} - {vendedor.zona || vendedor.email}</option>)}
                </select></label>
              </div>
              {mensajeEdicion && <p className="admin-cliente-modal-error" role="alert">{mensajeEdicion}</p>}
              <footer className="admin-cliente-modal-actions">
                <button type="button" className="btn-cancelar-edicion" onClick={cerrarModalEdicion} disabled={guardandoEdicion}>Cancelar</button>
                <button type="submit" className="btn-guardar" disabled={guardandoEdicion}>{guardandoEdicion ? "Guardando..." : "Guardar cambios"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

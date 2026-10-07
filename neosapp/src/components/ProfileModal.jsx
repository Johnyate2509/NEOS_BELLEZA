import { useState, useEffect } from "react";
import { useStore } from "../context/StoreContext";
import "../styles/profile-modal.css";

export default function ProfileModal({ clienteId, onClose }) {
  const {
    clientes,
    actualizarPerfilPropioCliente,
  } = useStore();

  const cliente = clientes.find((c) => c.id === clienteId);

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [celular, setCelular] = useState("");
  const [direccion, setDireccion] = useState("");
  const [editando, setEditando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  useEffect(() => {
    if (cliente) {
      setNombre(cliente.nombre || "");
      setCedula(cliente.cedula || "");
      setCelular(cliente.telefono || "");
      setDireccion(cliente.direccion || "");
    }
  }, [cliente]);

  const handleGuardar = async () => {
    setMensajeError("");
    setMensajeExito("");

    if (!nombre.trim()) {
      setMensajeError("El nombre es requerido");
      return;
    }

    if (!cedula.trim()) {
      setMensajeError("La cédula es requerida");
      return;
    }

    if (!celular.trim()) {
      setMensajeError("El celular es requerido");
      return;
    }

    if (!direccion.trim()) {
      setMensajeError("La dirección es requerida");
      return;
    }

    setCargando(true);

    try {
      const actualizado = await actualizarPerfilPropioCliente({
        nombre,
        cedula,
        telefono: celular,
        direccion,
      });

      if (actualizado) {
        setMensajeExito("Perfil actualizado correctamente");
        setEditando(false);
        setTimeout(() => {
          setMensajeExito("");
        }, 2000);
      } else {
        setMensajeError("Error al actualizar algunos datos");
      }
    } catch (error) {
      console.error("Error al guardar:", error);
      setMensajeError("Error al guardar los cambios");
    } finally {
      setCargando(false);
    }
  };

  const handleCancelar = () => {
    setEditando(false);
    setNombre(cliente?.nombre || "");
    setCedula(cliente?.cedula || "");
    setCelular(cliente?.telefono || "");
    setDireccion(cliente?.direccion || "");
    setMensajeError("");
    setMensajeExito("");
  };

  if (!cliente) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>Mi Perfil</h2>
          <button className="profile-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="profile-modal-content">
          {mensajeError && (
            <div className="profile-modal-mensaje error">{mensajeError}</div>
          )}
          {mensajeExito && (
            <div className="profile-modal-mensaje exito">{mensajeExito}</div>
          )}

          <div className="profile-field-group">
            <label>Nombre</label>
            {editando ? (
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                className="profile-input"
              />
            ) : (
              <p className="profile-value">{cliente.nombre}</p>
            )}
          </div>

          <div className="profile-field-group">
            <label>Cédula</label>
            {editando ? (
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Cédula"
                className="profile-input"
              />
            ) : (
              <p className="profile-value">{cliente.cedula}</p>
            )}
          </div>

          <div className="profile-field-group">
            <label>Celular</label>
            {editando ? (
              <input
                type="tel"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="Celular"
                className="profile-input"
              />
            ) : (
              <p className="profile-value">{cliente.telefono}</p>
            )}
          </div>

          <div className="profile-field-group">
            <label>Dirección</label>
            {editando ? (
              <textarea
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección de residencia"
                className="profile-input profile-textarea"
                rows="3"
              />
            ) : (
              <p className="profile-value">{cliente.direccion}</p>
            )}
          </div>

          <div className="profile-field-group">
            <label>Correo</label>
            <p className="profile-value">{cliente.correo}</p>
          </div>

          <div className="profile-modal-acciones">
            {editando ? (
              <>
                <button
                  className="profile-btn-guardar"
                  onClick={handleGuardar}
                  disabled={cargando}
                >
                  {cargando ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  className="profile-btn-cancelar"
                  onClick={handleCancelar}
                  disabled={cargando}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                className="profile-btn-editar"
                onClick={() => setEditando(true)}
              >
                ✎ Editar Perfil
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

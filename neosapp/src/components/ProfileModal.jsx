import { useState, useEffect } from "react";
import { useStore } from "../context/StoreContext";
import { supabase } from "../context/supabaseClient";
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
  const [mostrarCambioContrasena, setMostrarCambioContrasena] = useState(false);
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);

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

  const handleCambiarContrasena = async () => {
    setMensajeError("");
    setMensajeExito("");
    if (nuevaContrasena.length < 6) {
      setMensajeError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaContrasena !== confirmarContrasena) {
      setMensajeError("Las contraseñas no coinciden.");
      return;
    }

    setCambiandoContrasena(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
    if (error) {
      setMensajeError("No se pudo cambiar la contraseña. Vuelve a iniciar sesión e inténtalo de nuevo.");
    } else {
      setMensajeExito("Contraseña actualizada correctamente.");
      setNuevaContrasena("");
      setConfirmarContrasena("");
      setMostrarCambioContrasena(false);
    }
    setCambiandoContrasena(false);
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

          <div className="profile-password-section">
            <button
              type="button"
              className="profile-password-toggle"
              onClick={() => {
                setMostrarCambioContrasena((visible) => !visible);
                setNuevaContrasena("");
                setConfirmarContrasena("");
                setMensajeError("");
              }}
            >
              {mostrarCambioContrasena ? "Cancelar cambio de contraseña" : "Cambiar contraseña"}
            </button>
            {mostrarCambioContrasena && (
              <div className="profile-password-form">
                <div className="profile-field-group">
                  <label htmlFor="profile-new-password">Nueva contraseña</label>
                  <input id="profile-new-password" className="profile-input" type="password" autoComplete="new-password" minLength={6} value={nuevaContrasena} onChange={(e) => setNuevaContrasena(e.target.value)} disabled={cambiandoContrasena} />
                </div>
                <div className="profile-field-group">
                  <label htmlFor="profile-confirm-password">Confirmar contraseña</label>
                  <input id="profile-confirm-password" className="profile-input" type="password" autoComplete="new-password" minLength={6} value={confirmarContrasena} onChange={(e) => setConfirmarContrasena(e.target.value)} disabled={cambiandoContrasena} />
                </div>
                <button type="button" className="profile-btn-guardar" onClick={handleCambiarContrasena} disabled={cambiandoContrasena}>
                  {cambiandoContrasena ? "Actualizando..." : "Guardar contraseña"}
                </button>
              </div>
            )}
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

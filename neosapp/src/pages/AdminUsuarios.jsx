import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../context/supabaseClient";
import "../styles/admin-usuarios.css";

const ROLES = [
  { value: "cliente", label: "Cliente" },
  { value: "vendedor", label: "Vendedor" },
  { value: "repartidor", label: "Repartidor" },
  { value: "admin", label: "Administrador" },
];

const etiquetaRol = (rol) => ROLES.find((opcion) => opcion.value === rol)?.label || rol || "Sin rol";

const mensajeDeErrorFuncion = async (errorFuncion, data, fallback) => {
  if (data?.error) return data.error;
  const respuesta = errorFuncion?.context;
  if (respuesta && typeof respuesta.clone === "function") {
    try {
      const detalle = await respuesta.clone().json();
      if (detalle?.error || detalle?.message) return detalle.error || detalle.message;
    } catch {
      // Algunas respuestas de error no traen JSON; se usa el mensaje del SDK.
    }
  }
  return errorFuncion?.message || fallback;
};

export default function AdminUsuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [rolesEditados, setRolesEditados] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError("");
    const { data, error: errorCarga } = await supabase
      .from("usuarios")
      .select("id,nombre,email,rol,zona,cedula,created_at")
      .order("nombre", { ascending: true });
    if (errorCarga) {
      setError(errorCarga.message || "No se pudieron cargar los usuarios.");
      setCargando(false);
      return;
    }
    setUsuarios(data || []);
    setCargando(false);
  }, []);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es");
    if (!termino) return usuarios;
    return usuarios.filter((usuario) => [usuario.nombre, usuario.email, usuario.zona, usuario.cedula, usuario.id]
      .some((valor) => String(valor || "").toLocaleLowerCase("es").includes(termino)));
  }, [busqueda, usuarios]);

  const actualizarRol = async (usuario) => {
    const rol = rolesEditados[usuario.id];
    if (!rol || rol === usuario.rol) return;
    setProcesandoId(usuario.id);
    setError("");
    setMensaje("");
    const { data, error: errorFuncion } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_role", userId: usuario.id, role: rol },
    });
    setProcesandoId(null);
    if (errorFuncion || data?.error) {
      setError(await mensajeDeErrorFuncion(errorFuncion, data, "No se pudo cambiar el rol."));
      return;
    }
    setUsuarios((actuales) => actuales.map((item) => item.id === usuario.id ? { ...item, rol: data.usuario?.rol || rol } : item));
    setRolesEditados((actuales) => {
      const siguientes = { ...actuales };
      delete siguientes[usuario.id];
      return siguientes;
    });
    setMensaje(`Rol de ${usuario.nombre || usuario.email} actualizado a ${etiquetaRol(rol)}.`);
  };

  const eliminarUsuario = async (usuario) => {
    const nombre = usuario.nombre || usuario.email || "este usuario";
    if (!window.confirm(`¿Eliminar la cuenta de ${nombre}? Esta acción es irreversible. Los datos de pedidos se conservarán y se desvincularán las asignaciones.`)) return;
    setProcesandoId(usuario.id);
    setError("");
    setMensaje("");
    const { data, error: errorFuncion } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "delete", userId: usuario.id },
    });
    setProcesandoId(null);
    if (errorFuncion || data?.error) {
      setError(await mensajeDeErrorFuncion(errorFuncion, data, "No se pudo eliminar el usuario."));
      return;
    }
    setUsuarios((actuales) => actuales.filter((item) => item.id !== usuario.id));
    setRolesEditados((actuales) => {
      const siguientes = { ...actuales };
      delete siguientes[usuario.id];
      return siguientes;
    });
    setMensaje(`Cuenta de ${nombre} eliminada.`);
  };

  return (
    <main className="admin-usuarios-page">
      <header className="admin-usuarios-header">
        <div>
          <span className="admin-usuarios-eyebrow">ADMINISTRACIÓN</span>
          <h1>Usuarios</h1>
          <p>Gestiona accesos y roles de las cuentas de Neos Belleza.</p>
        </div>
        <div className="admin-usuarios-total"><strong>{usuarios.length}</strong><span>cuentas</span></div>
      </header>

      <section className="admin-usuarios-panel" aria-label="Administración de usuarios">
        <div className="admin-usuarios-toolbar">
          <label htmlFor="admin-usuarios-busqueda">Buscar usuario</label>
          <input
            id="admin-usuarios-busqueda"
            type="search"
            placeholder="Nombre, correo, zona o ID"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
          <button type="button" onClick={cargarUsuarios} disabled={cargando || procesandoId !== null}>Actualizar</button>
        </div>

        {error && <p className="admin-usuarios-alerta error" role="alert">{error}</p>}
        {mensaje && <p className="admin-usuarios-alerta exito" role="status">{mensaje}</p>}
        {cargando ? <p className="admin-usuarios-vacio">Cargando usuarios…</p> : usuariosFiltrados.length === 0 ? (
          <p className="admin-usuarios-vacio">No hay usuarios que coincidan con la búsqueda.</p>
        ) : (
          <div className="admin-usuarios-lista">
            {usuariosFiltrados.map((usuario) => {
              const esCuentaActual = usuario.id === user?.id;
              const rolSeleccionado = rolesEditados[usuario.id] ?? usuario.rol;
              const rolModificado = rolSeleccionado !== usuario.rol;
              const ocupado = procesandoId === usuario.id;
              const hayOperacion = procesandoId !== null;
              return (
                <article className="admin-usuario-card" key={usuario.id}>
                  <div className="admin-usuario-identidad">
                    <div className="admin-usuario-avatar" aria-hidden="true">{(usuario.nombre || usuario.email || "U").slice(0, 1).toLocaleUpperCase("es")}</div>
                    <div className="admin-usuario-datos">
                      <div className="admin-usuario-nombre">{usuario.nombre || "Sin nombre"}{esCuentaActual && <span className="admin-usuario-actual">Sesión actual</span>}</div>
                      <div className="admin-usuario-email">{usuario.email || "Sin correo"}</div>
                      <div className="admin-usuario-extra">{usuario.zona || "Sin zona"}{usuario.cedula ? ` · ${usuario.cedula}` : ""}</div>
                    </div>
                  </div>
                  <div className="admin-usuario-acciones">
                    <label className="admin-usuario-rol-label" htmlFor={`rol-${usuario.id}`}>Rol</label>
                    <select
                      id={`rol-${usuario.id}`}
                      value={rolSeleccionado}
                      disabled={esCuentaActual || hayOperacion}
                      onChange={(event) => setRolesEditados((actuales) => ({ ...actuales, [usuario.id]: event.target.value }))}
                    >
                      {ROLES.map((rol) => <option key={rol.value} value={rol.value}>{rol.label}</option>)}
                    </select>
                    <button type="button" className="admin-usuario-guardar" disabled={!rolModificado || hayOperacion || esCuentaActual} onClick={() => actualizarRol(usuario)}>
                      {ocupado && rolModificado ? "Guardando…" : "Guardar rol"}
                    </button>
                    <button type="button" className="admin-usuario-eliminar" disabled={hayOperacion || esCuentaActual} onClick={() => eliminarUsuario(usuario)}>
                      {ocupado && !rolModificado ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="admin-usuarios-privacidad">Solo se muestran datos de perfil y acceso. Las contraseñas no se consultan ni se muestran.</p>
    </main>
  );
}

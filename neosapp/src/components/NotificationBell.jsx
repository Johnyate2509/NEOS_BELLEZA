import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../context/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/notificaciones.css";

const rutaPorTipo = (tipo, rol) => {
  if (tipo === "nuevo_cliente") return "/admin-clientes";
  if (tipo.startsWith("pedido_") || tipo === "pedido_nuevo") {
    if (rol === "admin") return "/pedidos";
    if (rol === "vendedor") return "/vendedor-reportes";
    if (rol === "repartidor") return "/";
    return "/mis-pedidos";
  }
  return "/";
};

export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { getUserRole } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const noLeidas = notificaciones.filter((notificacion) => !notificacion.leida).length;

  const cargarNotificaciones = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: errorCarga } = await supabase
      .from("notificaciones_app")
      .select("id,tipo,titulo,mensaje,entidad_id,leida,created_at")
      .eq("usuario_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (errorCarga) {
      setError("No se pudieron cargar las notificaciones.");
      console.error("Error cargando notificaciones:", errorCarga);
      return;
    }
    setError("");
    setNotificaciones(data || []);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotificaciones([]);
      return undefined;
    }
    void cargarNotificaciones();
    const channel = supabase
      .channel(`notificaciones-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificaciones_app",
        filter: `usuario_id=eq.${user.id}`,
      }, () => void cargarNotificaciones())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, cargarNotificaciones]);

  useEffect(() => setAbierto(false), [location.pathname]);

  const marcarLeida = async (notificacion) => {
    if (!notificacion.leida) {
      const { error: errorActualizar } = await supabase
        .from("notificaciones_app")
        .update({ leida: true })
        .eq("id", notificacion.id)
        .eq("usuario_id", user.id);
      if (errorActualizar) {
        console.error("Error marcando notificación como leída:", errorActualizar);
        return;
      }
      setNotificaciones((actuales) => actuales.map((item) =>
        item.id === notificacion.id ? { ...item, leida: true } : item
      ));
    }
    setAbierto(false);
    navigate(rutaPorTipo(notificacion.tipo, getUserRole()));
  };

  const marcarTodasLeidas = async () => {
    const { error: errorActualizar } = await supabase
      .from("notificaciones_app")
      .update({ leida: true })
      .eq("usuario_id", user.id)
      .eq("leida", false);
    if (errorActualizar) {
      console.error("Error marcando notificaciones como leídas:", errorActualizar);
      return;
    }
    setNotificaciones((actuales) => actuales.map((item) => ({ ...item, leida: true })));
  };

  if (!user?.id) return null;

  return (
    <div className="notificaciones-contenedor">
      <button
        type="button"
        className="notificaciones-boton"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ""}`}
        aria-expanded={abierto}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {noLeidas > 0 && <span className="notificaciones-contador">{noLeidas > 99 ? "99+" : noLeidas}</span>}
      </button>
      {abierto && (
        <section className="notificaciones-panel" aria-label="Notificaciones">
          <header className="notificaciones-panel-header">
            <strong>Notificaciones</strong>
            {noLeidas > 0 && <button type="button" onClick={marcarTodasLeidas}>Marcar todas leídas</button>}
          </header>
          {error ? <p className="notificaciones-vacio" role="alert">{error}</p> : notificaciones.length === 0 ? (
            <p className="notificaciones-vacio">Aún no tienes notificaciones.</p>
          ) : (
            <div className="notificaciones-lista">
              {notificaciones.map((notificacion) => (
                <button
                  type="button"
                  key={notificacion.id}
                  className={`notificacion-item ${notificacion.leida ? "leida" : "no-leida"}`}
                  onClick={() => void marcarLeida(notificacion)}
                >
                  <span className="notificacion-punto" aria-hidden="true" />
                  <span className="notificacion-contenido">
                    <strong>{notificacion.titulo}</strong>
                    <span>{notificacion.mensaje}</span>
                    <time dateTime={notificacion.created_at}>{new Date(notificacion.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</time>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

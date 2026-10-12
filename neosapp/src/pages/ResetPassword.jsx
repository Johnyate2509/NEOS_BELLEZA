import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../context/supabaseClient";
import "./login.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [sesionRecuperacion, setSesionRecuperacion] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  useEffect(() => {
    const urlTieneRecuperacion =
      window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).has("code");

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setSesionRecuperacion(true);
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (urlTieneRecuperacion && sessionData.session) setSesionRecuperacion(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const handleGuardar = async (event) => {
    event.preventDefault();
    setError("");
    if (contrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (contrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: contrasena });
    if (updateError) {
      setError("No se pudo actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.");
    } else {
      setExito(true);
      setContrasena("");
      setConfirmacion("");
    }
    setCargando(false);
  };

  const irAlLogin = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>NEOSAPP</h1>
          <p>{exito ? "Contraseña actualizada" : "Recuperación de contraseña"}</p>
        </div>

        {exito ? (
          <>
            <div className="success-message">Ya puedes iniciar sesión con tu nueva contraseña.</div>
            <button type="button" className="btn-login" onClick={irAlLogin}>Ir al inicio de sesión</button>
          </>
        ) : !sesionRecuperacion ? (
          <>
            <div className="error-message">El enlace no es válido o venció. Solicita uno nuevo desde el inicio de sesión.</div>
            <button type="button" className="btn-login" onClick={() => navigate("/login", { replace: true })}>Volver al inicio de sesión</button>
          </>
        ) : (
          <form onSubmit={handleGuardar} className="login-form">
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type="password" autoComplete="new-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} minLength={6} required disabled={cargando} />
            </div>
            <div className="form-group">
              <label>Confirmar contraseña</label>
              <input type="password" autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} minLength={6} required disabled={cargando} />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn-login" disabled={cargando}>
              {cargando ? "Guardando..." : "Guardar nueva contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

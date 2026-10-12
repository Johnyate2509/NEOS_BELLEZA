import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../context/supabaseClient";
import "./login.css";

export default function Login() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState("");

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        setError("Email o contraseña incorrectos");
        setCargando(false);
        return;
      }

      // El login se maneja automáticamente por AuthContext
      navigate("/");
    } catch (err) {
      setError("Error al iniciar sesión");
      console.error("Error de login:", err);
    }

    setCargando(false);
  };

  const handleRecuperarContrasena = async (e) => {
    e.preventDefault();
    setError("");
    setMensajeRecuperacion("");
    if (!email.trim()) {
      setError("Escribe tu correo para enviarte el enlace de recuperación.");
      return;
    }

    setCargando(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    });
    if (resetError) {
      setError("No se pudo enviar el correo. Verifica la dirección e inténtalo de nuevo.");
    } else {
      setMensajeRecuperacion("Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.");
    }
    setCargando(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>NEOSAPP</h1>
          <p>Sistema de Gestión de Ventas</p>
        </div>

        <form onSubmit={recuperando ? handleRecuperarContrasena : handleLogin} className="login-form">
          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="Ej: correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={cargando}
              required
            />
          </div>

          {!recuperando && <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={cargando}
              required
            />
          </div>}

          {error && <div className="error-message">{error}</div>}
          {mensajeRecuperacion && <div className="success-message">{mensajeRecuperacion}</div>}

          <button type="submit" className="btn-login" disabled={cargando}>
            {cargando ? "Procesando..." : recuperando ? "Enviar enlace" : "Ingresar"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "-10px" }}>
          <button
            type="button"
            onClick={() => {
              setRecuperando((actual) => !actual);
              setError("");
              setMensajeRecuperacion("");
            }}
            style={{ background: "none", border: "none", color: "#c8a951", cursor: "pointer", textDecoration: "underline" }}
          >
            {recuperando ? "Volver al inicio de sesión" : "¿Olvidaste tu contraseña?"}
          </button>
        </div>

        {!recuperando && <div style={{ marginTop: "20px", textAlign: "center" }}>
          <p style={{ color: "#aaa", fontSize: "14px" }}>
            ¿No tienes cuenta?{" "}
            <button
              onClick={() => navigate("/registro")}
              style={{
                background: "none",
                border: "none",
                color: "#c8a951",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "14px",
              }}
            >
              Regístrate aquí
            </button>
          </p>
        </div>}
      </div>
    </div>
  );
}

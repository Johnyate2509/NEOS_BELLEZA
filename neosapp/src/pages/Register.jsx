import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./login.css";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");
    setCargando(true);

    // Validar campos
    if (!email.trim() || !password || !nombre.trim()) {
      setError("Nombre, correo y contraseña son requeridos");
      setCargando(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setCargando(false);
      return;
    }

    try {
      // Auth de Supabase recibe la contraseña y se encarga de protegerla.
      // Los datos de cliente se solicitan al completar el primer pedido.
      const resultado = await register(email.trim().toLowerCase(), password, "cliente", { nombre: nombre.trim() });

      if (!resultado.success) {
        setError(resultado.error || "No se pudo crear la cuenta.");
        setCargando(false);
        return;
      }

      if (resultado.confirmationRequired) {
        setExito("Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión.");
      } else {
        setExito("¡Cuenta creada exitosamente! Ya puedes completar tus datos cuando realices tu primer pedido.");
      }
      
      setTimeout(() => {
        navigate("/login");
      }, resultado.confirmationRequired ? 3000 : 2200);

    } catch (err) {
      setError("Error al procesar el registro: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container register-container">
      <div className="login-box register-box">
        <div className="login-header">
          <h1>NEOSAPP</h1>
          <p>Crear Nueva Cuenta</p>
        </div>

        <form onSubmit={handleRegister} className="login-form register-form">
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={cargando}
              required
            />
          </div>

          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="Ej: usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={cargando}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={cargando}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {exito && <div className="success-message">{exito}</div>}

          <button type="submit" className="btn-login" disabled={cargando}>
            {cargando ? "Registrando..." : "Registrarse"}
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <p style={{ color: "#aaa", fontSize: "14px" }}>
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "none",
                border: "none",
                color: "#c8a951",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "14px",
              }}
            >
              Inicia sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

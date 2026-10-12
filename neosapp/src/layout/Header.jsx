import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import ProfileModal from "../components/ProfileModal";
import NotificationBell from "../components/NotificationBell";
import "../styles/layout.css";

export default function Header({ onToggleSidebar, sidebarAbierto }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuarioAutenticado, obtenerDatosUsuario, obtenerAvatarUsuario, esAdmin, esVendedor, esRepartidor, logout, user } = useAuth();
  const { obtenerClienteActual } = useStore();
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarModalPerfil, setMostrarModalPerfil] = useState(false);

  const datosUsuario = obtenerDatosUsuario();
  const usuario = datosUsuario?.nombre || datosUsuario?.usuario;
  const avatarUrl = obtenerAvatarUsuario();
  const esAdministrador = esAdmin();
  const esVend = esVendedor();
  const esRepar = esRepartidor();

  // Obtener email del usuario para fallback en búsqueda de cliente
  const emailUsuario = user?.email || datosUsuario?.email;
  const clienteActual = user ? obtenerClienteActual(user.id, emailUsuario) : null;

  let tipoUsuario = "Invitado";
  if (esAdministrador) tipoUsuario = "Administrador";
  else if (esVend) tipoUsuario = "Vendedor";
  else if (esRepar) tipoUsuario = "Repartidor";
  else if (usuarioAutenticado) tipoUsuario = "Cliente";

  const iniciales = usuario?.substring(0, 2).toUpperCase() || "?";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleLogin = () => {
    navigate("/login");
  };

  const handleRegister = () => {
    navigate("/registro");
  };

  const handleHomeClick = () => {
    if (usuarioAutenticado) {
      navigate("/");
    } else {
      navigate("/");
    }
  };

  const tipoClase = esAdministrador ? "admin" : esVend ? "vendedor" : esRepar ? "repartidor" : usuarioAutenticado ? "cliente" : "invitado";
  const mostrarTituloHeader = location.pathname === "/login" || location.pathname === "/registro" || !usuarioAutenticado;

  return (
    <header className={`header header-dark ${mostrarTituloHeader ? "" : "header-no-logo"}`}>
      {onToggleSidebar && (
        <button
          type="button"
          className="header-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarAbierto ? "Cerrar menú" : "Abrir menú"}
        >
          {sidebarAbierto ? "✕" : "☰"}
        </button>
      )}

      {mostrarTituloHeader && (
        <div className="header-logo-container">
          <button 
            className="header-logo-main"
            onClick={handleHomeClick}
            title="Ir al inicio"
          >
            NEOS BELLEZA
          </button>
          <div className="header-logo-subtitle">
            Distribución de Belleza
          </div>
        </div>
      )}

      <div className="header-right">
        <NotificationBell user={user} />
        <div className="usuario-info">
          <span className={`badge-tipo ${tipoClase}`}>
            {tipoUsuario}
          </span>
          <span className="usuario-nombre">{usuario || (usuarioAutenticado ? "Usuario" : "Usuario Invitado")}</span>
        </div>

        <div className="avatar-menu">
          <button
            className="avatar"
            onClick={() => setMostrarMenu(!mostrarMenu)}
            title={usuario || (usuarioAutenticado ? "Usuario" : "Usuario Invitado")}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={`Avatar de ${usuario || "Usuario"}`} />
            ) : (
              iniciales
            )}
          </button>

          {mostrarMenu && (
            <div className="menu-desplegable">
              {usuarioAutenticado ? (
                <>
                  <div className="menu-item disabled">
                    <span className="menu-label">Usuario:</span>
                    <strong>{usuario}</strong>
                  </div>
                  <div className="menu-item disabled">
                    <span className="menu-label">Tipo:</span>
                    <strong>{tipoUsuario}</strong>
                  </div>
                  <hr className="menu-divider" />
                  {clienteActual && (
                    <>
                      <button
                        className="menu-item profile"
                        onClick={() => {
                          setMostrarModalPerfil(true);
                          setMostrarMenu(false);
                        }}
                      >
                         Mi Perfil
                      </button>
                      <hr className="menu-divider" />
                    </>
                  )}
                  <button
                    className="menu-item logout"
                    onClick={handleLogout}
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <div className="menu-item disabled">
                    <span className="menu-label">No tienes sesión iniciada</span>
                  </div>
                  <hr className="menu-divider" />
                  <button
                    className="menu-item login"
                    onClick={handleLogin}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    className="menu-item register"
                    onClick={handleRegister}
                  >
                    Registrarse
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {mostrarModalPerfil && clienteActual && (
        <ProfileModal
          clienteId={clienteActual.id}
          onClose={() => setMostrarModalPerfil(false)}
        />
      )}
    </header>
  );
}

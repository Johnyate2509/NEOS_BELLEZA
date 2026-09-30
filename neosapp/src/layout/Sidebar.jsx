import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";

export default function Sidebar() {
  const { esAdmin, esVendedor, esRepartidor } = useAuth();
  const { pedidos } = useStore();
  const esAdministrador = esAdmin();
  const esVend = esVendedor();
  const esRepar = esRepartidor();
  const esCliente = !esAdministrador && !esVend && !esRepar;

  return (
    <aside className="sidebar">
      <h2 className="logo">NEOS BELLEZA</h2>

      <nav>
        {/* Dashboard según tipo de usuario */}
        <NavLink to="/" end>
          {esAdministrador ? " Dashboard" : esVend ? " Mi Cartera" : esRepar ? " Entregas" : " Productos"}
        </NavLink>

        {/* Clientes - solo para admin */}
        {esAdministrador && (
          <NavLink to="/clientes">
             Clientes
          </NavLink>
        )}

        {/* Pedidos - para cliente */}
        {esCliente && (
          <NavLink to="/mis-pedidos">
              Mis Pedidos
          </NavLink>
        )}

        {/* Pedidos - para vendedor */}
        {esVend && (
          <>
            <NavLink to="/vendedor-pedidos">
               Tienda de Productos
            </NavLink>
            <NavLink to="/vendedor-reportes">
               📊 Reportes
            </NavLink>
          </>
        )}

        {/* Menú administrativo - solo para admin */}
        {esAdministrador && (
          <>
            <hr className="nav-divider" />
            <div className="nav-section-title">Administración</div>

            <NavLink to="/productos">
               Productos
            </NavLink>

            <NavLink to="/admin-productos">
              Administrar productos
            </NavLink>

            <NavLink to="/pedidos" className="sidebar-link-with-badge">
              <span>Pedidos</span>
              <span className="sidebar-count-badge" aria-label={`${pedidos.length} pedidos actuales`} title={`${pedidos.length} pedidos actuales`}>
                {pedidos.length}
              </span>
            </NavLink>

            <NavLink to="/repartidores">
               Repartidores
            </NavLink>

            <NavLink to="/vendedores">
               Vendedores
            </NavLink>

            <NavLink to="/admin-clientes">
              Administrar clientes
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

import { useState } from "react";
import Header from "./layout/Header";
import Sidebar from "./layout/Sidebar";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Pedidos from "./pages/Pedidos";
import Repartidores from "./pages/Repartidores";
import RepartidorPerfil from "./pages/RepartidorPerfil";
import Vendedores from "./pages/Vendedores";
import VendedorDashboard from "./pages/VendedorDashboard";
import ReportesVendedor from "./pages/ReportesVendedor";
import Mapa from "./pages/Mapa";
import Clientes from "./pages/Clientes";
import AdminClientes from "./pages/AdminClientes";
import AdminProductos from "./pages/AdminProductos";
import MisPedidos from "./pages/MisPedidos";
import "./styles/global.css";
import "./styles/variables.css";
import Productos from "./pages/Producto";


export default function App() {
  const { usuarioAutenticado, esRepartidor, esVendedor, loading } = useAuth();
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const toggleSidebar = () => setSidebarAbierto((prev) => !prev);

  // Esperar a que el estado de autenticación esté listo
  if (loading) {
    return <div className="app">Cargando...</div>;
  }

  // Si no está autenticado, mostrar tienda de productos sin sidebar
  if (!usuarioAutenticado) {
    return (
      <div className="app">
        <div className="main">
          <Header />

          <div className="content">
            <Routes>
              <Route path="/" element={<Productos />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    );
  }

  // Vista especial para repartidores (sin sidebar de admin)
  if (esRepartidor()) {
    return (
      <div className="app">
        <div className="main">
          <Header />

          <div className="content">
            <Routes>
              <Route path="/" element={<RepartidorPerfil />} />
              <Route path="/perfil" element={<RepartidorPerfil />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    );
  }

  // Vista especial para vendedores
  if (esVendedor()) {
    return (
      <div className={sidebarAbierto ? "app sidebar-open" : "app sidebar-closed"}>
        <Sidebar />
        <div className="sidebar-backdrop" onClick={toggleSidebar} />

        <div className="main">
          <Header onToggleSidebar={toggleSidebar} sidebarAbierto={sidebarAbierto} />

          <div className="content">
            <Routes>
              <Route path="/" element={<VendedorDashboard />} />
              <Route path="/vendedor-pedidos" element={<Productos />} />
              <Route path="/vendedor-reportes" element={<ReportesVendedor />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    );
  }

  // Vista normal para admin y clientes
  return (
    <div className={sidebarAbierto ? "app sidebar-open" : "app sidebar-closed"}>
      <Sidebar />
      <div className="sidebar-backdrop" onClick={toggleSidebar} />

      <div className="main">
        <Header onToggleSidebar={toggleSidebar} sidebarAbierto={sidebarAbierto} />

        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard/>} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/mis-pedidos" element={<MisPedidos />} />
            <Route path="/repartidores" element={<Repartidores />} />
            <Route path="/vendedores" element={<Vendedores />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/admin-productos" element={<AdminProductos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/admin-clientes" element={<AdminClientes />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

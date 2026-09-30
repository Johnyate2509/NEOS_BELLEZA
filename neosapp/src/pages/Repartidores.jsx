import { useState } from "react";
import { useStore } from "../context/StoreContext";
import "../styles/repartidores.css";



export default function Repartidores() {
  const { repartidores, crearRepartidor, eliminarRepartidor } = useStore();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [zona, setZona] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const agregarRepartidor = async () => {
    if (!nombre.trim() || !email.trim() || !zona.trim() || !password) {
      setMensaje("Todos los campos son requeridos");
      return;
    }

    try {
      console.log("Intentando crear repartidor:", { nombre, email, zona });
      const resultado = await crearRepartidor(nombre.trim(), email.trim(), zona.trim(), password);
      console.log("crearRepartidor resultado:", resultado);

      if (!resultado || resultado.error) {
        const msg = (resultado && resultado.error) || "Error al crear repartidor";
        setMensaje(msg);
        return;
      }

      setMensaje("Repartidor agregado exitosamente");
      setNombre("");
      setEmail("");
      setZona("");
      setPassword("");
      setTimeout(() => setMensaje(""), 3000);
    } catch (err) {
      console.error("Excepción en agregarRepartidor:", err);
      setMensaje("Error creando repartidor (ver consola)");
    }
  };

  const handleEliminarRepartidor = async (id) => {
    if (!id) return;
    const confirmar = window.confirm("¿Eliminar este repartidor? Esta acción es irreversible.");
    if (!confirmar) return;

    try {
      const resultado = await eliminarRepartidor(id);
      if (!resultado || resultado.error) {
        const msg = (resultado && resultado.error) || "Error al eliminar repartidor (revisar consola)";
        setMensaje(msg);
        console.error("eliminarRepartidor error for id:", id, resultado);
        return;
      }
      setMensaje("Repartidor eliminado correctamente");
      setTimeout(() => setMensaje(""), 3000);
    } catch (err) {
      console.error("Excepción al eliminar repartidor:", err);
      setMensaje("Error eliminando repartidor (excepción)");
    }
  };

  return (
    <>
      <div className="repartidores-header">
        <h2>Repartidores</h2>
        <p>Panel de repartidores.</p>
      </div>

      {/* Formulario */}
      <div className="repartidores-form">
        <input
          type="text"
          className="repartidores-input"
          placeholder="Nombre del repartidor"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <input
          type="email"
          className="repartidores-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="text"
          className="repartidores-input"
          placeholder="Zona"
          value={zona}
          onChange={(e) => setZona(e.target.value)}
        />

        <input
          type="password"
          className="repartidores-input"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn-agregar" onClick={agregarRepartidor}>
          Agregar Repartidor
        </button>

        {mensaje && (
          <p className={`mensaje ${mensaje.toLowerCase().includes("error") ? "error" : "exito"}`}>
            {mensaje}
          </p>
        )}
      </div>

      {/* Tarjetas */}
      <div className="repartidores-container">
        {repartidores.map((repartidor) => (
          <div key={repartidor.id} className="tarjeta-repartidor">
            <h4>{repartidor.nombre}</h4>
            <p>Email: {repartidor.email}</p>
            <p>Zona: {repartidor.zona}</p>

            <button
              className="btn-eliminar admin-action-control admin-action-control--danger"
              onClick={() => handleEliminarRepartidor(repartidor.id)}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

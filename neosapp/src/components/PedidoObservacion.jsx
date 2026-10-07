import { useEffect, useState } from "react";
import "../styles/pedido-observacion.css";

export default function PedidoObservacion({ pedido, editable = false, onGuardar }) {
  const [observacion, setObservacion] = useState(pedido.observacion || "");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setObservacion(pedido.observacion || "");
    setMensaje("");
    setError("");
  }, [pedido.id, pedido.observacion]);

  const guardarObservacion = async () => {
    if (!onGuardar || guardando) return;
    setGuardando(true);
    setMensaje("");
    setError("");
    try {
      const correcto = await onGuardar(pedido.id, observacion.trim());
      if (correcto) {
        setObservacion(observacion.trim());
        setMensaje("Observación guardada.");
      } else {
        setError("No se pudo guardar la observación. Inténtalo de nuevo.");
      }
    } catch {
      setError("No se pudo guardar la observación. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="pedido-observacion">
      <div className="pedido-observacion-header">
        <h4>Observación</h4>
        {editable && <span>{observacion.length}/1000</span>}
      </div>
      {editable ? (
        <>
          <textarea
            value={observacion}
            onChange={(event) => {
              setObservacion(event.target.value);
              setMensaje("");
              setError("");
            }}
            maxLength={1000}
            rows={3}
            placeholder="Escribe una observación para este pedido..."
            aria-label={`Observación del pedido ${pedido.id}`}
            disabled={guardando}
          />
          <div className="pedido-observacion-actions">
            <span className={error ? "pedido-observacion-error" : "pedido-observacion-feedback"} role={error ? "alert" : "status"}>
              {error || mensaje}
            </span>
            <button type="button" onClick={guardarObservacion} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar observación"}
            </button>
          </div>
        </>
      ) : (
        <p className="pedido-observacion-lectura">
          {pedido.observacion?.trim() || "Sin observación registrada."}
        </p>
      )}
    </section>
  );
}

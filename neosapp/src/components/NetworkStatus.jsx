import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const actualizarEstado = () => setOffline(!navigator.onLine);
    window.addEventListener("online", actualizarEstado);
    window.addEventListener("offline", actualizarEstado);
    return () => {
      window.removeEventListener("online", actualizarEstado);
      window.removeEventListener("offline", actualizarEstado);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" aria-live="polite" style={{ position: "fixed", zIndex: 10000, inset: "0 0 auto", padding: "10px 16px", background: "#7c2d12", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, boxShadow: "0 2px 8px #0003" }}>
      Sin conexión. Puedes consultar el catálogo guardado y preparar tu carrito; los pedidos requieren internet para confirmarse.
    </div>
  );
}

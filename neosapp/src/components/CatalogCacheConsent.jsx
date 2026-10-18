import { useState } from "react";
import {
  CATALOG_CACHE_CONSENT_EVENT,
  CATALOG_CACHE_CONSENT_KEY,
  borrarCacheProductos,
} from "../utils/catalogCache";
import "../styles/catalog-cache-consent.css";

const CACHE_IMAGES_NAME = "neos-catalog-images-v1";

const leerDecision = () => {
  try {
    return window.localStorage.getItem(CATALOG_CACHE_CONSENT_KEY);
  } catch {
    return null;
  }
};

export default function CatalogCacheConsent() {
  const [decision, setDecision] = useState(leerDecision);
  const [mostrarOpciones, setMostrarOpciones] = useState(!decision);

  const guardarDecision = async (aceptada) => {
    const valor = aceptada ? "accepted" : "declined";
    try {
      window.localStorage.setItem(CATALOG_CACHE_CONSENT_KEY, valor);
    } catch {
      // La navegación y el catálogo siguen funcionando aunque el navegador bloquee el almacenamiento.
    }

    try {
      window.localStorage.removeItem("neosapp_productos_offline_v1");
    } catch {
      // Ignorar si el navegador bloquea el almacenamiento.
    }

    setDecision(valor);
    setMostrarOpciones(false);
    window.dispatchEvent(new CustomEvent(CATALOG_CACHE_CONSENT_EVENT, { detail: { aceptada } }));

    try {
      if (!aceptada) {
        borrarCacheProductos();
        await window.caches?.delete(CACHE_IMAGES_NAME);
      } else {
        await window.caches?.open(CACHE_IMAGES_NAME);
      }
    } catch {
      // La caché del navegador puede no estar disponible; el sitio continúa en línea.
    }

    navigator.serviceWorker?.controller?.postMessage({
      type: "NEOS_CATALOG_CACHE_CONSENT",
      enabled: aceptada,
    });
  };

  return (
    <>
      {decision && !mostrarOpciones && (
        <button
          type="button"
          className="catalog-cache-preferences"
          onClick={() => setMostrarOpciones(true)}
          aria-label="Cambiar preferencias de caché del catálogo"
        >
          Caché del catálogo: {decision === "accepted" ? "activada" : "desactivada"}
        </button>
      )}

      {mostrarOpciones && (
        <aside className="catalog-cache-consent" aria-label="Preferencias de caché del catálogo">
          <div className="catalog-cache-copy">
            <strong>¿Guardar el catálogo en este dispositivo?</strong>
            <p>
              Podemos guardar los datos de productos y las imágenes que consultes para cargar el catálogo más rápido y tenerlo disponible sin conexión. No guardamos pedidos ni datos de clientes.
            </p>
          </div>
          <div className="catalog-cache-actions">
            <button type="button" className="catalog-cache-accept" onClick={() => guardarDecision(true)}>
              Aceptar
            </button>
            <button type="button" className="catalog-cache-decline" onClick={() => guardarDecision(false)}>
              Ahora no
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

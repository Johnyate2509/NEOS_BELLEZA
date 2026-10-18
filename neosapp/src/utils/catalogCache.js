export const CATALOG_CACHE_CONSENT_KEY = "neosapp_catalog_cache_consent_v1";
export const CATALOG_CACHE_CONSENT_EVENT = "neosapp:catalog-cache-consent-changed";
export const PRODUCT_CATALOG_CACHE_KEY = "neosapp_productos_cache_v2";
export const PRODUCT_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

export const tieneConsentimientoCacheCatalogo = () => {
  try {
    return window.localStorage.getItem(CATALOG_CACHE_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
};

export const leerCacheProductos = () => {
  if (!tieneConsentimientoCacheCatalogo()) return null;
  try {
    const cache = JSON.parse(window.localStorage.getItem(PRODUCT_CATALOG_CACHE_KEY) || "null");
    if (!Array.isArray(cache?.productos) || !Number.isFinite(Number(cache?.actualizadoEn))) return null;
    return { productos: cache.productos, actualizadoEn: Number(cache.actualizadoEn) };
  } catch {
    return null;
  }
};

export const guardarCacheProductos = (productos, actualizadoEn = null) => {
  if (!tieneConsentimientoCacheCatalogo() || !Array.isArray(productos)) return;
  try {
    const cacheAnterior = leerCacheProductos();
    const productosGuardables = productos.map((producto) => ({
      ...producto,
      imagenes: (producto.imagenes || []).filter((imagen) => typeof imagen === "string" && !imagen.startsWith("data:")),
    }));
    window.localStorage.setItem(PRODUCT_CATALOG_CACHE_KEY, JSON.stringify({
      actualizadoEn: actualizadoEn ?? cacheAnterior?.actualizadoEn ?? Date.now(),
      productos: productosGuardables,
    }));
  } catch (error) {
    console.warn("No se pudo guardar el catálogo en este dispositivo:", error);
  }
};

export const borrarCacheProductos = () => {
  try {
    window.localStorage.removeItem(PRODUCT_CATALOG_CACHE_KEY);
    // Retira la caché anterior, que se guardaba antes de pedir consentimiento.
    window.localStorage.removeItem("neosapp_productos_offline_v1");
  } catch {
    // El catálogo sigue funcionando en línea aunque el almacenamiento esté bloqueado.
  }
};

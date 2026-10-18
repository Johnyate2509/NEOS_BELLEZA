export const PRODUCT_IMAGES_BUCKET = "productos";

const crearIdArchivo = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const extensionPorMime = (mime) => ({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
})[mime] || "img";

/** Sube las imágenes nuevas y devuelve URLs públicas; conserva las URLs existentes. */
export const subirImagenesProducto = async (supabase, imagenes, carpeta) => {
  const rutasSubidas = [];
  try {
    const imagenesEnStorage = [];
    for (const imagen of imagenes || []) {
      if (typeof imagen !== "string" || (!imagen.startsWith("data:image/") && !imagen.startsWith("blob:"))) {
        imagenesEnStorage.push(imagen);
        continue;
      }

      const blob = await fetch(imagen).then((respuesta) => respuesta.blob());
      if (!blob.type.startsWith("image/")) throw new Error("El archivo seleccionado no es una imagen válida.");
      const ruta = `${carpeta}/${crearIdArchivo()}.${extensionPorMime(blob.type)}`;
      const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(ruta, blob, {
        cacheControl: "31536000",
        contentType: blob.type,
        upsert: false,
      });
      if (error) throw new Error(`No se pudo subir una imagen del producto: ${error.message}`);
      rutasSubidas.push(ruta);
      const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(ruta);
      imagenesEnStorage.push(data.publicUrl);
    }
    return imagenesEnStorage;
  } catch (error) {
    if (rutasSubidas.length) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(rutasSubidas).catch(() => undefined);
    }
    throw error;
  }
};

export const eliminarImagenesProductoSubidas = async (supabase, urls, carpetaPermitida = "") => {
  const prefijoPublico = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const prefijoPermitido = carpetaPermitida ? `${carpetaPermitida.replace(/^\/+|\/+$/g, "")}/` : "";
  const rutas = (urls || []).flatMap((url) => {
    if (typeof url !== "string") return [];
    try {
      const ruta = new URL(url).pathname.split(prefijoPublico)[1];
      const rutaDecodificada = ruta ? decodeURIComponent(ruta) : "";
      return rutaDecodificada && (!prefijoPermitido || rutaDecodificada.startsWith(prefijoPermitido))
        ? [rutaDecodificada]
        : [];
    } catch {
      return [];
    }
  });
  if (rutas.length) {
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(rutas);
    if (error) throw error;
  }
};

export const eliminarImagenesProductoRetiradas = async (supabase, anteriores, actuales, carpetaPermitida) => {
  const imagenesActuales = new Set((actuales || []).filter(Boolean));
  const retiradas = [...new Set((anteriores || []).filter((url) => url && !imagenesActuales.has(url)))];
  await eliminarImagenesProductoSubidas(supabase, retiradas, carpetaPermitida);
};

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

/** Reemplaza data URLs por URLs públicas de Supabase Storage antes de persistir filas. */
export const subirImagenesProducto = async (supabase, imagenes, carpeta) => {
  const rutasSubidas = [];
  try {
    const imagenesEnStorage = [];
    for (const imagen of imagenes || []) {
      if (typeof imagen !== "string" || !imagen.startsWith("data:image/")) {
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

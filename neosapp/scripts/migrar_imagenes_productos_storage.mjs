import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR_CAMBIOS = process.argv.includes("--apply");
const NOMBRE_BUCKET = "productos";
const TAMANO_LOTE = 5;
const COLUMNAS_IMAGEN_PRODUCTO = ["imagen_url", "imagen_url2", "imagen_url3", "imagen_url4", "imagen_url5"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno antes de ejecutar la migración.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const esDataUrlImagen = (valor) => typeof valor === "string" && /^data:image\//i.test(valor);

const extraerArchivo = (dataUrl) => {
  const coincidencia = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!coincidencia) throw new Error("Se encontró una imagen Base64 con formato no válido.");
  const mime = coincidencia[1].toLowerCase();
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" })[mime] || "img";
  return { mime, extension, contenido: Buffer.from(coincidencia[2], "base64") };
};

const subirDataUrl = async (dataUrl, rutaBase) => {
  const { mime, extension, contenido } = extraerArchivo(dataUrl);
  const ruta = `${rutaBase}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(NOMBRE_BUCKET).upload(ruta, contenido, {
    cacheControl: "31536000",
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Falló la carga de ${ruta}: ${error.message}`);
  const { data } = supabase.storage.from(NOMBRE_BUCKET).getPublicUrl(ruta);
  return { ruta, url: data.publicUrl };
};

const borrarSubidas = async (rutas) => {
  if (!rutas.length) return;
  const { error } = await supabase.storage.from(NOMBRE_BUCKET).remove(rutas);
  if (error) console.error("No se pudieron limpiar archivos subidos durante un fallo:", error.message);
};

let productosRevisados = 0;
let variantesRevisadas = 0;
let imagenesEncontradas = 0;
let imagenesMigradas = 0;

for (let inicio = 0; ; inicio += TAMANO_LOTE) {
  const { data: productos, error } = await supabase
    .from("productos")
    .select(`id,${COLUMNAS_IMAGEN_PRODUCTO.join(",")}`)
    .order("id")
    .range(inicio, inicio + TAMANO_LOTE - 1);
  if (error) throw new Error(`No se pudieron leer productos: ${error.message}`);
  if (!productos?.length) break;

  for (const producto of productos) {
    productosRevisados += 1;
    const camposConBase64 = COLUMNAS_IMAGEN_PRODUCTO.filter((campo) => esDataUrlImagen(producto[campo]));
    imagenesEncontradas += camposConBase64.length;
    if (!APLICAR_CAMBIOS || !camposConBase64.length) continue;

    const cambios = {};
    const rutasSubidas = [];
    try {
      for (const campo of camposConBase64) {
        const subida = await subirDataUrl(producto[campo], `productos/${producto.id}/migradas`);
        rutasSubidas.push(subida.ruta);
        cambios[campo] = subida.url;
      }
      const { error: errorActualizacion } = await supabase.from("productos").update(cambios).eq("id", producto.id);
      if (errorActualizacion) throw errorActualizacion;
      imagenesMigradas += camposConBase64.length;
    } catch (errorMigracion) {
      await borrarSubidas(rutasSubidas);
      throw new Error(`Error migrando imágenes del producto ${producto.id}: ${errorMigracion.message}`);
    }
  }
  console.log(`Productos revisados: ${productosRevisados}`);
}

for (let inicio = 0; ; inicio += TAMANO_LOTE) {
  const { data: variantes, error } = await supabase
    .from("producto_variantes")
    .select("id,producto_id,imagenes")
    .order("id")
    .range(inicio, inicio + TAMANO_LOTE - 1);
  if (error) throw new Error(`No se pudieron leer variantes: ${error.message}`);
  if (!variantes?.length) break;

  for (const variante of variantes) {
    variantesRevisadas += 1;
    const imagenes = Array.isArray(variante.imagenes)
      ? variante.imagenes
      : variante.imagenes
        ? [variante.imagenes]
        : [];
    const indicesConBase64 = imagenes.map((imagen, indice) => esDataUrlImagen(imagen) ? indice : -1).filter((indice) => indice >= 0);
    imagenesEncontradas += indicesConBase64.length;
    if (!APLICAR_CAMBIOS || !indicesConBase64.length) continue;

    const nuevasImagenes = [...imagenes];
    const rutasSubidas = [];
    try {
      for (const indice of indicesConBase64) {
        const subida = await subirDataUrl(imagenes[indice], `productos/${variante.producto_id}/variantes/migradas`);
        rutasSubidas.push(subida.ruta);
        nuevasImagenes[indice] = subida.url;
      }
      const { error: errorActualizacion } = await supabase
        .from("producto_variantes")
        .update({ imagenes: nuevasImagenes })
        .eq("id", variante.id);
      if (errorActualizacion) throw errorActualizacion;
      imagenesMigradas += indicesConBase64.length;
    } catch (errorMigracion) {
      await borrarSubidas(rutasSubidas);
      throw new Error(`Error migrando imágenes de la variante ${variante.id}: ${errorMigracion.message}`);
    }
  }
  console.log(`Variantes revisadas: ${variantesRevisadas}`);
}

console.log(JSON.stringify({
  modo: APLICAR_CAMBIOS ? "aplicado" : "solo lectura",
  productosRevisados,
  variantesRevisadas,
  imagenesEncontradas,
  imagenesMigradas,
}, null, 2));

if (!APLICAR_CAMBIOS) {
  console.log("Vista previa únicamente. Agrega --apply para subir los archivos y reemplazar las imágenes Base64 por URLs públicas.");
}

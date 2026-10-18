# Migrar imágenes de productos a Supabase Storage

Las imágenes nuevas se suben al bucket público `productos`; las tablas guardan las URLs. Para migrar las imágenes Base64 que ya existen:

1. Ejecuta `crear_bucket_productos.sql` en el SQL Editor del proyecto Supabase.
2. En una terminal local, define `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` con los valores del proyecto. La clave de servicio es secreta y solo se usa desde este script local.
3. Ejecuta primero `node scripts/migrar_imagenes_productos_storage.mjs` para contar las imágenes sin modificar datos.
4. Revisa el conteo y luego ejecuta `node scripts/migrar_imagenes_productos_storage.mjs --apply` para subirlas y reemplazar las cadenas Base64 por URLs.

El script procesa `productos.imagen_url` hasta `imagen_url5` y las imágenes JSON de `producto_variantes.imagenes`. Se puede volver a ejecutar: omite las URLs ya migradas. Si una fila falla después de subir archivos, intenta borrar esos archivos antes de detenerse.

No pongas la clave de servicio en archivos `VITE_*`, en el navegador ni en el repositorio. El bucket admite lectura pública, pero solo administradores autenticados pueden subir, actualizar o borrar archivos desde la aplicación.

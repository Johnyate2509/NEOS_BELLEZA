-- Ejecutar primero en Supabase SQL Editor.
-- Los archivos son públicos para que la tienda pueda mostrar sus imágenes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'productos',
  'productos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Lectura pública de imágenes de productos" ON storage.objects;
CREATE POLICY "Lectura pública de imágenes de productos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'productos');

DROP POLICY IF EXISTS "Administradores suben imágenes de productos" ON storage.objects;
CREATE POLICY "Administradores suben imágenes de productos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'productos'
  AND EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'
  )
);

DROP POLICY IF EXISTS "Administradores actualizan imágenes de productos" ON storage.objects;
CREATE POLICY "Administradores actualizan imágenes de productos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'productos'
  AND EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'productos'
  AND EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'
  )
);

DROP POLICY IF EXISTS "Administradores eliminan imágenes de productos" ON storage.objects;
CREATE POLICY "Administradores eliminan imágenes de productos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'productos'
  AND EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'
  )
);

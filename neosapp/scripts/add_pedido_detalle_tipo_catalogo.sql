-- Ejecutar en el SQL Editor de Supabase para guardar el catálogo elegido por línea de pedido.
ALTER TABLE pedido_detalle
  ADD COLUMN IF NOT EXISTS tipo_catalogo text;

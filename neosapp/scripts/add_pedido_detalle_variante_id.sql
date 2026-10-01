-- Ejecutar en el SQL Editor de Supabase para guardar la variante seleccionada en cada detalle.
ALTER TABLE pedido_detalle
  ADD COLUMN IF NOT EXISTS variante_id text;
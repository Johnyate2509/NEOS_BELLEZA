-- Ejecutar en el SQL Editor de Supabase para guardar observaciones en los pedidos.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS observacion text;

-- Ejecutar en el SQL Editor de Supabase para guardar el avance de pre-alistamiento por pedido.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS pre_alistamiento jsonb NOT NULL
  DEFAULT '{"cantidades":{},"confirmado":false}'::jsonb;

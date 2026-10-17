-- Permite retirar variantes del catálogo sin borrar la información usada por pedidos anteriores.
ALTER TABLE public.producto_variantes
  ADD COLUMN IF NOT EXISTS archivada boolean NOT NULL DEFAULT false;

-- Ejecutar en el SQL editor de Supabase para habilitar costo y visibilidad de catálogo.
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS precio_costo numeric,
  ADD COLUMN IF NOT EXISTS oculto_catalogo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS catalogos_ocultos text[] NOT NULL DEFAULT '{}';

UPDATE productos
SET catalogos_ocultos = ARRAY['General', 'Emprendedor', 'Mayorista']
WHERE oculto_catalogo = true
  AND cardinality(catalogos_ocultos) = 0;
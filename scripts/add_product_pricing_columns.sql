-- Agrega columnas para precio emprendedor y precio mayorista en la tabla productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS p numeric,
  ADD COLUMN IF NOT EXISTS precio_mayorista numeric;

-- Opcional: define un valor por defecto si lo deseas
-- ALTER TABLE productos
--   ALTER COLUMN precio_emprendedor SET DEFAULT 0,
--   ALTER COLUMN precio_mayorista SET DEFAULT 0;
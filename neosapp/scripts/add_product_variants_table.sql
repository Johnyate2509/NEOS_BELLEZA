-- Script: Crear tabla de variantes de producto
-- Ejecutar en el SQL editor de Supabase

-- Habilitar extensión para generar UUID (pgcrypto)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de variantes (colores, tallas, SKUs, stock y precios específicos)
CREATE TABLE IF NOT EXISTS producto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id integer NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sku text,
  nombre text, -- por ejemplo: "Rojo", "Azul - Talla M"
  atributos jsonb, -- ej: {"color":"rojo","talla":"M"}
  precio numeric, -- precio específico para esta variante (opcional)
  precio_emprendedor numeric,
  precio_mayorista numeric,
  stock integer DEFAULT 0,
  imagenes text[], -- array de URLs/base64 si se utiliza
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_producto_variantes_producto_id ON producto_variantes(producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_variantes_atributos_gin ON producto_variantes USING GIN (atributos);

-- Trigger para actualizar updated_at (opcional)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_producto_variantes ON producto_variantes;
CREATE TRIGGER set_timestamp_producto_variantes
BEFORE UPDATE ON producto_variantes
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Ejemplo de insert de variante:
-- INSERT INTO producto_variantes(producto_id, sku, nombre, atributos, precio, precio_emprendedor, precio_mayorista, stock, imagenes)
-- VALUES('...producto-uuid...', 'SKU-001', 'Rojo - M', '{"color":"rojo","talla":"M"}'::jsonb, 12000, 10000, 9000, 10, ARRAY['https://...']);

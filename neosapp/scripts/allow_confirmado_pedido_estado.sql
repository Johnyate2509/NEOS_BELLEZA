-- Ejecutar en el SQL Editor de Supabase para permitir el nuevo estado Confirmado.
DO $$
DECLARE
  definicion_check text;
  expresion_check text;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO definicion_check
    FROM pg_constraint
   WHERE conrelid = 'public.pedidos'::regclass
     AND conname = 'pedidos_estado_check'
     AND contype = 'c';

  IF definicion_check IS NULL THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_estado_check
      CHECK (estado::text IN ('Pendiente', 'En camino', 'Entregado', 'Cancelado', 'Retraso', 'Confirmado'));
  ELSIF position('Confirmado' IN definicion_check) = 0 THEN
    expresion_check := substring(definicion_check FROM 8 FOR char_length(definicion_check) - 8);
    ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_estado_check;
    EXECUTE format(
      'ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check CHECK ((estado::text = %L) OR (%s))',
      'Confirmado',
      expresion_check
    );
  END IF;
END;
$$;

-- Repair the database permissions used by the customer order flow.
-- Run after add_pedido_pre_alistamiento.sql and security_scope_customer_order_data.sql.
-- This grants authenticated users access to the order RPC, while restricting
-- direct order confirmation edits to administrators through RLS.

DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'crear_pedido_seguro'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_function);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'crear_pedido_seguro'
  ) THEN
    RAISE EXCEPTION 'No existe public.crear_pedido_seguro(); revisar la función de creación de pedidos.';
  END IF;
END
$$;

-- Confirmation writes pre_alistamiento and changes estado to Confirmado.
-- Column grants alone are insufficient; PostgreSQL also requires an UPDATE
-- policy, and the restrictive policy prevents older broad policies bypassing
-- the administrator-only rule.
GRANT UPDATE (pre_alistamiento, estado) ON TABLE public.pedidos TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_app_role(text) TO authenticated;

DROP POLICY IF EXISTS "Administradores confirman pedidos" ON public.pedidos;
CREATE POLICY "Administradores confirman pedidos" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (private.has_app_role('admin'))
  WITH CHECK (private.has_app_role('admin'));

DROP POLICY IF EXISTS "Solo administradores actualizan confirmacion de pedidos" ON public.pedidos;
CREATE POLICY "Solo administradores actualizan confirmacion de pedidos" ON public.pedidos
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (private.has_app_role('admin'))
  WITH CHECK (private.has_app_role('admin'));

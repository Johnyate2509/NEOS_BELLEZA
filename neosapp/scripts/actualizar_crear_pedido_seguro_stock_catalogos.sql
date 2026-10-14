-- Tienda física (General) valida y descuenta stock.
-- Mayorista (Emprendedor) y Supermayorista (Mayorista) solo requieren precio.
CREATE OR REPLACE FUNCTION public.crear_pedido_seguro(
  p_cliente_id integer,
  p_forma_pago text,
  p_lineas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_cliente public.clientes%ROWTYPE;
  v_line jsonb;
  v_producto public.productos%ROWTYPE;
  v_variante public.producto_variantes%ROWTYPE;
  v_cantidad integer;
  v_precio numeric;
  v_total numeric := 0;
  v_pedido_id integer;
  v_tipo text;
  v_transacciones jsonb;
BEGIN
  SELECT u.rol INTO v_role
  FROM public.usuarios u
  WHERE u.id = v_user;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'vendedor', 'cliente') THEN
    RAISE EXCEPTION 'Acceso denegado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes c
  WHERE c.id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND
     OR (v_role = 'cliente' AND v_cliente.usuario_id <> v_user)
     OR (v_role = 'vendedor' AND v_cliente.vendedor_usuario_id <> v_user) THEN
    RAISE EXCEPTION 'Cliente no autorizado' USING errcode = '42501';
  END IF;

  IF p_forma_pago IS NULL
     OR p_forma_pago NOT IN ('Efectivo', 'Crédito', 'Abono')
     OR p_lineas IS NULL
     OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Datos del pedido inválidos' USING errcode = '22023';
  END IF;

  INSERT INTO public.pedidos (cliente_id, forma_pago, estado, total, fecha, pre_alistamiento, observacion)
  VALUES (p_cliente_id, p_forma_pago, 'Pendiente', 0, now(), '{}'::jsonb, NULL)
  RETURNING id INTO v_pedido_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    v_cantidad := (v_line ->> 'cantidad')::integer;
    v_tipo := coalesce(v_line ->> 'tipo_catalogo', 'General');

    IF v_cantidad IS NULL OR v_cantidad < 1 OR v_cantidad > 1000
       OR v_tipo NOT IN ('General', 'Emprendedor', 'Mayorista') THEN
      RAISE EXCEPTION 'Cantidad o catálogo inválido' USING errcode = '22023';
    END IF;

    SELECT * INTO v_producto
    FROM public.productos p
    WHERE p.id = (v_line ->> 'producto_id')::integer
    FOR UPDATE;

    IF NOT FOUND OR v_producto.oculto_catalogo
       OR v_tipo = ANY(coalesce(v_producto.catalogos_ocultos, ARRAY[]::text[])) THEN
      RAISE EXCEPTION 'Producto no disponible' USING errcode = '22023';
    END IF;

    IF nullif(v_line ->> 'variante_id', '') IS NOT NULL THEN
      SELECT * INTO v_variante
      FROM public.producto_variantes v
      WHERE v.id = (v_line ->> 'variante_id')::uuid
        AND v.producto_id = v_producto.id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante no disponible' USING errcode = '22023';
      END IF;

      v_precio := CASE v_tipo
        WHEN 'Mayorista' THEN v_variante.precio_mayorista
        WHEN 'Emprendedor' THEN v_variante.precio_emprendedor
        ELSE v_variante.precio
      END;

      IF v_precio IS NULL OR v_precio <= 0 THEN
        RAISE EXCEPTION 'La variante no tiene precio para el catálogo seleccionado' USING errcode = '22023';
      END IF;

      IF v_tipo = 'General' AND coalesce(v_variante.stock, 0) < v_cantidad THEN
        RAISE EXCEPTION 'Variante sin stock' USING errcode = '22023';
      END IF;

      IF v_tipo = 'General' THEN
        UPDATE public.producto_variantes
        SET stock = stock - v_cantidad
        WHERE id = v_variante.id;
      END IF;

      INSERT INTO public.pedido_detalle (pedido_id, producto_id, cantidad, precio, variante_id, tipo_catalogo)
      VALUES (v_pedido_id, v_producto.id, v_cantidad, v_precio, v_variante.id::text, v_tipo);
    ELSE
      v_precio := CASE v_tipo
        WHEN 'Mayorista' THEN v_producto.precio_mayorista
        WHEN 'Emprendedor' THEN v_producto.precio_emprendedor
        ELSE v_producto.precio
      END;

      IF v_precio IS NULL OR v_precio <= 0 THEN
        RAISE EXCEPTION 'El producto no tiene precio para el catálogo seleccionado' USING errcode = '22023';
      END IF;

      IF v_tipo = 'General' AND coalesce(v_producto.stock, 0) < v_cantidad THEN
        RAISE EXCEPTION 'Producto sin stock' USING errcode = '22023';
      END IF;

      IF v_tipo = 'General' THEN
        UPDATE public.productos
        SET stock = stock - v_cantidad
        WHERE id = v_producto.id;
      END IF;

      INSERT INTO public.pedido_detalle (pedido_id, producto_id, cantidad, precio, variante_id, tipo_catalogo)
      VALUES (v_pedido_id, v_producto.id, v_cantidad, v_precio, NULL, v_tipo);
    END IF;

    v_total := v_total + v_precio * v_cantidad;
  END LOOP;

  UPDATE public.pedidos SET total = v_total WHERE id = v_pedido_id;

  v_transacciones := coalesce(v_cliente.transacciones, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'id', v_pedido_id,
      'tipo', 'pedido',
      'monto', v_total,
      'descripcion', 'Pedido #' || v_pedido_id,
      'fecha', to_char(now(), 'DD/MM/YYYY')
    ));

  UPDATE public.clientes
  SET saldo = coalesce(saldo, 0) + v_total,
      transacciones = v_transacciones
  WHERE id = p_cliente_id;

  RETURN jsonb_build_object('id', v_pedido_id, 'cliente_id', p_cliente_id, 'total', v_total);
END;
$function$;

-- Tienda física (General) valida y descuenta stock.
-- Todos los catálogos aplican el mínimo configurado al producto o, si no existe,
-- el mínimo global. Supermayorista (Mayorista) también exige múltiplos del mínimo.
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
  v_minimos_catalogo jsonb := '{}'::jsonb;
  v_minimo integer;
  v_totales_catalogo jsonb := '{}'::jsonb;
  v_minimo_monto numeric;
  v_total_catalogo numeric;
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

  SELECT CASE jsonb_typeof(s.value::jsonb)
    WHEN 'object' THEN s.value::jsonb
    WHEN 'string' THEN (s.value::jsonb #>> '{}')::jsonb
    ELSE '{}'::jsonb
  END
  INTO v_minimos_catalogo
  FROM public.site_settings s
  WHERE s.key = 'minimos_compra_catalogo';
  v_minimos_catalogo := coalesce(v_minimos_catalogo, '{}'::jsonb);

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

    v_minimo := coalesce(
      nullif(v_producto.minimos_compra ->> v_tipo, '')::integer,
      nullif(v_minimos_catalogo ->> v_tipo, '')::integer,
      CASE v_tipo
        WHEN 'General' THEN 1
        WHEN 'Emprendedor' THEN 3
        ELSE 6
      END
    );
    IF v_minimo IS NULL OR v_minimo < 1 THEN
      v_minimo := CASE v_tipo
        WHEN 'General' THEN 1
        WHEN 'Emprendedor' THEN 3
        ELSE 6
      END;
    END IF;
    IF v_cantidad < v_minimo
       OR (v_tipo = 'Mayorista' AND mod(v_cantidad, v_minimo) <> 0) THEN
      RAISE EXCEPTION 'La cantidad debe ser al menos % unidades%',
        v_minimo,
        CASE WHEN v_tipo = 'Mayorista' THEN ' y un múltiplo de ese mínimo' ELSE '' END
        USING errcode = '22023';
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
    v_totales_catalogo := jsonb_set(
      v_totales_catalogo,
      ARRAY[v_tipo],
      to_jsonb(coalesce((v_totales_catalogo ->> v_tipo)::numeric, 0) + v_precio * v_cantidad),
      true
    );
  END LOOP;

  v_minimo_monto := coalesce(nullif(v_minimos_catalogo ->> 'monto_General', '')::numeric, 0);
  v_total_catalogo := coalesce((v_totales_catalogo ->> 'General')::numeric, 0);
  IF v_minimo_monto > 0 AND v_total_catalogo < v_minimo_monto THEN
    RAISE EXCEPTION 'El monto mínimo para Tienda física es $%; el total del catálogo es $%', v_minimo_monto, v_total_catalogo USING errcode = '22023';
  END IF;

  v_minimo_monto := coalesce(nullif(v_minimos_catalogo ->> 'monto_Emprendedor', '')::numeric, 0);
  v_total_catalogo := coalesce((v_totales_catalogo ->> 'Emprendedor')::numeric, 0);
  IF v_minimo_monto > 0 AND v_total_catalogo < v_minimo_monto THEN
    RAISE EXCEPTION 'El monto mínimo para Mayorista es $%; el total del catálogo es $%', v_minimo_monto, v_total_catalogo USING errcode = '22023';
  END IF;

  v_minimo_monto := coalesce(nullif(v_minimos_catalogo ->> 'monto_Mayorista', '')::numeric, 0);
  v_total_catalogo := coalesce((v_totales_catalogo ->> 'Mayorista')::numeric, 0);
  IF v_minimo_monto > 0 AND v_total_catalogo < v_minimo_monto THEN
    RAISE EXCEPTION 'El monto mínimo para Supermayorista es $%; el total del catálogo es $%', v_minimo_monto, v_total_catalogo USING errcode = '22023';
  END IF;

  UPDATE public.pedidos SET total = v_total WHERE id = v_pedido_id;

  -- El pedido es la fuente persistente del saldo. No actualizamos saldo ni
  -- transacciones en clientes, campos protegidos por las reglas de la app.
  RETURN jsonb_build_object('id', v_pedido_id, 'cliente_id', p_cliente_id, 'total', v_total);
END;
$function$;

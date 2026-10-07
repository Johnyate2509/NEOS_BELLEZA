-- Ejecutar DESPUÉS de la migración principal de RLS, que crea private.has_app_role.
-- Permite que cada cliente actualice únicamente su propio perfil.
CREATE OR REPLACE FUNCTION public.actualizar_perfil_cliente(p_cambios jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_nombre text;
  v_cedula text;
  v_telefono text;
  v_direccion text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_app_role('cliente') THEN
    RAISE EXCEPTION 'Acceso denegado' USING errcode = '42501';
  END IF;
  IF p_cambios IS NULL
     OR jsonb_typeof(p_cambios) <> 'object'
     OR p_cambios = '{}'::jsonb
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(p_cambios) AS keys(key)
       WHERE keys.key NOT IN ('nombre', 'cedula', 'telefono', 'direccion')
     ) THEN
    RAISE EXCEPTION 'Campos de perfil no válidos' USING errcode = '22023';
  END IF;

  SELECT c.* INTO v_cliente
  FROM public.clientes c
  WHERE c.usuario_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cliente no encontrado' USING errcode = 'P0002';
  END IF;

  v_nombre := CASE WHEN p_cambios ? 'nombre' THEN nullif(trim(p_cambios->>'nombre'), '') ELSE v_cliente.nombre END;
  v_cedula := CASE WHEN p_cambios ? 'cedula' THEN nullif(trim(p_cambios->>'cedula'), '') ELSE v_cliente.cedula END;
  v_telefono := CASE WHEN p_cambios ? 'telefono' THEN nullif(trim(p_cambios->>'telefono'), '') ELSE v_cliente.telefono END;
  v_direccion := CASE WHEN p_cambios ? 'direccion' THEN nullif(trim(p_cambios->>'direccion'), '') ELSE v_cliente.direccion END;

  IF v_nombre IS NULL OR v_cedula IS NULL OR v_telefono IS NULL OR v_direccion IS NULL THEN
    RAISE EXCEPTION 'Nombre, cédula, teléfono y dirección son obligatorios' USING errcode = '22023';
  END IF;

  UPDATE public.clientes
  SET nombre = v_nombre,
      cedula = v_cedula,
      telefono = v_telefono,
      direccion = v_direccion
  WHERE id = v_cliente.id;

  UPDATE public.usuarios
  SET nombre = v_nombre,
      cedula = v_cedula
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'usuario_id', auth.uid(),
      'nombre', v_nombre,
      'cedula', v_cedula,
      'telefono', v_telefono,
      'direccion', v_direccion
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_perfil_cliente(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_perfil_cliente(jsonb) TO authenticated;

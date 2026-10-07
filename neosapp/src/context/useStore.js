//Obtener productos
const obtenerProductos = async () => {
  const { data, error } = await supabase
    .from("productos")
    .select("id,nombre,precio,stock,descripcion,categoria_id,imagen_url,precio_mayorista,precio_emprendedor,imagen_url2,imagen_url3,oculto_catalogo,catalogos_ocultos");

  if (!error) setProductos(data);
};

// Actualizar stok
const actualizarStock = async (id, cantidad) => {
  const { data: producto } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", id)
    .single();

  const nuevoStock = producto.stock + cantidad;

  if (nuevoStock < 0) return false;

  const { error } = await supabase
    .from("productos")
    .update({ stock: nuevoStock })
    .eq("id", id);

  if (error) return false;

  // actualizar estado local
  setProductos((prev) =>
    prev.map((p) =>
      p.id === id ? { ...p, stock: nuevoStock } : p
    )
  );

  return true;
};

//Crear pedido
const crearPedido = async (clienteId, carrito, formaPago) => {
  const lineas = (carrito || []).map((item) => ({
    producto_id: item.producto_id ?? item.variante?.producto_id ?? item.id,
    variante_id: item.variante?.id ?? item.variante_id ?? null,
    cantidad: Number(item.cantidad || 1),
    tipo_catalogo: item.tipo_catalogo || "General",
  }));
  const { error } = await supabase.rpc("crear_pedido_seguro", {
    p_cliente_id: Number(clienteId),
    p_forma_pago: formaPago,
    p_lineas: lineas,
  });
  return !error;
};

// Clientes
const obtenerClientes = async () => {
  const { data, error } = await supabase
    .from("clientes")
    .select("*");

  if (!error) setClientes(data);
};
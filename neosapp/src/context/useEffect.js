const cargarProductos = async () => {
  const { data, error } = await supabase
    .from("productos")
    .select("id,nombre,precio,stock,descripcion,categoria_id,imagen_url,precio_mayorista,precio_emprendedor,imagen_url2,imagen_url3,oculto_catalogo,catalogos_ocultos");

  if (error) {
    console.error(error);
    return;
  }

  const formateados = data.map(p => ({
    id: p.id,
    nombre: p.nombre,
    precio: p.precio,
    stock: p.stock,
    categoria: p.categoria,
    descripcion: p.descripcion,
    imagenes: p.imagen_url ? [p.imagen_url] : [],
  }));

  setProductos(formateados);
};

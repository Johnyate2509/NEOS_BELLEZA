import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { validarDatosPedido, validarCarrito, calcularTotal } from "../utils/validaciones";
import { enviarConfirmacionPedido, enviarNotificacionVendedor } from "../services/emailService";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [tablaPedidosTieneColumnaRepartidor, setTablaPedidosTieneColumnaRepartidor] = useState(true);
  const [vendedores, setVendedores] = useState([]);
  const [usuariosVendedores, setUsuariosVendedores] = useState([]);
  const [tablaVendedoresExiste, setTablaVendedoresExiste] = useState(true);
  const [categorias, setCategorias] = useState([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);

  const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1522338242592-cb0acf6f85a2?w=500";

const adaptarProducto = (p) => ({
  id: p.id ?? p.identificacion,
  nombre: p.nombre,
  precio: p.precio,
  precio_emprendedor: p.precio_emprendedor ?? p.precioEmprendedor ?? null,
  precio_mayorista: p.precio_mayorista ?? p.precioMayorista ?? null,
  stock: p.stock ?? p.existencias ?? 0,
  descripcion: p.descripcion,
  categoria_id: p.categoria_id,
  categoria: p.categorias?.nombre || p.categoria || "",
  categorias: p.categorias ?? null,
  imagenes: Array.isArray(p.imagenes) && p.imagenes.length > 0
    ? p.imagenes
    : p.imagen_url
    ? [p.imagen_url]
    : [DEFAULT_IMAGE],
});

  const adaptarPedido = (p, items = [], clientesData = []) => {
    const clienteId =
      p.cliente_id ??
      p.clienteId ??
      p.cliente_id ??
      p.cliente?.id ??
      null;

    const clienteInfo = clienteId
      ? (clientesData || clientes).find((c) => String(c.id) === String(clienteId))
      : null;

    const rawFecha = p.fecha ?? p.fecha_entrega ?? null;
    const fechaEntrega = rawFecha
      ? /^\d{4}-\d{2}-\d{2}$/.test(rawFecha)
        ? rawFecha
        : /^\d{2}\/\d{2}\/\d{4}$/.test(rawFecha)
        ? rawFecha.split("/").reverse().join("-")
        : !Number.isNaN(Date.parse(rawFecha))
        ? new Date(rawFecha).toISOString().split("T")[0]
        : rawFecha
      : p.created_at
      ? new Date(p.created_at).toISOString().split("T")[0]
      : "";

    const fecha = fechaEntrega
      ? new Date(fechaEntrega).toLocaleDateString("es-CO")
      : "";

    return {
      id: p.id,
      cliente: clienteInfo?.nombre || p.nombre || p.cliente || "",
      clienteCedula: clienteInfo?.cedula || p.cedula || "",
      cliente_id: clienteId,
      direccion: p.direccion || clienteInfo?.direccion || "",
      fecha,
      fechaEntrega,
      formaPago: p.forma_pago ?? p.formaPago ?? "",
      items,
      total: p.total ?? p.totalPedido ?? 0,
      estado: p.estado ?? "Pendiente",
      repartidor_id: p.repartidor_id ?? null,
      repartidor: p.repartidor ?? "",
    };
  };

const cargarProductos = async () => {
  const { data, error } = await supabase.from("productos").select("*");

  if (error) {
    console.error("Error cargando productos:", error);
    return [];
  }

  const adaptados = (data || []).map(adaptarProducto);
  setProductos(adaptados);
  return adaptados;
};

  const cargarClientes = async () => {
    const { data, error } = await supabase.from("clientes").select("*");
    if (error) {
      console.error("Error cargando clientes:", error);
      return;
    }

    console.log("Clientes cargados desde Supabase (clientes):", data);

    const adaptados = (data || []).map((cliente) => {
      // El ID del cliente es su ID único en la tabla clientes
      const clienteId = cliente.id ?? null;

      return {
        ...cliente,
        id: clienteId,
        cedula:
          cliente.cedula ??
          cliente.cedula_cliente ??
          cliente.Cedula ??
          cliente.CI ??
          cliente.ci ??
          "",
        nombre:
          cliente.nombre ??
          cliente.Nombre ??
          cliente.name ??
          cliente.nombre_cliente ??
          "Cliente",
        direccion:
          cliente.direccion ??
          cliente.dirección ??
          cliente.Direccion ??
          cliente.dirección_cliente ??
          cliente.address ??
          "",
        telefono:
          cliente.telefono ??
          cliente.telefono_cliente ??
          cliente.Telefono ??
          cliente.phone ??
          "",
        correo:
          cliente.correo ??
          cliente.email ??
          cliente.Email ??
          cliente.correo_cliente ??
          "",
        saldo: cliente.saldo ?? cliente.balance ?? 0,
        transacciones: cliente.transacciones ?? cliente.transactions ?? [],
        vendedor_id:
          cliente.vendedor_id ??
          cliente.vendedor_usuario_id ??
          cliente["vendedor id"] ??
          cliente.vendedorId ??
          cliente.Vendedor_id ??
          cliente.vendedor ??
          null,
        vendedor_usuario_id:
          cliente.vendedor_usuario_id ??
          cliente.vendedor_id ??
          cliente["vendedor id"] ??
          cliente.vendedorId ??
          cliente.Vendedor_id ??
          cliente.vendedor ??
          null,
        // usuario_id es la llave que relaciona con la tabla usuarios
        usuario_id:
          cliente.usuario_id ??
          cliente.Usuario_id ??
          cliente.usuarioId ??
          cliente.user_id ??
          cliente.userId ??
          null,
      };
    });

    setClientes(adaptados);
    return adaptados;
  };

  const cargarPedidos = async (productosCargados = [], clientesCargados = []) => {
    const { data, error } = await supabase.from("pedidos").select("*");
    if (error) {
      console.error("Error cargando pedidos:", error);
      return;
    }

    const pedidosData = data || [];
    const pedidoIds = pedidosData
      .map((pedido) => pedido.id)
      .filter((id) => id != null);

    let detalleData = [];
    if (pedidoIds.length > 0) {
      const { data: detalles, error: detalleError } = await supabase
        .from("pedido_detalle")
        .select("*")
        .in("pedido_id", pedidoIds);

      if (detalleError) {
        console.error("Error cargando detalles de pedidos:", detalleError);
      } else {
        detalleData = detalles || [];
      }
    }

    const detallesPorPedido = detalleData.reduce((acc, detalle) => {
      const pedidoId =
        detalle.pedido_id ?? detalle.Pedido_id ?? detalle.pedidoId ?? detalle.PedidoId;
      const productoId =
        detalle.producto_id ??
        detalle.Producto_id ??
        detalle.productoId ??
        detalle.ProductoId;

      const producto = (productosCargados.length > 0 ? productosCargados : productos).find(
        (prod) => String(prod.id) === String(productoId)
      );

      const item = {
        id: productoId,
        nombre:
          producto?.nombre ||
          detalle.nombre ||
          `Producto #${productoId}`,
        precio: Number(detalle.precio ?? detalle.Precio ?? producto?.precio ?? 0),
        cantidad: Number(detalle.cantidad ?? detalle.Cantidad ?? 1),
        imagen:
          producto?.imagenes?.[0] ||
          detalle.imagen ||
          detalle.imagen_url ||
          "",
      };

      acc[pedidoId] = [...(acc[pedidoId] || []), item];
      return acc;
    }, {});

    const pedidosAdaptados = pedidosData.map((pedido) =>
      adaptarPedido(
        pedido,
        detallesPorPedido[pedido.id] || pedido.items || [],
        Array.isArray(clientesCargados) && clientesCargados.length > 0
          ? clientesCargados
          : clientes
      )
    );

    console.log("📦 Pedidos cargados:", pedidosAdaptados.map(p => ({
      id: p.id,
      cliente: p.cliente,
      clienteCedula: p.clienteCedula,
      cliente_id: p.cliente_id,
      estado: p.estado,
      total: p.total
    })));

    setPedidos(pedidosAdaptados);
    return pedidosAdaptados;
  };

  const cargarRepartidores = async () => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, email, zona, rol")
      .eq("rol", "repartidor");

    if (error) {
      console.error("Error cargando repartidores desde usuarios:", error);
      return;
    }

    setRepartidores(data || []);
  };

  const cargarVendedores = async () => {
    try {
      const { data, error } = await supabase.from("vendedores").select("*");

      if (error) {
        if (
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("relation \"vendedores\" does not exist")
        ) {
          console.warn("Tabla 'vendedores' no existe: se usará solo usuarios con rol vendedor.");
          setTablaVendedoresExiste(false);
          setVendedores([]);
          return;
        }
        console.error("Error cargando vendedores:", error);
        return;
      }
      setVendedores(data || []);
      setTablaVendedoresExiste(true);
    } catch (err) {
      // Algunos errores de Supabase relacionados con la caché del esquema pueden lanzar excepciones
      if (String(err?.message || "").toLowerCase().includes("relation \"vendedores\" does not exist") ||
          String(err?.message || "").toLowerCase().includes("could not find the table 'public.vendedores'")) {
        console.warn("Excepción: tabla 'vendedores' no encontrada en el cache del esquema. Usando usuarios con rol 'vendedor'.");
        setTablaVendedoresExiste(false);
        setVendedores([]);
        return;
      }
      console.error("Excepción cargando vendedores:", err);
    }
  };

  const cargarUsuariosVendedores = async () => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, email, zona, rol")
      .eq("rol", "vendedor");

    if (error) {
      console.error("Error cargando vendedores desde usuarios:", error);
      return;
    }
    setUsuariosVendedores(data || []);
  };

  const vendedoresConUsuarios = useMemo(() => {
    return usuariosVendedores
      .filter((usuario) => usuario.rol === "vendedor")
      .map((usuario) => {
        const registro = vendedores.find((v) => String(v.usuario_id) === String(usuario.id));
        return {
          id: usuario.id,
          usuario_id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          zona: registro?.zona || usuario.zona || "",
          estado: registro?.estado || "Activo",
          registroVendedor: registro || null,
        };
      });
  }, [usuariosVendedores, vendedores]);

  const cargarCategorias = async () => {
    setCargandoCategorias(true);
    try {
      const { data, error } = await supabase.from("categorias").select("*");
      if (error) {
        console.error("Error cargando categorías:", error);
        setCategorias([]);
        return;
      }
      setCategorias(data || []);
    } finally {
      setCargandoCategorias(false);
    }
  };

  useEffect(() => {
    const calcularSaldoCliente = (cliente, pedidosArray) => {
      const transacciones = Array.isArray(cliente?.transacciones) ? cliente.transacciones : [];

      const totalPedidosTransacciones = transacciones
        .filter((trans) => String(trans.tipo).toLowerCase() === "pedido")
        .reduce((acc, trans) => acc + Number(trans.monto ?? 0), 0);

      const totalPagosTransacciones = transacciones
        .filter((trans) => {
          const tipo = String(trans.tipo).toLowerCase();
          return tipo === "pago" || tipo === "abono";
        })
        .reduce((acc, trans) => acc + Number(trans.monto ?? 0), 0);

      const tieneTransaccionesPedido = transacciones.some(
        (trans) => String(trans.tipo).toLowerCase() === "pedido"
      );

      if (tieneTransaccionesPedido) {
        return totalPedidosTransacciones - totalPagosTransacciones;
      }

      const pedidosCliente = pedidosArray.filter((pedido) => {
        const clienteIdMatch = cliente?.id != null && String(pedido.cliente_id) === String(cliente.id);
        const cedulaMatch = cliente?.cedula != null && String(pedido.clienteCedula) === String(cliente.cedula);
        return clienteIdMatch || cedulaMatch;
      });

      const totalPedidos = pedidosCliente.reduce((acc, pedido) => acc + Number(pedido.total ?? 0), 0);
      return totalPedidos - totalPagosTransacciones;
    };

    const reconciliarSaldosIniciales = (clientesArray, pedidosArray) => {
      if (!Array.isArray(clientesArray) || !Array.isArray(pedidosArray)) return;

      const clientesActualizados = clientesArray.map((cliente) => {
        if (!cliente?.id) return cliente;
        const saldoCalculado = calcularSaldoCliente(cliente, pedidosArray);
        if (Number(saldoCalculado) !== Number(cliente.saldo ?? 0)) {
          return {
            ...cliente,
            saldo: saldoCalculado,
          };
        }
        return cliente;
      });

      setClientes(clientesActualizados);
    };

    const cargarDatos = async () => {
      const productosCargados = await cargarProductos();
      const clientesCargados = await cargarClientes();
      const pedidosCargados = await cargarPedidos(productosCargados, clientesCargados);
      await Promise.all([
        cargarRepartidores(),
        cargarVendedores(),
        cargarUsuariosVendedores(),
        cargarCategorias(),
      ]);
      reconciliarSaldosIniciales(clientesCargados, pedidosCargados || []);
    };

    const init = async () => {
      await supabase.auth.getSession();
      await cargarDatos();
    };

    init();
  }, []);

  const crearProducto = async (
    nombre,
    precio,
    precioEmprendedor,
    precioMayorista,
    categoria,
    stock = 10,
    descripcion = "",
    imagenes = []
  ) => {
    if (!nombre || !precio || !categoria) {
      return { error: "Nombre, precio y categoría son requeridos" };
    }

    const categoriaEncontrada = categorias.find(
      (c) => c.nombre === categoria
    );

    if (!categoriaEncontrada) {
      return { error: "Categoría no encontrada" };
    }

    const productoInsert = {
      nombre,
      precio: Number(precio),
      precio_emprendedor: precioEmprendedor != null && precioEmprendedor !== "" ? Number(precioEmprendedor) : null,
      precio_mayorista: precioMayorista != null && precioMayorista !== "" ? Number(precioMayorista) : null,
      stock: Number(stock),
      descripcion,
      categoria_id: categoriaEncontrada.id,
    };

    if (imagenes.length > 0) {
      productoInsert.imagen_url = imagenes[0];
    }

    const { data, error } = await supabase
      .from("productos")
      .insert([productoInsert])
      .select("*")
      .single();

    if (error) {
      console.error("Error creando producto:", error);
      return { error: error.message };
    }

    let nuevoProducto = adaptarProducto(data);
    if (imagenes.length > 0) {
      nuevoProducto = { ...nuevoProducto, imagenes };
    }

    setProductos((prev) => [...prev, nuevoProducto]);
    return { success: true, producto: nuevoProducto };
  };

  const actualizarStock = async (productoId, cantidad) => {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return false;

    const nuevoStock = producto.stock + cantidad;
    if (nuevoStock < 0) return false;

    const { error } = await supabase
      .from("productos")
      .update({ stock: nuevoStock })
      .eq("id", productoId);

    if (error) {
      console.error("Error actualizando stock:", error);
      return false;
    }

    setProductos((prev) =>
      prev.map((p) =>
        p.id === productoId ? { ...p, stock: nuevoStock } : p
      )
    );
    return true;
  };

  const actualizarProducto = async (productoId, datos) => {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return { error: "Producto no encontrado" };

    const datosActualizacion = {};
    if (datos.nombre != null) datosActualizacion.nombre = datos.nombre;
    if (datos.precio != null) datosActualizacion.precio = Number(datos.precio);
    if (datos.precio_emprendedor != null) datosActualizacion.precio_emprendedor = datos.precio_emprendedor !== "" ? Number(datos.precio_emprendedor) : null;
    if (datos.precio_mayorista != null) datosActualizacion.precio_mayorista = datos.precio_mayorista !== "" ? Number(datos.precio_mayorista) : null;
    if (datos.stock != null) datosActualizacion.stock = Number(datos.stock);
    if (datos.descripcion != null) datosActualizacion.descripcion = datos.descripcion;
    if (datos.imagenes != null && datos.imagenes.length > 0) {
      datosActualizacion.imagen_url = datos.imagenes[0];
    }

    const { data, error } = await supabase
      .from("productos")
      .update(datosActualizacion)
      .eq("id", productoId)
      .select()
      .single();

    if (error) {
      console.error("Error actualizando producto:", error);
      return { error: error.message };
    }

    let productoActualizado = adaptarProducto(data);
    if (datos.imagenes != null && datos.imagenes.length > 0) {
      productoActualizado = {
        ...productoActualizado,
        imagenes: datos.imagenes,
      };
    }

    setProductos((prev) =>
      prev.map((p) => (p.id === productoId ? productoActualizado : p))
    );

    return { success: true, producto: productoActualizado };
  };

  const eliminarProducto = async (productoId) => {
    if (!productoId) {
      return { error: "Producto no especificado" };
    }

    try {
      // Eliminar variantes asociadas primero si existen
      try {
        const { error: errorVariantes } = await supabase
          .from("producto_variantes")
          .delete()
          .eq("producto_id", productoId);

        if (errorVariantes) {
          console.warn("Error eliminando variantes del producto:", errorVariantes);
        }
      } catch (err) {
        console.warn("No se pudo eliminar variantes asociadas o tabla no existe:", err);
      }

      const { data, error } = await supabase
        .from("productos")
        .delete()
        .eq("id", productoId);

      if (error) {
        console.error("Error eliminando producto:", error);
        return { error: error.message || String(error) };
      }

      setProductos((prev) => prev.filter((p) => p.id !== productoId));
      return { success: true, data };
    } catch (err) {
      console.error("Excepción eliminando producto:", err);
      return { error: err.message || String(err) };
    }
  };

  const agotarProducto = async (productoId) => {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return false;

    const { error } = await supabase
      .from("productos")
      .update({ stock: 0 })
      .eq("id", productoId);

    if (error) {
      console.error("Error agotando producto:", error);
      return false;
    }

    setProductos((prev) =>
      prev.map((p) => (p.id === productoId ? { ...p, stock: 0 } : p))
    );
    return true;
  };

  const crearPedido = async (cedula, nombre, direccion, carrito, formaPago, emailCliente = "", telefonoCliente = "", clienteIdManual = null) => {
    // Validar datos básicos
    if (!cedula || !nombre || !direccion || !carrito?.length) {
      return { error: "Cédula, nombre, dirección y carrito son requeridos" };
    }

    // Validar carrito
    const validacionCarrito = validarCarrito(carrito);
    if (!validacionCarrito.valido) {
      return { error: validacionCarrito.errores.join("; ") };
    }

    // Validar datos del pedido
    const datosValidar = {
      cedula,
      nombre,
      direccion,
      email: emailCliente,
      telefono: telefonoCliente,
      formaPago,
      carrito,
    };

    const validacion = validarDatosPedido(datosValidar);
    if (!validacion.valido) {
      return { error: validacion.errores.join("; ") };
    }

    // Obtener cliente para tener acceso a su email
    const clienteEncontrado = clientes.find((c) => c.cedula === cedula);
    const emailDestino = emailCliente || clienteEncontrado?.correo;

    const total = calcularTotal(carrito);

    const pedidoData = {
      cedula,
      nombre,
      direccion,
      forma_pago: formaPago,
      estado: "Pendiente",
      total,
      cliente_id: clienteIdManual || clienteEncontrado?.id || null,
    };

    try {
      const { data: pedidoCreado, error: errorPedido } = await supabase
        .from("pedidos")
        .insert([pedidoData])
        .select()
        .single();

      if (errorPedido) {
        console.error("Error creando pedido:", errorPedido);
        return { error: errorPedido.message };
      }

      const detalles = carrito.map((item) => ({
        pedido_id: pedidoCreado.id,
        producto_id: item.id,
        cantidad: item.cantidad || 1,
        precio: item.precio,
      }));

      const { error: errorDetalle } = await supabase
        .from("pedido_detalle")
        .insert(detalles);

      if (errorDetalle) {
        console.error("Error creando detalle de pedido:", errorDetalle);
        return { error: errorDetalle.message };
      }

      // Actualizar stock
      for (const item of carrito) {
        const nuevoStock = Number(item.stock ?? 0) - Number(item.cantidad || 1);
        const { error: errorStock } = await supabase
          .from("productos")
          .update({ stock: nuevoStock })
          .eq("id", item.id);

        if (errorStock) {
          console.error("Error actualizando stock de producto:", errorStock);
          return { error: errorStock.message };
        }
      }

      setProductos((prev) =>
        prev.map((producto) => {
          const item = carrito.find((i) => i.id === producto.id);
          if (!item) return producto;
          return { ...producto, stock: Number(producto.stock || 0) - Number(item.cantidad || 1) };
        })
      );

      const nuevoPedido = adaptarPedido({
        ...pedidoCreado,
        items: carrito,
      });

      setPedidos((prev) => [...prev, nuevoPedido]);

      const clienteIdParaSaldo = clienteEncontrado?.id || clienteIdManual || pedidoCreado.cliente_id;
      const clienteParaSaldo = clienteEncontrado || clientes.find((c) => String(c.id) === String(clienteIdParaSaldo));

      if (clienteParaSaldo) {
        const saldoActual = Number(clienteParaSaldo.saldo ?? 0);
        const nuevoSaldoCliente = saldoActual + Number(total || 0);
        const transaccionPedido = {
          id: `pedido-${pedidoCreado.id}-${Date.now()}`,
          tipo: "pedido",
          monto: Number(total || 0),
          descripcion: `Pedido ${pedidoCreado.id}`,
          metodoPago: formaPago,
          fecha: new Date().toLocaleDateString("es-CO"),
        };

        const nuevasTransacciones = [
          ...(clienteParaSaldo.transacciones ?? []),
          transaccionPedido,
        ];

        const { error: errorSaldo } = await supabase
          .from("clientes")
          .update({ saldo: nuevoSaldoCliente, transacciones: nuevasTransacciones })
          .eq("id", clienteParaSaldo.id);

        if (errorSaldo) {
          console.error("Error actualizando saldo del cliente al crear pedido:", errorSaldo);
        } else {
          setClientes((prev) =>
            prev.map((c) =>
              String(c.id) === String(clienteParaSaldo.id)
                ? { ...c, saldo: nuevoSaldoCliente, transacciones: nuevasTransacciones }
                : c
            )
          );
        }
      }

      // Enviar correo de confirmación al cliente
      if (emailDestino) {
        try {
          await enviarConfirmacionPedido({
            pedidoId: pedidoCreado.id,
            cliente: nombre,
            email: emailDestino,
            telefono: telefonoCliente || clienteEncontrado?.telefono,
            items: carrito,
            total,
            formaPago,
            direccion,
          });
        } catch (errorEmail) {
          console.error("Error enviando correo de confirmación:", errorEmail);
          // No retornar error aquí, el pedido ya fue creado
        }
      }

      return { success: true, pedido: nuevoPedido };
    } catch (error) {
      console.error("Error en crearPedido:", error);
      return { error: error.message || "Error al crear el pedido" };
    }
  };

const crearVendedor = async (nombre, zona, email, password) => {
  if (!nombre || !zona || !email || !password) {
    return { error: "Nombre, zona, email y contraseña son requeridos" };
  }

  const { data: { session: previousSession } } = await supabase.auth.getSession();

  try {
    // 1. Verificar si ya existe usuario con ese email
    const { data: usuarioExistente, error: errorUsuarioExistente } =
      await supabase
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (errorUsuarioExistente) {
      console.error(errorUsuarioExistente);
      return { error: errorUsuarioExistente.message };
    }

    if (usuarioExistente) {
      return { error: "Ya existe un usuario con ese email" };
    }

    // 2. Crear usuario en Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (authError) {
      console.error("Error creando usuario en Auth:", authError);
      return { error: authError.message };
    }

    if (!authData.user?.id) {
      return { error: "No se pudo obtener el ID del usuario creado" };
    }

    const userId = authData.user.id;

    // 3. Insertar en tabla usuarios con rol "vendedor"
    const { data: usuarioData, error: errorUsuario } =
      await supabase
        .from("usuarios")
        .insert([
          {
            id: userId,
            nombre,
            email,
            rol: "vendedor",
            zona,
          },
        ])
        .select()
        .single();

    if (errorUsuario) {
      console.error("Error creando usuario vendedor:", errorUsuario);

      await supabase.auth.admin.deleteUser(userId);

      if (previousSession) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: previousSession.access_token,
          refresh_token: previousSession.refresh_token,
        });
        if (restoreError) {
          console.error("Error restaurando sesión anterior tras rollback:", restoreError);
        }
      }

      return { error: errorUsuario.message };
    }

    // 4. Insertar en vendedores si existe
    let vendedorData = usuarioData;
    if (tablaVendedoresExiste) {
      const { data: vendedorInsertado, error: errorVendedor } =
        await supabase
          .from("vendedores")
          .insert([
            {
              zona,
              estado: "Activo",
              usuario_id: userId,
            },
          ])
          .select()
          .single();

      if (errorVendedor) {
        if (
          errorVendedor.code === "42P01" ||
          errorVendedor.message?.toLowerCase().includes("relation \"vendedores\" does not exist")
        ) {
          console.warn("Tabla 'vendedores' no existe: el vendedor se creó solo en usuarios.");
          setTablaVendedoresExiste(false);
        } else {
          console.error("Error creando vendedor:", errorVendedor);
          return { error: errorVendedor.message };
        }
      } else {
        vendedorData = vendedorInsertado;
        setVendedores((prev) => [...prev, vendedorInsertado]);
      }
    }

    // 5. Sincronizar estado local con la base de datos
    await cargarUsuariosVendedores();
    await cargarVendedores();

    if (previousSession) {
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });
      if (restoreError) {
        console.error("Error restaurando sesión anterior:", restoreError);
      }
    }

    return {
      success: true,
      vendedor: vendedorData,
    };
  } catch (err) {
    console.error(err);
    return { error: err.message };
  }
};

const crearCliente = async (
    nombre,
    cedula,
    direccion,
    telefono = "",
    correo = "",
    vendedor_id = null,
    password = "123456"
  ) => {
    if (!nombre || !cedula || !direccion) {
      return { error: "Nombre, cédula y dirección son requeridos" };
    }

    // Si se proporciona correo, seguiremos la misma lógica que crearVendedor:
    // 1) crear usuario en Auth, 2) insertar en table `usuarios`, 3) insertar en `clientes`.
    if (correo && correo.trim() !== "") {
      const { data: { session: previousSession } } = await supabase.auth.getSession();

      try {
        // Verificar si ya existe usuario por email o cédula
        const { data: usuarioExistenteEmail } = await supabase
          .from("usuarios")
          .select("id")
          .eq("email", correo)
          .maybeSingle();

        const { data: usuarioExistenteCedula } = await supabase
          .from("usuarios")
          .select("id")
          .eq("cedula", cedula)
          .maybeSingle();

        if (usuarioExistenteEmail || usuarioExistenteCedula) {
          return { error: "Ya existe un usuario con ese email o cédula" };
        }

        // Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: correo,
          password,
        });

        if (authError) {
          console.error("Error creando usuario en Auth:", authError);
          return { error: authError.message };
        }

        if (!authData.user?.id) {
          return { error: "No se pudo obtener el ID del usuario creado" };
        }

        const userId = authData.user.id;

        // Insertar en tabla usuarios
        const { data: usuarioData, error: errorUsuario } = await supabase
          .from("usuarios")
          .insert([
            {
              id: userId,
              nombre,
              cedula,
              email: correo,
              rol: "cliente",
            },
          ])
          .select()
          .single();

        if (errorUsuario) {
          console.error("Error creando usuario cliente:", errorUsuario);
          // rollback: eliminar usuario auth creado
          try { await supabase.auth.admin.deleteUser(userId); } catch (e) { console.error(e); }

          if (previousSession) {
            const { error: restoreError } = await supabase.auth.setSession({
              access_token: previousSession.access_token,
              refresh_token: previousSession.refresh_token,
            });
            if (restoreError) console.error("Error restaurando sesión anterior tras rollback:", restoreError);
          }

          return { error: errorUsuario.message };
        }

        // Insertar en tabla clientes vinculado al usuario
        const clienteInsertPayload = {
          usuario_id: userId,
          nombre,
          cedula,
          direccion,
          telefono,
          correo,
        };
        if (vendedor_id) {
          clienteInsertPayload.vendedor_usuario_id = vendedor_id;
        }

        const { data: clienteData, error: errorCliente } = await supabase
          .from("clientes")
          .insert([clienteInsertPayload])
          .select()
          .single();

        if (errorCliente) {
          console.error("Error creando cliente:", errorCliente);
          // rollback: eliminar usuario y usuario row
          try { await supabase.auth.admin.deleteUser(userId); } catch (e) { console.error(e); }
          try { await supabase.from("usuarios").delete().eq("id", userId); } catch (e) { console.error(e); }

          if (previousSession) {
            const { error: restoreError } = await supabase.auth.setSession({
              access_token: previousSession.access_token,
              refresh_token: previousSession.refresh_token,
            });
            if (restoreError) console.error("Error restaurando sesión anterior tras rollback:", restoreError);
          }

          return { error: errorCliente.message };
        }

        const clienteCreado = {
          ...clienteData,
          saldo: clienteData.saldo ?? 0,
          transacciones: clienteData.transacciones ?? [],
        };

        setClientes((prev) => [...prev, clienteCreado]);

        if (previousSession) {
          const { error: restoreError } = await supabase.auth.setSession({
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
          if (restoreError) console.error("Error restaurando sesión anterior:", restoreError);
        }

        return { success: true, cliente: clienteCreado };

      } catch (err) {
        console.error("Error en crearCliente (con auth):", err);
        return { error: err.message || "Error al crear cliente" };
      }
    }

    // Si no hay correo, conservar flujo previo (crear sin Auth)
    try {
      const { data: usuarioExistente, error: usuarioError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("cedula", cedula)
        .maybeSingle();

      if (usuarioError) {
        console.error("Error verificando usuario existente:", usuarioError);
        return { error: usuarioError.message };
      }

      if (!usuarioExistente) {
        const { error: errorUsuario } = await supabase
          .from("usuarios")
          .insert([
            {
              nombre,
              cedula,
              email: correo || null,
              rol: "cliente",
              password_hash: password,
            },
          ]);

        if (errorUsuario) {
          console.error("Error creando usuario:", errorUsuario);
          return { error: errorUsuario.message };
        }
      }

const datosCliente = {
      nombre,
      cedula,
      direccion,
      telefono,
      correo,
    };
    if (vendedor_id) {
      datosCliente.vendedor_usuario_id = vendedor_id;
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert([datosCliente])
        .select()
        .single();

      if (error) {
        console.error("Error creando cliente:", error);
        return { error: error.message };
      }

      const clienteCreado = {
        ...data,
        vendedor_id: data.vendedor_id ?? data.vendedor_usuario_id ?? null,
        vendedor_usuario_id: data.vendedor_usuario_id ?? data.vendedor_id ?? null,
        saldo: data.saldo ?? 0,
        transacciones: data.transacciones ?? [],
      };

      setClientes((prev) => [...prev, clienteCreado]);

      return { success: true, cliente: clienteCreado };
    } catch (err) {
      console.error("Error en crearCliente:", err);
      return { error: err.message || "Error al crear cliente" };
    }
  };

  const obtenerClientesPorVendedor = (vendedorId) =>
    clientes.filter((cliente) => {
      const vendedorAsignado = cliente.vendedor_usuario_id ?? cliente.vendedor_id ?? null;
      return String(vendedorAsignado) === String(vendedorId);
    });

  const calcularVentasPorVendedor = (vendedorId) => {
    const clientesVendedor = obtenerClientesPorVendedor(vendedorId);
    const cedulas = clientesVendedor.map((cliente) => cliente.cedula);
    return pedidos
      .filter((pedido) => cedulas.includes(pedido.clienteCedula))
      .reduce((sum, pedido) => sum + Number(pedido.total || 0), 0);
  };

  const crearRepartidor = async (nombre, email, zona, password) => {
    if (!nombre || !email || !zona || !password) {
      return { error: "Nombre, email, zona y contraseña son requeridos" };
    }

    const { data: { session: previousSession } } = await supabase.auth.getSession();

    try {
      // 1. Verificar si ya existe usuario con ese email
      const { data: usuarioExistente, error: errorUsuarioExistente } =
        await supabase
          .from("usuarios")
          .select("id")
          .eq("email", email)
          .maybeSingle();

      if (errorUsuarioExistente) {
        console.error(errorUsuarioExistente);
        return { error: errorUsuarioExistente.message };
      }

      if (usuarioExistente) {
        return { error: "Ya existe un usuario con ese email" };
      }

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (authError) {
        console.error("Error creando usuario en Auth:", authError);
        return { error: authError.message };
      }

      if (!authData.user?.id) {
        return { error: "No se pudo obtener el ID del usuario creado" };
      }

      const userId = authData.user.id;

      // 3. Insertar en tabla usuarios con rol "repartidor"
      const { data: usuarioData, error: errorUsuario } =
        await supabase
          .from("usuarios")
          .insert([
            {
              id: userId,
              nombre,
              email,
              rol: "repartidor",
              zona,
            },
          ])
          .select()
          .single();

      if (errorUsuario) {
        console.error("Error creando usuario repartidor:", errorUsuario);

        // rollback: eliminar usuario auth creado
        await supabase.auth.admin.deleteUser(userId);

        if (previousSession) {
          const { error: restoreError } = await supabase.auth.setSession({
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
          if (restoreError) {
            console.error("Error restaurando sesión anterior tras rollback:", restoreError);
          }
        }

        return { error: errorUsuario.message };
      }

      // 4. Actualizar estado local
      setRepartidores((prev) => [...prev, usuarioData]);

      // Restaurar sesión anterior si existía
      if (previousSession) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: previousSession.access_token,
          refresh_token: previousSession.refresh_token,
        });
        if (restoreError) {
          console.error("Error restaurando sesión anterior:", restoreError);
        }
      }

      return { success: true, repartidor: usuarioData };
    } catch (err) {
      console.error("Error en crearRepartidor:", err);
      return { error: err.message };
    }
  };

  const eliminarRepartidor = async (id) => {
    if (!id) return { error: "ID de repartidor no proporcionado" };

    try {
      // Obtener nombre del repartidor si existe (para limpiar columna 'repartidor' basada en nombre)
      const { data: usuarioData, error: errorUsuario } = await supabase
        .from("usuarios")
        .select("id, nombre, rol")
        .eq("id", id)
        .maybeSingle();

      if (errorUsuario) {
        console.error("Error obteniendo usuario repartidor:", errorUsuario);
        return { error: errorUsuario.message || String(errorUsuario) };
      }

      const nombreRepartidor = usuarioData?.nombre || null;

      // 1) Desasignar pedidos que referencian al repartidor por id
      try {
        const { error: errPedidosId } = await supabase
          .from("pedidos")
          .update({ repartidor_id: null })
          .eq("repartidor_id", id);

        if (errPedidosId) {
          console.error("Error limpiando repartidor_id en pedidos:", errPedidosId);
          // continuar; intentaremos otras limpiezas y no bloquear la eliminación local
        }
      } catch (e) {
        console.error("Excepción limpiando repartidor_id en pedidos:", e);
      }

      // 2) Si existe la columna 'repartidor' con el nombre, desasignar también
      if (nombreRepartidor) {
        try {
          const { error: errPedidosNombre } = await supabase
            .from("pedidos")
            .update({ repartidor: null })
            .eq("repartidor", nombreRepartidor);

          if (errPedidosNombre) {
            const msg = String(errPedidosNombre.message || "").toLowerCase();
            if (msg.includes("could not find the 'repartidor' column") ||
                msg.includes("could not find column \"repartidor\"")) {
              console.warn("La columna 'repartidor' no existe, se omite limpieza por nombre.");
            } else {
              console.error("Error limpiando repartidor (por nombre) en pedidos:", errPedidosNombre);
            }
          }
        } catch (e) {
          console.error("Excepción limpiando repartidor (por nombre) en pedidos:", e);
        }
      }

      // Actualizar estado local de pedidos: quitar asignación a este repartidor
      setPedidos((prev) =>
        prev.map((p) =>
          String(p.repartidor_id) === String(id) || String(p.repartidor) === String(nombreRepartidor)
            ? { ...p, repartidor_id: null, repartidor: "" }
            : p
        )
      );

      // 3) Eliminar el usuario en la tabla 'usuarios'
      const { data, error } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", id)
        .eq("rol", "repartidor");

      if (error) {
        console.error("Error eliminando repartidor en tabla usuarios:", error);
        return { error: error.message || JSON.stringify(error) };
      }

      // Actualizar state de repartidores
      setRepartidores((prev) => prev.filter((r) => String(r.id) !== String(id)));

      // 4) Intentar eliminar en Auth (si la key/permite)
      try {
        await supabase.auth.admin.deleteUser(id);
      } catch (e) {
        console.warn("No se pudo eliminar usuario en Auth (posible falta de permisos):", e);
      }

      return { success: true, data };
    } catch (err) {
      console.error("Excepción eliminando repartidor:", err);
      return { error: err.message || String(err) };
    }
  };

  const registrarPago = async (
    clienteId,
    monto,
    metodoPago = "efectivo",
    descripcion = ""
  ) => {
    const cliente = clientes.find((c) => c.id === clienteId);
    if (!cliente) return false;

    const nuevoSaldo = Number(cliente.saldo ?? 0) - Number(monto || 0);
    const nuevaTransacciones = [
      ...(cliente.transacciones ?? []),
      {
        id: `${Date.now()}`,
        tipo: "pago",
        monto: Number(monto),
        descripcion,
        metodoPago,
        fecha: new Date().toLocaleDateString("es-CO"),
      },
    ];

    const { error } = await supabase
      .from("clientes")
      .update({ saldo: nuevoSaldo, transacciones: nuevaTransacciones })
      .eq("id", clienteId);

    if (error) {
      console.error("Error registrando pago:", error);
      return false;
    }

    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? {
              ...c,
              saldo: nuevoSaldo,
              transacciones: nuevaTransacciones,
            }
          : c
      )
    );
    return true;
  };

  const actualizarClienteTelefono = async (clienteId, telefono) => {
    const { error } = await supabase
      .from("clientes")
      .update({ telefono })
      .eq("id", clienteId);

    if (error) {
      console.error("Error actualizando teléfono:", error);
      return false;
    }

    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, telefono } : c))
    );
    return true;
  };

  const actualizarClienteDireccion = async (clienteId, direccion) => {
    const { error } = await supabase
      .from("clientes")
      .update({ direccion })
      .eq("id", clienteId);

    if (error) {
      console.error("Error actualizando dirección:", error);
      return false;
    }

    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, direccion } : c))
    );
    return true;
  };

  const actualizarClienteVendedor = async (clienteId, vendedorId) => {
    const vendedorIdNormalized = vendedorId || null;

    const { error } = await supabase
      .from("clientes")
      .update({ vendedor_usuario_id: vendedorIdNormalized })
      .eq("id", clienteId);

    if (error) {
      console.error("Error actualizando vendedor del cliente:", error);
      return false;
    }

    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? {
              ...c,
              vendedor_id: vendedorIdNormalized,
              vendedor_usuario_id: vendedorIdNormalized,
            }
          : c
      )
    );
    return true;
  };

  const obtenerClienteActual = (usuarioId, emailFallback = null) => {
    if (!usuarioId && !emailFallback) return null;
    
    console.log("🔍 Buscando cliente para usuarioId:", usuarioId, "o email:", emailFallback);
    console.log("📋 Clientes disponibles:", clientes.map(c => ({ id: c.id, usuario_id: c.usuario_id, email: c.correo, nombre: c.nombre })));
    
    // Primero intenta buscar por usuario_id
    let cliente = usuarioId ? clientes.find((c) => String(c.usuario_id) === String(usuarioId)) : null;
    
    // Si no encuentra y tiene email, busca por email
    if (!cliente && emailFallback) {
      console.log("⚠️ No encontrado por usuario_id, buscando por email:", emailFallback);
      cliente = clientes.find((c) => c.correo && c.correo.toLowerCase() === emailFallback.toLowerCase());
    }
    
    console.log("✅ Cliente encontrado:", cliente);
    return cliente || null;
  };

  const actualizarClienteNombre = async (clienteId, nombre) => {
    const { error } = await supabase
      .from("clientes")
      .update({ nombre })
      .eq("id", clienteId);

    if (error) {
      console.error("Error actualizando nombre del cliente:", error);
      return false;
    }

    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, nombre } : c))
    );
    return true;
  };

  const actualizarClienteCedula = async (clienteId, cedula) => {
    const { error } = await supabase
      .from("clientes")
      .update({ cedula })
      .eq("id", clienteId);

    if (error) {
      console.error("Error actualizando cédula del cliente:", error);
      return false;
    }

    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, cedula } : c))
    );
    return true;
  };

  const eliminarVendedor = async (vendedorUsuarioId) => {
    if (!vendedorUsuarioId) {
      return { error: "ID de vendedor no proporcionado" };
    }

    try {
      // Verificar que el usuario exista y tenga rol 'vendedor'
      const { data: usuario, error: errorUsuarioSelect } = await supabase
        .from("usuarios")
        .select("id, rol")
        .eq("id", vendedorUsuarioId)
        .maybeSingle();

      if (errorUsuarioSelect) {
        console.error("Error verificando usuario vendedor:", errorUsuarioSelect);
        return { error: errorUsuarioSelect.message };
      }

      if (!usuario || String(usuario.rol) !== "vendedor") {
        return { error: "El usuario no existe o no tiene rol 'vendedor'" };
      }

      // Desasignar clientes asociados al vendedor
      const { error: errorClientes } = await supabase
        .from("clientes")
        .update({ vendedor_usuario_id: null })
        .eq("vendedor_usuario_id", vendedorUsuarioId);

      if (errorClientes) {
        console.error("Error desasignando clientes del vendedor:", errorClientes);
        return { error: errorClientes.message };
      }

      setClientes((prev) =>
        prev.map((cliente) =>
          String(cliente.vendedor_usuario_id) === String(vendedorUsuarioId)
            ? {
                ...cliente,
                vendedor_id: null,
                vendedor_usuario_id: null,
              }
            : cliente
        )
      );


      // No dependemos de la tabla `vendedores` (puede no existir).
      // La fuente de verdad es `usuarios` con `rol = 'vendedor'`.
      // Si la tabla `vendedores` existe, su limpieza puede hacerse aparte/manualmente.

      const { error: errorEliminarUsuario } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", vendedorUsuarioId)
        .eq("rol", "vendedor");

      if (errorEliminarUsuario) {
        console.error("Error eliminando usuario vendedor:", errorEliminarUsuario);
        return { error: errorEliminarUsuario.message };
      }

      setUsuariosVendedores((prev) =>
        prev.filter((usuario) => String(usuario.id) !== String(vendedorUsuarioId))
      );

      try {
        await supabase.auth.admin.deleteUser(vendedorUsuarioId);
      } catch (e) {
        console.error("Error eliminando usuario en Auth:", e);
      }

      return { success: true };
    } catch (err) {
      console.error("Error eliminando vendedor:", err);
      return { error: err.message || "Error al eliminar vendedor" };
    }
  };

  const cambiarEstadoPedido = async (pedidoId, estado) => {
    const estadosPermitidos = ["Pendiente", "En camino", "Cancelado", "Entregado"];
    if (!estadosPermitidos.includes(estado)) {
      console.warn("Estado no permitido:", estado);
      return false;
    }

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado })
        .eq("id", pedidoId);

      if (error) {
        console.error("Error cambiando estado de pedido:", error);
        return false;
      }

      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === pedidoId ? { ...pedido, estado } : pedido
        )
      );
      return true;
    } catch (err) {
      console.error("Excepción cambiando estado de pedido:", err);
      return false;
    }
  };

  const actualizarFechaPedido = async (pedidoId, fecha) => {
    const formatearFechaLocal = (fechaIso) => {
      if (!fechaIso) return "";
      const fechaObj = new Date(fechaIso);
      if (Number.isNaN(fechaObj.getTime())) return fechaIso;
      return fechaObj.toLocaleDateString("es-CO");
    }; 

    const fechaFormateada = formatearFechaLocal(fecha);

    const actualizarLocal = (campoFecha) => {
      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === pedidoId
            ? { ...pedido, fecha: campoFecha, fechaEntrega: fecha }
            : pedido
        )
      );
    };

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ fecha })
        .eq("id", pedidoId);

      if (error) {
        const mensaje = String(error.message || "").toLowerCase();
        if (
          mensaje.includes("could not find column \"fecha\"") ||
          mensaje.includes("columna \"fecha\"") ||
          String(error.code) === "42703"
        ) {
          const { error: errorEntrega } = await supabase
            .from("pedidos")
            .update({ fecha_entrega: fecha })
            .eq("id", pedidoId);

          if (errorEntrega) {
            console.error("Error actualizando fecha_entrega de pedido:", errorEntrega);
            return false;
          }

          actualizarLocal(fechaFormateada);
          return true;
        }

        console.error("Error actualizando fecha de pedido:", error);
        return false;
      }

      actualizarLocal(fechaFormateada);
      return true;
    } catch (err) {
      console.error("Excepción actualizando fecha de pedido:", err);
      return false;
    }
  };

  const eliminarPedido = async (pedidoId) => {
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", pedidoId);

    if (error) {
      console.error("Error eliminando pedido:", error);
      return false;
    }

    setPedidos((prev) => prev.filter((pedido) => pedido.id !== pedidoId));
    return true;
  };

  const asignarRepartidor = async (pedidoId, repartidorId) => {
    // Si viene vacío, asignar null
    if (!repartidorId) {
      repartidorId = null;
    }

    try {
      // Intentar actualizar con repartidor_id (espera UUID text/string)
      const { error: errorId } = await supabase
        .from("pedidos")
        .update({ repartidor_id: repartidorId })
        .eq("id", pedidoId);

      // Preparar valor para la propiedad legible (nombre) en caso de necesitarse
      let valorGuardar = null;
      if (repartidorId) {
        const repartidor = repartidores.find((r) => String(r.id) === String(repartidorId));
        valorGuardar = repartidor ? repartidor.nombre : repartidorId;
      }

      if (errorId) {
        // Si falla por tipo de dato u otra razón, intentar guardar como string en "repartidor"
        console.warn("No se pudo guardar con repartidor_id, intentando con 'repartidor':", errorId);

        if (tablaPedidosTieneColumnaRepartidor) {
          const { error: errorRepartidor } = await supabase
            .from("pedidos")
            .update({ repartidor: valorGuardar })
            .eq("id", pedidoId);

          if (errorRepartidor) {
            const msg = String(errorRepartidor.message || "").toLowerCase();
            if (
              msg.includes("could not find the 'repartidor' column") ||
              msg.includes("could not find column \"repartidor\"") ||
              String(errorRepartidor.code) === "42703"
            ) {
              console.warn("Columna 'repartidor' no encontrada en pedidos, guardando solo localmente.");
              setTablaPedidosTieneColumnaRepartidor(false);
              // No retornar; actualizaremos el estado local abajo
            } else {
              console.error("Error asignando repartidor:", errorRepartidor);
              alert("Error al asignar repartidor: " + errorRepartidor.message);
              return false;
            }
          }
        } else {
          console.warn("Se evita intento de guardar columna 'repartidor' porque no existe según flag.");
        }
      }

      // Actualizar estado local siempre (siempre reflejamos la intención del usuario en la UI)
      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === pedidoId
            ? { ...pedido, repartidor_id: repartidorId, repartidor: valorGuardar || "" }
            : pedido
        )
      );

      return true;
    } catch (err) {
      console.error("Error en asignarRepartidor:", err);
      alert("Error: " + err.message);
      return false;
    }
  };

  const updatePedidoItems = async (pedidoId, items) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return false;

    try {
      const { error: errorEliminar } = await supabase
        .from("pedido_detalle")
        .delete()
        .eq("pedido_id", pedidoId);

      if (errorEliminar) {
        console.error("Error eliminando items antiguos de pedido:", errorEliminar);
        return false;
      }

      if (items.length > 0) {
        const detalles = items.map((item) => ({
          pedido_id: pedidoId,
          producto_id: item.id,
          cantidad: item.cantidad || 1,
          precio: item.precio,
        }));

        const { error: errorInsertar } = await supabase
          .from("pedido_detalle")
          .insert(detalles);

        if (errorInsertar) {
          console.error("Error insertando items de pedido:", errorInsertar);
          return false;
        }
      }

      const total = items.reduce(
        (sum, item) => sum + Number(item.precio) * Number(item.cantidad || 1),
        0
      );

      const { error: errorActualizarPedido } = await supabase
        .from("pedidos")
        .update({ total })
        .eq("id", pedidoId);

      if (errorActualizarPedido) {
        console.error("Error actualizando total de pedido:", errorActualizarPedido);
        return false;
      }

      setPedidos((prev) =>
        prev.map((pedidoItem) =>
          pedidoItem.id === pedidoId
            ? { ...pedidoItem, items, total }
            : pedidoItem
        )
      );

      return true;
    } catch (err) {
      console.error("Excepción actualizando items de pedido:", err);
      return false;
    }
  };

  const agregarItemPedido = async (pedidoId, productoId, nombre, precio, cantidad) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return false;

    const nuevoItem = { id: productoId, nombre, precio, cantidad };
    const items = [...(pedido.items || []), nuevoItem];
    return await updatePedidoItems(pedidoId, items);
  };

  const eliminarItemPedido = async (pedidoId, productoId) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return false;

    const items = (pedido.items || []).filter((item) => item.id !== productoId);
    return await updatePedidoItems(pedidoId, items);
  };

  const actualizarCantidadItemPedido = async (pedidoId, productoId, cantidad) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return false;

    const items = (pedido.items || []).map((item) =>
      item.id === productoId ? { ...item, cantidad } : item
    );
    return await updatePedidoItems(pedidoId, items);
  };

return (
  <StoreContext.Provider
    value={{
      productos,
      setProductos,
      clientes,
      pedidos,
      repartidores,
      vendedores,
      usuariosVendedores,
      categorias,
      crearProducto,
      actualizarStock,
      agotarProducto,
      crearPedido,
      crearCliente,
      crearVendedor,
      actualizarClienteVendedor,
      obtenerClientesPorVendedor,
      calcularVentasPorVendedor,
      crearRepartidor,
      eliminarRepartidor,
      registrarPago,
      actualizarClienteTelefono,
      actualizarClienteDireccion,
      obtenerClienteActual,
      actualizarClienteNombre,
      actualizarClienteCedula,
      cambiarEstadoPedido,
      actualizarFechaPedido,
      eliminarPedido,
      asignarRepartidor,
      agregarItemPedido,
      eliminarItemPedido,
      actualizarCantidadItemPedido,
      actualizarProducto,
      eliminarProducto,
      eliminarVendedor,
      cargandoCategorias,
      vendedoresConUsuarios,
      tablaVendedoresExiste,
    }}
  >
    {children}
  </StoreContext.Provider>
);
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
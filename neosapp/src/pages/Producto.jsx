import { useState, useRef, useMemo, useEffect } from "react";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../context/supabaseClient";
import { validarDatosPedido, validarCarrito } from "../utils/validaciones";
import "./producto.css";
import brebImage from "../components/img/breb.jpg";

const CATEGORIAS_POR_DEFECTO = [
  "Accesorios",
  "Cabello",
  "Cejas y Pestañas",
  "Cuerpo",
  "Esmaltes",
  "Halloween",
  "Maquillaje",
  "Pedrería Adhesiva",
  "S. Shop",
  "Tratamientos",
  "Uñas y Limas"
];

const FORMAS_PAGO = ["Efectivo", "Crédito", "Abono"];

export default function Producto() {
  const { productos, categorias, setProductos, crearProducto, actualizarProducto, clientes } = useStore();
  const { esAdmin, esVendedor, obtenerDatosUsuario, user, getUserRole } = useAuth();
  const vendedorData = obtenerDatosUsuario();

  const obtenerCategoriaProducto = (producto) =>
    producto.categorias?.nombre ||
    producto.categoria ||
    categorias.find((c) => c.id === producto.categoria_id)?.nombre ||
    "Sin categoría";

  const categoriasDisponibles = useMemo(() => {
    if (categorias.length > 0) {
      return categorias.map((c) => c.nombre);
    }

    return Array.from(
      new Set(productos.map((producto) => obtenerCategoriaProducto(producto)))
    ).filter(Boolean);
  }, [categorias, productos]);

  const obtenerTextoStockCliente = (stock) => {
    const cantidad = Number(stock || 0);

    if (cantidad <= 0) {
      return "Sin stock";
    }

    if (cantidad < 5) {
      return "Quedan pocas unidades";
    }

    return "Disponible";
  };

  const obtenerClaseStockCliente = (stock) => {
    const cantidad = Number(stock || 0);

    if (cantidad <= 0) {
      return "sinstock";
    }

    if (cantidad < 5) {
      return "bajostock";
    }

    return "disponible";
  };

  const obtenerTextoStockAdmin = (stock) => {
    const cantidad = Number(stock || 0);

    if (cantidad <= 0) {
      return "Sin stock";
    }

    if (cantidad < 5) {
      return "Quedan pocas unidades";
    }

    return `Stock: ${cantidad}`;
  };

  const obtenerPrecioProducto = (producto) => {
    if (tipoCatalogo === "Emprendedor" && producto.precio_emprendedor != null && producto.precio_emprendedor !== "") {
      return producto.precio_emprendedor;
    }
    if (tipoCatalogo === "Mayorista" && producto.precio_mayorista != null && producto.precio_mayorista !== "") {
      return producto.precio_mayorista;
    }
    return producto.precio ?? 0;
  };

  const obtenerClaseStockAdmin = (stock) => {
    const cantidad = Number(stock || 0);

    if (cantidad <= 0) {
      return "sinstock";
    }

    if (cantidad < 5) {
      return "bajostock";
    }

    return "constock";
  };
  
  // Referencias para los scrolls horizontales
  const scrollRefs = useRef({});
  const [scrollNecesario, setScrollNecesario] = useState({});
  const [dragging, setDragging] = useState({});
  const [dragStart, setDragStart] = useState({});
  const [esVistaMovil, setEsVistaMovil] = useState(false);
  
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    precio: "",
    precioEmprendedor: "",
    precioMayorista: "",
    categoria: CATEGORIAS_POR_DEFECTO[0],
    stock: "",
    descripcion: "",
    imagenes: [],
  });
  const [imagenesVista, setImagenesVista] = useState([]);

  // Estados para el carrito (debe estar ANTES de useEffect que los usa)
  const [carrito, setCarrito] = useState([]);
  const [mostrarModalPedido, setMostrarModalPedido] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [tipoCatalogo, setTipoCatalogo] = useState("General");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false);
  const [erroresValidacion, setErroresValidacion] = useState([]);
  const [datosCliente, setDatosCliente] = useState({
    cedula: "",
    nombre: "",
    direccion: "",
    correoElectronico: "",
    numeroCelular: "",
    password: "",
    formaPago: FORMAS_PAGO[0],
  });

  useEffect(() => {
    const handleResize = () => {
      setEsVistaMovil(window.innerWidth <= 820);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cargar datos del cliente logueado cuando se abre el modal de pedido
  useEffect(() => {
    const cargarDatosClienteLogueado = async () => {
      if (mostrarModalPedido && user && getUserRole() === "cliente") {
        // Buscar cliente por usuario_id
        const clienteLogueado = clientes.find((c) => c.usuario_id === user.id);
        
        if (clienteLogueado) {
          setDatosCliente({
            cedula: clienteLogueado.cedula || "",
            nombre: clienteLogueado.nombre || "",
            direccion: clienteLogueado.direccion || "",
            correoElectronico: clienteLogueado.correo || user.email || "",
            numeroCelular: clienteLogueado.telefono || "",
            password: "",
            formaPago: datosCliente.formaPago || FORMAS_PAGO[0],
          });
        }
      }
    };

    cargarDatosClienteLogueado();
  }, [mostrarModalPedido, user, clientes]);

  // Estados para ver detalles del producto
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [productoDetalles, setProductoDetalles] = useState(null);
  const [indiceCarrusel, setIndiceCarrusel] = useState(0);
  const [cantidadDetalles, setCantidadDetalles] = useState(1);

  // Estados para actualizar stock
  const [mostrarModalStock, setMostrarModalStock] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [productoEdicion, setProductoEdicion] = useState({
    nombre: "",
    precio: "",
    precio_emprendedor: "",
    precio_mayorista: "",
    stock: "",
    descripcion: "",
    imagenes: [],
  });

  const crearProductoHandler = async () => {
    if (!nuevo.nombre || !nuevo.precio || !nuevo.stock) {
      alert("Por favor completa nombre, precio y stock");
      return;
    }

    const resultado = await crearProducto(
      nuevo.nombre,
      nuevo.precio,
      nuevo.precioEmprendedor,
      nuevo.precioMayorista,
      nuevo.categoria,
      nuevo.stock,
      nuevo.descripcion,
      nuevo.imagenes.length > 0 ? nuevo.imagenes : []
    );

    if (resultado.error) {
      alert(`Error: ${resultado.error}`);
      return;
    }

    setNuevo({ nombre: "", precio: "", precioEmprendedor: "", precioMayorista: "", categoria: CATEGORIAS_POR_DEFECTO[0], stock: "", descripcion: "", imagenes: [] });
    setImagenesVista([]);
    setMostrarModal(false);
    alert("✅ Producto creado exitosamente");
  }; 
 
  const handleImagenSeleccionada = (e) => {
    const archivos = Array.from(e.target.files);
    const maxImagenes = 5;
    
    if (archivos.length + nuevo.imagenes.length > maxImagenes) {
      alert(`Máximo ${maxImagenes} imágenes permitidas`);
      return;
    }

    // Procesar cada archivo
    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imagenBase64 = event.target.result;
        setNuevo((prev) => ({
          ...prev,
          imagenes: [...prev.imagenes, imagenBase64],
        }));
        setImagenesVista((prev) => [...prev, imagenBase64]);
      };
      reader.readAsDataURL(archivo);
    });
  };

  const eliminarImagen = (index) => {
    setNuevo((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== index),
    }));
    setImagenesVista((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImagenSeleccionadaEdicion = (e) => {
    const archivos = Array.from(e.target.files);
    const maxImagenes = 5;

    if (archivos.length + productoEdicion.imagenes.length > maxImagenes) {
      alert(`Máximo ${maxImagenes} imágenes permitidas`);
      return;
    }

    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imagenBase64 = event.target.result;
        setProductoEdicion((prev) => ({
          ...prev,
          imagenes: [...prev.imagenes, imagenBase64],
        }));
      };
      reader.readAsDataURL(archivo);
    });
  };

  const eliminarImagenEdicion = (index) => {
    setProductoEdicion((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== index),
    }));
  };

  const abrirDetalles = (producto) => {
    setProductoDetalles(producto);
    setIndiceCarrusel(0);
    setCantidadDetalles(1);
    setMostrarDetalles(true);
  };

  const siguienteImagen = () => {
    setIndiceCarrusel(
      (prev) => (prev + 1) % productoDetalles.imagenes.length
    );
  };

  const imagenAnterior = () => {
    setIndiceCarrusel(
      (prev) => (prev - 1 + productoDetalles.imagenes.length) % productoDetalles.imagenes.length
    );
  };

  // Funciones para scroll horizontal
  const hacerScroll = (categoria, direccion) => {
    const container = scrollRefs.current[categoria];
    if (container) {
      const scrollAmount = 240; // ancho de tarjeta + gap
      if (direccion === "izquierda") {
        container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }
  };

  const verificarScrollNecesario = (categoria) => {
    const container = scrollRefs.current[categoria];
    if (container) {
      const necesario = container.scrollWidth > container.clientWidth;
      setScrollNecesario((prev) => ({
        ...prev,
        [categoria]: necesario,
      }));
    }
  };

  const handleMouseDown = (categoria, e) => {
    const container = scrollRefs.current[categoria];
    if (!container) return;

    setDragging((prev) => ({ ...prev, [categoria]: true }));
    setDragStart((prev) => ({
      ...prev,
      [categoria]: {
        x: e.clientX,
        scrollLeft: container.scrollLeft,
      },
    }));
  };

  const handleMouseMove = (categoria, e) => {
    if (!dragging[categoria]) return;

    const container = scrollRefs.current[categoria];
    if (!container) return;

    const distance = e.clientX - dragStart[categoria].x;
    container.scrollLeft = dragStart[categoria].scrollLeft - distance;
  };

  const handleMouseUp = (categoria) => {
    setDragging((prev) => ({ ...prev, [categoria]: false }));
  };

  const abrirModalStock = (producto) => {
    setProductoSeleccionado(producto);
    setProductoEdicion({
      nombre: producto.nombre || "",
      precio: producto.precio || "",
      precio_emprendedor: producto.precio_emprendedor ?? "",
      precio_mayorista: producto.precio_mayorista ?? "",
      stock: producto.stock != null ? producto.stock.toString() : "",
      descripcion: producto.descripcion || "",
      imagenes: producto.imagenes ? [...producto.imagenes] : [],
    });
    setMostrarModalStock(true);
  };

  const actualizarStockHandler = async () => {
    if (!productoEdicion.nombre || !productoEdicion.precio || productoEdicion.stock === "") {
      alert("Por favor completa nombre, precio y stock");
      return;
    }

    const resultado = await actualizarProducto(productoSeleccionado.id, {
      nombre: productoEdicion.nombre,
      precio: Number(productoEdicion.precio),
      precio_emprendedor: productoEdicion.precio_emprendedor,
      precio_mayorista: productoEdicion.precio_mayorista,
      stock: Number(productoEdicion.stock),
      descripcion: productoEdicion.descripcion,
      imagenes: productoEdicion.imagenes,
    });

    if (resultado.error) {
      alert(`Error: ${resultado.error}`);
      return;
    }

    alert(`✅ Producto actualizado correctamente`);
    setMostrarModalStock(false);
  };

  const agregarAlCarrito = (producto) => {
    if (producto.stock <= 0) return;

    const precioSeleccionado = obtenerPrecioProducto(producto);

    // Verificar si ya está en el carrito
    const productoEnCarrito = carrito.find((p) => p.id === producto.id);

    if (!productoEnCarrito) {
      // Agregar con cantidad 0 para que el usuario la especifique en el carrito
      setCarrito([...carrito, { ...producto, precio: precioSeleccionado, cantidad: 0 }]);

    }
  };


  const eliminarDelCarrito = (productoId) => {
    setCarrito(carrito.filter((p) => p.id !== productoId));
  };

  const actualizarCantidad = (productoId, cantidad) => {
    if (cantidad <= 0) {
      eliminarDelCarrito(productoId);
      return;
    }

    const producto = productos.find((p) => p.id === productoId);
    if (cantidad > producto.stock) return;

    setCarrito(
      carrito.map((p) =>
        p.id === productoId ? { ...p, cantidad } : p
      )
    );
  };

  const calcularTotal = () => {
    return carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  };

  // Obtener clientes según el rol del usuario
  const obtenerClientesFiltrados = () => {
    let clientesFiltrados = clientes;

    if (esVendedor()) {
      const vendedorId = vendedorData?.id ?? vendedorData?.usuario_id ?? user?.id ?? null;
      clientesFiltrados = clientes.filter((cliente) => {
        const vendedorAsignado = cliente.vendedor_usuario_id ?? cliente.vendedor_id ?? null;
        return String(vendedorAsignado) === String(vendedorId);
      });
    }

    // Filtrar por búsqueda
    if (busquedaCliente.trim()) {
      const busqueda = busquedaCliente.toLowerCase();
      clientesFiltrados = clientesFiltrados.filter(c =>
        c.nombre.toLowerCase().includes(busqueda) ||
        c.cedula.includes(busqueda)
      );
    }

    return clientesFiltrados;
  };

  // Ordenar productos alfabéticamente
  const obtenerProductosOrdenados = (productosFiltrados) => {
    return [...productosFiltrados].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  };

  // Obtener categorías a mostrar basado en filtros
const obtenerCategoriasConProductos = () => {
  let categoriasAMostrar = categoriasDisponibles;

  if (categoriaSeleccionada !== "Todas") {
    categoriasAMostrar = [categoriaSeleccionada];
  }

  return categoriasAMostrar.filter((categoria) => {
    return productos.some((p) => {
      const categoriaProducto = obtenerCategoriaProducto(p);
      const coincideCategoria = categoriaProducto === categoria;
      const coincideBusqueda = p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase());
      return coincideCategoria && coincideBusqueda;
    });
  });
};

  // Obtener productos filtrados por categoría y búsqueda
const obtenerProductosFiltrados = (categoria) => {
  return productos.filter((p) => {
    const categoriaProducto = obtenerCategoriaProducto(p);
    return (
      categoriaProducto === categoria &&
      p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
    );
  });
};

  const seleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setDatosCliente({
      cedula: cliente.cedula || "",
      nombre: cliente.nombre || "",
      direccion: cliente.direccion || "",
      correoElectronico: cliente.correo || "",
      numeroCelular: cliente.telefono || "",
      formaPago: FORMAS_PAGO[0],
    });
    setBusquedaCliente("");
    setMostrarListaClientes(false);
  };

  const limpiarSeleccionCliente = () => {
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setDatosCliente({
      cedula: "",
      nombre: "",
      direccion: "",
      correoElectronico: "",
      numeroCelular: "",
      formaPago: FORMAS_PAGO[0],
    });
  };

  const finalizarPedido = async () => {
    setErroresValidacion([]);

    const correo = datosCliente.correoElectronico.trim();
    const nombre = datosCliente.nombre.trim();
    const direccion = datosCliente.direccion.trim();
    const telefono = datosCliente.numeroCelular.trim();
    const total = calcularTotal();

    const datosPedido = {
      cedula: datosCliente.cedula,
      nombre,
      direccion,
      email: correo,
      telefono,
      password: datosCliente.password,
      formaPago: datosCliente.formaPago,
      carrito,
    };

    const validacionPedido = validarDatosPedido(datosPedido);
    if (!validacionPedido.valido) {
      setErroresValidacion(validacionPedido.errores);
      return;
    }

    const validacionCarrito = validarCarrito(carrito);
    if (!validacionCarrito.valido) {
      setErroresValidacion(validacionCarrito.errores);
      return;
    }

    try {
      let { data: clienteExistente, error: errorClienteExistente } = await supabase
        .from("clientes")
        .select("*")
        .eq("correo", correo)
        .maybeSingle();

      if (errorClienteExistente) {
        throw errorClienteExistente;
      }

      let clienteId;

      if (!clienteExistente) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: correo,
          password: datosCliente.password || "Temporal123!",
        });

        if (authError) {
          throw authError;
        }

        const userId = authData?.user?.id;
        if (!userId) {
          throw new Error("No se pudo obtener el ID del usuario creado en Auth");
        }

        const { error: errorUsuario } = await supabase.from("usuarios").insert({
          id: userId,
          nombre,
          cedula: datosCliente.cedula,
          email: correo,
          rol: "cliente",
        });

        if (errorUsuario) {
          throw errorUsuario;
        }

        const { data: clienteNuevo, error: errorCrearCliente } = await supabase
          .from("clientes")
          .insert({
            usuario_id: userId,
            nombre,
            cedula: datosCliente.cedula,
            direccion,
            telefono,
            correo,
          })
          .select()
          .single();

        if (errorCrearCliente) {
          throw errorCrearCliente;
        }

        clienteId = clienteNuevo.id;
      } else {
        clienteId = clienteExistente.id;
      }

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: clienteId,
          forma_pago: datosCliente.formaPago,
          estado: "Pendiente",
          total,
        })
        .select()
        .single();

      if (pedidoError) {
        throw pedidoError;
      }

      for (const item of carrito) {
        const { error: errorDetalle } = await supabase.from("pedido_detalle").insert({
          pedido_id: pedido.id,
          producto_id: item.id,
          cantidad: item.cantidad,
          precio: item.precio,
        });

        if (errorDetalle) {
          throw errorDetalle;
        }
      }

      setCarrito([]);
      setDatosCliente({
        cedula: "",
        nombre: "",
        direccion: "",
        correoElectronico: "",
        numeroCelular: "",
        password: "",
        formaPago: FORMAS_PAGO[0],
      });
      setClienteSeleccionado(null);
      setBusquedaCliente("");
      setMostrarModalPedido(false);
      setErroresValidacion([]);
      alert("Compra registrada correctamente");
    } catch (error) {
      console.error(error);
      setErroresValidacion([error?.message || "Error registrando la compra"]);
    }
  };

  return (
    <div className="productos-page">
      <div className="productos-header">
        {(esAdmin() || esVendedor()) && <h2>Tienda de Productos</h2>}
        <div>
          {esAdmin() && (
            <button
              className="btn-primary"
              onClick={() => setMostrarModal(true)}
            >
              + Nuevo producto
            </button>
          )}
          {carrito.length > 0 && (
            <button
              className="btn-carrito"
              onClick={() => setMostrarModalPedido(true)}
            >
              🛒 Carrito ({carrito.length})
            </button>
          )}
        </div>
      </div>

      {/* Selector de tipo de catálogo */}
      <div className="selector-catalogo-container">
        <label htmlFor="tipoCatalogo">¿Qué tipo de catálogo desea consultar?</label>
        <select
          id="tipoCatalogo"
          value={tipoCatalogo}
          onChange={(e) => setTipoCatalogo(e.target.value)}
        >
          <option value="General">General</option>
          <option value="Emprendedor">Emprendedor</option>
          <option value="Mayorista">Mayorista</option>
        </select>
      </div>

      {/* IMAGEN INFORMATIVA PARA CLIENTES */}
      {!esAdmin() && !esVendedor() && (
        <div className="info-image-container">
          <img src={brebImage} alt="Información sobre pedidos y productos" />
        </div>
      )}

      {/* TÍTULO PARA CLIENTES */}
      {!esAdmin() && !esVendedor() && (
        <h2 className="productos-title">Tienda de Productos</h2>
      )}

      {/* BUSCADOR Y FILTROS */}
      <div className="productos-filtros">
        <div className="busqueda-container">
          <input
            type="text"
            className="input-busqueda"
            placeholder="🔍 Buscar producto por nombre..."
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
          />
        </div>

        <div className="filtro-categorias">
          <button
            className={`categoria-btn ${categoriaSeleccionada === "Todas" ? "activa" : ""}`}
            onClick={() => setCategoriaSeleccionada("Todas")}
          >
            Todas
          </button>
          {(categorias.length > 0 ? categorias.map((c) => c.nombre) : CATEGORIAS_POR_DEFECTO).map((categoria) => (
            <button
              key={categoria}
              className={`categoria-btn ${categoriaSeleccionada === categoria ? "activa" : ""}`}
              onClick={() => setCategoriaSeleccionada(categoria)}
            >
              {categoria}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCTOS */}
      {obtenerCategoriasConProductos().length > 0 ? (
        obtenerCategoriasConProductos().map((categoria) => {
          const productosFiltrados = obtenerProductosOrdenados(obtenerProductosFiltrados(categoria));
          const mostrarGrid = categoriaSeleccionada !== "Todas";

          return (
            <div className="categoria-bloque" key={categoria}>
              <h3 className="categoria-titulo">{categoria}</h3>

              {mostrarGrid ? (
                <div className="productos-grid">
                  {productosFiltrados.map((p) => (
                    <div 
                      className="producto-card" 
                      key={p.id}
                      onClick={() => abrirDetalles(p)}
                      role="button"
                      tabIndex="0"
                    >
                      <div className="producto-imagen">
                        <img 
                          src={p.imagenes?.[0] || "https://images.unsplash.com/photo-1522338242592-cb0acf6f85a2?w=500&h=500&fit=crop"} 
                          alt={p.nombre}
                        />
                      </div>

                      <div className="producto-info">
                        <span className="producto-nombre">
                          {p.nombre}
                        </span>
                        <span className="producto-precio">
                          ${Number(obtenerPrecioProducto(p)).toLocaleString()}
                        </span>
                        {esAdmin() ? (
                          <span className={`producto-stock ${obtenerClaseStockAdmin(p.stock)}`}>
                            {obtenerTextoStockAdmin(p.stock)}
                          </span>
                        ) : (
                          obtenerTextoStockCliente(p.stock) && (
                            <span className={`producto-stock ${obtenerClaseStockCliente(p.stock)}`}>
                              {obtenerTextoStockCliente(p.stock)}
                            </span>
                          )
                        )}
                      </div>

                      <div className="producto-acciones">
                        <button
                          className="btn-agregar-carrito"
                          onClick={() => agregarAlCarrito(p)}
                          disabled={p.stock <= 0}
                        >
                          Agregar
                        </button>
                        {esAdmin() && (
                          <>
                            <button
                              className="btn-stock"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModalStock(p);
                              }}
                              title="Actualizar stock"
                            >
                              Actualizar stock
                            </button>
                            <button
                              className="btn-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductos(
                                  productos.filter((x) => x.id !== p.id)
                                );
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  className="productos-scroll-container"
                  onMouseEnter={() => verificarScrollNecesario(categoria)}
                >
                  {scrollNecesario[categoria] && (
                    <button 
                      className="scroll-btn scroll-btn-left"
                      onClick={() => hacerScroll(categoria, "izquierda")}
                      title="Desplazar izquierda"
                    >
                      ◀
                    </button>
                  )}
                  
                  <div 
                    className="productos-scroll"
                    ref={(el) => scrollRefs.current[categoria] = el}
                    onMouseDown={(e) => handleMouseDown(categoria, e)}
                    onMouseMove={(e) => handleMouseMove(categoria, e)}
                    onMouseUp={() => handleMouseUp(categoria)}
                    onMouseLeave={() => handleMouseUp(categoria)}
                    style={{ cursor: dragging[categoria] ? "grabbing" : "grab" }}
                  >
                    {productosFiltrados.map((p) => (
                      <div 
                        className="producto-card" 
                        key={p.id}
                        onClick={() => {
                          // Evitar abrir detalles si se está arrastrando
                          if (!dragging[categoria]) {
                            abrirDetalles(p);
                          }
                        }}
                        role="button"
                        tabIndex="0"
                      >
                        <div className="producto-imagen">
                          <img 
                            src={p.imagenes?.[0] || "https://images.unsplash.com/photo-1522338242592-cb0acf6f85a2?w=500&h=500&fit=crop"} 
                            alt={p.nombre}
                          />
                        </div>

                        <div className="producto-info">
                          <span className="producto-nombre">
                            {p.nombre}
                          </span>
                          <span className="producto-precio">
                            ${Number(obtenerPrecioProducto(p)).toLocaleString()}
                          </span>
                          {esAdmin() ? (
                            <span className={`producto-stock ${obtenerClaseStockAdmin(p.stock)}`}>
                              {obtenerTextoStockAdmin(p.stock)}
                            </span>
                          ) : (
                            obtenerTextoStockCliente(p.stock) && (
                              <span className={`producto-stock ${obtenerClaseStockCliente(p.stock)}`}>
                                {obtenerTextoStockCliente(p.stock)}
                              </span>
                            )
                          )}
                        </div>

                        <div className="producto-acciones">
                          <button
                            className="btn-agregar-carrito"
                            onClick={() => agregarAlCarrito(p)}
                            disabled={p.stock <= 0}
                          >
                            Agregar
                          </button>
                          {esAdmin() && (
                            <>
                              <button
                                className="btn-stock"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalStock(p);
                                }}
                                title="Actualizar stock"
                              >
                                Actualizar stock
                              </button>
                              <button
                                className="btn-delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductos(
                                    productos.filter((x) => x.id !== p.id)
                                  );
                                }}
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {scrollNecesario[categoria] && (
                    <button 
                      className="scroll-btn scroll-btn-right"
                      onClick={() => hacerScroll(categoria, "derecha")}
                      title="Desplazar derecha"
                    >
                      ▶
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="sin-resultados">
          <p>No hay productos que coincidan con tu búsqueda</p>
        </div>
      )}

      {/* Modal para crear producto */}
      {mostrarModal && esAdmin() && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nuevo producto</h3>

            <input
              placeholder="Nombre"
              value={nuevo.nombre}
              onChange={(e) =>
                setNuevo({ ...nuevo, nombre: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Precio general"
              value={nuevo.precio}
              onChange={(e) =>
                setNuevo({ ...nuevo, precio: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Precio emprendedor"
              value={nuevo.precioEmprendedor}
              onChange={(e) =>
                setNuevo({ ...nuevo, precioEmprendedor: e.target.value })
              }
              min="0"
            />

            <input
              type="number"
              placeholder="Precio mayorista"
              value={nuevo.precioMayorista}
              onChange={(e) =>
                setNuevo({ ...nuevo, precioMayorista: e.target.value })
              }
              min="0"
            />

            <input
              type="number"
              placeholder="Stock inicial"
              value={nuevo.stock}
              onChange={(e) =>
                setNuevo({ ...nuevo, stock: e.target.value })
              }
              min="0"
            />

            <textarea
              placeholder="Descripción del producto (opcional)"
              value={nuevo.descripcion}
              onChange={(e) =>
                setNuevo({ ...nuevo, descripcion: e.target.value })
              }
              rows="3"
              style={{ fontFamily: "inherit", resize: "vertical" }}
            />

            <select
              value={nuevo.categoria}
              onChange={(e) =>
                setNuevo({ ...nuevo, categoria: e.target.value })
              }
            >
              {(categorias.length > 0 ? categorias.map((c) => c.nombre) : CATEGORIAS_POR_DEFECTO).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            {/* Sección de imágenes */}
            <div className="seccion-imagenes">
              <label className="etiqueta-imagenes">Imágenes del producto (máximo 5):</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImagenSeleccionada}
                className="input-imagenes"
              />
              
              {imagenesVista.length > 0 && (
                <div className="previsualizacion-imagenes">
                  {imagenesVista.map((imagen, index) => (
                    <div key={index} className="item-imagen-preview">
                      <img src={imagen} alt={`Preview ${index + 1}`} />
                      <button
                        type="button"
                        className="btn-eliminar-imagen"
                        onClick={() => eliminarImagen(index)}
                        title="Eliminar imagen"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => {
                setMostrarModal(false);
                setNuevo({ nombre: "", precio: "", precioEmprendedor: "", precioMayorista: "", categoria: CATEGORIAS_POR_DEFECTO[0], stock: "", descripcion: "", imagenes: [] });
                setImagenesVista([]);
              }}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={crearProductoHandler}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para actualizar stock y detalles del producto */}
      {mostrarModalStock && productoSeleccionado && esAdmin() && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar producto</h3>
            <p><strong>{productoSeleccionado.nombre}</strong></p>
            <p>Stock actual: <strong>{productoSeleccionado.stock}</strong> unidades</p>

            <input
              placeholder="Nombre"
              value={productoEdicion.nombre}
              onChange={(e) =>
                setProductoEdicion({ ...productoEdicion, nombre: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Precio general"
              value={productoEdicion.precio}
              onChange={(e) =>
                setProductoEdicion({ ...productoEdicion, precio: e.target.value })
              }
              min="0"
            />

            <input
              type="number"
              placeholder="Precio emprendedor"
              value={productoEdicion.precio_emprendedor}
              onChange={(e) =>
                setProductoEdicion({ ...productoEdicion, precio_emprendedor: e.target.value })
              }
              min="0"
            />

            <input
              type="number"
              placeholder="Precio mayorista"
              value={productoEdicion.precio_mayorista}
              onChange={(e) =>
                setProductoEdicion({ ...productoEdicion, precio_mayorista: e.target.value })
              }
              min="0"
            />

            <input
              type="number"
              placeholder="Stock"
              value={productoEdicion.stock}
              onChange={(e) =>
                setProductoEdicion({ ...productoEdicion, stock: e.target.value })
              }
              min="0"
            />

            <textarea
              placeholder="Descripción"
              value={productoEdicion.descripcion}
              onChange={(e) =>
                setProductoEdicion({ ...productoEdicion, descripcion: e.target.value })
              }
              rows="3"
              style={{ fontFamily: "inherit", resize: "vertical" }}
            />

            <div className="seccion-imagenes">
              <label className="etiqueta-imagenes">Imágenes del producto (máximo 5):</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImagenSeleccionadaEdicion}
                className="input-imagenes"
              />

              {productoEdicion.imagenes.length > 0 && (
                <div className="previsualizacion-imagenes">
                  {productoEdicion.imagenes.map((imagen, index) => (
                    <div key={index} className="item-imagen-preview">
                      <img src={imagen} alt={`Preview ${index + 1}`} />
                      <button
                        type="button"
                        className="btn-eliminar-imagen"
                        onClick={() => eliminarImagenEdicion(index)}
                        title="Eliminar imagen"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => setMostrarModalStock(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={actualizarStockHandler}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver detalles del producto */}
      {mostrarDetalles && productoDetalles && (
        <div className="modal-overlay" onClick={() => setMostrarDetalles(false)}>
          <div className="modal-detalles" onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn-cerrar"
              onClick={() => setMostrarDetalles(false)}
            >
              ✕
            </button>

            <div className="detalles-contenedor">
              {/* Carrusel de imágenes */}
              <div className="detalles-carrusel">
                <img 
                  src={productoDetalles.imagenes[indiceCarrusel]} 
                  alt={productoDetalles.nombre}
                  className="imagen-principal"
                />
                
                {productoDetalles.imagenes.length > 1 && !esVistaMovil && (
                  <>
                    <button 
                      className="btn-carrusel-prev"
                      onClick={imagenAnterior}
                    >
                      ❮
                    </button>
                    <button 
                      className="btn-carrusel-next"
                      onClick={siguienteImagen}
                    >
                      ❯
                    </button>
                  </>
                )}

                <div className="indicadores-carrusel">
                  {productoDetalles.imagenes.map((_, index) => (
                    <button
                      key={index}
                      className={`indicador ${index === indiceCarrusel ? "activo" : ""}`}
                      onClick={() => setIndiceCarrusel(index)}
                    />
                  ))}
                </div>
              </div>

              {/* Información del producto */}
              <div className="detalles-info">
                <h2>{productoDetalles.nombre}</h2>
                
                <div className="detalles-categoria">
                  <span className="badge-categoria">{obtenerCategoriaProducto(productoDetalles)}</span>
                </div>

                <p className="detalles-descripcion">
                  {productoDetalles.descripcion || "No hay descripción disponible"}
                </p>

                <div className="detalles-precio-stock">
                  <div className="precio-grande">
                    ${Number(obtenerPrecioProducto(productoDetalles)).toLocaleString()}
                  </div>
                  {esAdmin() && (
                    <div className="precios-especiales">
                      {productoDetalles.precio_emprendedor != null && productoDetalles.precio_emprendedor !== "" && (
                        <div className="precio-especial">
                          <span>Emprendedor:</span> ${Number(productoDetalles.precio_emprendedor).toLocaleString()}
                        </div>
                      )}
                      {productoDetalles.precio_mayorista != null && productoDetalles.precio_mayorista !== "" && (
                        <div className="precio-especial">
                          <span>Mayorista:</span> ${Number(productoDetalles.precio_mayorista).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  {esAdmin() ? (
                    <div className={`stock-info ${obtenerClaseStockAdmin(productoDetalles.stock)}`}>
                      {obtenerTextoStockAdmin(productoDetalles.stock)}
                    </div>
                  ) : (
                    obtenerTextoStockCliente(productoDetalles.stock) && (
                      <div className={`stock-info ${obtenerClaseStockCliente(productoDetalles.stock)}`}>
                        {obtenerTextoStockCliente(productoDetalles.stock)}
                      </div>
                    )
                  )}
                </div>

                <div className="detalles-acciones">
                  <div className="cantidad-detalles">
                    <label>Cantidad:</label>
                    <div className="cantidad-input-group-detalles">
                      <button
                        onClick={() => setCantidadDetalles(Math.max(1, cantidadDetalles - 1))}
                        className="btn-cantidad-detalles"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={cantidadDetalles}
                        onChange={(e) => {
                          const valor = Number(e.target.value);
                          if (valor > 0 && valor <= productoDetalles.stock) {
                            setCantidadDetalles(valor);
                          }
                        }}
                        min="1"
                        max={productoDetalles.stock}
                        className="cantidad-input-detalles"
                      />
                      <button
                        onClick={() => setCantidadDetalles(Math.min(productoDetalles.stock, cantidadDetalles + 1))}
                        className="btn-cantidad-detalles"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn-agregar-grande"
                    onClick={() => {
                      if (cantidadDetalles <= 0 || cantidadDetalles > productoDetalles.stock) {
                        alert("Cantidad inválida");
                        return;
                      }

                      const productoEnCarrito = carrito.find((p) => p.id === productoDetalles.id);
                      if (productoEnCarrito) {
                        const nuevaCantidad = productoEnCarrito.cantidad + cantidadDetalles;
                        if (nuevaCantidad > productoDetalles.stock) {
                          alert(`No hay suficiente stock. Máximo disponible: ${productoDetalles.stock}`);
                          return;
                        }
                        setCarrito(
                          carrito.map((p) =>
                            p.id === productoDetalles.id
                              ? { ...p, cantidad: nuevaCantidad }
                              : p
                          )
                        );
                      } else {
                        setCarrito([
                          ...carrito,
                          {
                            ...productoDetalles,
                            precio: obtenerPrecioProducto(productoDetalles),
                            cantidad: cantidadDetalles,
                          },
                        ]);
                      }

                      setMostrarDetalles(false);
                      setCantidadDetalles(1);
                    }}
                    disabled={productoDetalles.stock <= 0}
                  >
                    🛒 Agregar al carrito
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Modal para finalizar pedido */}
      {mostrarModalPedido && (
        <div className="modal-overlay">
          <div className="modal modal-grande">
            <h3>Finalizar Pedido</h3>

            <div className="modal-carrito">
              <h4>Productos en el carrito:</h4>
              <div className="carrito-items">
                {carrito.map((item) => (
                  <div key={item.id} className="carrito-item">
                    <div>
                      <p><strong>{item.nombre}</strong></p>
                      <p>${item.precio.toLocaleString()}</p>
                    </div>
                    <div className="cantidad-control">
                      <button
                        onClick={() =>
                          actualizarCantidad(item.id, item.cantidad - 1)
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarCantidad(item.id, Number(e.target.value))
                        }
                      />
                      <button
                        onClick={() =>
                          actualizarCantidad(item.id, item.cantidad + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <p><strong>${(item.precio * item.cantidad).toLocaleString()}</strong></p>
                    <button
                      className="btn-delete-small"
                      onClick={() => eliminarDelCarrito(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="carrito-total">
                <h4>Total: ${calcularTotal().toLocaleString()}</h4>
              </div>
            </div>

            <div className="formulario-cliente">
              <h4>Datos del cliente:</h4>

              {erroresValidacion.length > 0 && (
                <div className="errores-validacion">
                  <h5>⚠️ Corrige los siguientes datos:</h5>
                  <ul>
                    {erroresValidacion.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {(esAdmin() || esVendedor()) ? (
                <div className="busqueda-cliente">
                  <div className="busqueda-input-wrapper">
                    <input
                      type="text"
                      placeholder="Buscar cliente por nombre o cédula..."
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        setMostrarListaClientes(true);
                      }}
                      onFocus={() => setMostrarListaClientes(true)}
                      className="busqueda-input"
                    />
                    {clienteSeleccionado && (
                      <button
                        className="btn-limpiar-cliente"
                        onClick={limpiarSeleccionCliente}
                        title="Limpiar selección"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {mostrarListaClientes && (
                    <div className="lista-clientes-dropdown">
                      {obtenerClientesFiltrados().length > 0 ? (
                        obtenerClientesFiltrados().map((cliente) => (
                          <div
                            key={cliente.id}
                            className="cliente-opcion"
                            onClick={() => seleccionarCliente(cliente)}
                          >
                            <div className="cliente-info">
                              <strong>{cliente.nombre}</strong>
                              <span className="cliente-cedula">{cliente.cedula}</span>
                            </div>
                            <small className="cliente-direccion">{cliente.direccion}</small>
                          </div>
                        ))
                      ) : (
                        <div className="sin-resultados">
                          {busquedaCliente ? "No se encontraron clientes" : "No hay clientes disponibles"}
                        </div>
                      )}
                    </div>
                  )}

                  {clienteSeleccionado && (
                    <div className="cliente-seleccionado">
                      <p><strong>Cliente seleccionado:</strong> {clienteSeleccionado.nombre}</p>
                      <p><small>{clienteSeleccionado.cedula}</small></p>
                      <p><small>Correo: {datosCliente.correoElectronico || "No registrado"}</small></p>
                      <p><small>Celular: {datosCliente.numeroCelular || "No registrado"}</small></p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {user && getUserRole() === "cliente" ? (
                    // Cliente logueado: mostrar resumen de datos
                    <div className="cliente-resumen-logueado">
                      <div className="resumen-item">
                        <label>Nombre:</label>
                        <p>{datosCliente.nombre}</p>
                      </div>
                      <div className="resumen-item">
                        <label>Cédula:</label>
                        <p>{datosCliente.cedula}</p>
                      </div>
                      <div className="resumen-item">
                        <label>Dirección:</label>
                        <p>{datosCliente.direccion}</p>
                      </div>
                      <div className="resumen-item">
                        <label>Correo:</label>
                        <p>{datosCliente.correoElectronico}</p>
                      </div>
                      <div className="resumen-item">
                        <label>Teléfono:</label>
                        <p>{datosCliente.numeroCelular || "No registrado"}</p>
                      </div>
                    </div>
                  ) : (
                    // Usuario no logueado: formulario de registro
                    <>
                      <input
                        placeholder="Cédula o NIT"
                        value={datosCliente.cedula}
                        onChange={(e) =>
                          setDatosCliente({ ...datosCliente, cedula: e.target.value })
                        }
                      />

                      <input
                        placeholder="Nombre del cliente"
                        value={datosCliente.nombre}
                        onChange={(e) =>
                          setDatosCliente({ ...datosCliente, nombre: e.target.value })
                        }
                      />

                      <input
                        placeholder="Dirección"
                        value={datosCliente.direccion}
                        onChange={(e) =>
                          setDatosCliente({ ...datosCliente, direccion: e.target.value })
                        }
                      />

                      <input
                        placeholder="Correo electrónico"
                        value={datosCliente.correoElectronico}
                        onChange={(e) =>
                          setDatosCliente({ ...datosCliente, correoElectronico: e.target.value })
                        }
                      />

                      <input
                        placeholder="Número de celular"
                        value={datosCliente.numeroCelular}
                        onChange={(e) =>
                          setDatosCliente({ ...datosCliente, numeroCelular: e.target.value })
                        }
                      />

                      <input
                        type="password"
                        placeholder="Contraseña para el cliente"
                        value={datosCliente.password}
                        onChange={(e) =>
                          setDatosCliente({ ...datosCliente, password: e.target.value })
                        }
                      />
                    </>
                  )}
                </>
              )}

              <select
                value={datosCliente.formaPago}
                onChange={(e) =>
                  setDatosCliente({ ...datosCliente, formaPago: e.target.value })
                }
              >
                {FORMAS_PAGO.map((forma) => (
                  <option key={forma}>{forma}</option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button onClick={() => setMostrarModalPedido(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={finalizarPedido}
              >
                Crear Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante del carrito */}
      {carrito.length > 0 && (
        <button
          className="carrito-flotante"
          onClick={() => setMostrarModalPedido(true)}
          title="Ver carrito"
        >
          <span className="carrito-icono">🛒</span>
          <span className="carrito-cantidad">{carrito.length}</span>
        </button>
      )}
    </div>
  );
}

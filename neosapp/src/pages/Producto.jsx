import { useState, useRef, useMemo, useEffect } from "react";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../context/supabaseClient";
import { validarDatosPedido, validarCarrito } from "../utils/validaciones";
import "./producto.css";
import brebImage from "../components/img/breb.jpg";
import editarIcon from "../components/img/editar.png";
import eliminarIcon from "../components/img/eliminar.png";
import ocultoIcon from "../components/img/oculto.png";

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
  const { productos, categorias, setProductos, setCategorias, crearProducto, actualizarProducto, eliminarProducto, clientes, bannerUrl, subirBanner } = useStore();
  const { esAdmin, esVendedor, obtenerDatosUsuario, user, getUserRole } = useAuth();
  const vendedorData = obtenerDatosUsuario();

  const obtenerCategoriaProducto = (producto) =>
    producto.categorias?.nombre ||
    producto.categoria ||
    categorias.find((c) => c.id === producto.categoria_id)?.nombre ||
    "Sin categoría";

  const [categoriasOcultas, setCategoriasOcultas] = useState([]);

  const categoriasDisponibles = useMemo(() => {
    const base = categorias.length > 0
      ? categorias.map((c) => c.nombre)
      : Array.from(
          new Set(productos.map((producto) => obtenerCategoriaProducto(producto)))
        ).filter(Boolean);

    return Array.from(new Set([...base, ...CATEGORIAS_POR_DEFECTO])).filter(Boolean);
  }, [categorias, productos]);

  const categoriasVisibles = useMemo(() => {
    return categoriasDisponibles.filter((categoria) => !categoriasOcultas.includes(categoria));
  }, [categoriasDisponibles, categoriasOcultas]);

  const crearCategoria = async () => {
    const nombreCategoria = nuevaCategoria.trim();
    if (!nombreCategoria) return;

    const nombreNormalizado = nombreCategoria.replace(/\s+/g, " ").trim();
    const existe = categoriasDisponibles.some((categoria) => categoria.toLowerCase() === nombreNormalizado.toLowerCase());

    if (existe) {
      setNuevaCategoria("");
      setCategoriaSeleccionada("Todas");
      return;
    }

    try {
      const categoriaInsert = { nombre: nombreNormalizado };
      const { data, error } = await supabase
        .from("categorias")
        .insert([categoriaInsert])
        .select()
        .single();

      if (error) {
        console.warn("No se pudo crear la categoría en Supabase, se añadirá localmente:", error);
      }

      const categoriaCreada = data?.nombre || nombreNormalizado;
      setCategorias((prev) => {
        const yaExiste = prev.some((categoria) => String(categoria.nombre || "").toLowerCase() === categoriaCreada.toLowerCase());
        return yaExiste ? prev : [...prev, { id: data?.id ?? Date.now(), nombre: categoriaCreada }];
      });
      setCategoriaSeleccionada(categoriaCreada);
      setNuevaCategoria("");
    } catch (error) {
      console.error("Error creando categoría:", error);
      setCategorias((prev) => {
        const nombre = nombreNormalizado;
        const yaExiste = prev.some((categoria) => String(categoria.nombre || "").toLowerCase() === nombre.toLowerCase());
        return yaExiste ? prev : [...prev, { id: Date.now(), nombre }];
      });
      setCategoriaSeleccionada(nombreNormalizado);
      setNuevaCategoria("");
    }
  };

  const alternarCategoriaOculta = async (categoria) => {
    if (!categoria) return;

    const siguiente = categoriasOcultas.includes(categoria)
      ? categoriasOcultas.filter((item) => item !== categoria)
      : [...categoriasOcultas, categoria];

    await guardarCategoriasOcultas(siguiente);
  };

  const editarCategoria = async (categoriaNombre) => {
    if (!categoriaNombre) return;

    const categoriaActual = categorias.find((categoria) => categoria.nombre === categoriaNombre);
    if (!categoriaActual) return;

    const nuevoNombre = window.prompt("Editar nombre de la categoría", categoriaActual.nombre)?.trim();
    if (!nuevoNombre) return;

    const nombreNormalizado = nuevoNombre.replace(/\s+/g, " ").trim();
    if (!nombreNormalizado) return;

    const yaExiste = categorias.some(
      (categoria) =>
        categoria.id !== categoriaActual.id &&
        String(categoria.nombre || "").toLowerCase() === nombreNormalizado.toLowerCase()
    );

    if (yaExiste) {
      alert("Ya existe una categoría con ese nombre.");
      return;
    }

    try {
      const { error } = await supabase
        .from("categorias")
        .update({ nombre: nombreNormalizado })
        .eq("id", categoriaActual.id);

      if (error) {
        throw error;
      }

      setCategorias((prev) =>
        prev.map((categoria) =>
          categoria.id === categoriaActual.id ? { ...categoria, nombre: nombreNormalizado } : categoria
        )
      );

      setCategoriasOcultas((prev) =>
        prev.map((categoria) => (categoria === categoriaNombre ? nombreNormalizado : categoria))
      );

      if (categoriaSeleccionada === categoriaNombre) {
        setCategoriaSeleccionada(nombreNormalizado);
      }
    } catch (error) {
      console.error("Error editando categoría:", error);
      alert("No se pudo editar la categoría en Supabase.");
    }
  };

  const eliminarCategoria = async (categoriaNombre) => {
    if (!categoriaNombre) return;

    const categoriaActual = categorias.find((categoria) => categoria.nombre === categoriaNombre);
    if (!categoriaActual) return;

    const confirmado = window.confirm(`¿Estás seguro de eliminar la categoría "${categoriaActual.nombre}"?`);
    if (!confirmado) return;

    try {
      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", categoriaActual.id);

      if (error) {
        throw error;
      }

      const { error: errorProductos } = await supabase
        .from("productos")
        .update({ categoria_id: null })
        .eq("categoria_id", categoriaActual.id);

      if (errorProductos) {
        console.warn("Error limpiando productos afectados al borrar categoría:", errorProductos);
      }

      setCategorias((prev) => prev.filter((categoria) => categoria.id !== categoriaActual.id));
      setCategoriasOcultas((prev) => prev.filter((categoria) => categoria !== categoriaNombre));

      if (categoriaSeleccionada === categoriaNombre) {
        setCategoriaSeleccionada("Todas");
      }
    } catch (error) {
      console.error("Error eliminando categoría:", error);
      alert("No se pudo eliminar la categoría en Supabase.");
    }
  };

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

  const obtenerPrecioProducto = (producto, catalogo = tipoCatalogo) => {
    if (!producto) return null;

    let precioValor = null;

    if (catalogo === "Emprendedor") {
      precioValor = producto.precio_emprendedor;
    } else if (catalogo === "Mayorista") {
      precioValor = producto.precio_mayorista;
    } else {
      precioValor = producto.precio;
    }

    if (precioValor === null || precioValor === undefined || precioValor === "") {
      return null;
    }

    const numero = Number(precioValor);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  };

  const tienePrecioEnCatalogo = (producto, catalogo = tipoCatalogo) => {
    return obtenerPrecioProducto(producto, catalogo) != null;
  };

  const validarPrecioProducto = (datos) => {
    const precios = [
      datos?.precio,
      datos?.precio_emprendedor,
      datos?.precio_mayorista,
      datos?.precioEmprendedor,
      datos?.precioMayorista,
    ]
      .filter((valor) => valor !== null && valor !== undefined && valor !== "")
      .map((valor) => Number(valor));

    if (precios.length === 0) return false;
    return precios.some((valor) => Number.isFinite(valor) && valor >= 0);
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
    variantesTemp: [],
  });
  const [imagenesVista, setImagenesVista] = useState([]);
  const [bannerZoom, setBannerZoom] = useState(100);
  const [bannerPosicionX, setBannerPosicionX] = useState(50);
  const [bannerPosicionY, setBannerPosicionY] = useState(50);
  const [bannerEditorAbierto, setBannerEditorAbierto] = useState(false);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState("");
  const [bannerArchivoTemporal, setBannerArchivoTemporal] = useState(null);
  const [bannerBackgroundMode, setBannerBackgroundMode] = useState("transparent");
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState("#ffffff");
  const [bannerHandleDrag, setBannerHandleDrag] = useState(null);
  const [bannerAmpliadoMovil, setBannerAmpliadoMovil] = useState(false);
  const bannerPreviewRef = useRef(null);

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
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const bannerInputRef = useRef(null);
  const categoriasOcultasLista = useMemo(() => {
    return categoriasDisponibles.filter((categoria) => categoriasOcultas.includes(categoria));
  }, [categoriasDisponibles, categoriasOcultas]);

  const cargarCategoriasOcultas = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "categorias_ocultas")
        .maybeSingle();

      if (error && !String(error.message || "").toLowerCase().includes("does not exist")) {
        console.error("Error cargando categorías ocultas:", error);
      }

      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setCategoriasOcultas(Array.isArray(parsed) ? parsed : []);
          return;
        } catch (parseError) {
          console.warn("No se pudo parsear categorías ocultas desde Supabase:", parseError);
        }
      }
    } catch (error) {
      console.warn("No se pudo cargar categorías ocultas desde Supabase:", error);
    }

    if (typeof window !== "undefined") {
      try {
        const guardadas = window.localStorage.getItem("neosapp_categorias_ocultas");
        if (guardadas) {
          const parsed = JSON.parse(guardadas);
          setCategoriasOcultas(Array.isArray(parsed) ? parsed : []);
        }
      } catch (error) {
        console.error("Error leyendo categorías ocultas locales:", error);
      }
    }
  };

  const guardarCategoriasOcultas = async (lista) => {
    const valorFinal = Array.isArray(lista) ? lista : [];
    setCategoriasOcultas(valorFinal);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("neosapp_categorias_ocultas", JSON.stringify(valorFinal));
      } catch (error) {
        console.error("Error guardando categorías ocultas locales:", error);
      }
    }

    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "categorias_ocultas", value: JSON.stringify(valorFinal) }, { onConflict: "key" });

      if (error) {
        console.warn("No se pudo guardar categorías ocultas en Supabase:", error);
      }
    } catch (error) {
      console.warn("No se pudo guardar categorías ocultas en Supabase:", error);
    }
  };
  const [datosCliente, setDatosCliente] = useState({
    cedula: "",
    nombre: "",
    direccion: "",
    correoElectronico: "",
    numeroCelular: "",
    password: "",
    formaPago: FORMAS_PAGO[0],
  });

  const guardarConfiguracionBanner = (
    zoom = bannerZoom,
    posicionXValue = bannerPosicionX,
    posicionYValue = bannerPosicionY,
    modoFondo = bannerBackgroundMode,
    colorFondo = bannerBackgroundColor
  ) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "neosapp_banner_config",
          JSON.stringify({
            zoom,
            posicionX: posicionXValue,
            posicionY: posicionYValue,
            backgroundMode: modoFondo,
            backgroundColor: colorFondo,
          })
        );
      }
    } catch (error) {
      console.warn("No se pudo guardar la configuración del banner:", error);
    }
  };

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const configGuardada = window.localStorage.getItem("neosapp_banner_config");
      if (!configGuardada) return;

      const config = JSON.parse(configGuardada);
      if (Number.isFinite(Number(config.zoom))) {
        setBannerZoom(Number(config.zoom));
      }
      if (Number.isFinite(Number(config.posicionX))) {
        setBannerPosicionX(Number(config.posicionX));
      }
      if (Number.isFinite(Number(config.posicionY))) {
        setBannerPosicionY(Number(config.posicionY));
      }
      if (config.backgroundMode) {
        setBannerBackgroundMode(config.backgroundMode);
      }
      if (config.backgroundColor) {
        setBannerBackgroundColor(config.backgroundColor);
      }
    } catch (error) {
      console.warn("No se pudo cargar la configuración del banner:", error);
    }
  }, []);

  const abrirEditorBanner = () => {
    setBannerPreviewUrl(bannerUrl || brebImage);
    setBannerArchivoTemporal(null);
    setBannerEditorAbierto(true);
  };

  const cerrarEditorBanner = () => {
    setBannerArchivoTemporal(null);
    setBannerPreviewUrl("");
    setBannerEditorAbierto(false);
    setBannerHandleDrag(null);
  };

  const manejarCambioBanner = (event) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      alert("Solo puedes subir imágenes para el banner.");
      return;
    }

    const urlPrevia = URL.createObjectURL(archivo);
    setBannerArchivoTemporal(archivo);
    setBannerPreviewUrl(urlPrevia);
    setBannerEditorAbierto(true);
    event.target.value = "";
  };

  const moverBannerConFlecha = (direccion) => {
    if (esVistaMovil) {
      setBannerPosicionX(50);
      setBannerPosicionY(50);
      return;
    }

    const paso = 6;

    setBannerPosicionX((prev) => {
      if (direccion === "left") return Math.max(0, prev - paso);
      if (direccion === "right") return Math.min(100, prev + paso);
      return prev;
    });

    setBannerPosicionY((prev) => {
      if (direccion === "up") return Math.max(0, prev - paso);
      if (direccion === "down") return Math.min(100, prev + paso);
      return prev;
    });
  };

  const getBannerImageStyles = () => ({
    transform: esVistaMovil ? "scale(1)" : `scale(${bannerZoom / 100})`,
    transformOrigin: esVistaMovil ? "50% 50%" : `${bannerPosicionX}% ${bannerPosicionY}%`,
    objectPosition: esVistaMovil ? "50% 50%" : `${bannerPosicionX}% ${bannerPosicionY}%`,
    background: bannerBackgroundMode === "transparent" ? "transparent" : bannerBackgroundColor,
  });

  const abrirBannerMovil = () => {
    if (esVistaMovil) {
      setBannerAmpliadoMovil(true);
    }
  };

  const cerrarBannerMovil = () => {
    setBannerAmpliadoMovil(false);
  };

  const guardarBannerEditado = async () => {
    try {
      if (bannerArchivoTemporal) {
        await subirBanner(bannerArchivoTemporal);
      }
      guardarConfiguracionBanner();
      cerrarEditorBanner();
    } catch (error) {
      console.error("Error al guardar banner:", error);
      alert("No se pudo guardar el banner. Inténtalo de nuevo.");
    }
  };

  useEffect(() => {
    cargarCategoriasOcultas();
  }, []);

  useEffect(() => {
    if (categoriaSeleccionada !== "Todas" && categoriasOcultas.includes(categoriaSeleccionada)) {
      setCategoriaSeleccionada("Todas");
    }
  }, [categoriaSeleccionada, categoriasOcultas]);

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
  const [mostrarModalVarianteNuevo, setMostrarModalVarianteNuevo] = useState(false);
  const [varianteTemp, setVarianteTemp] = useState({ nombre: "", atributos: "", precio: "", precio_emprendedor: "", precio_mayorista: "", stock: "", imagenes: [] });
  const [mostrarModalVarianteEdit, setMostrarModalVarianteEdit] = useState(false);
  const [productoVarianteEditActivo, setProductoVarianteEditActivo] = useState(null);
  const [varianteEditTemp, setVarianteEditTemp] = useState({ nombre: "", atributos: "", precio: "", precio_emprendedor: "", precio_mayorista: "", stock: "", imagenes: [] });
  const [editarVarianteId, setEditarVarianteId] = useState(null);
  const [mostrarModalSeleccionarVariante, setMostrarModalSeleccionarVariante] = useState(false);
  const [variantesProducto, setVariantesProducto] = useState([]);

  const STORAGE_KEY = "neosapp_producto_state";

  const cargarEstadoPersistente = () => {
    if (typeof window === "undefined") return null;
    try {
      const data = window.localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Error cargando estado persistente:", error);
      return null;
    }
  };

  const guardarEstadoPersistente = (estado) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (error) {
      console.error("Error guardando estado persistente:", error);
    }
  };

  useEffect(() => {
    const estadoGuardado = cargarEstadoPersistente();
    if (!estadoGuardado) return;

    if (estadoGuardado.carrito) setCarrito(estadoGuardado.carrito);
    if (estadoGuardado.mostrarModalPedido) setMostrarModalPedido(estadoGuardado.mostrarModalPedido);
    if (estadoGuardado.busquedaProducto) setBusquedaProducto(estadoGuardado.busquedaProducto);
    if (estadoGuardado.categoriaSeleccionada) setCategoriaSeleccionada(estadoGuardado.categoriaSeleccionada);
    if (estadoGuardado.tipoCatalogo) setTipoCatalogo(estadoGuardado.tipoCatalogo);
    if (estadoGuardado.busquedaCliente) setBusquedaCliente(estadoGuardado.busquedaCliente);
    if (estadoGuardado.clienteSeleccionado) setClienteSeleccionado(estadoGuardado.clienteSeleccionado);
    if (estadoGuardado.mostrarListaClientes) setMostrarListaClientes(estadoGuardado.mostrarListaClientes);
    if (estadoGuardado.datosCliente) setDatosCliente(estadoGuardado.datosCliente);
    if (estadoGuardado.mostrarDetalles) setMostrarDetalles(estadoGuardado.mostrarDetalles);
    if (estadoGuardado.indiceCarrusel != null) setIndiceCarrusel(estadoGuardado.indiceCarrusel);
    if (estadoGuardado.cantidadDetalles != null) setCantidadDetalles(estadoGuardado.cantidadDetalles);
    if (estadoGuardado.mostrarModalStock) setMostrarModalStock(estadoGuardado.mostrarModalStock);
    if (estadoGuardado.productoSeleccionado) setProductoSeleccionado(estadoGuardado.productoSeleccionado);
    if (estadoGuardado.productoEdicion) setProductoEdicion(estadoGuardado.productoEdicion);
    if (estadoGuardado.mostrarModalVarianteNuevo) setMostrarModalVarianteNuevo(estadoGuardado.mostrarModalVarianteNuevo);
    if (estadoGuardado.varianteTemp) setVarianteTemp(estadoGuardado.varianteTemp);
    if (estadoGuardado.mostrarModalVarianteEdit) setMostrarModalVarianteEdit(estadoGuardado.mostrarModalVarianteEdit);
    if (estadoGuardado.productoVarianteEditActivo) setProductoVarianteEditActivo(estadoGuardado.productoVarianteEditActivo);
    if (estadoGuardado.varianteEditTemp) setVarianteEditTemp(estadoGuardado.varianteEditTemp);
    if (estadoGuardado.editarVarianteId) setEditarVarianteId(estadoGuardado.editarVarianteId);
    if (estadoGuardado.mostrarModalSeleccionarVariante) setMostrarModalSeleccionarVariante(estadoGuardado.mostrarModalSeleccionarVariante);
    if (estadoGuardado.variantesProducto) setVariantesProducto(estadoGuardado.variantesProducto);
    if (estadoGuardado.nuevo) setNuevo(estadoGuardado.nuevo);
    if (estadoGuardado.imagenesVista) setImagenesVista(estadoGuardado.imagenesVista);
  }, []);

  useEffect(() => {
    guardarEstadoPersistente({
      carrito,
      mostrarModalPedido,
      busquedaProducto,
      categoriaSeleccionada,
      tipoCatalogo,
      busquedaCliente,
      clienteSeleccionado,
      mostrarListaClientes,
      datosCliente,
      mostrarDetalles,
      indiceCarrusel,
      cantidadDetalles,
      mostrarModalStock,
      productoSeleccionado,
      productoEdicion,
      mostrarModalVarianteNuevo,
      varianteTemp,
      mostrarModalVarianteEdit,
      productoVarianteEditActivo,
      varianteEditTemp,
      editarVarianteId,
      mostrarModalSeleccionarVariante,
      variantesProducto,
      nuevo,
      imagenesVista,
    });
  }, [
    carrito,
    mostrarModalPedido,
    busquedaProducto,
    categoriaSeleccionada,
    tipoCatalogo,
    busquedaCliente,
    clienteSeleccionado,
    mostrarListaClientes,
    datosCliente,
    mostrarDetalles,
    indiceCarrusel,
    cantidadDetalles,
    mostrarModalStock,
    productoSeleccionado,
    productoEdicion,
    mostrarModalVarianteNuevo,
    varianteTemp,
    mostrarModalVarianteEdit,
    productoVarianteEditActivo,
    varianteEditTemp,
    editarVarianteId,
    mostrarModalSeleccionarVariante,
    variantesProducto,
    nuevo,
    imagenesVista,
  ]);

  const crearProductoHandler = async () => {
    if (!nuevo.nombre || !nuevo.stock || !validarPrecioProducto(nuevo)) {
      alert("Por favor completa nombre y stock");
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

    // Si se añadieron variantes temporales en la creación, persistirlas
    const nuevoProducto = resultado.producto;
    if (nuevo.variantesTemp && nuevo.variantesTemp.length > 0) {
      for (const v of nuevo.variantesTemp) {
        try {
          let atributosValue = null;
          if (v.atributos) {
            try {
              atributosValue = JSON.parse(v.atributos);
            } catch (parseError) {
              atributosValue = v.atributos;
            }
          }
          await supabase.from("producto_variantes").insert([{ producto_id: Number(nuevoProducto.id), nombre: v.nombre || null, atributos: atributosValue, precio: v.precio ? Number(v.precio) : null, precio_emprendedor: v.precio_emprendedor ? Number(v.precio_emprendedor) : null, precio_mayorista: v.precio_mayorista ? Number(v.precio_mayorista) : null, stock: v.stock ? Number(v.stock) : 0, imagenes: v.imagenes || null }]);
        } catch (err) {
          console.error("Error guardando variante temporal:", err);
        }
      }
    }

    setNuevo({ nombre: "", precio: "", precioEmprendedor: "", precioMayorista: "", categoria: CATEGORIAS_POR_DEFECTO[0], stock: "", descripcion: "", imagenes: [], variantesTemp: [] });
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

  const handleImagenVarianteTempSeleccionada = (e) => {
    const archivos = Array.from(e.target.files);
    const maxImagenes = 5;
    const actuales = varianteTemp.imagenes || [];

    if (archivos.length + actuales.length > maxImagenes) {
      alert(`Máximo ${maxImagenes} imágenes permitidas por variante`);
      return;
    }

    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imagenBase64 = event.target.result;
        setVarianteTemp((prev) => ({
          ...prev,
          imagenes: [...(prev.imagenes || []), imagenBase64],
        }));
      };
      reader.readAsDataURL(archivo);
    });
  };

  const eliminarImagenVarianteTemp = (index) => {
    setVarianteTemp((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== index),
    }));
  };

  const handleImagenVarianteEditSeleccionada = (e) => {
    const archivos = Array.from(e.target.files);
    const maxImagenes = 5;
    const actuales = varianteEditTemp.imagenes || [];

    if (archivos.length + actuales.length > maxImagenes) {
      alert(`Máximo ${maxImagenes} imágenes permitidas por variante`);
      return;
    }

    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imagenBase64 = event.target.result;
        setVarianteEditTemp((prev) => ({
          ...prev,
          imagenes: [...(prev.imagenes || []), imagenBase64],
        }));
      };
      reader.readAsDataURL(archivo);
    });
  };

  const eliminarImagenVarianteEdit = (index) => {
    setVarianteEditTemp((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== index),
    }));
  };

  const agregarVarianteTemp = () => {
    if (!varianteTemp.nombre) {
      alert("Ingrese al menos el nombre de la variante");
      return;
    }
    setNuevo((prev) => ({ ...prev, variantesTemp: [...(prev.variantesTemp || []), varianteTemp] }));
    setVarianteTemp({ nombre: "", atributos: "", precio: "", precio_emprendedor: "", precio_mayorista: "", stock: "", imagenes: [] });
    setMostrarModalVarianteNuevo(false);
  };

  const insertarVarianteEnProducto = async (productoId, variante) => {
    try {
      let atributosValue = null;
      if (variante.atributos) {
        try {
          atributosValue = JSON.parse(variante.atributos);
        } catch (parseError) {
          atributosValue = variante.atributos;
        }
      }
      const payload = {
        producto_id: Number(productoId),
        nombre: variante.nombre || null,
        atributos: atributosValue,
        precio: variante.precio ? Number(variante.precio) : null,
        precio_emprendedor: variante.precio_emprendedor ? Number(variante.precio_emprendedor) : null,
        precio_mayorista: variante.precio_mayorista ? Number(variante.precio_mayorista) : null,
        stock: variante.stock ? Number(variante.stock) : 0,
        imagenes: variante.imagenes || null,
      };
      const { data, error } = await supabase.from("producto_variantes").insert([payload]).select().single();
      if (error) throw error;
      return { success: true, variante: data };
    } catch (err) {
      console.error("Error insertando variante:", err);
      return { error: err.message || String(err) };
    }
  };

  const actualizarVarianteEnProducto = async (varianteId, variante) => {
    try {
      let atributosValue = null;
      if (variante.atributos) {
        try {
          atributosValue = JSON.parse(variante.atributos);
        } catch (parseError) {
          atributosValue = variante.atributos;
        }
      }
      const payload = {
        nombre: variante.nombre || null,
        atributos: atributosValue,
        precio: variante.precio ? Number(variante.precio) : null,
        precio_emprendedor: variante.precio_emprendedor ? Number(variante.precio_emprendedor) : null,
        precio_mayorista: variante.precio_mayorista ? Number(variante.precio_mayorista) : null,
        stock: variante.stock ? Number(variante.stock) : 0,
        imagenes: variante.imagenes || null,
      };
      const { data, error } = await supabase.from("producto_variantes").update(payload).eq("id", varianteId).select().single();
      if (error) throw error;
      return { success: true, variante: data };
    } catch (err) {
      console.error("Error actualizando variante:", err);
      return { error: err.message || String(err) };
    }
  };

  const cargarVariantesProducto = async (productoId) => {
    try {
      const { data, error } = await supabase.from("producto_variantes").select("*").eq("producto_id", Number(productoId));
      if (error) throw error;
      setVariantesProducto(data || []);
      return data || [];
    } catch (err) {
      console.error("Error cargando variantes:", err);
      setVariantesProducto([]);
      return [];
    }
  };

  const abrirEdicionVariante = (variante) => {
    setEditarVarianteId(variante.id);
    setProductoVarianteEditActivo(productoSeleccionado || productoDetalles);
    setVarianteEditTemp({
      nombre: variante.nombre || "",
      atributos: typeof variante.atributos === "object" ? JSON.stringify(variante.atributos) : variante.atributos || "",
      precio: variante.precio ?? "",
      precio_emprendedor: variante.precio_emprendedor ?? "",
      precio_mayorista: variante.precio_mayorista ?? "",
      stock: variante.stock ?? "",
      imagenes: Array.isArray(variante.imagenes) ? variante.imagenes : variante.imagenes ? [variante.imagenes] : [],
    });
    setMostrarModalVarianteEdit(true);
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
    if (!tienePrecioEnCatalogo(producto, tipoCatalogo)) {
      alert("Este producto no está disponible en este catálogo");
      return;
    }

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
    if (!productoEdicion.nombre || productoEdicion.stock === "" || !validarPrecioProducto(productoEdicion)) {
      alert("Por favor completa nombre y stock");
      return;
    }

    const resultado = await actualizarProducto(productoSeleccionado.id, {
      nombre: productoEdicion.nombre,
      precio: productoEdicion.precio,
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
    if (precioSeleccionado == null) {
      alert("Producto no disponible en este catalogo");
      return;
    }

    // Verificar si ya está en el carrito
    const productoEnCarrito = carrito.find((p) => p.id === producto.id);

    if (!productoEnCarrito) {
      // Agregar con cantidad 0 para que el usuario la especifique en el carrito
      setCarrito([...carrito, { ...producto, precio: precioSeleccionado, cantidad: 0 }]);

    }
  };

  const precioDisponibleEnCatalogo = (producto) => obtenerPrecioProducto(producto) != null;


  const obtenerCarritoKey = (item) =>
    item.variante?.id ? `${item.id}-${item.variante.id}` : `${item.id}-base`;

  const obtenerNombreCarrito = (item) => {
    if (!item.variante) return item.nombre;
    const varianteNombre = item.variante.nombre || item.variante.atributos || "Variante";
    return `${item.nombre} (${varianteNombre})`;
  };

  const eliminarDelCarrito = (itemKey) => {
    setCarrito(carrito.filter((p) => obtenerCarritoKey(p) !== itemKey));
  };

  const actualizarCantidad = (itemKey, cantidad) => {
    const item = carrito.find((p) => obtenerCarritoKey(p) === itemKey);
    if (!item) return;

    if (cantidad <= 0) {
      eliminarDelCarrito(itemKey);
      return;
    }

    const stockDisponible = item.variante?.stock ?? item.stock;
    if (cantidad > stockDisponible) return;

    setCarrito(
      carrito.map((p) =>
        obtenerCarritoKey(p) === itemKey ? { ...p, cantidad } : p
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
  let categoriasAMostrar = categoriasVisibles;

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

      {/* IMAGEN INFORMATIVA DEL BANNER */}
      <div
        className="info-image-container"
        style={{
          background: bannerBackgroundMode === "transparent" ? "transparent" : bannerBackgroundColor,
        }}
      >
        <img
          src={bannerPreviewUrl || bannerUrl || brebImage}
          alt="Banner principal de NEOS BELLEZA"
          onClick={abrirBannerMovil}
          style={{
            ...getBannerImageStyles(),
            cursor: esVistaMovil ? "pointer" : "default",
          }}
        />

        {esAdmin() && (
          <div className="banner-admin-controls">
            <button
              type="button"
              className="btn-primary btn-banner-editor"
              onClick={abrirEditorBanner}
            >
              ✏️ Editar banner
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={manejarCambioBanner}
            />
          </div>
        )}

        {esAdmin() && bannerEditorAbierto && (
          <div className="banner-editor-panel">
            <div className="banner-editor-header">
              <h4>Ajustar banner</h4>
            </div>

            <div
              ref={bannerPreviewRef}
              className="banner-editor-preview"
              style={{
                background: bannerBackgroundMode === "transparent" ? "transparent" : bannerBackgroundColor,
              }}
            >
              <div className="banner-crop-frame" />
              <div className="banner-crop-grid" />

              <img
                src={bannerPreviewUrl || bannerUrl || brebImage}
                alt="Vista previa del banner"
                style={getBannerImageStyles()}
              />
            </div>

            <div className="banner-editor-directions" aria-label="Mover imagen del banner">
              <button type="button" className="banner-direction-btn" onClick={() => moverBannerConFlecha("left")}>←</button>
              <button type="button" className="banner-direction-btn" onClick={() => moverBannerConFlecha("right")}>→</button>
              <button type="button" className="banner-direction-btn" onClick={() => moverBannerConFlecha("up")}>↑</button>
              <button type="button" className="banner-direction-btn" onClick={() => moverBannerConFlecha("down")}>↓</button>
            </div>

            <div className="banner-editor-controls">
              <label>
                Zoom: <strong>{bannerZoom}%</strong>
                <input
                  type="range"
                  min="10"
                  max="180"
                  step="5"
                  value={bannerZoom}
                  onChange={(e) => setBannerZoom(Number(e.target.value))}
                />
              </label>

              <label className="banner-bg-picker">
                Fondo del banner:
                <select
                  value={bannerBackgroundMode}
                  onChange={(e) => setBannerBackgroundMode(e.target.value)}
                >
                  <option value="transparent">Transparente</option>
                  <option value="color">Color sólido</option>
                </select>
              </label>

              {bannerBackgroundMode === "color" && (
                <label className="banner-color-picker">
                  Color de fondo:
                  <input
                    type="color"
                    value={bannerBackgroundColor}
                    onChange={(e) => setBannerBackgroundColor(e.target.value)}
                  />
                </label>
              )}

              <p className="banner-editor-hint">Ajusta el zoom y mueve la imagen con las flechas para dejarla alineada al banner real.</p>
            </div>

            <div className="banner-editor-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => bannerInputRef.current?.click()}
              >
                Cambiar foto
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={guardarBannerEditado}
              >
                Guardar
              </button>
              <button
                type="button"
                className="btn-secundario"
                onClick={cerrarEditorBanner}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

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

        <div className="filtro-categorias-wrapper">
          <div className="filtro-categorias">
            <button
              className={`categoria-btn ${categoriaSeleccionada === "Todas" ? "activa" : ""}`}
              onClick={() => setCategoriaSeleccionada("Todas")}
            >
              Todas
            </button>
            {categoriasVisibles.map((categoria) => (
              <div key={categoria} className="categoria-chip-container">
                <button
                  className={`categoria-btn ${categoriaSeleccionada === categoria ? "activa" : ""}`}
                  onClick={() => setCategoriaSeleccionada(categoria)}
                >
                  {categoria}
                </button>
                {esAdmin() && (
                  <div className="categoria-admin-actions">
                    <button
                      type="button"
                      className="categoria-action-btn"
                      onClick={() => editarCategoria(categoria)}
                      title="Editar categoría"
                      aria-label={`Editar categoría ${categoria}`}
                    >
                      <img src={editarIcon} alt="Editar categoría" />
                    </button>
                    <button
                      type="button"
                      className="categoria-action-btn danger"
                      onClick={() => eliminarCategoria(categoria)}
                      title="Eliminar categoría"
                      aria-label={`Eliminar categoría ${categoria}`}
                    >
                      <img src={eliminarIcon} alt="Eliminar categoría" />
                    </button>
                    <button
                      type="button"
                      className="categoria-hide-btn"
                      onClick={() => alternarCategoriaOculta(categoria)}
                      title="Ocultar categoría"
                      aria-label={`Ocultar categoría ${categoria}`}
                    >
                      <img src={ocultoIcon} alt="Ocultar categoría" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {esAdmin() && (
            <div className="categoria-admin-tools">
              <input
                type="text"
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                placeholder="Nueva categoría"
                className="categoria-input"
              />
              <button type="button" className="btn-primary btn-categoria-crear" onClick={crearCategoria}>
                + Crear
              </button>
            </div>
          )}

          {esAdmin() && categoriasOcultasLista.length > 0 && (
            <div className="categoria-ocultas-panel">
              <span className="categoria-ocultas-label">Ocultas:</span>
              <div className="categoria-ocultas-lista">
                {categoriasOcultasLista.map((categoria) => (
                  <button
                    key={categoria}
                    type="button"
                    className="categoria-oculta-btn"
                    onClick={() => alternarCategoriaOculta(categoria)}
                  >
                    {categoria} ↩
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {esVistaMovil && bannerAmpliadoMovil && (
        <div className="banner-mobile-zoom-overlay" onClick={cerrarBannerMovil}>
          <div className="banner-mobile-zoom-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="banner-mobile-zoom-close"
              onClick={cerrarBannerMovil}
              aria-label="Cerrar vista ampliada"
            >
              ×
            </button>
            <img
              src={bannerPreviewUrl || bannerUrl || brebImage}
              alt="Banner ampliado"
              style={{
                objectFit: "cover",
                objectPosition: "center center",
                width: "100%",
                height: "100%",
                borderRadius: "12px",
              }}
            />
          </div>
        </div>
      )}

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
                          {obtenerPrecioProducto(p) != null ? `$${Number(obtenerPrecioProducto(p)).toLocaleString()}` : "No disponible"}
                        </span>
                        {esAdmin() ? (
                          precioDisponibleEnCatalogo(p) && (
                            <span className={`producto-stock ${obtenerClaseStockAdmin(p.stock)}`}>
                              {obtenerTextoStockAdmin(p.stock)}
                            </span>
                          )
                        ) : (
                          precioDisponibleEnCatalogo(p) && obtenerTextoStockCliente(p.stock) && (
                            <span className={`producto-stock ${obtenerClaseStockCliente(p.stock)}`}>
                              {obtenerTextoStockCliente(p.stock)}
                            </span>
                          )
                        )}
                      </div>

                      <div className="producto-acciones">
                        <button
                          className="btn-agregar-carrito"
                          onClick={() => {
                            if (!precioDisponibleEnCatalogo(p)) {
                              alert("Producto no disponible en este catalogo");
                              return;
                            }
                            agregarAlCarrito(p);
                          }}
                          disabled={p.stock <= 0 || !precioDisponibleEnCatalogo(p)}
                        >
                          {precioDisponibleEnCatalogo(p) ? "Agregar" : "No disponible"}
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
                              onClick={async (e) => {
                                e.stopPropagation();
                                const confirmar = window.confirm("¿Eliminar este producto? Esta acción es irreversible.");
                                if (!confirmar) return;

                                const resultado = await eliminarProducto(p.id);
                                if (resultado.error) {
                                  alert(`Error eliminando producto: ${resultado.error}`);
                                  return;
                                }
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
                            {obtenerPrecioProducto(p) != null ? `$${Number(obtenerPrecioProducto(p)).toLocaleString()}` : "No disponible"}
                          </span>
                          {esAdmin() ? (
                            precioDisponibleEnCatalogo(p) && (
                              <span className={`producto-stock ${obtenerClaseStockAdmin(p.stock)}`}>
                                {obtenerTextoStockAdmin(p.stock)}
                              </span>
                            )
                          ) : (
                            precioDisponibleEnCatalogo(p) && obtenerTextoStockCliente(p.stock) && (
                              <span className={`producto-stock ${obtenerClaseStockCliente(p.stock)}`}>
                                {obtenerTextoStockCliente(p.stock)}
                              </span>
                            )
                          )}
                        </div>

                        <div className="producto-acciones">
                          <button
                            className="btn-agregar-carrito"
                            onClick={() => {
                              if (!precioDisponibleEnCatalogo(p)) {
                                alert("Producto no disponible en este catalogo");
                                return;
                              }
                              agregarAlCarrito(p);
                            }}
                            disabled={p.stock <= 0 || !precioDisponibleEnCatalogo(p)}
                          >
                            {precioDisponibleEnCatalogo(p) ? "Agregar" : "No disponible"}
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
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const confirmar = window.confirm("¿Eliminar este producto? Esta acción es irreversible.");
                                  if (!confirmar) return;

                                  const resultado = await eliminarProducto(p.id);
                                  if (resultado.error) {
                                    alert(`Error eliminando producto: ${resultado.error}`);
                                    return;
                                  }
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

            {/* Variantes temporales para nuevo producto */}
            <div className="seccion-variantes-nuevo">
              <button className="btn-primary" onClick={() => setMostrarModalVarianteNuevo(true)}>+ Añadir variante</button>
              {nuevo.variantesTemp && nuevo.variantesTemp.length > 0 && (
                <div className="lista-variantes-temp">
                  {nuevo.variantesTemp.map((v, i) => (
                    <div key={i} className="item-variante-temp">
                      <strong>{v.nombre}</strong> - {v.atributos || "Sin atributos"} - stock: {v.stock || 0}
                    </div>
                  ))}
                </div>
              )}

              {mostrarModalVarianteNuevo && (
                <div className="modal-mini-variant">
                  <h4>Nueva variante (temporal)</h4>
                  <input placeholder="Nombre" value={varianteTemp.nombre} onChange={(e) => setVarianteTemp({ ...varianteTemp, nombre: e.target.value })} />
                  <input placeholder='Atributos (ej: COLOR: ROJO, TALLA: M)' value={varianteTemp.atributos} onChange={(e) => setVarianteTemp({ ...varianteTemp, atributos: e.target.value })} />
                  <input type="number" placeholder="Precio" value={varianteTemp.precio} onChange={(e) => setVarianteTemp({ ...varianteTemp, precio: e.target.value })} />
                  <input type="number" placeholder="Precio emprendedor" value={varianteTemp.precio_emprendedor} onChange={(e) => setVarianteTemp({ ...varianteTemp, precio_emprendedor: e.target.value })} />
                  <input type="number" placeholder="Precio mayorista" value={varianteTemp.precio_mayorista} onChange={(e) => setVarianteTemp({ ...varianteTemp, precio_mayorista: e.target.value })} />
                  <input type="number" placeholder="Stock" value={varianteTemp.stock} onChange={(e) => setVarianteTemp({ ...varianteTemp, stock: e.target.value })} />
                  <div className="seccion-imagenes-variantes">
                    <label className="etiqueta-imagenes">Imágenes de la variante (máximo 5):</label>
                    <input type="file" multiple accept="image/*" onChange={handleImagenVarianteTempSeleccionada} />
                    {varianteTemp.imagenes?.length > 0 && (
                      <div className="previsualizacion-imagenes">
                        {varianteTemp.imagenes.map((imagen, index) => (
                          <div key={index} className="item-imagen-preview">
                            <img src={imagen} alt={`Preview variante ${index + 1}`} />
                            <button type="button" className="btn-eliminar-imagen" onClick={() => eliminarImagenVarianteTemp(index)} title="Eliminar imagen">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button className="btn-primary" onClick={agregarVarianteTemp}>Agregar variante</button>
                    <button className="btn-secundario" onClick={() => setMostrarModalVarianteNuevo(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => {
                setMostrarModal(false);
                setNuevo({ nombre: "", precio: "", precioEmprendedor: "", precioMayorista: "", categoria: CATEGORIAS_POR_DEFECTO[0], stock: "", descripcion: "", imagenes: [], variantesTemp: [] });
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
              rows="5"
              style={{ fontFamily: "inherit", resize: "vertical", minHeight: "120px" }}
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

            {/* Añadir variante al producto existente */}
            <div className="seccion-variantes-edit">
              <button
                className="btn-primary"
                onClick={() => {
                  setProductoVarianteEditActivo(productoSeleccionado);
                  setEditarVarianteId(null);
                  setVarianteEditTemp({ nombre: '', atributos: '', precio: '', precio_emprendedor: '', precio_mayorista: '', stock: '', imagenes: [] });
                  setMostrarModalVarianteEdit(true);
                }}
              >
                + Añadir variante
              </button>
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
                    precioDisponibleEnCatalogo(productoDetalles) && (
                      <div className={`stock-info ${obtenerClaseStockAdmin(productoDetalles.stock)}`}>
                        {obtenerTextoStockAdmin(productoDetalles.stock)}
                      </div>
                    )
                  ) : (
                    precioDisponibleEnCatalogo(productoDetalles) && obtenerTextoStockCliente(productoDetalles.stock) && (
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
                    className="btn-seleccionar-variante"
                    onClick={async () => {
                      await cargarVariantesProducto(productoDetalles.id);
                      setMostrarModalSeleccionarVariante(true);
                    }}
                    disabled={productoDetalles.stock <= 0}
                  >
                    Seleccionar variante
                  </button>

                  <button
                    className="btn-agregar-grande"
                    onClick={() => {
                      if (cantidadDetalles <= 0 || cantidadDetalles > productoDetalles.stock) {
                        alert("Cantidad inválida");
                        return;
                      }

                      const precioSeleccionado = obtenerPrecioProducto(productoDetalles);
                      if (precioSeleccionado == null) {
                        alert("Producto no disponible en este catalogo");
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
                            precio: precioSeleccionado,
                            cantidad: cantidadDetalles,
                          },
                        ]);
                      }

                      setMostrarDetalles(false);
                      setCantidadDetalles(1);
                    }}
                    disabled={productoDetalles.stock <= 0 || obtenerPrecioProducto(productoDetalles) == null}
                  >
                    🛒 Agregar al carrito
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarModalSeleccionarVariante && (
        <div className="modal-overlay" onClick={() => setMostrarModalSeleccionarVariante(false)}>
          <div className="modal modal-variante" onClick={(e) => e.stopPropagation()}>
            <h3>Seleccionar variante</h3>
            {variantesProducto.length === 0 ? (
              <p>No hay variantes disponibles para este producto</p>
            ) : (
              <div className="lista-variantes">
                {variantesProducto.map((v) => {
                  const precioVar = tipoCatalogo === "Emprendedor" && v.precio_emprendedor != null ? v.precio_emprendedor : tipoCatalogo === "Mayorista" && v.precio_mayorista != null ? v.precio_mayorista : v.precio != null ? v.precio : obtenerPrecioProducto(productoDetalles);
                  return (
                    <div key={v.id} className="variante-item">
                      <div className="variante-meta">
                        <div className="variante-preview">
                          {Array.isArray(v.imagenes) && v.imagenes.length > 0 ? (
                            <img src={v.imagenes[0]} alt={v.nombre || "Variante"} />
                          ) : (
                            <div className="imagen-mini-placeholder">No imagen</div>
                          )}
                        </div>
                        <div className="variante-detalles">
                          <strong>{v.nombre || "Variante"}</strong>
                          <span>{v.atributos || "Sin atributos"}</span>
                          <span>Stock: {v.stock}</span>
                          <span>Precio: ${Number(precioVar).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="variante-actions">
                        <button
                          className="btn-secundario btn-icon"
                          onClick={() => abrirEdicionVariante(v)}
                        >
                          ✎ Editar
                        </button>
                        <button
                          className="btn-primary"
                          disabled={precioVar == null || precioVar <= 0}
                          onClick={() => {
                            const precioSel = precioVar;
                            if (precioSel == null || precioSel <= 0) {
                              alert("Producto no disponible en este catalogo");
                              return;
                            }

                            const productoEnCarrito = carrito.find((p) => p.id === productoDetalles.id && p.variante?.id === v.id);
                            if (productoEnCarrito) {
                              const nuevaCantidad = productoEnCarrito.cantidad + 1;
                              if (nuevaCantidad > v.stock) {
                                alert("No hay suficiente stock");
                                return;
                              }
                              setCarrito(
                                carrito.map((p) =>
                                  p.id === productoDetalles.id && p.variante?.id === v.id
                                    ? { ...p, cantidad: nuevaCantidad }
                                    : p
                                )
                              );
                            } else {
                              setCarrito([
                                ...carrito,
                                {
                                  ...productoDetalles,
                                  precio: precioSel,
                                  cantidad: 1,
                                  variante: v,
                                },
                              ]);
                            }

                            setMostrarModalSeleccionarVariante(false);
                          }}
                        >
                          Agregar variante
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secundario" onClick={() => setMostrarModalSeleccionarVariante(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalVarianteEdit && productoVarianteEditActivo && (
        <div className="modal-overlay" onClick={() => {
          setMostrarModalVarianteEdit(false);
          setEditarVarianteId(null);
          setProductoVarianteEditActivo(null);
        }}>
          <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
            <h3>{editarVarianteId ? "Editar variante" : "Nueva variante"}</h3>
            <p style={{ marginBottom: "14px", color: "#4b5563" }}><strong>Producto:</strong> {productoVarianteEditActivo.nombre}</p>
            <input placeholder="Nombre" value={varianteEditTemp.nombre} onChange={(e) => setVarianteEditTemp({ ...varianteEditTemp, nombre: e.target.value })} />
            <input placeholder='Atributos (ej: COLOR: ROJO, TALLA: M)' value={varianteEditTemp.atributos} onChange={(e) => setVarianteEditTemp({ ...varianteEditTemp, atributos: e.target.value })} />
            <input type="number" placeholder="Precio" value={varianteEditTemp.precio} onChange={(e) => setVarianteEditTemp({ ...varianteEditTemp, precio: e.target.value })} />
            <input type="number" placeholder="Precio emprendedor" value={varianteEditTemp.precio_emprendedor} onChange={(e) => setVarianteEditTemp({ ...varianteEditTemp, precio_emprendedor: e.target.value })} />
            <input type="number" placeholder="Precio mayorista" value={varianteEditTemp.precio_mayorista} onChange={(e) => setVarianteEditTemp({ ...varianteEditTemp, precio_mayorista: e.target.value })} />
            <input type="number" placeholder="Stock" value={varianteEditTemp.stock} onChange={(e) => setVarianteEditTemp({ ...varianteEditTemp, stock: e.target.value })} />
            <div className="seccion-imagenes-variantes">
              <label className="etiqueta-imagenes">Imágenes de la variante (máximo 5):</label>
              <input type="file" multiple accept="image/*" onChange={handleImagenVarianteEditSeleccionada} />
              {varianteEditTemp.imagenes?.length > 0 && (
                <div className="previsualizacion-imagenes">
                  {varianteEditTemp.imagenes.map((imagen, index) => (
                    <div key={index} className="item-imagen-preview">
                      <img src={imagen} alt={`Preview variante ${index + 1}`} />
                      <button type="button" className="btn-eliminar-imagen" onClick={() => eliminarImagenVarianteEdit(index)} title="Eliminar imagen">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={async () => {
                  const productoId = productoVarianteEditActivo.id;
                  if (editarVarianteId) {
                    const res = await actualizarVarianteEnProducto(editarVarianteId, varianteEditTemp);
                    if (res.error) {
                      alert(`Error: ${res.error}`);
                      return;
                    }
                    alert('✅ Variante actualizada');
                  } else {
                    const res = await insertarVarianteEnProducto(productoId, varianteEditTemp);
                    if (res.error) {
                      alert(`Error: ${res.error}`);
                      return;
                    }
                    alert('✅ Variante agregada');
                  }
                  setMostrarModalVarianteEdit(false);
                  setEditarVarianteId(null);
                  setProductoVarianteEditActivo(null);
                  setVarianteEditTemp({ nombre: '', atributos: '', precio: '', precio_emprendedor: '', precio_mayorista: '', stock: '', imagenes: [] });
                  await cargarVariantesProducto(productoId);
                }}
              >
                {editarVarianteId ? "Guardar cambios" : "Agregar variante"}
              </button>
              <button className="btn-secundario" onClick={() => {
                setMostrarModalVarianteEdit(false);
                setEditarVarianteId(null);
                setProductoVarianteEditActivo(null);
              }}>
                Cancelar
              </button>
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
                {carrito.map((item) => {
                  const itemKey = obtenerCarritoKey(item);
                  return (
                    <div key={itemKey} className="carrito-item">
                      <div>
                        <p><strong>{obtenerNombreCarrito(item)}</strong></p>
                        <p>${item.precio.toLocaleString()}</p>
                      </div>
                      <div className="cantidad-control">
                        <button
                          onClick={() =>
                            actualizarCantidad(itemKey, item.cantidad - 1)
                          }
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarCantidad(itemKey, Number(e.target.value))
                          }
                        />
                        <button
                          onClick={() =>
                            actualizarCantidad(itemKey, item.cantidad + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                      <p><strong>${(item.precio * item.cantidad).toLocaleString()}</strong></p>
                      <button
                        className="btn-delete-small"
                        onClick={() => eliminarDelCarrito(itemKey)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
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

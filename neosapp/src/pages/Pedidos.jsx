import { useState, useEffect, useRef } from "react";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../context/supabaseClient";
import { descargarRemisionPedido } from "../utils/remisionPdf";
import PedidoObservacion from "../components/PedidoObservacion";
import { obtenerClavePrealistamiento, obtenerResumenPrealistamiento, pedidoEstaConfirmado } from "../utils/pedidos";
import HistorialPedidos from "./HistorialPedidos";
import PedidosTabla from "./PedidosTabla";
import "../styles/pedidos.css";

const REMISION_CONFIG_KEY = "remision_config";
const REMISION_CONFIG_DEFAULT = {
  logoUrl: "/favicon.ico",
  encabezado: "Remisión de pedido",
  pieTexto: "NEOS BELLEZA · Cualquier duda, comunícate con nosotros:",
  pieTelefono: "3001234567",
};

const obtenerNombreVariante = (variante) => {
  if (variante?.nombre) return variante.nombre;
  if (typeof variante?.atributos === "string") return variante.atributos;
  if (variante?.atributos && typeof variante.atributos === "object") {
    return Object.entries(variante.atributos)
      .map(([nombre, valor]) => `${nombre}: ${Array.isArray(valor) ? valor.join(", ") : String(valor)}`)
      .join(" · ");
  }
  return "Variante";
};

const obtenerPrecioCatalogo = (producto, variante, catalogo) => {
  const campoPrecio = catalogo === "Emprendedor"
    ? "precio_emprendedor"
    : catalogo === "Mayorista"
      ? "precio_mayorista"
      : catalogo === "General"
        ? "precio"
        : null;
  if (!campoPrecio) return null;
  const valor = variante?.[campoPrecio] ?? producto?.[campoPrecio];
  if (valor == null || valor === "") return null;
  const precio = Number(valor);
  return Number.isFinite(precio) && precio >= 0 ? precio : null;
};

export default function Pedidos({ vista = "pedidos" }) {
  const { 
    pedidos, 
    repartidores, 
    productos,
    categorias,
    cambiarEstadoPedido, 
    eliminarPedido,
    asignarRepartidor,
    agregarItemPedido,
    actualizarItemsPedido,
    actualizarPrealistamientoPedido,
    actualizarObservacionPedido,
    eliminarItemPedido,
    actualizarCantidadItemPedido,
    actualizarFechaPedido,
    actualizarFormaPagoPedido,
  } = useStore();
  const { esAdmin, esVendedor } = useAuth();
  const esVistaHistorico = vista === "historico";

  const [pedidoExpandido, setPedidoExpandido] = useState(null);
  const [pedidoTemp, setPedidoTemp] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [modalPedido, setModalPedido] = useState(null);
  const [pedidoPrealistar, setPedidoPrealistar] = useState(null);
  const [pedidoAnularConfirmacion, setPedidoAnularConfirmacion] = useState(null);
  const [guardandoAnulacionConfirmacion, setGuardandoAnulacionConfirmacion] = useState(false);
  const [errorAnulacionConfirmacion, setErrorAnulacionConfirmacion] = useState("");
  const [cantidadesPrealistadas, setCantidadesPrealistadas] = useState({});
  const [sliderPrealistamiento, setSliderPrealistamiento] = useState(0);
  const [mostrarAdvertenciaPrealistamiento, setMostrarAdvertenciaPrealistamiento] = useState(false);
  const [guardandoPrealistamiento, setGuardandoPrealistamiento] = useState(false);
  const [errorPrealistamiento, setErrorPrealistamiento] = useState("");
  const colaGuardadoPrealistamiento = useRef(Promise.resolve());
  const guardadosPendientesPrealistamiento = useRef(0);
  const cantidadesPrealistadasRef = useRef({});
  const [pedidoAsignarRepartidor, setPedidoAsignarRepartidor] = useState(null);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");
  const [guardandoAsignacionRepartidor, setGuardandoAsignacionRepartidor] = useState(false);
  const [errorAsignacionRepartidor, setErrorAsignacionRepartidor] = useState("");
  const [mostrarSelectorProductos, setMostrarSelectorProductos] = useState(false);
  const [busquedaProductosPedido, setBusquedaProductosPedido] = useState("");
  const [categoriaProductosPedido, setCategoriaProductosPedido] = useState("");
  const [variantesProductosPedido, setVariantesProductosPedido] = useState([]);
  const [cargandoVariantesPedido, setCargandoVariantesPedido] = useState(false);
  const [errorVariantesPedido, setErrorVariantesPedido] = useState("");
  const [errorCatalogoPedido, setErrorCatalogoPedido] = useState("");
  const [imagenModal, setImagenModal] = useState(null);
  const [mostrarMenuRemision, setMostrarMenuRemision] = useState(false);
  const [mostrarEditorRemision, setMostrarEditorRemision] = useState(false);
  const [configRemision, setConfigRemision] = useState(REMISION_CONFIG_DEFAULT);
  const [configRemisionTemporal, setConfigRemisionTemporal] = useState(REMISION_CONFIG_DEFAULT);
  const [logoRemisionFile, setLogoRemisionFile] = useState(null);
  const [logoRemisionPreview, setLogoRemisionPreview] = useState("");
  const [guardandoConfigRemision, setGuardandoConfigRemision] = useState(false);
  const [errorConfigRemision, setErrorConfigRemision] = useState("");

  useEffect(() => {
    if (imagenModal) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [imagenModal]);

  useEffect(() => {
    let activo = true;
    const cargarConfiguracionRemision = async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", REMISION_CONFIG_KEY)
          .maybeSingle();
        if (error) throw error;
        if (!data?.value || !activo) return;
        const valor = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        if (valor && typeof valor === "object") {
          setConfigRemision({ ...REMISION_CONFIG_DEFAULT, ...valor });
          setConfigRemisionTemporal({ ...REMISION_CONFIG_DEFAULT, ...valor });
        }
      } catch (error) {
        console.warn("No se pudo cargar la configuración de remisión:", error);
      }
    };
    cargarConfiguracionRemision();
    return () => { activo = false; };
  }, []);

  const obtenerNombreRepartidor = (repartidorId) => {
    if (!repartidorId) return "No asignado";
    
    // Si es un UUID o número, buscar en la lista de repartidores
    const repartidor = repartidores.find((r) => String(r.id) === String(repartidorId));
    if (repartidor) return repartidor.nombre;
    
    // Si no encuentra por ID, asumir que ya es el nombre (guardado como string)
    return String(repartidorId);
  };

  const manejarCambioRepartidor = async (pedidoId, repartidorId) => {
    const valor = repartidorId && repartidorId !== "" ? repartidorId : null;
    const resultado = await asignarRepartidor(pedidoId, valor);
    if (resultado && modalPedido && modalPedido.id === pedidoId) {
      // Actualizar el modal local también
      setModalPedido((prev) => prev ? { ...prev, repartidor_id: valor } : null);
    }
    return resultado;
  };

  const abrirAsignacionRepartidor = (pedido) => {
    const actual = repartidores.find((repartidor) =>
      String(repartidor.id) === String(pedido.repartidor_id) ||
      repartidor.nombre === pedido.repartidor_id
    );
    setPedidoAsignarRepartidor(pedido);
    setRepartidorSeleccionado(actual ? String(actual.id) : "");
    setErrorAsignacionRepartidor("");
  };

  const cerrarAsignacionRepartidor = () => {
    if (guardandoAsignacionRepartidor) return;
    setPedidoAsignarRepartidor(null);
    setRepartidorSeleccionado("");
    setErrorAsignacionRepartidor("");
  };

  const guardarAsignacionRepartidor = async (event) => {
    event.preventDefault();
    if (!repartidorSeleccionado) {
      setErrorAsignacionRepartidor("Selecciona un repartidor para continuar.");
      return;
    }

    setGuardandoAsignacionRepartidor(true);
    setErrorAsignacionRepartidor("");
    try {
      const resultado = await manejarCambioRepartidor(pedidoAsignarRepartidor.id, repartidorSeleccionado);
      if (!resultado) {
        setErrorAsignacionRepartidor("No se pudo asignar el repartidor. Inténtalo de nuevo.");
        return;
      }
      setPedidoAsignarRepartidor(null);
      setRepartidorSeleccionado("");
    } catch (error) {
      setErrorAsignacionRepartidor(error.message || "Ocurrió un error al asignar el repartidor.");
    } finally {
      setGuardandoAsignacionRepartidor(false);
    }
  };

  const confirmarEliminarPedido = async (pedido) => {
    const confirmar = window.confirm(
      `¿Estás seguro de eliminar el pedido #${pedido.id} de ${pedido.cliente}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      const eliminado = await eliminarPedido(pedido.id);
      if (!eliminado) {
        window.alert("No se pudo eliminar el pedido. Inténtalo de nuevo.");
        return;
      }
      if (String(modalPedido?.id) === String(pedido.id)) {
        setModalPedido(null);
        setPedidoExpandido(null);
        setPedidoTemp({});
      }
    } catch (error) {
      console.error("Error eliminando pedido:", error);
      window.alert("Ocurrió un error al eliminar el pedido. Inténtalo de nuevo.");
    }
  };

  const formatFechaDisplay = (fechaIso) => {
    if (!fechaIso) return "";
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return fechaIso;
    return fecha.toLocaleDateString("es-CO");
  };

  const manejarCambioFechaEntrega = async (pedidoId, fechaEntrega) => {
    const success = await actualizarFechaPedido(pedidoId, fechaEntrega);
    if (!success) return;

    const fechaFormateada = formatFechaDisplay(fechaEntrega);
    if (modalPedido && modalPedido.id === pedidoId) {
      setModalPedido((prev) =>
        prev ? { ...prev, fechaEntrega, fecha: fechaFormateada } : null
      );
    }
    if (pedidoExpandido === pedidoId) {
      setPedidoTemp((prev) =>
        prev ? { ...prev, fechaEntrega, fecha: fechaFormateada } : prev
      );
    }
  };

  const manejarCambioFormaPago = async (pedidoId, formaPago) => {
    const success = await actualizarFormaPagoPedido(pedidoId, formaPago);
    if (!success) return;

    setModalPedido((prev) =>
      prev?.id === pedidoId ? { ...prev, formaPago } : prev
    );
    setPedidoTemp((prev) =>
      prev?.id === pedidoId ? { ...prev, formaPago } : prev
    );
  };

  const handleDescargarRemision = (pedido) => {
    const pedidoPdf = {
      ...pedido,
      cliente: pedido.cliente || "Cliente sin nombre",
      direccion: pedido.direccion || "Sin dirección registrada",
      telefono: pedido.telefono || pedido.celular || pedido.clienteTelefono || pedido.cliente?.telefono || "3001234567",
      contactoTelefono: pedido.contactoTelefono || pedido.telefono || pedido.celular || "3001234567",
      estado: pedido.estado || "Pendiente",
      items: pedido.items ?? pedido.detalles ?? [],
      productos,
      configRemision,
    };

    descargarRemisionPedido(pedidoPdf);
  };

  const abrirEditorRemision = () => {
    setConfigRemisionTemporal({ ...configRemision });
    setLogoRemisionFile(null);
    setLogoRemisionPreview("");
    setErrorConfigRemision("");
    setMostrarMenuRemision(false);
    setMostrarEditorRemision(true);
  };

  const seleccionarLogoRemision = (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setErrorConfigRemision("Selecciona un archivo de imagen.");
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorConfigRemision("El logo debe pesar menos de 2 MB.");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setLogoRemisionFile(archivo);
      setLogoRemisionPreview(String(lector.result || ""));
      setErrorConfigRemision("");
    };
    lector.onerror = () => setErrorConfigRemision("No se pudo leer el archivo del logo.");
    lector.readAsDataURL(archivo);
  };

  const guardarConfiguracionRemision = async (event) => {
    event.preventDefault();
    setGuardandoConfigRemision(true);
    setErrorConfigRemision("");
    try {
      let logoUrl = configRemisionTemporal.logoUrl || "/favicon.ico";
      if (logoRemisionFile) {
        const extension = logoRemisionFile.name.split(".").pop()?.toLowerCase() || "png";
        const rutaLogo = `remisiones/logo-${Date.now()}.${extension}`;
        const { data: archivoSubido, error: errorSubida } = await supabase.storage
          .from("banners")
          .upload(rutaLogo, logoRemisionFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: logoRemisionFile.type,
          });
        if (errorSubida) throw errorSubida;
        logoUrl = supabase.storage.from("banners").getPublicUrl(archivoSubido.path).data.publicUrl;
      }

      const configuracion = {
        ...configRemisionTemporal,
        logoUrl,
        encabezado: configRemisionTemporal.encabezado.trim() || REMISION_CONFIG_DEFAULT.encabezado,
        pieTexto: configRemisionTemporal.pieTexto.trim() || REMISION_CONFIG_DEFAULT.pieTexto,
        pieTelefono: configRemisionTemporal.pieTelefono.trim(),
      };
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: REMISION_CONFIG_KEY, value: JSON.stringify(configuracion) }, { onConflict: "key" });
      if (error) throw error;

      setConfigRemision(configuracion);
      setConfigRemisionTemporal(configuracion);
      setMostrarEditorRemision(false);
      setLogoRemisionFile(null);
      setLogoRemisionPreview("");
    } catch (error) {
      setErrorConfigRemision(error.message || "No se pudo guardar la configuración de remisión.");
    } finally {
      setGuardandoConfigRemision(false);
    }
  };

  const abrirEdicion = (pedido) => {
    if (pedidoEstaConfirmado(pedido)) return;
    const catalogos = new Set((pedido.items || []).map((item) => item.tipo_catalogo || "General"));
    setPedidoExpandido(pedido.id);
    setPedidoTemp({ ...pedido, tipo_catalogo: catalogos.size <= 1 ? [...catalogos][0] || "General" : "" });
    setErrorCatalogoPedido("");
  };

  const cerrarEdicion = () => {
    setPedidoExpandido(null);
    setPedidoTemp({});
  };

  const abrirPrealistamiento = (pedido) => {
    setPedidoPrealistar(pedido);
    const cantidadesGuardadas = { ...(pedido.pre_alistamiento?.cantidades || {}) };
    cantidadesPrealistadasRef.current = cantidadesGuardadas;
    setCantidadesPrealistadas(cantidadesGuardadas);
    setSliderPrealistamiento(0);
    setMostrarAdvertenciaPrealistamiento(false);
    setErrorPrealistamiento("");
  };

  const abrirAnulacionConfirmacion = (pedido) => {
    setPedidoAnularConfirmacion(pedido);
    setErrorAnulacionConfirmacion("");
  };

  const cerrarPrealistamiento = () => {
    if (guardandoPrealistamiento) return;
    setPedidoPrealistar(null);
    setMostrarAdvertenciaPrealistamiento(false);
    setSliderPrealistamiento(0);
    setErrorPrealistamiento("");
  };

  const guardarPrealistamiento = async (pedidoId, datos, estado = null) => {
    guardadosPendientesPrealistamiento.current += 1;
    setGuardandoPrealistamiento(true);
    setErrorPrealistamiento("");
    const guardado = colaGuardadoPrealistamiento.current
      .catch(() => false)
      .then(() => actualizarPrealistamientoPedido(pedidoId, datos, estado));
    colaGuardadoPrealistamiento.current = guardado;
    try {
      const resultado = await guardado;
      if (!resultado?.success) {
        setErrorPrealistamiento(`No se pudo guardar el avance${resultado?.message ? `: ${resultado.message}` : ". Revisa la conexión e inténtalo de nuevo."}`);
      }
      return Boolean(resultado?.success);
    } finally {
      guardadosPendientesPrealistamiento.current -= 1;
      if (guardadosPendientesPrealistamiento.current === 0) {
        setGuardandoPrealistamiento(false);
      }
    }
  };

  const cambiarCantidadPrealistada = (item, index, valor) => {
    const clave = obtenerClavePrealistamiento(item, index);
    const cantidad = Math.min(Number(item.cantidad || 0), Math.max(0, Math.floor(Number(valor) || 0)));
    const nuevasCantidades = { ...cantidadesPrealistadasRef.current, [clave]: cantidad };
    cantidadesPrealistadasRef.current = nuevasCantidades;
    setCantidadesPrealistadas(nuevasCantidades);
    setPedidoPrealistar((actual) => actual ? {
      ...actual,
      pre_alistamiento: { ...(actual.pre_alistamiento || {}), cantidades: nuevasCantidades, confirmado: false },
    } : actual);
    // Persist each change immediately. The save queue serializes rapid edits so
    // the last quantity entered is always the final value written to Supabase.
    void guardarPrealistamiento(pedidoPrealistar.id, {
      cantidades: nuevasCantidades,
      confirmado: false,
    });
  };

  const confirmarPrealistamiento = async () => {
    if (!pedidoPrealistar || guardandoPrealistamiento) return;
    try {
      const ultimoGuardado = await colaGuardadoPrealistamiento.current;
      if (ultimoGuardado?.success === false || ultimoGuardado === false) {
        setErrorPrealistamiento("Espera a que se guarden las cantidades antes de confirmar.");
        return;
      }
    } catch {
      setErrorPrealistamiento("No se pudo guardar el avance. Inténtalo de nuevo antes de confirmar.");
      return;
    }
    const datosConfirmados = {
      cantidades: cantidadesPrealistadasRef.current,
      confirmado: true,
      confirmado_en: new Date().toISOString(),
      estado_anterior: pedidoPrealistar.estado !== "Confirmado"
        ? pedidoPrealistar.estado || "Pendiente"
        : pedidoPrealistar.pre_alistamiento?.estado_anterior || "Pendiente",
    };
    const correcto = await guardarPrealistamiento(pedidoPrealistar.id, datosConfirmados, "Confirmado");
    if (correcto) {
      setPedidoPrealistar((actual) => actual ? { ...actual, estado: "Confirmado", pre_alistamiento: datosConfirmados } : actual);
      setModalPedido((actual) => actual?.id === pedidoPrealistar.id
        ? { ...actual, estado: "Confirmado", pre_alistamiento: datosConfirmados }
        : actual);
      setPedidoTemp((actual) => actual?.id === pedidoPrealistar.id
        ? { ...actual, estado: "Confirmado", pre_alistamiento: datosConfirmados }
        : actual);
      setMostrarAdvertenciaPrealistamiento(false);
      setSliderPrealistamiento(0);
    }
  };

  const confirmarAnulacionConfirmacion = async () => {
    if (!pedidoAnularConfirmacion || guardandoAnulacionConfirmacion) return;
    setGuardandoAnulacionConfirmacion(true);
    setErrorAnulacionConfirmacion("");
    const preAlistamiento = {
      ...(pedidoAnularConfirmacion.pre_alistamiento || {}),
      confirmado: false,
      confirmado_en: null,
    };
    const estadoAnterior = preAlistamiento.estado_anterior || "Pendiente";
    const resultado = await actualizarPrealistamientoPedido(
      pedidoAnularConfirmacion.id,
      preAlistamiento,
      estadoAnterior
    );
    if (resultado?.success) {
      setModalPedido((actual) => actual?.id === pedidoAnularConfirmacion.id
        ? { ...actual, estado: estadoAnterior, pre_alistamiento: preAlistamiento }
        : actual);
      setPedidoTemp((actual) => actual?.id === pedidoAnularConfirmacion.id
        ? { ...actual, estado: estadoAnterior, pre_alistamiento: preAlistamiento }
        : actual);
      setPedidoAnularConfirmacion(null);
    } else {
      setErrorAnulacionConfirmacion(`No se pudo anular la confirmación${resultado?.message ? `: ${resultado.message}` : ". Inténtalo de nuevo."}`);
    }
    setGuardandoAnulacionConfirmacion(false);
  };

  const solicitarConfirmacionPrealistamiento = async () => {
    if (!pedidoPrealistar || guardandoPrealistamiento) return;
    const resumen = obtenerResumenPrealistamiento({
      ...pedidoPrealistar,
      pre_alistamiento: { cantidades: cantidadesPrealistadasRef.current, confirmado: false },
    });
    setSliderPrealistamiento(0);
    if (resumen.faltantes > 0) {
      setMostrarAdvertenciaPrealistamiento(true);
      return;
    }
    await confirmarPrealistamiento();
  };

  const actualizarItemsLocal = (items) => {
    const nuevoTotal = items.reduce(
      (sum, item) => sum + Number(item.precio) * Number(item.cantidad || 1),
      0
    );

    setPedidoTemp((prev) =>
      prev && prev.id
        ? { ...prev, items, total: nuevoTotal }
        : prev
    );

    setModalPedido((prev) =>
      prev && prev.id
        ? { ...prev, items, total: nuevoTotal }
        : prev
    );
  };

  const handleAgregarItem = async (pedidoId, productoId, variante = null) => {
    const producto = productos.find((p) => String(p.id) === String(productoId));
    if (!producto) return false;
    const tipoCatalogo = pedidoTemp.tipo_catalogo;
    if (!tipoCatalogo) {
      setErrorCatalogoPedido("Selecciona un catálogo para unificar los productos del pedido.");
      return false;
    }

    const etiquetaVariante = variante ? obtenerNombreVariante(variante) : "";
    const nombre = etiquetaVariante ? `${producto.nombre} - ${etiquetaVariante}` : producto.nombre;
    const precio = obtenerPrecioCatalogo(producto, variante, tipoCatalogo);
    if (precio == null) {
      setErrorCatalogoPedido(`El producto no tiene precio disponible en el catálogo ${tipoCatalogo}.`);
      return false;
    }
    const imagen = variante?.imagenes?.[0] || variante?.imagen || variante?.imagen_url || variante?.image
      || producto.imagenes?.[0] || producto.imagen || producto.imagen_url || producto.image || "";
    const itemId = variante?.id ?? producto.id;
    const success = await agregarItemPedido(pedidoId, itemId, nombre, precio, 1, {
      producto_id: producto.id,
      variante,
      tipo_catalogo: tipoCatalogo,
      imagen,
    });
    if (!success) return false;

    const nuevosItems = [
      ...(pedidoTemp.items || []),
      { id: itemId, producto_id: producto.id, nombre, precio, cantidad: 1, variante: variante || null, tipo_catalogo: tipoCatalogo, imagen },
    ];
    actualizarItemsLocal(nuevosItems);
    setErrorCatalogoPedido("");
    return true;
  };

  const handleCambiarCatalogoPedido = async (tipoCatalogo) => {
    const items = pedidoTemp.items || [];
    const itemsRepreciados = items.map((item) => {
      const productoId = item.producto_id ?? item.variante?.producto_id ?? item.id;
      const producto = productos.find((actual) => String(actual.id) === String(productoId));
      const precio = obtenerPrecioCatalogo(producto, item.variante, tipoCatalogo);
      return precio == null ? null : { ...item, precio, tipo_catalogo: tipoCatalogo };
    });
    const indiceSinPrecio = itemsRepreciados.findIndex((item) => item === null);
    if (indiceSinPrecio >= 0) {
      setErrorCatalogoPedido(`No se puede cambiar a ${tipoCatalogo}: "${items[indiceSinPrecio].nombre}" no tiene precio en ese catálogo.`);
      return;
    }

    setErrorCatalogoPedido("");
    const success = await actualizarItemsPedido(pedidoTemp.id, itemsRepreciados);
    if (!success) {
      setErrorCatalogoPedido("No se pudo guardar el catálogo y sus precios. Inténtalo de nuevo.");
      return;
    }
    actualizarItemsLocal(itemsRepreciados);
    setPedidoTemp((actual) => ({ ...actual, tipo_catalogo: tipoCatalogo }));
    setModalPedido((actual) => actual?.id === pedidoTemp.id
      ? { ...actual, tipo_catalogo: tipoCatalogo }
      : actual);
  };

  const abrirSelectorProductos = async () => {
    setMostrarSelectorProductos(true);
    setBusquedaProductosPedido("");
    setCategoriaProductosPedido("");
    setCargandoVariantesPedido(true);
    setErrorVariantesPedido("");
    const { data, error } = await supabase
      .from("producto_variantes")
      .select("id,producto_id,nombre,atributos,precio,precio_emprendedor,precio_mayorista,stock,imagenes,created_at,updated_at");
    if (error) {
      setErrorVariantesPedido("No se pudieron cargar las variantes. Puedes agregar productos sin variante.");
      setVariantesProductosPedido([]);
    } else {
      setVariantesProductosPedido(data || []);
    }
    setCargandoVariantesPedido(false);
  };

  const agregarProductoSeleccionado = async (producto, variante = null) => {
    const success = await handleAgregarItem(modalPedido.id, producto.id, variante);
    if (!success) return;
    setMostrarSelectorProductos(false);
  };

  const handleEliminarItem = async (pedidoId, productoId) => {
    const success = await eliminarItemPedido(pedidoId, productoId);
    if (!success) return;

    const nuevosItems = (pedidoTemp.items || []).filter((item) => item.id !== productoId);
    actualizarItemsLocal(nuevosItems);
  };

  const handleActualizarCantidad = async (pedidoId, productoId, nuevaCantidad) => {
    if (nuevaCantidad <= 0) return;

    const success = await actualizarCantidadItemPedido(pedidoId, productoId, nuevaCantidad);
    if (!success) return;

    const nuevosItems = (pedidoTemp.items || []).map((item) =>
      item.id === productoId ? { ...item, cantidad: nuevaCantidad } : item
    );
    actualizarItemsLocal(nuevosItems);
  };

  const productosDisponibles = productos.filter(
    (p) => !pedidoTemp.items?.some((item) => String(item.producto_id ?? item.id) === String(p.id))
  );
  const productosFiltradosPedido = productosDisponibles.filter((producto) => {
    const busqueda = busquedaProductosPedido.trim().toLocaleLowerCase();
    const categoria = producto.categoria || producto.categorias?.nombre || "";
    const variantes = variantesProductosPedido.filter((variante) => String(variante.producto_id) === String(producto.id));
    const textoVariantes = variantes.flatMap((variante) => [variante.nombre, variante.atributos])
      .map((valor) => typeof valor === "string" ? valor : JSON.stringify(valor || ""))
      .join(" ");
    return (!categoriaProductosPedido || String(producto.categoria_id) === categoriaProductosPedido || categoria === categoriaProductosPedido)
      && (!busqueda || `${producto.nombre} ${categoria} ${textoVariantes}`.toLocaleLowerCase().includes(busqueda));
  });
  const pedidoEdicionUnificado = Boolean(pedidoTemp.tipo_catalogo) && (pedidoTemp.items || []).every(
    (item) => (item.tipo_catalogo || "General") === pedidoTemp.tipo_catalogo
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const pedidosActivos = pedidos.filter((pedido) => !pedidoEstaConfirmado(pedido));
  const pedidosFiltrados = pedidosActivos
    .filter((p) => {
      const cliente = (p?.cliente ?? "").toLowerCase();
      const id = p?.id != null ? p.id.toString() : "";

      if (!normalizedSearchTerm) {
        return true;
      }

      return (
        cliente.includes(normalizedSearchTerm) ||
        id.includes(normalizedSearchTerm)
      );
    })
    .sort((a, b) => Number(b.id) - Number(a.id));

  const resumenPrealistamientoActivo = pedidoPrealistar
    ? obtenerResumenPrealistamiento({
        ...pedidoPrealistar,
        pre_alistamiento: { cantidades: cantidadesPrealistadas, confirmado: pedidoPrealistar.pre_alistamiento?.confirmado },
      })
    : null;

  return (
    <div className="pedidos-page">
      {!esVistaHistorico && (
        <div className="pedidos-page-heading">
          <div>
            <h2>Pedidos</h2>
            <p>Gestión de pedidos creados desde la tienda</p>
          </div>
          {esAdmin() && (
            <div className="remision-settings-menu">
              <button
                type="button"
                className="remision-settings-trigger"
                aria-label="Configuración de remisión"
                aria-expanded={mostrarMenuRemision}
                onClick={() => setMostrarMenuRemision((mostrar) => !mostrar)}
              >
                ⚙
              </button>
              {mostrarMenuRemision && (
                <div className="remision-settings-dropdown" role="menu">
                  <button type="button" role="menuitem" className="admin-action-control" onClick={abrirEditorRemision}>Editar Remisión</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!esVistaHistorico && esAdmin() && mostrarEditorRemision && (
        <div className="remision-config-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardandoConfigRemision) setMostrarEditorRemision(false); }}>
          <section className="remision-config-modal" role="dialog" aria-modal="true" aria-labelledby="remision-config-title">
            <header className="remision-config-header">
              <div><span>ADMINISTRACIÓN</span><h2 id="remision-config-title">Editar Remisión</h2></div>
              <button type="button" aria-label="Cerrar" onClick={() => setMostrarEditorRemision(false)} disabled={guardandoConfigRemision}>×</button>
            </header>
            <form onSubmit={guardarConfiguracionRemision}>
              <div className="remision-config-fields">
                <div className="remision-logo-field">
                  <label htmlFor="remision-logo-input">Logo de la remisión</label>
                  <div className="remision-logo-controls">
                    <img src={logoRemisionPreview || configRemisionTemporal.logoUrl || "/favicon.ico"} alt="Vista previa del logo de remisión" />
                    <div>
                      <input id="remision-logo-input" type="file" accept="image/*" onChange={seleccionarLogoRemision} />
                      <button
                        type="button"
                        className="remision-logo-reset"
                        onClick={() => {
                          setLogoRemisionFile(null);
                          setLogoRemisionPreview("");
                          setConfigRemisionTemporal((actual) => ({ ...actual, logoUrl: "/favicon.ico" }));
                        }}
                      >
                        Usar favicon de NEOS
                      </button>
                    </div>
                  </div>
                  <small>Imagen de hasta 2 MB.</small>
                </div>
                <label>Encabezado<input value={configRemisionTemporal.encabezado} onChange={(event) => setConfigRemisionTemporal((actual) => ({ ...actual, encabezado: event.target.value }))} maxLength={80} required /></label>
                <label className="remision-config-span-two">Texto del pie de página<textarea rows="3" value={configRemisionTemporal.pieTexto} onChange={(event) => setConfigRemisionTemporal((actual) => ({ ...actual, pieTexto: event.target.value }))} maxLength={180} required /></label>
                <label>Teléfono del pie<input type="tel" value={configRemisionTemporal.pieTelefono} onChange={(event) => setConfigRemisionTemporal((actual) => ({ ...actual, pieTelefono: event.target.value }))} maxLength={30} /></label>
              </div>
              {errorConfigRemision && <p className="remision-config-error" role="alert">{errorConfigRemision}</p>}
              <footer className="remision-config-actions">
                <button type="button" className="remision-config-cancel" onClick={() => setMostrarEditorRemision(false)} disabled={guardandoConfigRemision}>Cancelar</button>
                <button type="submit" className="remision-config-save" disabled={guardandoConfigRemision}>{guardandoConfigRemision ? "Guardando..." : "Guardar cambios"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {esVistaHistorico ? (
        <HistorialPedidos
          pedidos={pedidos}
          obtenerNombreRepartidor={obtenerNombreRepartidor}
          onAsignarRepartidor={abrirAsignacionRepartidor}
          onVerDetalle={setModalPedido}
          onDescargarRemision={handleDescargarRemision}
          onEliminarPedido={confirmarEliminarPedido}
        />
      ) : (
        <>
          <div className="buscador-container">
            <input
              type="text"
              placeholder="Buscar por cliente o ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="buscador-input"
            />
          </div>
          <PedidosTabla
            pedidos={pedidosFiltrados}
            mensajeVacio="No hay pedidos que coincidan con la búsqueda."
            obtenerNombreRepartidor={obtenerNombreRepartidor}
            onAsignarRepartidor={abrirAsignacionRepartidor}
            onVerDetalle={setModalPedido}
            onDescargarRemision={handleDescargarRemision}
            onEliminarPedido={confirmarEliminarPedido}
          />
        </>
      )}

      {pedidoAnularConfirmacion && (
        <div className="anular-confirmacion-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardandoAnulacionConfirmacion) setPedidoAnularConfirmacion(null); }}>
          <section className="prealistamiento-confirmacion" role="alertdialog" aria-modal="true" aria-labelledby="anular-confirmacion-titulo">
            <h3 id="anular-confirmacion-titulo">¿Anular la confirmación del pedido #{pedidoAnularConfirmacion.id}?</h3>
            <p>El pedido volverá a su estado anterior y se habilitará su edición. Las cantidades pre-alistadas se conservarán.</p>
            {errorAnulacionConfirmacion && <p className="prealistamiento-error" role="alert">{errorAnulacionConfirmacion}</p>}
            <div>
              <button type="button" onClick={() => setPedidoAnularConfirmacion(null)} disabled={guardandoAnulacionConfirmacion}>Cancelar</button>
              <button type="button" onClick={confirmarAnulacionConfirmacion} disabled={guardandoAnulacionConfirmacion}>
                {guardandoAnulacionConfirmacion ? "Anulando..." : "Anular confirmación"}
              </button>
            </div>
          </section>
        </div>
      )}

      {pedidoPrealistar && (
        <div
          className="prealistamiento-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrarPrealistamiento();
          }}
        >
          <section className="prealistamiento-modal" role="dialog" aria-modal="true" aria-labelledby="prealistamiento-titulo">
            <header className="prealistamiento-header">
              <div>
                <span>PREPARACIÓN DE PEDIDO #{pedidoPrealistar.id}</span>
                <h2 id="prealistamiento-titulo">Pre-alistar pedido</h2>
                <p>{pedidoPrealistar.cliente || "Cliente sin nombre"}</p>
              </div>
              <button type="button" aria-label="Cerrar pre-alistamiento" onClick={cerrarPrealistamiento} disabled={guardandoPrealistamiento}>×</button>
            </header>

            <div className="prealistamiento-resumen">
              <div><span>Unidades del pedido</span><strong>{resumenPrealistamientoActivo.total}</strong></div>
              <div><span>Unidades empacadas</span><strong>{resumenPrealistamientoActivo.empacadas}</strong></div>
              <div><span>Pendientes</span><strong>{resumenPrealistamientoActivo.faltantes}</strong></div>
              <small role="status">{guardandoPrealistamiento ? "Guardando avance..." : "El avance se guarda automáticamente."}</small>
            </div>

            <div className="prealistamiento-lista">
              {(pedidoPrealistar.items || []).map((item, index) => {
                const clave = obtenerClavePrealistamiento(item, index);
                const solicitadas = Number(item.cantidad || 0);
                const empacadas = Math.min(solicitadas, Number(cantidadesPrealistadas[clave] || 0));
                return (
                  <article className="prealistamiento-item" key={clave}>
                    {item.imagen ? (
                      <img className="prealistamiento-imagen" src={item.imagen} alt={item.nombre} />
                    ) : (
                      <div className="prealistamiento-imagen prealistamiento-imagen-vacia">?</div>
                    )}
                    <div className="prealistamiento-producto">
                      <strong>{item.nombre}</strong>
                      <span>Solicitadas por el sistema: {solicitadas}</span>
                      <small>Pendientes por empacar: {Math.max(0, solicitadas - empacadas)}</small>
                    </div>
                    <label className="prealistamiento-cantidad">
                      Empacadas
                      <input
                        type="number"
                        min="0"
                        max={solicitadas}
                        step="1"
                        value={cantidadesPrealistadas[clave] ?? 0}
                        onChange={(event) => cambiarCantidadPrealistada(item, index, event.target.value)}
                        aria-label={`Unidades empacadas de ${item.nombre}`}
                      />
                    </label>
                  </article>
                );
              })}
              {(pedidoPrealistar.items || []).length === 0 && (
                <p className="prealistamiento-vacio">Este pedido no tiene productos para alistar.</p>
              )}
            </div>

            {errorPrealistamiento && <p className="prealistamiento-error" role="alert">{errorPrealistamiento}</p>}

            <footer className="prealistamiento-footer">
              {pedidoEstaConfirmado(pedidoPrealistar) ? (
                <div className="prealistamiento-confirmado" role="status">
                  <strong>Confirmado</strong>
                  {resumenPrealistamientoActivo.faltantes > 0 && (
                    <small>{resumenPrealistamientoActivo.faltantes} unidades faltantes aceptadas</small>
                  )}
                </div>
              ) : (
                <div className="prealistamiento-slider-area">
                  <div className="prealistamiento-slider-instruccion" id="prealistamiento-slider-instruccion">
                    <span>Desliza para confirmar el pedido</span>
                    <span className="prealistamiento-slider-ayuda" aria-hidden="true">
                      <span>ARRASTRA</span>
                      <span className="prealistamiento-slider-flecha">→</span>
                    </span>
                  </div>
                  <input
                    className="prealistamiento-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPrealistamiento}
                    style={{ "--slider-progreso": `${sliderPrealistamiento}%` }}
                    onChange={(event) => {
                      const valor = Number(event.target.value);
                      setSliderPrealistamiento(valor);
                      if (valor === 100) solicitarConfirmacionPrealistamiento();
                    }}
                    disabled={guardandoPrealistamiento || resumenPrealistamientoActivo.total === 0}
                    aria-label="Desliza a la derecha para confirmar"
                    aria-describedby="prealistamiento-slider-instruccion"
                    aria-valuetext={`${sliderPrealistamiento}% deslizado`}
                  />
                </div>
              )}
              <button type="button" className="prealistamiento-cerrar" onClick={cerrarPrealistamiento} disabled={guardandoPrealistamiento}>
                Cerrar
              </button>
            </footer>
          </section>

          {mostrarAdvertenciaPrealistamiento && (
            <div className="prealistamiento-confirmacion-overlay" role="presentation">
              <section className="prealistamiento-confirmacion" role="alertdialog" aria-modal="true" aria-labelledby="prealistamiento-confirmacion-titulo">
                <h3 id="prealistamiento-confirmacion-titulo">Hay unidades pendientes por confirmar en este pedido</h3>
                <p>¿Desea continuar y confirmar el pre-alistamiento con unidades faltantes?</p>
                <div>
                  <button type="button" onClick={() => setMostrarAdvertenciaPrealistamiento(false)} disabled={guardandoPrealistamiento}>Volver a revisar</button>
                  <button type="button" onClick={confirmarPrealistamiento} disabled={guardandoPrealistamiento}>
                    {guardandoPrealistamiento ? "Guardando..." : "Sí, continuar"}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {pedidoAsignarRepartidor && (
        <div
          className="asignacion-repartidor-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrarAsignacionRepartidor();
          }}
        >
          <section
            className="asignacion-repartidor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asignacion-repartidor-titulo"
          >
            <header className="asignacion-repartidor-header">
              <div>
                <span>ASIGNACIÓN DE PEDIDO</span>
                <h2 id="asignacion-repartidor-titulo">Elegir repartidor</h2>
              </div>
              <button
                type="button"
                className="admin-action-control admin-action-control--icon"
                aria-label="Cerrar"
                onClick={cerrarAsignacionRepartidor}
                disabled={guardandoAsignacionRepartidor}
              >
                ×
              </button>
            </header>
            <form onSubmit={guardarAsignacionRepartidor}>
              <div className="asignacion-repartidor-pedido">
                <span>Pedido #{pedidoAsignarRepartidor.id}</span>
                <strong>{pedidoAsignarRepartidor.cliente || "Cliente sin nombre"}</strong>
                <small>Actual: {obtenerNombreRepartidor(pedidoAsignarRepartidor.repartidor_id)}</small>
              </div>
              <label className="asignacion-repartidor-campo" htmlFor="pedido-repartidor-select">
                Repartidor
                <select
                  id="pedido-repartidor-select"
                  value={repartidorSeleccionado}
                  onChange={(event) => {
                    setRepartidorSeleccionado(event.target.value);
                    setErrorAsignacionRepartidor("");
                  }}
                  disabled={guardandoAsignacionRepartidor}
                >
                  <option value="">Selecciona un repartidor</option>
                  {repartidores.map((repartidor) => (
                    <option key={repartidor.id} value={repartidor.id}>
                      {repartidor.nombre}{repartidor.zona ? ` · ${repartidor.zona}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {errorAsignacionRepartidor && <p className="asignacion-repartidor-error" role="alert">{errorAsignacionRepartidor}</p>}
              <footer className="asignacion-repartidor-acciones">
                <button
                  type="button"
                  className="admin-action-control"
                  onClick={cerrarAsignacionRepartidor}
                  disabled={guardandoAsignacionRepartidor}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-action-control"
                  disabled={guardandoAsignacionRepartidor}
                >
                  {guardandoAsignacionRepartidor ? "Asignando..." : "Asignar repartidor"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* Modal de detalle */}
      {modalPedido && (
        <div className="modal-overlay" onClick={() => setModalPedido(null)}>
          <div className="modal-content pedido-detalle-modal-content" translate="no" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-card">
              <div className="pedido-header">
                <strong>Pedido #{modalPedido.id}</strong>
                <div className="pedido-header-acciones">
                  <button
                    className="btn-editar admin-action-control"
                    onClick={() => abrirEdicion(modalPedido)}
                    disabled={pedidoEstaConfirmado(modalPedido)}
                    title={pedidoEstaConfirmado(modalPedido) ? "Anula la confirmación antes de editar" : "Editar items"}
                  >
                    ✎ Editar
                  </button>
                  <button
                    className="btn-cerrar-modal"
                    onClick={() => setModalPedido(null)}
                    title="Cerrar"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="pedido-body">
                <div className="pedido-info-cliente">
                  <p><strong>Cliente:</strong> {modalPedido.cliente}</p>
                  <p><strong>Dirección:</strong> {modalPedido.direccion}</p>
                  <p>
                    <strong>Fecha de entrega:</strong>{" "}
                    {pedidoExpandido === modalPedido.id ? (
                      <input
                        type="date"
                        value={pedidoTemp.fechaEntrega || modalPedido.fechaEntrega || ""}
                        onChange={(e) => manejarCambioFechaEntrega(modalPedido.id, e.target.value)}
                        className="fecha-entrega-input"
                      />
                    ) : (
                      modalPedido.fecha || "No definida"
                    )}
                  </p>
                  {esAdmin() && (
                    <p>
                      <strong>Forma de pago:</strong>{" "}
                      <span
                        className={`forma-pago ${modalPedido.formaPago?.toLowerCase() ?? ""}`}
                      >
                        {modalPedido.formaPago}
                      </span>
                    </p>
                  )}
                </div>

                {/* Items con controles de edición si está expandido */}
                {pedidoExpandido === modalPedido.id ? (
                  <div className="pedido-items-editable">
                    <div className="control pedido-catalogo-control">
                      <label htmlFor={`catalogo-pedido-${modalPedido.id}`}>Catálogo del pedido:</label>
                      <select
                        id={`catalogo-pedido-${modalPedido.id}`}
                        value={pedidoTemp.tipo_catalogo || ""}
                        onChange={(event) => handleCambiarCatalogoPedido(event.target.value)}
                      >
                        <option value="" disabled>Selecciona un catálogo para unificar</option>
                        <option value="General">General</option>
                        <option value="Emprendedor">Emprendedor</option>
                        <option value="Mayorista">Mayorista</option>
                      </select>
                    </div>
                    {!pedidoTemp.tipo_catalogo && (
                      <p className="selector-productos-error" role="status">
                        Este pedido tiene catálogos distintos. Selecciona uno para aplicar una tarifa uniforme.
                      </p>
                    )}
                    {errorCatalogoPedido && <p className="selector-productos-error" role="alert">{errorCatalogoPedido}</p>}
                    <h5>Productos:</h5>
                    <div className="items-container">
                      {pedidoTemp.items?.map((item, index) => (
                        <div key={index} className="pedido-item-editable">
                          <div
                            role="button"
                            tabIndex={0}
                            className="producto-miniatura"
                            onClick={() => item.imagen && setImagenModal(item.imagen)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                item.imagen && setImagenModal(item.imagen);
                              }
                            }}
                            title={item.imagen ? "Ver imagen ampliada" : "Sin imagen disponible"}
                          >
                            {item.imagen ? (
                              <img src={item.imagen} alt={item.nombre} />
                            ) : (
                              <div className="imagen-placeholder">?</div>
                            )}
                          </div>
                          <div className="item-info">
                            <span className="item-nombre">{item.nombre}</span>
                            <span className="item-precio-unitario">Catálogo: {item.tipo_catalogo || "General"}</span>
                            <span className="item-precio-unitario">${item.precio.toLocaleString()}</span>
                          </div>
                          <div className="item-controls">
                            <button
                              className="btn-cantidad"
                              onClick={() => handleActualizarCantidad(modalPedido.id, item.id, item.cantidad - 1)}
                              disabled={item.cantidad === 1}
                              title="Disminuir cantidad"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) => handleActualizarCantidad(modalPedido.id, item.id, parseInt(e.target.value) || 1)}
                              className="cantidad-input"
                            />
                            <button
                              className="btn-cantidad"
                              onClick={() => handleActualizarCantidad(modalPedido.id, item.id, item.cantidad + 1)}
                              title="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>
                          <span className="item-subtotal">${(item.precio * item.cantidad).toLocaleString()}</span>
                          <button
                            className="btn-eliminar-item admin-action-control admin-action-control--danger admin-action-control--icon"
                            onClick={() => handleEliminarItem(modalPedido.id, item.id)}
                            title="Eliminar este item"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Agregar nuevo item */}
                    {productosDisponibles.length > 0 && (
                      <div className="agregar-item-container">
                        <label>Agregar producto:</label>
                        <button type="button" className="select-agregar" onClick={abrirSelectorProductos} disabled={!pedidoTemp.tipo_catalogo}>
                          + Seleccionar producto
                        </button>
                      </div>
                    )}

                    <div className="edicion-botones">
                      <button className="btn-guardar" onClick={cerrarEdicion} disabled={!pedidoEdicionUnificado}>
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pedido-items">
                    <h5>Productos:</h5>
                    {modalPedido.items?.length > 0 ? (
                      modalPedido.items.map((item, index) => (
                        <div key={index} className="pedido-item pedido-item-detalle">
                          <div
                            role="button"
                            tabIndex={0}
                            className="producto-miniatura"
                            onClick={() => item.imagen && setImagenModal(item.imagen)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                item.imagen && setImagenModal(item.imagen);
                              }
                            }}
                            title={item.imagen ? "Ver imagen ampliada" : "Sin imagen disponible"}
                          >
                            {item.imagen ? (
                              <img src={item.imagen} alt={item.nombre} />
                            ) : (
                              <div className="imagen-placeholder">?</div>
                            )}
                          </div>

                          <div className="producto-detalle-texto">
                            <span className="producto-nombre">{item.nombre}</span>
                            <span className="producto-cantidad">x{item.cantidad}</span>
                            <span className="producto-cantidad">Catálogo: {item.tipo_catalogo || "General"}</span>
                            <span className="producto-cantidad">Precio unitario: ${Number(item.precio || 0).toLocaleString()}</span>
                          </div>

                          <span className="price">${(item.precio * item.cantidad).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="sin-productos">No hay productos registrados en este pedido.</p>
                    )}
                  </div>
                )}

                <div className="pedido-total-acciones">
                  {esAdmin() && (
                    <button
                      type="button"
                      className={`btn-detalle btn-pre-alistar ${pedidoEstaConfirmado(modalPedido) ? "btn-anular-confirmacion" : ""}`}
                      onClick={() => pedidoEstaConfirmado(modalPedido)
                        ? abrirAnulacionConfirmacion(modalPedido)
                        : abrirPrealistamiento(modalPedido)}
                      aria-label={`${pedidoEstaConfirmado(modalPedido) ? "Anular confirmación" : "Pre-alistar"} del pedido ${modalPedido.id}`}
                    >
                      {pedidoEstaConfirmado(modalPedido) ? "Anular confirmación" : "Pre-alistar"}
                    </button>
                  )}
                  <p className="pedido-total"><strong>Total:</strong> ${((pedidoExpandido === modalPedido.id ? pedidoTemp.total : modalPedido.total) || 0).toLocaleString()}</p>
                </div>

                <PedidoObservacion
                  pedido={modalPedido}
                  editable={esAdmin() || esVendedor()}
                  onGuardar={actualizarObservacionPedido}
                />

                {pedidoExpandido === modalPedido.id && (
                  <div className="pedido-acciones">
                    {esAdmin() && (
                      <div className="control">
                        <label>Forma de pago:</label>
                        <select
                          value={modalPedido.formaPago || "Efectivo"}
                          onChange={(e) => manejarCambioFormaPago(modalPedido.id, e.target.value)}
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="Crédito">Crédito</option>
                          <option value="Abono">Abono</option>
                        </select>
                      </div>
                    )}
                    <div className="control">
                      <label>Estado:</label>
                      <select
                        value={modalPedido.estado}
                        onChange={(e) =>
                          cambiarEstadoPedido(modalPedido.id, e.target.value)
                        }
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En camino">En camino</option>
                        {modalPedido.estado === "Confirmado" && <option value="Confirmado" disabled>Confirmado</option>}
                        <option value="Entregado">Entregado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>

                    <div className="control">
                      <label>Asignación de repartidor:</label>
                      <div className="pedido-repartidor-actual">
                        <span>{obtenerNombreRepartidor(modalPedido.repartidor_id)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarSelectorProductos && (
        <div className="selector-productos-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMostrarSelectorProductos(false); }}>
          <section className="selector-productos-modal" role="dialog" aria-modal="true" aria-labelledby="selector-productos-titulo">
            <header className="selector-productos-header">
              <div><span>EDITAR PEDIDO #{modalPedido?.id}</span><h2 id="selector-productos-titulo">Agregar producto</h2></div>
              <button type="button" aria-label="Cerrar selector" onClick={() => setMostrarSelectorProductos(false)}>×</button>
            </header>
            <div className="selector-productos-filtros">
              <input
                type="search"
                autoFocus
                placeholder="Buscar producto o variante..."
                value={busquedaProductosPedido}
                onChange={(event) => setBusquedaProductosPedido(event.target.value)}
              />
              <select value={categoriaProductosPedido} onChange={(event) => setCategoriaProductosPedido(event.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map((categoria) => <option key={categoria.id} value={String(categoria.id)}>{categoria.nombre}</option>)}
              </select>
            </div>
            {errorVariantesPedido && <p className="selector-productos-error" role="status">{errorVariantesPedido}</p>}
            <div className="selector-productos-lista">
              {productosFiltradosPedido.length ? productosFiltradosPedido.map((producto) => {
                const variantes = variantesProductosPedido.filter((variante) => String(variante.producto_id) === String(producto.id));
                const precioProducto = obtenerPrecioCatalogo(producto, null, pedidoTemp.tipo_catalogo);
                return (
                  <article className="selector-producto" key={producto.id}>
                    <div className="selector-producto-base">
                      <div>
                        <strong>{producto.nombre}</strong>
                        <span>{producto.categoria || producto.categorias?.nombre || "Sin categoría"} · Stock: {producto.stock}</span>
                      </div>
                      <button type="button" disabled={precioProducto == null} onClick={() => agregarProductoSeleccionado(producto)}>
                        {precioProducto == null ? "Sin precio en este catálogo" : `Agregar · $${precioProducto.toLocaleString()}`}
                      </button>
                    </div>
                    {variantes.length > 0 && (
                      <div className="selector-producto-variantes">
                        {variantes.map((variante) => {
                          const detalle = obtenerNombreVariante(variante);
                          const precioVariante = obtenerPrecioCatalogo(producto, variante, pedidoTemp.tipo_catalogo);
                          return (
                            <button type="button" key={variante.id} disabled={precioVariante == null} onClick={() => agregarProductoSeleccionado(producto, variante)}>
                              <span>{detalle}</span>
                              <strong>{precioVariante == null ? "Sin precio" : `$${precioVariante.toLocaleString()}`}</strong>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              }) : (
                <p className="selector-productos-vacio">No hay productos que coincidan con los filtros.</p>
              )}
              {cargandoVariantesPedido && <p className="selector-productos-cargando">Cargando variantes...</p>}
            </div>
          </section>
        </div>
      )}

      {imagenModal && (
        <div className="image-preview-overlay" onClick={() => setImagenModal(null)}>
          <div className="image-preview-content" onClick={(e) => e.stopPropagation()}>
            <img src={imagenModal} alt="Imagen del producto" />
            <button
              type="button"
              className="btn-cerrar-modal image-preview-close"
              onClick={() => setImagenModal(null)}
              aria-label="Cerrar vista de imagen"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

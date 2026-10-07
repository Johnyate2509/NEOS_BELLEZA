import { useState, useEffect } from "react";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../context/supabaseClient";
import { descargarRemisionPedido } from "../utils/remisionPdf";
import expedienteIcon from "../components/img/expediente.png";
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

export default function Pedidos() {
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
    eliminarItemPedido,
    actualizarCantidadItemPedido,
    actualizarFechaPedido,
    actualizarFormaPagoPedido,
  } = useStore();
  const { esAdmin } = useAuth();

  const [pedidoExpandido, setPedidoExpandido] = useState(null);
  const [pedidoTemp, setPedidoTemp] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [modalPedido, setModalPedido] = useState(null);
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
    const catalogos = new Set((pedido.items || []).map((item) => item.tipo_catalogo || "General"));
    setPedidoExpandido(pedido.id);
    setPedidoTemp({ ...pedido, tipo_catalogo: catalogos.size <= 1 ? [...catalogos][0] || "General" : "" });
    setErrorCatalogoPedido("");
  };

  const cerrarEdicion = () => {
    setPedidoExpandido(null);
    setPedidoTemp({});
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
    const itemId = variante?.id ?? producto.id;
    const success = await agregarItemPedido(pedidoId, itemId, nombre, precio, 1, {
      producto_id: producto.id,
      variante,
      tipo_catalogo: tipoCatalogo,
    });
    if (!success) return false;

    const nuevosItems = [
      ...(pedidoTemp.items || []),
      { id: itemId, producto_id: producto.id, nombre, precio, cantidad: 1, variante: variante || null, tipo_catalogo: tipoCatalogo },
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
    const { data, error } = await supabase.from("producto_variantes").select("*");
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

  const pedidosFiltrados = pedidos
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

  return (
    <div className="pedidos-page">
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

      {esAdmin() && mostrarEditorRemision && (
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

      {/* Buscador */}
      <div className="buscador-container">
        <input
          type="text"
          placeholder="Buscar por cliente o ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="buscador-input"
        />
      </div>

      {/* Tabla pedidos */}
      <table className="pedidos-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Fecha de entrega</th>
            <th>Valor</th>
            <th>Estado</th>
            <th>Asignación de repartidor</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {pedidosFiltrados.length === 0 ? (
            <tr>
              <td colSpan="7" className="sin-pedidos">No hay pedidos que coincidan con la búsqueda.</td>
            </tr>
          ) : (
            pedidosFiltrados.map((p) => (
              <tr key={p.id}>
                <td data-label="ID">{p.id}</td>
                <td data-label="Nombre">{p.cliente}</td>
                <td data-label="Fecha">{p.fecha}</td>
                <td data-label="Valor">${p.total.toLocaleString()}</td>
                <td data-label="Estado">
                  <span className={`estado-badge estado-${(p.estado ?? "").toLowerCase().replace(' ', '-')}`}>
                    {p.estado}
                  </span>
                </td>
                <td data-label="Asignación de repartidor">
                  <div className="repartidor-asignacion">
                    {p.repartidor_id ? (
                      <span className="repartidor-nombre">{obtenerNombreRepartidor(p.repartidor_id)}</span>
                    ) : (
                      <span className="sin-repartidor">No asignado</span>
                    )}
                    <button
                      type="button"
                      className="admin-action-control"
                      onClick={() => abrirAsignacionRepartidor(p)}
                      aria-label={`${p.repartidor_id ? "Cambiar" : "Asignar"} repartidor del pedido ${p.id}`}
                    >
                      {p.repartidor_id ? "Cambiar" : "Asignar"}
                    </button>
                  </div>
                </td>
                <td data-label="Acción">
                  <div className="acciones-pedido">
                    <button
                      className="btn-detalle"
                      onClick={() => setModalPedido(p)}
                      title="Ver detalle"
                    >
                      Ver Detalle
                    </button>
                    <button
                      type="button"
                      className="btn-pdf"
                      onClick={() => handleDescargarRemision(p)}
                      title="Descargar remisión PDF"
                      aria-label={`Descargar remisión del pedido ${p.id}`}
                    >
                      <img src={expedienteIcon} alt="" />
                    </button>
                    <button
                      type="button"
                      className="btn-delete admin-action-control admin-action-control--danger"
                      onClick={() => confirmarEliminarPedido(p)}
                      title={`Eliminar pedido ${p.id}`}
                      aria-label={`Eliminar pedido ${p.id}`}
                    >
                       Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

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
          <div className="modal-content" translate="no" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-card">
              <div className="pedido-header">
                <strong>Pedido #{modalPedido.id}</strong>
                <div className="pedido-header-acciones">
                  <button
                    className="btn-editar admin-action-control"
                    onClick={() => abrirEdicion(modalPedido)}
                    title="Editar items"
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

                <p className="pedido-total"><strong>Total:</strong> ${((pedidoExpandido === modalPedido.id ? pedidoTemp.total : modalPedido.total) || 0).toLocaleString()}</p>

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
                        <option value="Entregado">Entregado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>

                    <div className="control">
                      <label>Repartidor:</label>
                      <div className="pedido-repartidor-actual">
                        <span>{obtenerNombreRepartidor(modalPedido.repartidor_id)}</span>
                        <button
                          type="button"
                          className="admin-action-control"
                          onClick={() => abrirAsignacionRepartidor(modalPedido)}
                        >
                          {modalPedido.repartidor_id ? "Cambiar" : "Asignar"}
                        </button>
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

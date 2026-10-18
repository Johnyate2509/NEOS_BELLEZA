import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { validarDatosPedido, validarCarrito } from "../utils/validaciones";
import { enviarConfirmacionPedido, enviarNotificacionVendedor } from "../services/emailService";
import { asegurarPerfilCliente } from "../utils/asegurarPerfilCliente";
import {
  CATALOG_CACHE_CONSENT_EVENT,
  PRODUCT_CATALOG_CACHE_TTL_MS,
  guardarCacheProductos,
  leerCacheProductos,
  tieneConsentimientoCacheCatalogo,
} from "../utils/catalogCache";
import { subirImagenesProducto } from "../utils/productImageStorage";

const StoreContext = createContext(null);
const MINIMOS_COMPRA_CATALOGO_DEFAULT = { General: 1, Emprendedor: 3, Mayorista: 6 };
const MONTOS_MINIMOS_CATALOGO_DEFAULT = { General: 0, Emprendedor: 0, Mayorista: 0 };
const CATEGORIAS_OFFLINE_KEY = "neosapp_categorias_offline_v1";
const PRODUCT_COLUMNS = "id,nombre,precio,stock,descripcion,categoria_id,imagen_url,precio_mayorista,precio_emprendedor,imagen_url2,imagen_url3,imagen_url4,imagen_url5,oculto_catalogo,catalogos_ocultos,minimos_compra";
const VARIANT_COLUMNS = "id,producto_id,nombre,atributos,precio,precio_emprendedor,precio_mayorista,stock,imagenes,archivada,created_at,updated_at";

const eliminarUsuarioAuthSeguro = async (userId) => {
  const { data, error } = await supabase.functions.invoke("admin-delete-user", {
    body: { userId },
  });
  if (error) return { error: error.message || "No se pudo eliminar la cuenta de acceso." };
  if (!data?.success) return { error: data?.error || "No se pudo eliminar la cuenta de acceso." };
  return { success: true };
};

export function StoreProvider({ children }) {
  const [productos, setProductos] = useState([]);
  const [revisionConsentimientoCatalogo, setRevisionConsentimientoCatalogo] = useState(0);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [tablaPedidosTieneColumnaRepartidor, setTablaPedidosTieneColumnaRepartidor] = useState(true);
  const [vendedores, setVendedores] = useState([]);
  const [usuariosVendedores, setUsuariosVendedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerImages, setBannerImages] = useState([]);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [catalogosOcultos, setCatalogosOcultos] = useState([]);
  const [minimosCompraCatalogo, setMinimosCompraCatalogo] = useState(MINIMOS_COMPRA_CATALOGO_DEFAULT);
  const [montosMinimosCompraCatalogo, setMontosMinimosCompraCatalogo] = useState(MONTOS_MINIMOS_CATALOGO_DEFAULT);

  useEffect(() => {
    const actualizarConsentimiento = () => setRevisionConsentimientoCatalogo((revision) => revision + 1);
    window.addEventListener(CATALOG_CACHE_CONSENT_EVENT, actualizarConsentimiento);
    return () => window.removeEventListener(CATALOG_CACHE_CONSENT_EVENT, actualizarConsentimiento);
  }, []);

  useEffect(() => {
    if (!productos.length || !tieneConsentimientoCacheCatalogo()) return;
    // Conserva la fecha de la última lectura remota; editar localmente el catálogo
    // no debe extender indefinidamente la vigencia de una copia desactualizada.
    guardarCacheProductos(productos);
  }, [productos, revisionConsentimientoCatalogo]);

  const notificarEventoApp = async (tipo, entidadId) => {
    try {
      const { error } = await supabase.rpc("notificar_evento_app", {
        p_tipo: tipo,
        p_entidad_id: Number(entidadId),
      });
      if (error) console.warn("No se pudo registrar la notificación:", error.message);
    } catch (error) {
      console.warn("No se pudo registrar la notificación:", error);
    }
  };

  const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1522338242592-cb0acf6f85a2?w=500";

  const cargarBannerDesdeSupabase = async () => {
    try {
      const { data: carruselData, error: carruselError } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "banner_images")
        .maybeSingle();
      if (!carruselError && carruselData?.value) {
        const imagenes = Array.isArray(carruselData.value) ? carruselData.value : JSON.parse(carruselData.value);
        if (Array.isArray(imagenes) && imagenes.length) {
          setBannerImages(imagenes);
          setBannerUrl(imagenes[0]);
          return imagenes[0];
        }
      }
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "banner_url")
        .maybeSingle();

      if (error && !String(error.message || "").toLowerCase().includes("does not exist")) {
        console.error("Error cargando banner desde Supabase:", error);
      }

      if (data?.value) {
        setBannerUrl(data.value);
        setBannerImages([data.value]);
        return data.value;
      }
    } catch (error) {
      console.warn("No se pudo cargar el banner desde Supabase:", error);
    }

    if (typeof window !== "undefined") {
      try {
        const imagenesGuardadas = JSON.parse(window.localStorage.getItem("neosapp_banner_images") || "[]");
        if (Array.isArray(imagenesGuardadas) && imagenesGuardadas.length) {
          setBannerImages(imagenesGuardadas);
          setBannerUrl(imagenesGuardadas[0]);
          return imagenesGuardadas[0];
        }
        const bannerGuardado = window.localStorage.getItem("neosapp_banner_url");
        if (bannerGuardado) {
          setBannerUrl(bannerGuardado);
          setBannerImages([bannerGuardado]);
          return bannerGuardado;
        }
      } catch (localError) {
        console.error("Error cargando banner guardado:", localError);
      }
    }

    return "";
  };

  const guardarImagenesBanner = async (imagenes) => {
    const imagenesValidas = (imagenes || []).filter(Boolean).slice(0, 5);
    const { error } = await supabase
      .from("site_settings")
      .upsert([
        { key: "banner_images", value: JSON.stringify(imagenesValidas) },
        { key: "banner_url", value: imagenesValidas[0] || "" },
      ], { onConflict: "key" });
    if (error) throw error;

    setBannerImages(imagenesValidas);
    setBannerUrl(imagenesValidas[0] || "");
    try {
      window.localStorage.setItem("neosapp_banner_images", JSON.stringify(imagenesValidas));
      if (imagenesValidas[0]) window.localStorage.setItem("neosapp_banner_url", imagenesValidas[0]);
      else window.localStorage.removeItem("neosapp_banner_url");
    } catch (errorLocal) {
      console.warn("No se pudieron guardar localmente las imágenes del carrusel:", errorLocal);
    }
  };

  const guardarBannerUrl = async (url) => {
    const valorFinal = url || "";
    setBannerUrl(valorFinal);

    if (typeof window !== "undefined") {
      try {
        if (valorFinal) {
          window.localStorage.setItem("neosapp_banner_url", valorFinal);
        } else {
          window.localStorage.removeItem("neosapp_banner_url");
        }
      } catch (error) {
        console.error("Error guardando banner local:", error);
      }
    }

    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "banner_url", value: valorFinal }, { onConflict: "key" });

      if (error) {
        console.warn("No se pudo guardar banner en Supabase, se conserva localmente:", error);
      }
    } catch (error) {
      console.warn("No se pudo guardar banner en Supabase:", error);
    }
  };

  const guardarBannerVisible = async (visible) => {
    const valor = Boolean(visible);
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "banner_visible", value: String(valor) }, { onConflict: "key" });
      if (error) throw error;
      setBannerVisible(valor);
      try {
        window.localStorage.setItem("neosapp_banner_visible", String(valor));
      } catch (errorLocal) {
        console.warn("No se pudo guardar localmente la visibilidad del banner:", errorLocal);
      }
      return { success: true };
    } catch (error) {
      console.error("No se pudo guardar la visibilidad del banner en Supabase:", error);
      return { error: error.message || "No se pudo guardar la visibilidad del banner." };
    }
  };

  const cargarVisibilidadBanner = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "banner_visible")
        .maybeSingle();
      if (!error && data?.value != null) {
        setBannerVisible(String(data.value) !== "false");
        return;
      }
    } catch (error) {
      console.warn("No se pudo cargar la visibilidad del banner:", error);
    }
    try {
      const guardado = window.localStorage.getItem("neosapp_banner_visible");
      if (guardado != null) setBannerVisible(guardado !== "false");
    } catch (error) {
      console.warn("No se pudo leer la visibilidad local del banner:", error);
    }
  };

  const cargarCatalogosOcultos = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "catalogos_ocultos")
        .maybeSingle();
      if (error) throw error;

      const valor = data?.value;
      const ocultos = Array.isArray(valor) ? valor : typeof valor === "string" ? JSON.parse(valor || "[]") : [];
      const validos = ["General", "Emprendedor", "Mayorista"].filter((catalogo) => ocultos.includes(catalogo));
      setCatalogosOcultos(validos.length < 3 ? validos : validos.slice(0, 2));
    } catch (error) {
      console.warn("No se pudieron cargar los catálogos ocultos:", error);
    }
  };

  const guardarCatalogosOcultos = async (lista) => {
    const catalogosValidos = ["General", "Emprendedor", "Mayorista"];
    const ocultos = catalogosValidos.filter((catalogo) => Array.isArray(lista) && lista.includes(catalogo));
    if (ocultos.length >= catalogosValidos.length) {
      return { error: "Debe quedar al menos un catálogo visible." };
    }
    if (!(await esAdministradorActual())) {
      return { error: "Solo un administrador puede cambiar la visibilidad de los catálogos." };
    }

    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "catalogos_ocultos", value: JSON.stringify(ocultos) }, { onConflict: "key" });
      if (error) throw error;

      setCatalogosOcultos(ocultos);
      return { success: true };
    } catch (error) {
      console.error("No se pudo guardar la visibilidad de los catálogos:", error);
      return { error: error.message || "No se pudo guardar la visibilidad de los catálogos." };
    }
  };

  const cargarMinimosCompraCatalogo = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "minimos_compra_catalogo")
        .maybeSingle();
      if (!error && data?.value) {
        const valores = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        const normalizados = Object.fromEntries(Object.keys(MINIMOS_COMPRA_CATALOGO_DEFAULT).map((catalogo) => {
          const valor = Number(valores?.[catalogo]);
          return [catalogo, Number.isInteger(valor) && valor > 0 ? valor : MINIMOS_COMPRA_CATALOGO_DEFAULT[catalogo]];
        }));
        setMinimosCompraCatalogo(normalizados);
        setMontosMinimosCompraCatalogo(Object.fromEntries(Object.keys(MONTOS_MINIMOS_CATALOGO_DEFAULT).map((catalogo) => {
          const monto = Number(valores?.[`monto_${catalogo}`]);
          return [catalogo, Number.isFinite(monto) && monto > 0 ? monto : 0];
        })));
        return;
      }
    } catch (error) {
      console.warn("No se pudieron cargar los mínimos generales de compra:", error);
    }
    try {
      const guardado = JSON.parse(window.localStorage.getItem("neosapp_minimos_compra_catalogo") || "null");
      if (guardado && typeof guardado === "object") {
        setMinimosCompraCatalogo(Object.fromEntries(Object.keys(MINIMOS_COMPRA_CATALOGO_DEFAULT).map((catalogo) => [catalogo, Number(guardado[catalogo]) || MINIMOS_COMPRA_CATALOGO_DEFAULT[catalogo]])));
        setMontosMinimosCompraCatalogo(Object.fromEntries(Object.keys(MONTOS_MINIMOS_CATALOGO_DEFAULT).map((catalogo) => [catalogo, Math.max(0, Number(guardado[`monto_${catalogo}`]) || 0)])));
      }
    } catch (error) {
      console.warn("No se pudieron cargar los mínimos locales de compra:", error);
    }
  };

  const guardarMinimosCompraCatalogo = async (valores, montos = MONTOS_MINIMOS_CATALOGO_DEFAULT) => {
    const normalizados = Object.fromEntries([
      ...Object.keys(MINIMOS_COMPRA_CATALOGO_DEFAULT).map((catalogo) => [catalogo, Number(valores[catalogo])]),
      ...Object.keys(MONTOS_MINIMOS_CATALOGO_DEFAULT).map((catalogo) => [`monto_${catalogo}`, Math.max(0, Number(montos[catalogo]) || 0)]),
    ]);
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "minimos_compra_catalogo", value: JSON.stringify(normalizados) }, { onConflict: "key" });
      if (error) return { error: error.message };
      setMinimosCompraCatalogo(Object.fromEntries(Object.keys(MINIMOS_COMPRA_CATALOGO_DEFAULT).map((catalogo) => [catalogo, normalizados[catalogo]])));
      setMontosMinimosCompraCatalogo(Object.fromEntries(Object.keys(MONTOS_MINIMOS_CATALOGO_DEFAULT).map((catalogo) => [catalogo, normalizados[`monto_${catalogo}`]])));
      try {
        window.localStorage.setItem("neosapp_minimos_compra_catalogo", JSON.stringify(normalizados));
      } catch (errorLocal) {
        console.warn("No se pudieron guardar localmente los mínimos de compra:", errorLocal);
      }
      return { success: true };
    } catch (error) {
      return { error: error.message || "No se pudieron guardar los mínimos de compra." };
    }
  };

  const subirBanner = async (file) => {
    if (!file) return "";

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxDimension = 1600;
          const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("El navegador no pudo procesar la imagen del banner."));
            return;
          }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.onerror = () => reject(new Error(`No se pudo procesar la imagen ${file.name}.`));
        image.src = String(reader.result || "");
      };
      reader.onerror = () => reject(new Error(`No se pudo leer la imagen ${file.name}.`));
      reader.readAsDataURL(file);
    });
  };

const adaptarProducto = (p) => {
  const imagenesDesdeColumnas = [p.imagen_url, p.imagen_url2, p.imagen_url3, p.imagen_url4, p.imagen_url5].filter(Boolean);
  const catalogosOcultos = Array.isArray(p.catalogos_ocultos)
    ? p.catalogos_ocultos
    : p.oculto_catalogo
    ? ["General", "Emprendedor", "Mayorista"]
    : [];
  return {
    id: p.id ?? p.identificacion,
    nombre: p.nombre,
    precio: p.precio,
    precio_emprendedor: p.precio_emprendedor ?? p.precioEmprendedor ?? null,
    precio_mayorista: p.precio_mayorista ?? p.precioMayorista ?? null,
    precio_costo: p.precio_costo ?? null,
    catalogos_ocultos: catalogosOcultos,
    minimos_compra: p.minimos_compra && typeof p.minimos_compra === "object" ? p.minimos_compra : {},
    oculto_catalogo: catalogosOcultos.length === 3,
    stock: p.stock ?? p.existencias ?? 0,
    descripcion: p.descripcion,
    categoria_id: p.categoria_id,
    categoria: p.categorias?.nombre || p.categoria || "",
    categorias: p.categorias ?? null,
    imagenes:
      Array.isArray(p.imagenes) && p.imagenes.length > 0
        ? p.imagenes
        : imagenesDesdeColumnas.length > 0
        ? imagenesDesdeColumnas
        : [DEFAULT_IMAGE],
  };
};

  const obtenerNombreVariantePedido = (variante) => {
    if (!variante) return "";
    if (variante.nombre) return variante.nombre;
    if (typeof variante.atributos === "string" && variante.atributos.trim()) return variante.atributos;
    if (variante.atributos && typeof variante.atributos === "object") {
      return Object.entries(variante.atributos)
        .map(([nombre, valor]) => `${nombre}: ${Array.isArray(valor) ? valor.join(", ") : String(valor)}`)
        .join(" · ");
    }
    return "Variante";
  };

  const obtenerPrimeraImagen = (...candidatos) => {
    for (const valor of candidatos) {
      if (!valor) continue;

      if (Array.isArray(valor)) {
        const primer = valor.find((item) => Boolean(item));
        if (primer) return primer;
        continue;
      }

      if (typeof valor === "string") {
        if (valor.trim()) return valor;
        continue;
      }

      if (typeof valor === "object") {
        const imagenes = Array.isArray(valor.imagenes)
          ? valor.imagenes
          : [valor.imagen, valor.imagen_url, valor.image, valor.url, valor.src].filter(Boolean);

        const primer = imagenes.find((item) => Boolean(item));
        if (primer) return primer;
      }
    }

    return "";
  };

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
      observacion: p.observacion ?? "",
      pre_alistamiento: p.pre_alistamiento ?? { cantidades: {}, confirmado: false },
    };
  };

const cargarProductos = async () => {
  const cache = leerCacheProductos();
  const cacheReciente = cache && Date.now() - cache.actualizadoEn < PRODUCT_CATALOG_CACHE_TTL_MS;
  if (cacheReciente) {
    setProductos(cache.productos);
    return cache.productos;
  }

  // Trae el catálogo en páginas pequeñas para evitar que una sola respuesta
  // grande (incluyendo sus URLs de imagen) exceda el statement timeout.
  const TAMANO_PAGINA = 100;
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from("productos")
      .select(PRODUCT_COLUMNS)
      .order("id", { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      console.error("Error cargando productos:", error);
      const productosOffline = cache?.productos || [];
      setProductos(productosOffline);
      return productosOffline;
    }

    filas.push(...(data || []));
    if (!data || data.length < TAMANO_PAGINA) break;
  }

  const adaptados = filas.map(adaptarProducto);
  setProductos(adaptados);
  guardarCacheProductos(adaptados, Date.now());
  return adaptados;
};

  const cargarClientes = async () => {
    const { data, error } = await supabase.from("clientes").select("*");
    if (error) {
      console.error("Error cargando clientes:", error);
      return;
    }


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
    let variantesData = [];
    if (pedidoIds.length > 0) {
      const detallesResponse = await supabase
        .from("pedido_detalle")
        .select("*")
        .in("pedido_id", pedidoIds);

      if (detallesResponse.error) {
        console.error("Error cargando detalles de pedidos:", detallesResponse.error);
      } else {
        detalleData = detallesResponse.data || [];
      }

      const obtenerIdVariante = (detalle) =>
        detalle.variante_id ?? detalle.producto_variante_id ?? detalle.variant_id ?? null;
      const obtenerIdProducto = (detalle) =>
        detalle.producto_id ?? detalle.Producto_id ?? detalle.productoId ?? detalle.ProductoId ?? null;
      const idsVariantesNecesarias = [...new Set(
        detalleData.map(obtenerIdVariante).filter((id) => id != null).map(String)
      )];
      const idsProductosLegacy = [...new Set(
        detalleData
          .filter((detalle) => obtenerIdVariante(detalle) == null)
          .map(obtenerIdProducto)
          .filter((id) => id != null)
          .map(String)
      )];
      const consultasVariantes = [];
      if (idsVariantesNecesarias.length) {
        consultasVariantes.push(
          supabase.from("producto_variantes").select(VARIANT_COLUMNS).in("id", idsVariantesNecesarias)
        );
      }
      if (idsProductosLegacy.length) {
        consultasVariantes.push(
          supabase.from("producto_variantes").select(VARIANT_COLUMNS).in("producto_id", idsProductosLegacy)
        );
      }
      const respuestasVariantes = await Promise.all(consultasVariantes);
      for (const variantesResponse of respuestasVariantes) {
        if (variantesResponse.error) {
          console.error("Error cargando variantes de productos:", variantesResponse.error);
        } else {
          variantesData.push(...(variantesResponse.data || []));
        }
      }
    }

    const variantesPorId = new Map(
      variantesData.map((variante) => [String(variante.id), variante])
    );
    const idsVariantes = new Set(variantesData.map((variante) => String(variante.id)));

    const filtrarItemsConVariantes = (items = []) => {
      const idsPadresConVariante = new Set(
        items
          .filter((item) => {
            const itemId = String(item?.id ?? item?.producto_id ?? "");
            const itemVarianteId = String(item?.variante?.id ?? item?.varianteId ?? "");
            const nombreItem = typeof item?.nombre === "string" ? item.nombre : "";
            const pareceVariante = Boolean(item?.variante) || idsVariantes.has(itemId) || idsVariantes.has(itemVarianteId) || nombreItem.includes(" - ");
            return pareceVariante;
          })
          .map((item) => String(item?.producto_id ?? item?.variante?.producto_id ?? item?.id ?? ""))
          .filter(Boolean)
      );

      return items.filter((item) => {
        if (item?.variante) return true;
        const itemProductId = String(item?.producto_id ?? item?.id ?? "");
        const nombreItem = typeof item?.nombre === "string" ? item.nombre : "";
        if (nombreItem.includes(" - ")) return false;
        return !idsPadresConVariante.has(itemProductId);
      });
    };

    const variantesLegacyUsadas = new Set();
    const detallesPorPedido = detalleData.reduce((acc, detalle) => {
      const pedidoId =
        detalle.pedido_id ?? detalle.Pedido_id ?? detalle.pedidoId ?? detalle.PedidoId;
      const productoId =
        detalle.producto_id ??
        detalle.Producto_id ??
        detalle.productoId ??
        detalle.ProductoId;

      const variantesDelProducto = variantesData.filter(
        (variante) => String(variante.producto_id) === String(productoId)
      );
      const varianteId =
        detalle.variante_id ??
        detalle.producto_variante_id ??
        detalle.variant_id ??
        null;
      const varianteGuardada = varianteId ? variantesPorId.get(String(varianteId)) : null;
      const precioDetalle = Number(detalle.precio ?? detalle.Precio);
      const variantesCoincidentes = variantesDelProducto.filter((variante) =>
        [variante.precio, variante.precio_emprendedor, variante.precio_mayorista]
          .some((precio) => precio != null && Number(precio) === precioDetalle)
      );
      const claveLegacy = `${pedidoId}-${productoId}`;
      const variantesDisponiblesLegacy = (variantesCoincidentes.length > 0
        ? variantesCoincidentes
        : variantesDelProducto
      ).filter((variante) => !variantesLegacyUsadas.has(`${claveLegacy}-${variante.id}`));
      const variante = varianteGuardada || variantesDisponiblesLegacy[0] || null;
      if (variante && !varianteId) {
        variantesLegacyUsadas.add(`${claveLegacy}-${variante.id}`);
      }
      const productoPadre = variante
        ? (productosCargados.length > 0 ? productosCargados : productos).find(
            (prod) => String(prod.id) === String(variante.producto_id)
          )
        : (productosCargados.length > 0 ? productosCargados : productos).find(
            (prod) => String(prod.id) === String(productoId)
          );

      const nombreBase = productoPadre?.nombre || `Producto #${productoId}`;
      const nombreItem = variante
        ? `${nombreBase} (${obtenerNombreVariantePedido(variante)})`
        : nombreBase;
      const precioGuardado = Number(detalle.precio ?? detalle.Precio ?? variante?.precio ?? productoPadre?.precio ?? 0);
      const tipoCatalogo = detalle.tipo_catalogo || detalle.catalogo || [
        ["General", variante?.precio ?? productoPadre?.precio],
        ["Emprendedor", variante?.precio_emprendedor ?? productoPadre?.precio_emprendedor],
        ["Mayorista", variante?.precio_mayorista ?? productoPadre?.precio_mayorista],
      ].find(([, precio]) => precio != null && Number(precio) === precioGuardado)?.[0] || "General";

      const item = {
        id: variante?.id ?? productoId,
        producto_id: variante ? variante.producto_id : productoPadre?.id ?? productoId,
        nombre: nombreItem,
        precio: precioGuardado,
        cantidad: Number(detalle.cantidad ?? detalle.Cantidad ?? 1),
        imagen: obtenerPrimeraImagen(
          variante?.imagenes,
          variante?.imagen,
          variante?.imagen_url,
          variante?.image,
          productoPadre?.imagenes,
          productoPadre?.imagen,
          productoPadre?.imagen_url,
          detalle.imagen,
          detalle.imagen_url,
          detalle.image
        ),
        variante,
        tipo_catalogo: tipoCatalogo,
      };

      acc[pedidoId] = [...(acc[pedidoId] || []), item];
      return acc;
    }, {});

    const detallesPorPedidoFiltrados = Object.fromEntries(
      Object.entries(detallesPorPedido).map(([pedidoId, items]) => [
        pedidoId,
        filtrarItemsConVariantes(items),
      ])
    );

    const pedidosAdaptados = pedidosData.map((pedido) =>
      adaptarPedido(
        pedido,
        detallesPorPedidoFiltrados[pedido.id] || filtrarItemsConVariantes(pedido.items || []),
        Array.isArray(clientesCargados) && clientesCargados.length > 0
          ? clientesCargados
          : clientes
      )
    );


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
        return {
          id: usuario.id,
          usuario_id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          zona: usuario.zona || "",
          estado: "Activo",
          registroVendedor: null,
        };
      });
  }, [usuariosVendedores]);

  const cargarCategorias = async () => {
    setCargandoCategorias(true);
    try {
      const { data, error } = await supabase.from("categorias").select("*");
      if (error) {
        console.error("Error cargando categorías:", error);
        try {
          const guardadas = JSON.parse(window.localStorage.getItem(CATEGORIAS_OFFLINE_KEY) || "[]");
          setCategorias(Array.isArray(guardadas) ? guardadas : []);
        } catch {
          setCategorias([]);
        }
        return;
      }
      setCategorias(data || []);
      try {
        window.localStorage.setItem(CATEGORIAS_OFFLINE_KEY, JSON.stringify(data || []));
      } catch (errorCache) {
        console.warn("No se pudieron guardar las categorías para uso offline:", errorCache);
      }
    } finally {
      setCargandoCategorias(false);
    }
  };

  useEffect(() => {
    cargarBannerDesdeSupabase();
    cargarVisibilidadBanner();
    cargarCatalogosOcultos();
    cargarMinimosCompraCatalogo();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (bannerUrl) {
        window.localStorage.setItem("neosapp_banner_url", bannerUrl);
      } else {
        window.localStorage.removeItem("neosapp_banner_url");
      }
    } catch (error) {
      console.error("Error guardando banner:", error);
    }
  }, [bannerUrl]);

  useEffect(() => {
    const calcularSaldoCliente = (cliente, pedidosArray) => {
      const transacciones = Array.isArray(cliente?.transacciones) ? cliente.transacciones : [];

      const totalPagosTransacciones = transacciones
        .filter((trans) => {
          const tipo = String(trans.tipo).toLowerCase();
          return tipo === "pago" || tipo === "abono";
        })
        .reduce((acc, trans) => acc + Number(trans.monto ?? 0), 0);

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

    const cargarDatos = async (autenticado) => {
      const productosCargados = await cargarProductos();
      await cargarCategorias();
      if (!autenticado) {
        setClientes([]);
        setPedidos([]);
        setRepartidores([]);
        setVendedores([]);
        setUsuariosVendedores([]);
        return;
      }

      const clientesCargados = await cargarClientes();
      const pedidosCargados = await cargarPedidos(productosCargados, clientesCargados);
      await Promise.all([
        cargarRepartidores(),
        cargarUsuariosVendedores(),
      ]);
      reconciliarSaldosIniciales(clientesCargados, pedidosCargados || []);
    };

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("No se pudo recuperar la sesión:", error);
      await cargarDatos(Boolean(data?.session));
    };

    init();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // La sesión inicial se atiende en init() y la renovación de token no cambia los datos de la app.
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      setTimeout(() => cargarDatos(Boolean(session)), 0);
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  const crearProducto = async (
    nombre,
    precio,
    precioEmprendedor,
    precioMayorista,
    categoria,
    stock = 10,
    descripcion = "",
    imagenes = [],
    opciones = {}
  ) => {
    if (!nombre || !categoria) {
      return { error: "Nombre y categoría son requeridos" };
    }

    const preciosIngresados = [
      { campo: "precio", valor: precio },
      { campo: "precio_emprendedor", valor: precioEmprendedor },
      { campo: "precio_mayorista", valor: precioMayorista },
    ].filter(({ valor }) => valor !== null && valor !== undefined && valor !== "");

    const primerPrecioValido = preciosIngresados.find(({ valor }) => {
      const numero = Number(valor);
      return Number.isFinite(numero) && numero >= 0;
    }) || { campo: "precio", valor: 0 };

    const categoriaEncontrada = categorias.find(
      (c) => c.nombre === categoria
    );

    if (!categoriaEncontrada) {
      return { error: "Categoría no encontrada" };
    }

    const productoInsert = {
      nombre,
      precio: primerPrecioValido.campo === "precio" ? Number(primerPrecioValido.valor) : null,
      precio_emprendedor: primerPrecioValido.campo === "precio_emprendedor" ? Number(primerPrecioValido.valor) : (precioEmprendedor != null && precioEmprendedor !== "" && Number(precioEmprendedor) >= 0 ? Number(precioEmprendedor) : null),
      precio_mayorista: primerPrecioValido.campo === "precio_mayorista" ? Number(primerPrecioValido.valor) : (precioMayorista != null && precioMayorista !== "" && Number(precioMayorista) >= 0 ? Number(precioMayorista) : null),
      stock: Number(stock),
      descripcion,
      categoria_id: categoriaEncontrada.id,
      precio_costo: opciones.precio_costo === "" || opciones.precio_costo == null ? null : Number(opciones.precio_costo),
      catalogos_ocultos: opciones.catalogos_ocultos || [],
      minimos_compra: opciones.minimos_compra || {},
      oculto_catalogo: (opciones.catalogos_ocultos || []).length === 3,
    };

    if (productoInsert.precio == null) {
      const precioBase = [
        precio,
        precioEmprendedor,
        precioMayorista,
      ].find((valor) => valor !== null && valor !== undefined && valor !== "" && Number(valor) > 0);
      productoInsert.precio = precioBase != null ? Number(precioBase) : null;
    }

    let imagenesGuardadas = imagenes;
    try {
      imagenesGuardadas = await subirImagenesProducto(supabase, imagenes, "productos");
    } catch (error) {
      return { error: error.message || "No se pudieron subir las imágenes del producto." };
    }

    if (imagenesGuardadas.length > 0) {
      productoInsert.imagen_url = imagenesGuardadas[0] || null;
      productoInsert.imagen_url2 = imagenesGuardadas[1] || null;
      productoInsert.imagen_url3 = imagenesGuardadas[2] || null;
      productoInsert.imagen_url4 = imagenesGuardadas[3] || null;
      productoInsert.imagen_url5 = imagenesGuardadas[4] || null;
    }

    const { data, error } = await supabase
      .from("productos")
      .insert([productoInsert])
      .select(PRODUCT_COLUMNS)
      .single();

    if (error) {
      console.error("Error creando producto:", error);
      return { error: error.message };
    }

    let nuevoProducto = adaptarProducto({ ...data, precio_costo: productoInsert.precio_costo });
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

    const normalizarPrecioParaGuardar = (valor) => {
      if (valor === null || valor === undefined || valor === "") return 0;
      const numero = Number(valor);
      if (!Number.isFinite(numero) || numero < 0) return 0;
      return numero;
    };

    const preciosIngresados = [
      { campo: "precio", valor: datos.precio },
      { campo: "precio_emprendedor", valor: datos.precio_emprendedor },
      { campo: "precio_mayorista", valor: datos.precio_mayorista },
    ].filter(({ valor }) => valor !== null && valor !== undefined && valor !== "");

    const datosActualizacion = {};
    if (datos.nombre != null) datosActualizacion.nombre = datos.nombre;

    if (datos.precio !== undefined) {
      datosActualizacion.precio = normalizarPrecioParaGuardar(datos.precio);
    } else {
      datosActualizacion.precio = normalizarPrecioParaGuardar(producto.precio ?? 0);
    }

    if (datos.precio_emprendedor !== undefined) {
      datosActualizacion.precio_emprendedor = normalizarPrecioParaGuardar(datos.precio_emprendedor);
    } else {
      datosActualizacion.precio_emprendedor = normalizarPrecioParaGuardar(producto.precio_emprendedor ?? 0);
    }

    if (datos.precio_mayorista !== undefined) {
      datosActualizacion.precio_mayorista = normalizarPrecioParaGuardar(datos.precio_mayorista);
    } else {
      datosActualizacion.precio_mayorista = normalizarPrecioParaGuardar(producto.precio_mayorista ?? 0);
    }

    if (datos.stock != null) datosActualizacion.stock = Number(datos.stock);
    if (datos.descripcion != null) datosActualizacion.descripcion = datos.descripcion;
    if (datos.categoria_id != null) datosActualizacion.categoria_id = datos.categoria_id;
    if (datos.precio_costo !== undefined) {
      datosActualizacion.precio_costo = datos.precio_costo === "" || datos.precio_costo == null
        ? null
        : normalizarPrecioParaGuardar(datos.precio_costo);
    }
    if (datos.catalogos_ocultos !== undefined) {
      const catalogosValidos = ["General", "Emprendedor", "Mayorista"];
      datosActualizacion.catalogos_ocultos = catalogosValidos.filter((catalogo) => datos.catalogos_ocultos.includes(catalogo));
      datosActualizacion.oculto_catalogo = datosActualizacion.catalogos_ocultos.length === catalogosValidos.length;
    } else if (datos.oculto_catalogo !== undefined) {
      datosActualizacion.oculto_catalogo = Boolean(datos.oculto_catalogo);
    }
    if (datos.minimos_compra !== undefined) {
      datosActualizacion.minimos_compra = datos.minimos_compra;
    }
    if (datos.imagenes != null) {
      try {
        const imagenesGuardadas = await subirImagenesProducto(supabase, datos.imagenes, `productos/${productoId}`);
        datosActualizacion.imagen_url = imagenesGuardadas[0] || null;
        datosActualizacion.imagen_url2 = imagenesGuardadas[1] || null;
        datosActualizacion.imagen_url3 = imagenesGuardadas[2] || null;
        datosActualizacion.imagen_url4 = imagenesGuardadas[3] || null;
        datosActualizacion.imagen_url5 = imagenesGuardadas[4] || null;
      } catch (error) {
        return { error: error.message || "No se pudieron subir las imágenes del producto." };
      }
    }

    const { data, error } = await supabase
      .from("productos")
      .update(datosActualizacion)
      .eq("id", productoId)
      .select(PRODUCT_COLUMNS)
      .single();

    if (error) {
      console.error("Error actualizando producto:", error);
      return { error: error.message };
    }

    let productoActualizado = adaptarProducto({
      ...data,
      precio_costo: Object.hasOwn(datosActualizacion, "precio_costo")
        ? datosActualizacion.precio_costo
        : producto.precio_costo ?? null,
    });
    if (datos.categoria_id != null) {
      productoActualizado = {
        ...productoActualizado,
        categoria: categorias.find((categoria) => String(categoria.id) === String(datos.categoria_id))?.nombre || producto.categoria,
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
      const catalogosOcultos = ["General", "Emprendedor", "Mayorista"];
      const { error: errorRetiro } = await supabase
        .from("productos")
        .update({ oculto_catalogo: true, catalogos_ocultos: catalogosOcultos })
        .eq("id", productoId);
      if (errorRetiro) throw errorRetiro;

      // Ocultarlo primero evita que se creen nuevos detalles mientras verificamos el historial.
      const { count, error: errorHistorial } = await supabase
        .from("pedido_detalle")
        .select("pedido_id", { count: "exact", head: true })
        .eq("producto_id", productoId);

      if (errorHistorial || count > 0) {
        console.warn("Se conserva el producto retirado para proteger el historial de pedidos:", errorHistorial);
        setProductos((prev) => prev.map((producto) => String(producto.id) === String(productoId)
          ? { ...producto, oculto_catalogo: true, catalogos_ocultos: catalogosOcultos }
          : producto));
        return { success: true, archived: true };
      }

      const { error: errorVariantes } = await supabase
        .from("producto_variantes")
        .delete()
        .eq("producto_id", productoId);
      if (errorVariantes) {
        if (errorVariantes.code === "23503") {
          const { error: errorArchivarVariantes } = await supabase
            .from("producto_variantes")
            .update({ archivada: true })
            .eq("producto_id", productoId);
          if (errorArchivarVariantes) console.error("No se pudieron archivar las variantes del producto:", errorArchivarVariantes);
          setProductos((prev) => prev.map((producto) => String(producto.id) === String(productoId)
            ? { ...producto, oculto_catalogo: true, catalogos_ocultos: catalogosOcultos }
            : producto));
          return { success: true, archived: true };
        }
        throw errorVariantes;
      }

      const { data, error } = await supabase
        .from("productos")
        .delete()
        .eq("id", productoId);

      if (error) {
        if (error.code === "23503") {
          setProductos((prev) => prev.map((producto) => String(producto.id) === String(productoId)
            ? { ...producto, oculto_catalogo: true, catalogos_ocultos: catalogosOcultos }
            : producto));
          return { success: true, archived: true };
        }
        console.error("Error eliminando producto:", error);
        return { error: error.message || String(error) };
      }

      setProductos((prev) => prev.filter((p) => String(p.id) !== String(productoId)));
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

  const validarMinimosCarrito = (carrito) => {
    for (const item of carrito || []) {
      const catalogo = item.tipo_catalogo || "General";
      const minimoProducto = Number(item.minimos_compra?.[catalogo]);
      const minimoGeneral = Number(minimosCompraCatalogo?.[catalogo]);
      const minimo = Number.isInteger(minimoProducto) && minimoProducto > 0
        ? minimoProducto
        : Number.isInteger(minimoGeneral) && minimoGeneral > 0
          ? minimoGeneral
          : MINIMOS_COMPRA_CATALOGO_DEFAULT[catalogo] || 1;
      const cantidad = Number(item.cantidad || 0);
      if (cantidad < minimo || (catalogo === "Mayorista" && cantidad % minimo !== 0)) {
        const producto = item.variante?.nombre ? `${item.nombre} (${item.variante.nombre})` : item.nombre;
        const nombreCatalogo = { General: "Tienda física", Emprendedor: "Mayorista", Mayorista: "Supermayorista" }[catalogo] || catalogo;
        const multiple = catalogo === "Mayorista" ? ` y en múltiplos de ${minimo}` : "";
        return `${producto}: el mínimo de ${nombreCatalogo} es ${minimo} unidades${multiple}.`;
      }
    }
    const totalesPorCatalogo = {};
    for (const item of carrito || []) {
      const catalogo = item.tipo_catalogo || "General";
      totalesPorCatalogo[catalogo] = (totalesPorCatalogo[catalogo] || 0) + Number(item.precio || 0) * Number(item.cantidad || 0);
    }
    for (const [catalogo, total] of Object.entries(totalesPorCatalogo)) {
      const minimo = Number(montosMinimosCompraCatalogo?.[catalogo]) || 0;
      if (minimo > 0 && total < minimo) {
        const nombreCatalogo = { General: "Tienda física", Emprendedor: "Mayorista", Mayorista: "Supermayorista" }[catalogo] || catalogo;
        return `El pedido del catálogo ${nombreCatalogo} debe ser mínimo de $${minimo.toLocaleString("es-CO")}. Agrega $${(minimo - total).toLocaleString("es-CO")} para continuar.`;
      }
    }
    return "";
  };

  const crearPedidoSeguro = async ({ clienteId, cedula, nombre, direccion, correo = "", telefono = "", carrito, formaPago }) => {
    if (!clienteId || !Array.isArray(carrito) || carrito.length === 0) {
      return { error: "Selecciona un cliente y agrega productos para crear el pedido." };
    }
    const errorMinimo = validarMinimosCarrito(carrito);
    if (errorMinimo) return { error: errorMinimo };

    try {
      const lineas = carrito.map((item) => ({
        producto_id: item.producto_id ?? item.variante?.producto_id ?? item.id,
        variante_id: item.variante?.id ?? item.variante_id ?? null,
        cantidad: Number(item.cantidad || 1),
        tipo_catalogo: item.tipo_catalogo || "General",
      }));
      const { data, error } = await supabase.rpc("crear_pedido_seguro", {
        p_cliente_id: Number(clienteId),
        p_forma_pago: formaPago,
        p_lineas: lineas,
      });

      if (error) {
        console.error("Error creando pedido seguro:", error);
        return { error: error.message };
      }

      const resultado = typeof data === "string" ? JSON.parse(data) : data;
      const total = Number(resultado.total || 0);
      const clienteActual = clientes.find((cliente) => String(cliente.id) === String(clienteId));
      const clienteParaPedido = clienteActual || {
        id: clienteId,
        cliente_id: clienteId,
        cedula,
        nombre,
        direccion,
        correo,
        telefono,
        saldo: 0,
        transacciones: [],
      };
      const clientesParaPedido = clienteActual ? clientes : [...clientes, clienteParaPedido];
      const pedidoFallback = adaptarPedido({
        id: resultado.id,
        cliente_id: resultado.cliente_id ?? clienteId,
        cedula,
        nombre,
        direccion,
        forma_pago: formaPago,
        total,
        estado: "Pendiente",
        created_at: new Date().toISOString(),
      }, carrito, clientesParaPedido);

      const cantidadesBase = new Map();
      carrito.forEach((item) => {
        // General corresponde al catálogo de Tienda física, el único que descuenta existencias.
        if ((item.tipo_catalogo || "General") !== "General") return;
        if (item.variante || item.variante_id) return;
        const productoId = item.producto_id ?? item.id;
        cantidadesBase.set(
          String(productoId),
          (cantidadesBase.get(String(productoId)) || 0) + Number(item.cantidad || 1)
        );
      });
      setProductos((prev) => prev.map((producto) => {
        const cantidad = cantidadesBase.get(String(producto.id));
        return cantidad == null ? producto : { ...producto, stock: Math.max(0, Number(producto.stock || 0) - cantidad) };
      }));

      const transaccion = {
        id: `pedido-${resultado.id}`,
        tipo: "pedido",
        monto: total,
        descripcion: `Pedido ${resultado.id}`,
        metodoPago: formaPago,
        fecha: new Date().toISOString().slice(0, 10),
      };
      setClientes((prev) => prev.some((actual) => String(actual.id) === String(clienteId))
        ? prev.map((actual) => String(actual.id) === String(clienteId)
          ? {
              ...actual,
              saldo: Number(actual.saldo || 0) + total,
              transacciones: [...(actual.transacciones || []), transaccion],
            }
          : actual)
        : [...prev, {
            ...clienteParaPedido,
            saldo: total,
            transacciones: [...(clienteParaPedido.transacciones || []), transaccion],
          }]);

      const pedido = pedidoFallback;
      setPedidos((prev) => [
        ...prev.filter((actual) => String(actual.id) !== String(pedidoFallback.id)),
        pedidoFallback,
      ]);

      void notificarEventoApp("pedido_nuevo", resultado.id);
      return { success: true, pedido, total };
    } catch (error) {
      console.error("Excepción creando pedido seguro:", error);
      return { error: error.message || "Error al crear el pedido" };
    }
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

    const clienteId = clienteIdManual || clienteEncontrado?.id;
    const resultadoPedido = await crearPedidoSeguro({
      clienteId,
      cedula,
      nombre,
      direccion,
      carrito,
      formaPago,
      correo: emailCliente,
      telefono: telefonoCliente,
    });
    if (!resultadoPedido.success) return { error: resultadoPedido.error };

      // Enviar correo de confirmación al cliente
      if (emailDestino) {
        try {
          await enviarConfirmacionPedido({
            pedidoId: resultadoPedido.pedido.id,
            cliente: nombre,
            email: emailDestino,
            telefono: telefonoCliente || clienteEncontrado?.telefono,
            items: carrito,
            total: resultadoPedido.total,
            formaPago,
            direccion,
          });
        } catch (errorEmail) {
          console.error("Error enviando correo de confirmación:", errorEmail);
          // No retornar error aquí, el pedido ya fue creado
        }
      }

    return { success: true, pedido: resultadoPedido.pedido };
  };

const crearVendedor = async (nombre, zona, email, password) => {
  if (!nombre || !zona || !email || !password) {
    return { error: "Nombre, zona, email y contraseña son requeridos" };
  }

  const { data: { session: previousSession } } = await supabase.auth.getSession();
  if (!previousSession) return { error: "Se requiere una sesión administrativa para crear vendedores." };
  const { data: perfilCreador, error: errorPerfilCreador } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", previousSession.user.id)
    .maybeSingle();
  if (errorPerfilCreador) return { error: errorPerfilCreador.message };
  if (perfilCreador?.rol !== "admin") return { error: "Solo un administrador puede crear vendedores." };

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

    const { error: restoreAfterSignupError } = await supabase.auth.setSession({
      access_token: previousSession.access_token,
      refresh_token: previousSession.refresh_token,
    });
    if (restoreAfterSignupError) return { error: restoreAfterSignupError.message };

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
        .select("id,nombre,cedula,rol,zona,email,created_at")
        .single();

    if (errorUsuario) {
      console.error("Error creando usuario vendedor:", errorUsuario);

      const rollbackAuth = await eliminarUsuarioAuthSeguro(userId);
      if (rollbackAuth.error) console.error("No se pudo revertir la cuenta Auth:", rollbackAuth.error);

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

    // La fuente de vendedores es `usuarios` con rol `vendedor`.
    await cargarUsuariosVendedores();

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
      vendedor: usuarioData,
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
    password = ""
  ) => {
    if (!nombre || !cedula || !direccion) {
      return { error: "Nombre, cédula y dirección son requeridos" };
    }

    // Si se proporciona correo, seguiremos la misma lógica que crearVendedor:
    // 1) crear usuario en Auth, 2) insertar en table `usuarios`, 3) insertar en `clientes`.
    if (correo && correo.trim() !== "" && password) {
      const { data: { session: previousSession } } = await supabase.auth.getSession();
      if (previousSession) {
        const { data: perfilActual, error: errorPerfilActual } = await supabase
          .from("usuarios")
          .select("rol")
          .eq("id", previousSession.user.id)
          .maybeSingle();
        if (errorPerfilActual) return { error: errorPerfilActual.message };
        if (perfilActual?.rol !== "admin") return { error: "Solo un administrador puede crear clientes para otras cuentas." };
      }

      try {
        if (previousSession) {
          const { data: usuarioExistenteEmail, error: errorUsuarioEmail } = await supabase
            .from("usuarios")
            .select("id")
            .eq("email", correo)
            .maybeSingle();
          if (errorUsuarioEmail) return { error: errorUsuarioEmail.message };
          const { data: usuarioExistenteCedula, error: errorUsuarioCedula } = await supabase
            .from("usuarios")
            .select("id")
            .eq("cedula", cedula)
            .maybeSingle();
          if (errorUsuarioCedula) return { error: errorUsuarioCedula.message };
          if (usuarioExistenteEmail || usuarioExistenteCedula) {
            return { error: "Ya existe un usuario con ese email o cédula" };
          }
        }

        // Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: correo,
          password,
          options: { data: { nombre, cedula, direccion, telefono, role: "cliente", perfil_creado_por_admin: Boolean(previousSession) } },
        });

        if (authError) {
          console.error("Error creando usuario en Auth:", authError);
          return { error: authError.message };
        }

        if (!authData.user?.id) {
          return { error: "No se pudo obtener el ID del usuario creado" };
        }

        if (!previousSession) {
          if (!authData.session) {
            return { success: true, pendienteConfirmacion: true, userId: authData.user.id };
          }
          const resultadoPerfil = await asegurarPerfilCliente(supabase, authData.user, {
            nombre, cedula, direccion, telefono, correo,
          });
          if (resultadoPerfil.error) return { error: resultadoPerfil.error };
          const clientePropio = resultadoPerfil.cliente;
          if (clientePropio) setClientes((prev) => [...prev, clientePropio]);
          return { success: true, cliente: clientePropio };
        }

        const userId = authData.user.id;

        if (previousSession) {
          const { error: restoreAfterSignupError } = await supabase.auth.setSession({
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
          if (restoreAfterSignupError) return { error: restoreAfterSignupError.message };
        }

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
          .select("id,nombre,cedula,rol,zona,email,created_at")
          .single();

        if (errorUsuario) {
          console.error("Error creando usuario cliente:", errorUsuario);
          // rollback: eliminar usuario auth creado
          const rollbackAuth = await eliminarUsuarioAuthSeguro(userId);
          if (rollbackAuth.error) console.error("No se pudo revertir la cuenta Auth:", rollbackAuth.error);

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
          const rollbackAuth = await eliminarUsuarioAuthSeguro(userId);
          if (rollbackAuth.error) console.error("No se pudo revertir la cuenta Auth:", rollbackAuth.error);
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

    // Cliente sin cuenta de acceso: guardar sólo su ficha, nunca una contraseña local.
    try {
      const { data: clienteExistente, error: clienteExistenteError } = await supabase
        .from("clientes")
        .select("id")
        .eq("cedula", cedula)
        .maybeSingle();

      if (clienteExistenteError) {
        console.error("Error verificando cliente existente:", clienteExistenteError);
        return { error: clienteExistenteError.message };
      }
      if (clienteExistente) {
        return { error: "Ya existe un cliente con esta cédula." };
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

  const crearClienteVendedor = async ({ nombre, cedula, direccion, telefono = "", correo = "" } = {}) => {
    const nombreLimpio = String(nombre ?? "").trim();
    const cedulaLimpia = String(cedula ?? "").trim();
    const direccionLimpia = String(direccion ?? "").trim();
    if (!nombreLimpio || !cedulaLimpia || !direccionLimpia) {
      return { error: "Nombre, cédula y dirección son requeridos." };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return { error: "Debes iniciar sesión para crear un cliente." };
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios").select("rol").eq("id", session.user.id).maybeSingle();
      if (perfilError) return { error: perfilError.message };
      if (perfil?.rol !== "vendedor") return { error: "Esta acción está disponible solo para vendedores." };

      const { data: existente, error: consultaError } = await supabase
        .from("clientes").select("id").eq("cedula", cedulaLimpia).maybeSingle();
      if (consultaError) return { error: consultaError.message };
      if (existente) return { error: "Ya existe un cliente con esta cédula." };

      const { data, error } = await supabase.from("clientes").insert({
        nombre: nombreLimpio,
        cedula: cedulaLimpia,
        direccion: direccionLimpia,
        telefono: String(telefono ?? "").trim(),
        correo: String(correo ?? "").trim(),
        vendedor_usuario_id: session.user.id,
      }).select().single();
      if (error) return { error: error.message };

      const clienteCreado = {
        ...data,
        vendedor_id: data.vendedor_usuario_id ?? session.user.id,
        vendedor_usuario_id: data.vendedor_usuario_id ?? session.user.id,
        saldo: data.saldo ?? 0,
        transacciones: data.transacciones ?? [],
      };
      setClientes((prev) => [...prev, clienteCreado]);
      void notificarEventoApp("nuevo_cliente", data.id);
      return { success: true, cliente: clienteCreado };
    } catch (error) {
      console.error("Error creando cliente desde vendedor:", error);
      return { error: error.message || "No se pudo crear el cliente." };
    }
  };

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
    if (!previousSession) return { error: "Se requiere una sesión administrativa para crear repartidores." };
    const { data: perfilCreador, error: errorPerfilCreador } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", previousSession.user.id)
      .maybeSingle();
    if (errorPerfilCreador) return { error: errorPerfilCreador.message };
    if (perfilCreador?.rol !== "admin") return { error: "Solo un administrador puede crear repartidores." };

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

      const { error: restoreAfterSignupError } = await supabase.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });
      if (restoreAfterSignupError) return { error: restoreAfterSignupError.message };

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
          .select("id,nombre,cedula,rol,zona,email,created_at")
          .single();

      if (errorUsuario) {
        console.error("Error creando usuario repartidor:", errorUsuario);

        // rollback: eliminar usuario auth creado
        const rollbackAuth = await eliminarUsuarioAuthSeguro(userId);
        if (rollbackAuth.error) console.error("No se pudo revertir la cuenta Auth:", rollbackAuth.error);

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

      // Eliminar Auth desde una función protegida antes de borrar el perfil local.
      const authResult = await eliminarUsuarioAuthSeguro(id);
      if (authResult.error) return { error: authResult.error };

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

    const { error } = await supabase.rpc("registrar_pago", {
      p_cliente_id: Number(clienteId),
      p_monto: Number(monto),
      p_metodo: metodoPago,
      p_descripcion: descripcion,
    });

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

  const actualizarPerfilPropioCliente = async (cambios) => {
    const { data, error } = await supabase.rpc("actualizar_perfil_cliente", {
      p_cambios: {
        nombre: String(cambios.nombre || "").trim(),
        cedula: String(cambios.cedula || "").trim(),
        telefono: String(cambios.telefono || "").trim(),
        direccion: String(cambios.direccion || "").trim(),
      },
    });
    if (error) {
      console.error("Error actualizando perfil propio:", error);
      return false;
    }

    const clienteActualizado = data?.cliente;
    if (!clienteActualizado) return false;
    setClientes((prev) => prev.map((cliente) =>
      String(cliente.id) === String(clienteActualizado.id)
        ? { ...cliente, ...clienteActualizado }
        : cliente
    ));
    return true;
  };

  const esAdministradorActual = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;
    const { data: perfil, error } = await supabase
      .from("usuarios").select("rol").eq("id", session.user.id).maybeSingle();
    return !error && perfil?.rol === "admin";
  };

  const actualizarClienteTelefono = async (clienteId, telefono) => {
    if (!(await esAdministradorActual())) return false;
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
    if (!(await esAdministradorActual())) return false;
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
    if (!(await esAdministradorActual())) return false;
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

  const actualizarClienteCompleto = async (clienteId, datos) => {
    if (!(await esAdministradorActual())) return { error: "Solo un administrador puede modificar clientes." };
    const datosActualizados = {
      cedula: datos.cedula,
      nombre: datos.nombre,
      direccion: datos.direccion,
      telefono: datos.telefono || "",
      correo: datos.correo || "",
      vendedor_usuario_id: datos.vendedor_id || null,
    };
    const { error } = await supabase
      .from("clientes")
      .update(datosActualizados)
      .eq("id", clienteId);

    if (error) {
      console.error("Error actualizando cliente:", error);
      return { error: error.message || "No se pudo actualizar el cliente." };
    }

    setClientes((prev) => prev.map((cliente) => (
      String(cliente.id) === String(clienteId)
        ? {
            ...cliente,
            ...datosActualizados,
            vendedor_id: datosActualizados.vendedor_usuario_id,
          }
        : cliente
    )));
    return { success: true };
  };

  const eliminarCliente = async (clienteId) => {
    if (!(await esAdministradorActual())) return { error: "Solo un administrador puede eliminar clientes." };
    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", clienteId);

    if (error) {
      console.error("Error eliminando cliente:", error);
      return { error: error.message || "No se pudo eliminar el cliente." };
    }

    setClientes((prev) => prev.filter((cliente) => String(cliente.id) !== String(clienteId)));
    return { success: true };
  };

  const obtenerClienteActual = (usuarioId, emailFallback = null) => {
    if (!usuarioId && !emailFallback) return null;
    
    
    // Primero intenta buscar por usuario_id
    let cliente = usuarioId ? clientes.find((c) => String(c.usuario_id) === String(usuarioId)) : null;
    
    // Si no encuentra y tiene email, busca por email
    if (!cliente && emailFallback) {
      cliente = clientes.find((c) => c.correo && c.correo.toLowerCase() === emailFallback.toLowerCase());
    }
    
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

      const authResult = await eliminarUsuarioAuthSeguro(vendedorUsuarioId);
      if (authResult.error) return { error: authResult.error };

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

      return { success: true };
    } catch (err) {
      console.error("Error eliminando vendedor:", err);
      return { error: err.message || "Error al eliminar vendedor" };
    }
  };

  const cambiarEstadoPedido = async (pedidoId, estado, desdeRepartidor = false) => {
    const estadosPermitidos = ["Pendiente", "En camino", "Cancelado", "Entregado"];
    if (!estadosPermitidos.includes(estado)) {
      console.warn("Estado no permitido:", estado);
      return false;
    }
    if (desdeRepartidor && !["En camino", "Entregado", "Cancelado"].includes(estado)) return false;
    const pedidoActual = pedidos.find((pedido) => pedido.id === pedidoId);
    if (pedidoActual?.estado === "Confirmado" || pedidoActual?.pre_alistamiento?.confirmado) return false;

    try {
      const respuesta = desdeRepartidor
        ? await supabase.rpc("actualizar_estado_repartidor", {
            p_pedido_id: Number(pedidoId),
            p_estado: estado,
          })
        : await supabase
            .from("pedidos")
            .update({ estado })
            .eq("id", pedidoId);
      const { error } = respuesta;

      if (error) {
        console.error("Error cambiando estado de pedido:", error);
        return false;
      }

      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === pedidoId ? { ...pedido, estado } : pedido
        )
      );
      if (["En camino", "Entregado", "Cancelado"].includes(estado)) {
        const tiposPorEstado = { "En camino": "pedido_en_camino", Entregado: "pedido_entregado", Cancelado: "pedido_cancelado" };
        void notificarEventoApp(tiposPorEstado[estado], pedidoId);
      }
      return true;
    } catch (err) {
      console.error("Excepción cambiando estado de pedido:", err);
      return false;
    }
  };

  const actualizarFormaPagoPedido = async (pedidoId, formaPago) => {
    const formasPagoPermitidas = ["Efectivo", "Crédito", "Abono"];
    if (!formasPagoPermitidas.includes(formaPago)) return false;
    const pedidoActual = pedidos.find((pedido) => pedido.id === pedidoId);
    if (pedidoActual?.estado === "Confirmado" || pedidoActual?.pre_alistamiento?.confirmado) return false;

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ forma_pago: formaPago })
        .eq("id", pedidoId);

      if (error) {
        console.error("Error actualizando forma de pago del pedido:", error);
        return false;
      }

      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === pedidoId ? { ...pedido, formaPago } : pedido
        )
      );
      return true;
    } catch (err) {
      console.error("Excepción actualizando forma de pago del pedido:", err);
      return false;
    }
  };

  const actualizarFechaPedido = async (pedidoId, fecha) => {
    const pedidoActual = pedidos.find((pedido) => pedido.id === pedidoId);
    if (pedidoActual?.estado === "Confirmado" || pedidoActual?.pre_alistamiento?.confirmado) return false;
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
    const pedidoAntes = pedidos.find((pedido) => String(pedido.id) === String(pedidoId));
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

      if (repartidorId && String(pedidoAntes?.repartidor_id || "") !== String(repartidorId)) {
        void notificarEventoApp("pedido_asignado", pedidoId);
      }

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
    if (pedido.estado === "Confirmado" || pedido.pre_alistamiento?.confirmado) return false;

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
          producto_id: item.producto_id ?? item.id,
          variante_id: item.variante?.id ?? item.variante_id ?? null,
          tipo_catalogo: item.tipo_catalogo || "General",
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

  const actualizarPrealistamientoPedido = async (pedidoId, preAlistamiento, estado = null) => {
    const pedidoAntes = pedidos.find((pedido) => String(pedido.id) === String(pedidoId));
    try {
      const cambios = { pre_alistamiento: preAlistamiento };
      if (estado) cambios.estado = estado;
      const { error } = await supabase
        .from("pedidos")
        .update(cambios)
        .eq("id", pedidoId);

      if (error) {
        console.error("Error guardando pre-alistamiento del pedido:", error);
        return { success: false, message: error.message };
      }

      setPedidos((prev) => prev.map((pedido) =>
        String(pedido.id) === String(pedidoId)
          ? { ...pedido, pre_alistamiento: preAlistamiento, ...(estado ? { estado } : {}) }
          : pedido
      ));
      if (estado === "Confirmado" && preAlistamiento?.confirmado && pedidoAntes?.estado !== "Confirmado" && !pedidoAntes?.pre_alistamiento?.confirmado) {
        void notificarEventoApp("pedido_confirmado", pedidoId);
      }
      return { success: true };
    } catch (error) {
      console.error("Excepción guardando pre-alistamiento del pedido:", error);
      return { success: false, message: error.message || "Error inesperado" };
    }
  };

  const actualizarObservacionPedido = async (pedidoId, observacion) => {
    const observacionGuardada = String(observacion ?? "").trim();
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ observacion: observacionGuardada || null })
        .eq("id", pedidoId);

      if (error) {
        console.error("Error guardando observación del pedido:", error);
        return false;
      }

      setPedidos((prev) => prev.map((pedido) =>
        String(pedido.id) === String(pedidoId)
          ? { ...pedido, observacion: observacionGuardada }
          : pedido
      ));
      return true;
    } catch (error) {
      console.error("Excepción guardando observación del pedido:", error);
      return false;
    }
  };

  const actualizarObservacionVendedor = async (pedidoId, observacion) => {
    const observacionGuardada = String(observacion ?? "").trim();
    const { error } = await supabase.rpc("actualizar_pedido_vendedor", {
      p_pedido_id: Number(pedidoId),
      p_cambios: { observacion: observacionGuardada || null },
    });
    if (error) {
      console.error("Error guardando observación del vendedor:", error);
      return false;
    }
    setPedidos((prev) => prev.map((pedido) =>
      String(pedido.id) === String(pedidoId)
        ? { ...pedido, observacion: observacionGuardada }
        : pedido
    ));
    return true;
  };

  const actualizarFormaPagoVendedor = async (pedidoId, formaPago) => {
    const formasPermitidas = ["Efectivo", "Crédito", "Abono"];
    if (!formasPermitidas.includes(formaPago)) return false;
    const { error } = await supabase.rpc("actualizar_pedido_vendedor", {
      p_pedido_id: Number(pedidoId),
      p_cambios: { forma_pago: formaPago },
    });
    if (error) {
      console.error("Error actualizando forma de pago del vendedor:", error);
      return false;
    }
    setPedidos((prev) => prev.map((pedido) =>
      String(pedido.id) === String(pedidoId)
        ? { ...pedido, formaPago }
        : pedido
    ));
    return true;
  };

  const agregarItemPedido = async (pedidoId, productoId, nombre, precio, cantidad, itemMeta = {}) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return false;

    const nuevoItem = {
      id: productoId,
      producto_id: itemMeta.producto_id ?? productoId,
      nombre,
      precio,
      cantidad,
      imagen: itemMeta.imagen ?? "",
      variante: itemMeta.variante ?? null,
      tipo_catalogo: itemMeta.tipo_catalogo || "General",
    };
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
      setCategorias,
      crearProducto,
      actualizarStock,
      agotarProducto,
      crearPedido,
      crearPedidoSeguro,
      crearCliente,
      crearClienteVendedor,
      actualizarClienteCompleto,
      eliminarCliente,
      crearVendedor,
      actualizarClienteVendedor,
      obtenerClientesPorVendedor,
      calcularVentasPorVendedor,
      crearRepartidor,
      eliminarRepartidor,
      registrarPago,
      actualizarPerfilPropioCliente,
      actualizarClienteTelefono,
      actualizarClienteDireccion,
      obtenerClienteActual,
      actualizarClienteNombre,
      actualizarClienteCedula,
      cambiarEstadoPedido,
      actualizarFormaPagoPedido,
      actualizarFechaPedido,
      eliminarPedido,
      asignarRepartidor,
      agregarItemPedido,
      actualizarItemsPedido: updatePedidoItems,
      actualizarPrealistamientoPedido,
      actualizarObservacionPedido,
      actualizarObservacionVendedor,
      actualizarFormaPagoVendedor,
      eliminarItemPedido,
      actualizarCantidadItemPedido,
      actualizarProducto,
      eliminarProducto,
      eliminarVendedor,
      cargandoCategorias,
      vendedoresConUsuarios,
      bannerUrl,
      bannerImages,
      guardarImagenesBanner,
      bannerVisible,
      guardarBannerVisible,
      catalogosOcultos,
      guardarCatalogosOcultos,
      minimosCompraCatalogo,
      montosMinimosCompraCatalogo,
      guardarMinimosCompraCatalogo,
      setBannerUrl,
      guardarBannerUrl,
      subirBanner,
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

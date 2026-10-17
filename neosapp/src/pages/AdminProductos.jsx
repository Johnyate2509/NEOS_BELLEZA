import { Fragment, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { supabase } from "../context/supabaseClient";
import * as XLSX from "xlsx";
import HorizontalScroll from "../components/HorizontalScroll";
import "../styles/admin-productos.css";

const FORMULARIO_VACIO = {
  nombre: "",
  categoria_id: "",
  stock: "0",
  precio: "",
  precio_emprendedor: "",
  precio_mayorista: "",
  minimos_compra: { General: "", Emprendedor: "", Mayorista: "" },
  precio_costo: "",
  descripcion: "",
  imagenes: [],
  catalogos_ocultos: [],
};

const VARIANTE_VACIA = {
  nombre: "",
  atributos: "",
  precio: "",
  precio_emprendedor: "",
  precio_mayorista: "",
  stock: "0",
  imagenes: [],
};

const BORRADOR_STORAGE_KEY = "neosapp_admin_productos_borrador";
const BUSQUEDA_STORAGE_KEY = "neosapp_admin_productos_busqueda";

const leerBusquedaGuardada = () => {
  try {
    return window.localStorage.getItem(BUSQUEDA_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const leerBorrador = () => {
  try {
    const guardado = window.localStorage.getItem(BORRADOR_STORAGE_KEY);
    if (!guardado) return null;
    const borrador = JSON.parse(guardado);
    if (!borrador.formulario || typeof borrador.formulario !== "object") return null;
    return {
      productoActivo: borrador.productoActivo || null,
      formulario: {
        ...FORMULARIO_VACIO,
        ...borrador.formulario,
        imagenes: Array.isArray(borrador.formulario.imagenes) ? borrador.formulario.imagenes : [],
        catalogos_ocultos: Array.isArray(borrador.formulario.catalogos_ocultos)
          ? borrador.formulario.catalogos_ocultos
          : [],
      },
    };
  } catch {
    return null;
  }
};

const borrarBorrador = () => {
  try {
    window.localStorage.removeItem(BORRADOR_STORAGE_KEY);
  } catch {
    return;
  }
};

const CATALOGOS = [
  { id: "General", label: "Tienda física" },
  { id: "Emprendedor", label: "Mayorista" },
  { id: "Mayorista", label: "Supermayorista" },
];

const CAMPOS_PRODUCTO_IMPORTACION = [
  { key: "nombre", label: "Nombre", obligatorio: true },
  { key: "categoria", label: "Categoría", obligatorio: true },
  { key: "stock", label: "Stock" },
  { key: "precio", label: "Precio tienda física" },
  { key: "precio_emprendedor", label: "Precio mayorista" },
  { key: "precio_mayorista", label: "Precio supermayorista" },
  { key: "precio_costo", label: "Precio de costo" },
  { key: "descripcion", label: "Descripción" },
  { key: "minimo_General", label: "Mínimo tienda física" },
  { key: "minimo_Emprendedor", label: "Mínimo mayorista" },
  { key: "minimo_Mayorista", label: "Mínimo supermayorista" },
];

const CAMPOS_VARIANTE_IMPORTACION = [
  { key: "nombre", label: "Nombre variante" },
  { key: "atributos", label: "Atributos (texto o JSON)" },
  { key: "stock", label: "Stock variante" },
  { key: "precio", label: "Precio variante tienda física" },
  { key: "precio_emprendedor", label: "Precio variante mayorista" },
  { key: "precio_mayorista", label: "Precio variante supermayorista" },
  { key: "precio_costo", label: "Precio de costo variante" },
];

const valorCeldaVacia = (valor) => valor == null || String(valor).trim() === "";

const convertirNumeroCelda = (valor, etiqueta, fila, { permitirVacio = false, entero = false } = {}) => {
  if (valorCeldaVacia(valor)) {
    if (permitirVacio) return null;
    throw new Error(`Fila ${fila}: falta el valor de ${etiqueta}.`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || (entero && !Number.isInteger(numero))) {
    throw new Error(`Fila ${fila}: ${etiqueta} debe ser ${entero ? "un entero" : "un número"} igual o mayor a cero.`);
  }
  return numero;
};

const procesarFilasPorLotes = async (filas, procesarFila, tamanoLote = 5) => {
  for (let inicio = 0; inicio < filas.length; inicio += tamanoLote) {
    const lote = filas.slice(inicio, inicio + tamanoLote);
    await Promise.all(lote.map((fila, indice) => procesarFila(fila, inicio + indice)));
  }
};

const formatearPrecio = (precio) =>
  precio == null || precio === "" || Number(precio) === 0
    ? "—"
    : `$${Number(precio).toLocaleString("es-CO")}`;

const formatearAtributos = (atributos) =>
  typeof atributos === "string" ? atributos : atributos ? JSON.stringify(atributos) : "—";

const obtenerNombreCategoria = (producto, categorias) =>
  producto.categorias?.nombre ||
  producto.categoria ||
  categorias.find((categoria) => String(categoria.id) === String(producto.categoria_id))?.nombre ||
  "Sin categoría";

export default function AdminProductos() {
  const { esAdmin } = useAuth();
  const { productos, setProductos, categorias, crearProducto, actualizarProducto, eliminarProducto, minimosCompraCatalogo, guardarMinimosCompraCatalogo } = useStore();
  const esAdministrador = esAdmin();
  const [borradorInicial] = useState(leerBorrador);
  const [busqueda, setBusqueda] = useState(leerBusquedaGuardada);
  const [filtroVisibilidad, setFiltroVisibilidad] = useState("todos");
  const [productoActivo, setProductoActivo] = useState(borradorInicial?.productoActivo ?? null);
  const [formularioAbierto, setFormularioAbierto] = useState(Boolean(borradorInicial));
  const [formulario, setFormulario] = useState(borradorInicial?.formulario ?? FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [productoExpandidoId, setProductoExpandidoId] = useState(null);
  const [variantesPorProducto, setVariantesPorProducto] = useState({});
  const [cargandoVariantes, setCargandoVariantes] = useState({});
  const [erroresVariantes, setErroresVariantes] = useState({});
  const [filtroVariantes, setFiltroVariantes] = useState("");
  const [productoVarianteActivo, setProductoVarianteActivo] = useState(null);
  const [varianteActiva, setVarianteActiva] = useState(null);
  const [formularioVariante, setFormularioVariante] = useState(VARIANTE_VACIA);
  const [guardandoVariante, setGuardandoVariante] = useState(false);
  const [errorVariante, setErrorVariante] = useState("");
  const [administrarCatalogosAbierto, setAdministrarCatalogosAbierto] = useState(false);
  const [minimosCatalogosFormulario, setMinimosCatalogosFormulario] = useState({ General: "1", Emprendedor: "3", Mayorista: "6" });
  const [guardandoMinimosCatalogos, setGuardandoMinimosCatalogos] = useState(false);
  const [importarPlantillaAbierto, setImportarPlantillaAbierto] = useState(false);
  const [camposProductoImportacion, setCamposProductoImportacion] = useState(() => Object.fromEntries(
    CAMPOS_PRODUCTO_IMPORTACION.map((campo) => [campo.key, true])
  ));
  const [camposVarianteImportacion, setCamposVarianteImportacion] = useState(() => Object.fromEntries(
    CAMPOS_VARIANTE_IMPORTACION.map((campo) => [campo.key, true])
  ));
  const [incluirVariantesImportacion, setIncluirVariantesImportacion] = useState(true);
  const [archivoImportacion, setArchivoImportacion] = useState(null);
  const [importandoPlantilla, setImportandoPlantilla] = useState(false);

  const cerrarImportarPlantilla = () => {
    if (importandoPlantilla) return;
    setImportarPlantillaAbierto(false);
    setArchivoImportacion(null);
  };

  const descargarPlantillaExcel = async () => {
    const camposProducto = CAMPOS_PRODUCTO_IMPORTACION.filter((campo) =>
      campo.obligatorio || camposProductoImportacion[campo.key]
    );
    const camposVariante = CAMPOS_VARIANTE_IMPORTACION.filter((campo) => camposVarianteImportacion[campo.key]);
    const hojaProductos = [
      ["ID producto", ...camposProducto.map((campo) => campo.label)],
      ...productos.map((producto) => [
        producto.id,
        ...camposProducto.map((campo) => {
          if (campo.key === "categoria") return obtenerNombreCategoria(producto, categorias);
          if (campo.key === "minimo_General") return producto.minimos_compra?.General ?? "";
          if (campo.key === "minimo_Emprendedor") return producto.minimos_compra?.Emprendedor ?? "";
          if (campo.key === "minimo_Mayorista") return producto.minimos_compra?.Mayorista ?? "";
          return producto[campo.key] ?? "";
        }),
      ]),
      ["", ...camposProducto.map(() => "")],
    ];
    const libro = XLSX.utils.book_new();
    const sheetProductos = XLSX.utils.aoa_to_sheet(hojaProductos);
    sheetProductos["!cols"] = [{ wch: 14 }, ...camposProducto.map((campo) => ({ wch: Math.max(18, campo.label.length + 2) }))];
    XLSX.utils.book_append_sheet(libro, sheetProductos, "Productos");

    if (incluirVariantesImportacion && camposVariante.length) {
      const { data, error: errorVariantes } = await supabase
        .from("producto_variantes")
        .select("id,producto_id,nombre,atributos,precio,precio_emprendedor,precio_mayorista,stock,archivada")
        .eq("archivada", false)
        .order("producto_id", { ascending: true });
      if (errorVariantes) {
        setError(`No se pudieron preparar las variantes de la plantilla: ${errorVariantes.message}`);
        return;
      }
      const { data: costosVariantes, error: errorCostosVariantes } = await supabase.rpc("admin_list_product_costs");
      if (errorCostosVariantes) {
        setError(`No se pudieron cargar los precios de costo de las variantes: ${errorCostosVariantes.message}`);
        return;
      }
      const costosPorVariante = new Map(
        (costosVariantes || [])
          .filter((fila) => fila.table_name === "producto_variantes")
          .map((fila) => [String(fila.row_id), fila.precio_costo])
      );
      const porId = new Map(productos.map((producto) => [String(producto.id), producto]));
      const hojaVariantes = [
        ["ID variante", "ID producto", "Producto", ...camposVariante.map((campo) => campo.label)],
        ...(data || []).map((variante) => [
          variante.id,
          variante.producto_id,
          porId.get(String(variante.producto_id))?.nombre || "",
          ...camposVariante.map((campo) => {
            const valor = campo.key === "precio_costo"
              ? costosPorVariante.get(String(variante.id))
              : variante[campo.key];
            return campo.key === "atributos" && valor && typeof valor === "object" ? JSON.stringify(valor) : valor ?? "";
          }),
        ]),
        ["", "", "", ...camposVariante.map(() => "")],
      ];
      const sheetVariantes = XLSX.utils.aoa_to_sheet(hojaVariantes);
      sheetVariantes["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 30 }, ...camposVariante.map((campo) => ({ wch: Math.max(20, campo.label.length + 2) }))];
      XLSX.utils.book_append_sheet(libro, sheetVariantes, "Variantes");
    }

    XLSX.writeFile(libro, "plantilla_importar_productos.xlsx");
    setError("");
    setMensaje("Plantilla descargada. Edita las filas actuales o agrega filas nuevas y luego impórtala aquí.");
  };

  const importarArchivoExcel = async () => {
    if (!archivoImportacion) {
      setError("Selecciona primero un archivo de Excel para importar.");
      return;
    }
    setImportandoPlantilla(true);
    setError("");
    setMensaje("");
    const erroresImportacion = [];
    let productosCreados = 0;
    let productosActualizados = 0;
    let variantesCreadas = 0;
    let variantesActualizadas = 0;

    try {
      const libro = XLSX.read(await archivoImportacion.arrayBuffer(), { type: "array", cellFormula: false, cellHTML: false });
      const hojaProductos = libro.Sheets.Productos;
      if (!hojaProductos) throw new Error("El archivo debe contener una hoja llamada Productos.");
      const filasProductos = XLSX.utils.sheet_to_json(hojaProductos, { header: 1, defval: "", raw: true });
      const cabecerasProductos = (filasProductos.shift() || []).map((cabecera) => String(cabecera).trim());
      const indiceIdProducto = cabecerasProductos.indexOf("ID producto");
      const indiceCampoProducto = new Map(CAMPOS_PRODUCTO_IMPORTACION.map((campo) => [campo.key, cabecerasProductos.indexOf(campo.label)]));
      if (indiceIdProducto < 0 || indiceCampoProducto.get("nombre") < 0 || indiceCampoProducto.get("categoria") < 0) {
        throw new Error("La hoja Productos debe conservar las columnas ID producto, Nombre y Categoría.");
      }

      const categoriasPorNombre = new Map(categorias.map((categoria) => [String(categoria.nombre || "").trim().toLocaleLowerCase("es"), categoria]));
      const productosPorId = new Map(productos.map((producto) => [String(producto.id), producto]));
      const productosNuevosPorNombre = new Map();
      const idsProductoVistos = new Set();
      await procesarFilasPorLotes(filasProductos, async (filaRecibida, indiceFila) => {
        const fila = filaRecibida || [];
        if (fila.every(valorCeldaVacia)) return;
        const numeroFila = indiceFila + 2;
        try {
          const idCelda = fila[indiceIdProducto];
          const id = valorCeldaVacia(idCelda) ? "" : String(idCelda).trim();
          if (id && idsProductoVistos.has(id)) throw new Error(`Fila ${numeroFila}: el ID ${id} está repetido en el archivo.`);
          if (id) idsProductoVistos.add(id);
          const existente = id ? productosPorId.get(id) : null;
          if (id && !existente) throw new Error(`Fila ${numeroFila}: no existe el producto con ID ${id}.`);
          const obtenerValor = (clave) => {
            const indice = indiceCampoProducto.get(clave);
            return indice == null || indice < 0 ? undefined : fila[indice];
          };
          const nombreCelda = obtenerValor("nombre");
          const categoriaCelda = obtenerValor("categoria");
          const nombre = valorCeldaVacia(nombreCelda) ? existente?.nombre || "" : String(nombreCelda).trim();
          if (!nombre) throw new Error(`Fila ${numeroFila}: el nombre del producto es obligatorio.`);

          const cambios = { nombre };
          if (!valorCeldaVacia(categoriaCelda)) {
            const categoria = categoriasPorNombre.get(String(categoriaCelda).trim().toLocaleLowerCase("es"));
            if (!categoria) throw new Error(`Fila ${numeroFila}: no existe la categoría “${categoriaCelda}”.`);
            cambios.categoria_id = categoria.id;
          } else if (!existente) {
            throw new Error(`Fila ${numeroFila}: la categoría es obligatoria para crear un producto.`);
          }

          const stockCelda = obtenerValor("stock");
          if (stockCelda !== undefined && !valorCeldaVacia(stockCelda)) cambios.stock = convertirNumeroCelda(stockCelda, "stock", numeroFila, { entero: true });
          for (const clave of ["precio", "precio_emprendedor", "precio_mayorista"]) {
            const valor = obtenerValor(clave);
            if (valor !== undefined) cambios[clave] = valorCeldaVacia(valor) ? "" : convertirNumeroCelda(valor, clave, numeroFila);
          }
          const costo = obtenerValor("precio_costo");
          if (costo !== undefined && !valorCeldaVacia(costo)) {
            cambios.precio_costo = convertirNumeroCelda(costo, "precio de costo", numeroFila);
          }
          const descripcion = obtenerValor("descripcion");
          if (descripcion !== undefined) cambios.descripcion = valorCeldaVacia(descripcion) ? "" : String(descripcion);

          const minimos = { ...(existente?.minimos_compra || {}) };
          let hayMinimos = false;
          for (const [clave, catalogo] of [["minimo_General", "General"], ["minimo_Emprendedor", "Emprendedor"], ["minimo_Mayorista", "Mayorista"]]) {
            const valor = obtenerValor(clave);
            if (valor === undefined) continue;
            const minimo = valorCeldaVacia(valor) ? null : convertirNumeroCelda(valor, `mínimo ${catalogo}`, numeroFila, { entero: true });
            if (minimo !== null && minimo < 1) throw new Error(`Fila ${numeroFila}: el mínimo ${catalogo} debe ser mayor que cero.`);
            minimos[catalogo] = minimo;
            hayMinimos = true;
          }
          if (hayMinimos) cambios.minimos_compra = minimos;

          if (existente) {
            const resultado = await actualizarProducto(existente.id, cambios);
            if (resultado?.error) throw new Error(resultado.error);
            productosPorId.set(String(existente.id), resultado.producto || { ...existente, ...cambios });
            productosActualizados += 1;
          } else {
            const precios = [cambios.precio, cambios.precio_emprendedor, cambios.precio_mayorista];
            if (!precios.some((precio) => precio !== undefined && precio !== "" && Number(precio) > 0)) {
              throw new Error(`Fila ${numeroFila}: un producto nuevo necesita al menos un precio mayor que cero.`);
            }
            const categoriaNombre = categorias.find((categoria) => String(categoria.id) === String(cambios.categoria_id))?.nombre;
            const resultado = await crearProducto(
              cambios.nombre,
              cambios.precio ?? "",
              cambios.precio_emprendedor ?? "",
              cambios.precio_mayorista ?? "",
              categoriaNombre,
              cambios.stock ?? 0,
              cambios.descripcion ?? "",
              [],
              { precio_costo: cambios.precio_costo, minimos_compra: cambios.minimos_compra || {} }
            );
            if (resultado?.error) throw new Error(resultado.error);
            productosCreados += 1;
            if (resultado?.producto) {
              productosPorId.set(String(resultado.producto.id), resultado.producto);
              const claveNombre = resultado.producto.nombre.trim().toLocaleLowerCase("es");
              productosNuevosPorNombre.set(claveNombre, [...(productosNuevosPorNombre.get(claveNombre) || []), resultado.producto]);
            }
          }
        } catch (errorFila) {
          erroresImportacion.push(errorFila.message || `Fila ${numeroFila}: error al importar.`);
        }
      });

      const hojaVariantes = libro.Sheets.Variantes;
      if (hojaVariantes) {
        const filasVariantes = XLSX.utils.sheet_to_json(hojaVariantes, { header: 1, defval: "", raw: true });
        const cabecerasVariantes = (filasVariantes.shift() || []).map((cabecera) => String(cabecera).trim());
        const indiceIdVariante = cabecerasVariantes.indexOf("ID variante");
        const indiceIdPadre = cabecerasVariantes.indexOf("ID producto");
        const indiceNombrePadre = cabecerasVariantes.indexOf("Producto");
        const indiceCampoVariante = new Map(CAMPOS_VARIANTE_IMPORTACION.map((campo) => [campo.key, cabecerasVariantes.indexOf(campo.label)]));
        if (indiceIdVariante < 0 || indiceIdPadre < 0 || indiceNombrePadre < 0) {
          throw new Error("La hoja Variantes debe conservar ID variante, ID producto y Producto.");
        }
        const idsVarianteVistos = new Set();
        await procesarFilasPorLotes(filasVariantes, async (filaRecibida, indiceFila) => {
          const fila = filaRecibida || [];
          if (fila.every(valorCeldaVacia)) return;
          const numeroFila = indiceFila + 2;
          try {
            const idCelda = fila[indiceIdVariante];
            const idVariante = valorCeldaVacia(idCelda) ? "" : String(idCelda).trim();
            if (idVariante && idsVarianteVistos.has(idVariante)) throw new Error(`Fila ${numeroFila}: el ID de variante ${idVariante} está repetido en el archivo.`);
            if (idVariante) idsVarianteVistos.add(idVariante);
            const idPadreCelda = fila[indiceIdPadre];
            let productoPadre = valorCeldaVacia(idPadreCelda) ? null : productosPorId.get(String(idPadreCelda).trim());
            if (!productoPadre) {
              const nombrePadre = String(fila[indiceNombrePadre] || "").trim().toLocaleLowerCase("es");
              const coincidencias = productosNuevosPorNombre.get(nombrePadre) || productos.filter((producto) => producto.nombre.trim().toLocaleLowerCase("es") === nombrePadre);
              if (coincidencias.length === 1) productoPadre = coincidencias[0];
            }
            if (!productoPadre) throw new Error(`Fila ${numeroFila}: no se encontró un producto padre único para la variante.`);
            const obtenerValor = (clave) => {
              const indice = indiceCampoVariante.get(clave);
              return indice == null || indice < 0 ? undefined : fila[indice];
            };
            const payload = {};
            const nombreVariante = obtenerValor("nombre");
            if (nombreVariante !== undefined) payload.nombre = valorCeldaVacia(nombreVariante) ? null : String(nombreVariante).trim();
            const atributos = obtenerValor("atributos");
            if (atributos !== undefined) {
              if (valorCeldaVacia(atributos)) payload.atributos = null;
              else {
                try { payload.atributos = JSON.parse(String(atributos)); }
                catch { payload.atributos = String(atributos); }
              }
            }
            const stock = obtenerValor("stock");
            if (stock !== undefined && !valorCeldaVacia(stock)) payload.stock = convertirNumeroCelda(stock, "stock de variante", numeroFila, { entero: true });
            for (const clave of ["precio", "precio_emprendedor", "precio_mayorista"]) {
              const valor = obtenerValor(clave);
              if (valor !== undefined) payload[clave] = valorCeldaVacia(valor) ? null : convertirNumeroCelda(valor, clave, numeroFila);
            }
            const costoVariante = obtenerValor("precio_costo");
            if (costoVariante !== undefined && !valorCeldaVacia(costoVariante)) {
              payload.precio_costo = convertirNumeroCelda(costoVariante, "precio de costo de variante", numeroFila);
            }
            if (!idVariante && !payload.nombre) throw new Error(`Fila ${numeroFila}: una variante nueva necesita un nombre.`);
            let consulta = supabase.from("producto_variantes");
            if (idVariante) {
              consulta = consulta.update(payload).eq("id", idVariante).eq("producto_id", Number(productoPadre.id));
            } else {
              consulta = consulta.insert([{ ...payload, producto_id: Number(productoPadre.id) }]);
            }
            const { data, error: errorGuardado } = await consulta
              .select("id,producto_id,nombre,atributos,precio,precio_emprendedor,precio_mayorista,stock,imagenes,archivada,created_at,updated_at")
              .single();
            if (errorGuardado) throw new Error(errorGuardado.message);
            setVariantesPorProducto((actuales) => {
              const lista = actuales[productoPadre.id] || [];
              return {
                ...actuales,
                [productoPadre.id]: idVariante
                  ? lista.map((variante) => String(variante.id) === String(data.id)
                    ? { ...data, precio_costo: payload.precio_costo ?? variante.precio_costo ?? null }
                    : variante)
                  : [...lista, { ...data, precio_costo: payload.precio_costo ?? null }],
              };
            });
            if (idVariante) variantesActualizadas += 1;
            else variantesCreadas += 1;
          } catch (errorFila) {
            erroresImportacion.push(`Variantes ${errorFila.message || `fila ${numeroFila}: error al importar.`}`);
          }
        });
      }

      const resumen = `${productosCreados} productos creados, ${productosActualizados} actualizados, ${variantesCreadas} variantes creadas y ${variantesActualizadas} actualizadas.`;
      if (erroresImportacion.length) {
        setError(`${resumen} ${erroresImportacion.length} filas tuvieron errores: ${erroresImportacion.slice(0, 8).join(" | ")}${erroresImportacion.length > 8 ? " | …" : ""} Las filas exitosas ya se guardaron; descarga una plantilla nueva antes de volver a importar.`);
      } else {
        setMensaje(`Importación terminada: ${resumen}`);
        setArchivoImportacion(null);
      }
    } catch (errorImportacion) {
      setError(errorImportacion.message || "No se pudo leer el archivo de Excel.");
    } finally {
      setImportandoPlantilla(false);
      setArchivoImportacion(null);
    }
  };

  useEffect(() => {
    if (!esAdministrador) return undefined;
    let activo = true;
    const cargarCostos = async () => {
      const { data, error: errorCostos } = await supabase.rpc("admin_list_product_costs");
      if (errorCostos) {
        console.warn("No se pudieron cargar los costos protegidos:", errorCostos.message);
        return;
      }
      if (!activo) return;
      const costosPorId = new Map(
        (data || [])
          .filter((fila) => fila.table_name === "productos")
          .map((fila) => [String(fila.row_id), fila.precio_costo])
      );
      setProductos((actuales) => actuales.map((producto) => ({
        ...producto,
        precio_costo: costosPorId.get(String(producto.id)) ?? producto.precio_costo ?? null,
      })));
    };
    cargarCostos();
    return () => { activo = false; };
  }, [esAdministrador, setProductos]);

  useEffect(() => {
    if (!formularioAbierto) {
      borrarBorrador();
      return;
    }
    try {
      window.localStorage.setItem(BORRADOR_STORAGE_KEY, JSON.stringify({ productoActivo, formulario }));
    } catch {
      return;
    }
  }, [formularioAbierto, formulario, productoActivo]);

  useEffect(() => {
    try {
      if (busqueda) {
        window.localStorage.setItem(BUSQUEDA_STORAGE_KEY, busqueda);
      } else {
        window.localStorage.removeItem(BUSQUEDA_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }, [busqueda]);

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es");
    return productos
      .filter((producto) => {
        const coincideTexto = `${producto.nombre || ""} ${obtenerNombreCategoria(producto, categorias)}`
          .toLocaleLowerCase("es")
          .includes(texto);
        const coincideVisibilidad = filtroVisibilidad === "todos" ||
          (filtroVisibilidad === "ocultos" ? producto.catalogos_ocultos?.length > 0 : !producto.catalogos_ocultos?.length);
        return coincideTexto && coincideVisibilidad;
      })
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" }));
  }, [productos, categorias, busqueda, filtroVisibilidad]);

  if (!esAdministrador) return <Navigate to="/" replace />;

  const cerrarFormulario = () => {
    borrarBorrador();
    setProductoActivo(null);
    setFormularioAbierto(false);
    setFormulario(FORMULARIO_VACIO);
  };

  const cargarVariantes = async (productoId) => {
    setCargandoVariantes((actuales) => ({ ...actuales, [productoId]: true }));
    setErroresVariantes((actuales) => ({ ...actuales, [productoId]: "" }));
    try {
      const { data, error: errorConsulta } = await supabase
        .from("producto_variantes")
        .select("id,producto_id,nombre,atributos,precio,precio_emprendedor,precio_mayorista,stock,imagenes,archivada,created_at,updated_at")
        .eq("producto_id", Number(productoId));
      if (errorConsulta) throw errorConsulta;
      const { data: costos } = await supabase.rpc("admin_list_product_costs");
      const costosPorVariante = new Map(
        (costos || [])
          .filter((costo) => costo.table_name === "producto_variantes")
          .map((costo) => [String(costo.row_id), costo.precio_costo])
      );
      const variantes = (data || []).map((variante) => ({
        ...variante,
        precio_costo: costosPorVariante.get(String(variante.id)) ?? null,
      }));
      setVariantesPorProducto((actuales) => ({ ...actuales, [productoId]: variantes }));
      return variantes;
    } catch (errorConsulta) {
      setErroresVariantes((actuales) => ({
        ...actuales,
        [productoId]: errorConsulta.message || "No se pudieron cargar las variantes.",
      }));
      return null;
    } finally {
      setCargandoVariantes((actuales) => ({ ...actuales, [productoId]: false }));
    }
  };

  const alternarVariantes = async (producto) => {
    if (productoExpandidoId === producto.id) {
      setProductoExpandidoId(null);
      setFiltroVariantes("");
      return;
    }
    setProductoExpandidoId(producto.id);
    setFiltroVariantes("");
    if (!Object.prototype.hasOwnProperty.call(variantesPorProducto, producto.id)) {
      await cargarVariantes(producto.id);
    }
  };

  const abrirNuevaVariante = (producto) => {
    setProductoVarianteActivo(producto);
    setVarianteActiva(null);
    setFormularioVariante(VARIANTE_VACIA);
    setErrorVariante("");
  };

  const abrirEdicionVariante = (producto, variante) => {
    setProductoVarianteActivo(producto);
    setVarianteActiva(variante);
    setFormularioVariante({
      nombre: variante.nombre || "",
      atributos: typeof variante.atributos === "object" && variante.atributos !== null
        ? JSON.stringify(variante.atributos)
        : variante.atributos || "",
      precio: variante.precio ?? "",
      precio_emprendedor: variante.precio_emprendedor ?? "",
      precio_mayorista: variante.precio_mayorista ?? "",
      stock: String(variante.stock ?? 0),
      imagenes: Array.isArray(variante.imagenes)
        ? variante.imagenes
        : variante.imagenes
          ? [variante.imagenes]
          : [],
    });
    setErrorVariante("");
  };

  const cerrarVariante = () => {
    setProductoVarianteActivo(null);
    setVarianteActiva(null);
    setFormularioVariante(VARIANTE_VACIA);
    setErrorVariante("");
  };

  const agregarImagenesVariante = async (event) => {
    const archivos = Array.from(event.target.files || []);
    event.target.value = "";
    const disponibles = Math.max(0, 5 - formularioVariante.imagenes.length);
    const seleccionados = archivos.slice(0, disponibles);
    if (archivos.length > disponibles) setErrorVariante("Se permiten hasta 5 imágenes por variante.");
    try {
      const imagenesNuevas = await Promise.all(seleccionados.map((archivo) => new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result || ""));
        lector.onerror = reject;
        lector.readAsDataURL(archivo);
      })));
      setFormularioVariante((actual) => ({ ...actual, imagenes: [...actual.imagenes, ...imagenesNuevas] }));
    } catch {
      setErrorVariante("No se pudieron cargar las imágenes seleccionadas.");
    }
  };

  const guardarVariante = async (event) => {
    event.preventDefault();
    setErrorVariante("");
    if (!formularioVariante.nombre.trim()) {
      setErrorVariante("Escribe el nombre de la variante.");
      return;
    }
    if (!Number.isFinite(Number(formularioVariante.stock)) || Number(formularioVariante.stock) < 0) {
      setErrorVariante("El stock debe ser un número igual o mayor a cero.");
      return;
    }

    let atributos = null;
    if (formularioVariante.atributos.trim()) {
      try {
        atributos = JSON.parse(formularioVariante.atributos);
      } catch {
        atributos = formularioVariante.atributos;
      }
    }
    const payload = {
      nombre: formularioVariante.nombre.trim(),
      atributos,
      precio: formularioVariante.precio === "" ? null : Number(formularioVariante.precio),
      precio_emprendedor: formularioVariante.precio_emprendedor === "" ? null : Number(formularioVariante.precio_emprendedor),
      precio_mayorista: formularioVariante.precio_mayorista === "" ? null : Number(formularioVariante.precio_mayorista),
      stock: Number(formularioVariante.stock),
      imagenes: formularioVariante.imagenes,
    };
    setGuardandoVariante(true);
    try {
      const consulta = varianteActiva
        ? supabase.from("producto_variantes").update(payload).eq("id", varianteActiva.id).eq("producto_id", Number(productoVarianteActivo.id))
        : supabase.from("producto_variantes").insert([{ ...payload, producto_id: Number(productoVarianteActivo.id) }]);
      const { data, error: errorGuardado } = await consulta
        .select("id,producto_id,nombre,atributos,precio,precio_emprendedor,precio_mayorista,stock,imagenes,archivada,created_at,updated_at")
        .single();
      if (errorGuardado) throw errorGuardado;
      setVariantesPorProducto((actuales) => {
        const variantes = actuales[productoVarianteActivo.id] || [];
        return {
          ...actuales,
          [productoVarianteActivo.id]: varianteActiva
            ? variantes.map((variante) => variante.id === data.id ? data : variante)
            : [...variantes, data],
        };
      });
      cerrarVariante();
    } catch (errorGuardado) {
      setErrorVariante(errorGuardado.message || "No se pudo guardar la variante.");
    } finally {
      setGuardandoVariante(false);
    }
  };

  const eliminarVariante = async (producto, variante) => {
    if (!window.confirm(`¿Retirar la variante “${variante.nombre || "Variante"}” del catálogo? Si ya aparece en pedidos, se conservará archivada en el historial.`)) return;
    const { count, error: errorHistorial } = await supabase
      .from("pedido_detalle")
      .select("pedido_id", { count: "exact", head: true })
      .eq("variante_id", String(variante.id));
    if (errorHistorial) {
      setErroresVariantes((actuales) => ({ ...actuales, [producto.id]: errorHistorial.message }));
      return;
    }

    if (count > 0) {
      const { error: errorArchivo } = await supabase
        .from("producto_variantes")
        .update({ archivada: true })
        .eq("id", variante.id)
        .eq("producto_id", Number(producto.id));
      if (errorArchivo) {
        setErroresVariantes((actuales) => ({ ...actuales, [producto.id]: errorArchivo.message }));
        return;
      }
      setVariantesPorProducto((actuales) => ({
        ...actuales,
        [producto.id]: (actuales[producto.id] || []).map((actual) =>
          actual.id === variante.id ? { ...actual, archivada: true } : actual
        ),
      }));
      setMensaje("Variante retirada del catálogo y conservada en el historial de pedidos.");
      return;
    }

    const { error: errorEliminacion } = await supabase
      .from("producto_variantes")
      .delete()
      .eq("id", variante.id)
      .eq("producto_id", Number(producto.id));
    if (errorEliminacion) {
      if (errorEliminacion.code === "23503") {
        const { error: errorArchivo } = await supabase
          .from("producto_variantes")
          .update({ archivada: true })
          .eq("id", variante.id)
          .eq("producto_id", Number(producto.id));
        if (!errorArchivo) {
          setVariantesPorProducto((actuales) => ({
            ...actuales,
            [producto.id]: (actuales[producto.id] || []).map((actual) =>
              actual.id === variante.id ? { ...actual, archivada: true } : actual
            ),
          }));
          setMensaje("Variante retirada del catálogo y conservada en el historial de pedidos.");
          return;
        }
      }
      setErroresVariantes((actuales) => ({ ...actuales, [producto.id]: errorEliminacion.message }));
      return;
    }
    setVariantesPorProducto((actuales) => ({
      ...actuales,
      [producto.id]: (actuales[producto.id] || []).filter((actual) => actual.id !== variante.id),
    }));
  };

  const restaurarVariante = async (producto, variante) => {
    const { error: errorRestaurar } = await supabase
      .from("producto_variantes")
      .update({ archivada: false })
      .eq("id", variante.id)
      .eq("producto_id", Number(producto.id));
    if (errorRestaurar) {
      setErroresVariantes((actuales) => ({ ...actuales, [producto.id]: errorRestaurar.message }));
      return;
    }
    setVariantesPorProducto((actuales) => ({
      ...actuales,
      [producto.id]: (actuales[producto.id] || []).map((actual) =>
        actual.id === variante.id ? { ...actual, archivada: false } : actual
      ),
    }));
    setMensaje("Variante restaurada en el catálogo.");
  };

  const abrirNuevo = () => {
    setProductoActivo(null);
    setFormularioAbierto(true);
    setFormulario({ ...FORMULARIO_VACIO, categoria_id: categorias[0]?.id ?? "" });
    setMensaje("");
    setError("");
  };

  const abrirEdicion = (producto) => {
    setProductoActivo(producto);
    setFormularioAbierto(true);
    setFormulario({
      ...FORMULARIO_VACIO,
      ...producto,
      categoria_id: producto.categoria_id ?? "",
      stock: String(producto.stock ?? 0),
      imagenes: [...(producto.imagenes || [])].filter(Boolean),
      minimos_compra: { ...FORMULARIO_VACIO.minimos_compra, ...(producto.minimos_compra || {}) },
    });
    setMensaje("");
    setError("");
  };

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const alternarCatalogoOculto = (catalogo, ocultar) => {
    setFormulario((actual) => ({
      ...actual,
      catalogos_ocultos: ocultar
        ? [...new Set([...actual.catalogos_ocultos, catalogo])]
        : actual.catalogos_ocultos.filter((item) => item !== catalogo),
    }));
  };

  const agregarImagenes = async (event) => {
    const archivos = Array.from(event.target.files || []);
    event.target.value = "";
    const disponibles = Math.max(0, 3 - formulario.imagenes.length);
    if (archivos.length > disponibles) {
      setError("Se permiten hasta 3 imágenes por producto.");
    }
    const seleccionados = archivos.slice(0, disponibles);
    const imagenesNuevas = await Promise.all(seleccionados.map((archivo) => new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result || ""));
      lector.onerror = reject;
      lector.readAsDataURL(archivo);
    })));
    setFormulario((actual) => ({ ...actual, imagenes: [...actual.imagenes, ...imagenesNuevas] }));
  };

  const guardar = async (event) => {
    event.preventDefault();
    setError("");
    setMensaje("");
    if (!formulario.nombre.trim() || !formulario.categoria_id) {
      setError("Completa el nombre y la categoría del producto.");
      return;
    }
    if (Number(formulario.stock) < 0 || !Number.isFinite(Number(formulario.stock))) {
      setError("El stock debe ser un número igual o mayor a cero.");
      return;
    }
    const precios = [formulario.precio, formulario.precio_emprendedor, formulario.precio_mayorista];
    if (!precios.some((valor) => valor !== "" && Number.isFinite(Number(valor)) && Number(valor) > 0)) {
      setError("Agrega al menos un precio de venta mayor que cero.");
      return;
    }

    setGuardando(true);
    const datos = {
      nombre: formulario.nombre.trim(),
      categoria_id: formulario.categoria_id,
      stock: Number(formulario.stock),
      precio: formulario.precio,
      precio_emprendedor: formulario.precio_emprendedor,
      precio_mayorista: formulario.precio_mayorista,
      precio_costo: formulario.precio_costo,
      descripcion: formulario.descripcion,
      imagenes: formulario.imagenes,
      catalogos_ocultos: formulario.catalogos_ocultos,
      minimos_compra: Object.fromEntries(Object.entries(formulario.minimos_compra || {}).map(([catalogo, valor]) => [catalogo, valor === "" ? null : Number(valor)])),
    };

    try {
      const resultado = productoActivo
        ? await actualizarProducto(productoActivo.id, datos)
        : await crearProducto(
            datos.nombre,
            datos.precio,
            datos.precio_emprendedor,
            datos.precio_mayorista,
            categorias.find((categoria) => String(categoria.id) === String(datos.categoria_id))?.nombre,
            datos.stock,
            datos.descripcion,
            datos.imagenes,
            { precio_costo: datos.precio_costo, catalogos_ocultos: datos.catalogos_ocultos, minimos_compra: datos.minimos_compra }
          );

      if (resultado?.error) throw new Error(resultado.error);
      cerrarFormulario();
      setMensaje(productoActivo ? "Producto actualizado." : "Producto creado.");
    } catch (guardarError) {
      setError(guardarError.message || "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  const borrarProducto = async (producto) => {
    if (!window.confirm(`¿Retirar “${producto.nombre}” de todos los catálogos? Si ya aparece en pedidos, se conservará junto con sus variantes en el historial.`)) return;
    const resultado = await eliminarProducto(producto.id);
    if (resultado?.error) setError(`No se pudo eliminar: ${resultado.error}`);
    else setMensaje(resultado?.archived
      ? "Producto retirado de los catálogos y conservado en el historial de pedidos."
      : "Producto eliminado.");
  };

  const abrirAdministrarCatalogos = () => {
    setError("");
    setMinimosCatalogosFormulario({
      General: String(minimosCompraCatalogo?.General ?? 1),
      Emprendedor: String(minimosCompraCatalogo?.Emprendedor ?? 3),
      Mayorista: String(minimosCompraCatalogo?.Mayorista ?? 6),
    });
    setAdministrarCatalogosAbierto(true);
  };

  const guardarMinimosCatalogos = async (event) => {
    event.preventDefault();
    const valores = Object.fromEntries(Object.entries(minimosCatalogosFormulario).map(([catalogo, valor]) => [catalogo, Number(valor)]));
    if (Object.values(valores).some((valor) => !Number.isInteger(valor) || valor < 1)) {
      setError("Los mínimos deben ser números enteros mayores que cero.");
      return;
    }
    setGuardandoMinimosCatalogos(true);
    const resultado = await guardarMinimosCompraCatalogo(valores);
    setGuardandoMinimosCatalogos(false);
    if (resultado?.error) {
      setError(`No se pudieron guardar los mínimos en Supabase: ${resultado.error}`);
      return;
    }
    setAdministrarCatalogosAbierto(false);
    setError("");
    setMensaje("Mínimos predeterminados de compra actualizados.");
  };

  return (
    <main className="admin-productos-page">
      <header className="admin-productos-header">
        <div>
          <span className="admin-productos-eyebrow">INVENTARIO</span>
          <h1>Administrar productos</h1>
          <p>Precios, disponibilidad e imágenes en un solo lugar.</p>
        </div>
        <div className="admin-productos-header-actions">
          <button className="admin-productos-secondary" type="button" onClick={abrirAdministrarCatalogos}>Administrar categorías</button>
          <button className="admin-productos-secondary" type="button" onClick={() => { setError(""); setMensaje(""); setImportarPlantillaAbierto(true); }}>Importar plantilla</button>
          <button className="admin-productos-primary" type="button" onClick={abrirNuevo}>+ Nuevo producto</button>
        </div>
      </header>

      {importarPlantillaAbierto && (
        <div className="admin-productos-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) cerrarImportarPlantilla(); }}>
          <section className="admin-productos-modal admin-productos-import-modal" role="dialog" aria-modal="true" aria-labelledby="admin-importar-plantilla-title">
            <header className="admin-productos-modal-header">
              <div><span>IMPORTACIÓN MASIVA</span><h2 id="admin-importar-plantilla-title">Importar plantilla</h2></div>
              <button type="button" aria-label="Cerrar" onClick={cerrarImportarPlantilla} disabled={importandoPlantilla}>×</button>
            </header>
            <div className="admin-productos-import-body">
              <p>Elige los campos y descarga un archivo Excel con los productos actuales para editarlos. También puedes agregar filas nuevas. Las imágenes no se incluyen.</p>
              <fieldset className="admin-productos-import-fields">
                <legend>Campos del producto</legend>
                <label className="admin-productos-import-select-all">
                  <input
                    type="checkbox"
                    checked={CAMPOS_PRODUCTO_IMPORTACION.filter((campo) => !campo.obligatorio).every((campo) => camposProductoImportacion[campo.key])}
                    onChange={(event) => setCamposProductoImportacion(Object.fromEntries(CAMPOS_PRODUCTO_IMPORTACION.map((campo) => [campo.key, campo.obligatorio || event.target.checked])))}
                  />
                  Todos los campos
                </label>
                <div className="admin-productos-import-checks">
                  {CAMPOS_PRODUCTO_IMPORTACION.map((campo) => (
                    <label key={campo.key}>
                      <input
                        type="checkbox"
                        checked={campo.obligatorio || Boolean(camposProductoImportacion[campo.key])}
                        disabled={campo.obligatorio}
                        onChange={(event) => setCamposProductoImportacion((actual) => ({ ...actual, [campo.key]: event.target.checked }))}
                      />
                      {campo.label}{campo.obligatorio ? " *" : ""}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="admin-productos-import-fields">
                <legend>Variantes</legend>
                <label className="admin-productos-import-include-variants">
                  <input type="checkbox" checked={incluirVariantesImportacion} onChange={(event) => setIncluirVariantesImportacion(event.target.checked)} />
                  Incluir hoja de variantes
                </label>
                {incluirVariantesImportacion && (
                  <>
                  <label className="admin-productos-import-select-all">
                    <input type="checkbox" checked={CAMPOS_VARIANTE_IMPORTACION.every((campo) => camposVarianteImportacion[campo.key])} onChange={(event) => setCamposVarianteImportacion(Object.fromEntries(CAMPOS_VARIANTE_IMPORTACION.map((campo) => [campo.key, event.target.checked])))} />
                    Todos los campos de variantes
                  </label>
                  <div className="admin-productos-import-checks">
                    {CAMPOS_VARIANTE_IMPORTACION.map((campo) => (
                      <label key={campo.key}>
                        <input type="checkbox" checked={Boolean(camposVarianteImportacion[campo.key])} onChange={(event) => setCamposVarianteImportacion((actual) => ({ ...actual, [campo.key]: event.target.checked }))} />
                        {campo.label}
                      </label>
                    ))}
                  </div>
                  </>
                )}
              </fieldset>
              <div className="admin-productos-import-notice">
                <strong>Cómo se aplica:</strong> conserva el ID para actualizar; deja el ID vacío en una fila nueva para crear. Las filas que dejes fuera no se eliminan. Para variantes nuevas, completa el ID del producto o su nombre exacto. Si algunas filas fallan, las demás quedan guardadas y no se revierten.
              </div>
              <div className="admin-productos-import-actions">
                <button type="button" className="admin-productos-secondary" onClick={descargarPlantillaExcel} disabled={importandoPlantilla || (incluirVariantesImportacion && !CAMPOS_VARIANTE_IMPORTACION.some((campo) => camposVarianteImportacion[campo.key]))}>Descargar plantilla Excel</button>
                <label className="admin-productos-import-file">
                  <span>{archivoImportacion?.name || "Seleccionar archivo Excel"}</span>
                  <input key={archivoImportacion?.name || "sin-archivo"} type="file" accept=".xlsx,.xls" disabled={importandoPlantilla} onChange={(event) => setArchivoImportacion(event.target.files?.[0] || null)} />
                </label>
                <button type="button" className="admin-productos-primary" onClick={importarArchivoExcel} disabled={importandoPlantilla || !archivoImportacion}>{importandoPlantilla ? "Importando…" : "Importar productos"}</button>
              </div>
              {error && <p className="admin-productos-form-error" role="alert">{error}</p>}
              {mensaje && <p className="admin-productos-import-success" role="status">{mensaje}</p>}
              <footer className="admin-productos-form-actions">
                <button type="button" className="admin-productos-secondary" onClick={cerrarImportarPlantilla} disabled={importandoPlantilla}>Cerrar</button>
              </footer>
            </div>
          </section>
        </div>
      )}

      {administrarCatalogosAbierto && (
        <div className="admin-productos-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardandoMinimosCatalogos) setAdministrarCatalogosAbierto(false); }}>
          <section className="admin-productos-modal" role="dialog" aria-modal="true" aria-labelledby="admin-minimos-catalogo-title">
            <header className="admin-productos-modal-header">
              <div><span>CONFIGURACIÓN GENERAL</span><h2 id="admin-minimos-catalogo-title">Administrar categorías</h2></div>
              <button type="button" aria-label="Cerrar" onClick={() => setAdministrarCatalogosAbierto(false)}>×</button>
            </header>
            <form onSubmit={guardarMinimosCatalogos}>
              <p>Define el mínimo predeterminado de compra para los productos sin una cantidad personalizada.</p>
              <div className="admin-productos-form-grid">
                {CATALOGOS.map((catalogo) => (
                  <label key={catalogo.id}>{catalogo.label}
                    <input type="number" min="1" step="1" required value={minimosCatalogosFormulario[catalogo.id]} onChange={(event) => setMinimosCatalogosFormulario((actual) => ({ ...actual, [catalogo.id]: event.target.value }))} />
                  </label>
                ))}
              </div>
              <small>En Supermayorista las cantidades se pedirán en múltiplos del mínimo configurado.</small>
              {error && <p className="admin-productos-form-error" role="alert">{error}</p>}
              <footer className="admin-productos-form-actions">
                <button type="button" className="admin-productos-secondary" onClick={() => setAdministrarCatalogosAbierto(false)} disabled={guardandoMinimosCatalogos}>Cancelar</button>
                <button type="submit" className="admin-productos-primary" disabled={guardandoMinimosCatalogos}>{guardandoMinimosCatalogos ? "Guardando..." : "Guardar mínimos"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      <section className="admin-productos-toolbar" aria-label="Filtros de productos">
        <label className="admin-productos-search">
          <span>Buscar</span>
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre o categoría" />
        </label>
        <div className="admin-productos-filtros" role="group" aria-label="Filtrar visibilidad">
          {[["todos", "Todos"], ["visibles", "En catálogo"], ["ocultos", "Ocultos"]].map(([valor, etiqueta]) => (
            <button key={valor} type="button" className={filtroVisibilidad === valor ? "activo" : ""} onClick={() => setFiltroVisibilidad(valor)}>
              {etiqueta}
            </button>
          ))}
        </div>
        <span className="admin-productos-count">{productosFiltrados.length} de {productos.length} productos</span>
      </section>

      {(mensaje || error) && <div className={`admin-productos-message ${error ? "error" : "success"}`} role="status">{error || mensaje}</div>}

      <section className="admin-productos-list" aria-label="Lista de productos">
        <HorizontalScroll viewportClassName="admin-productos-table-wrap">
          <table className="admin-productos-table">
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Tienda física</th><th>Mayorista</th><th>Supermayorista</th><th>Costo</th><th>Catálogo</th><th>Variantes</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {productosFiltrados.map((producto) => {
                const variantes = variantesPorProducto[producto.id] || [];
                const textoFiltro = filtroVariantes.trim().toLocaleLowerCase("es");
                const variantesFiltradas = variantes.filter((variante) =>
                  `${variante.nombre || ""} ${formatearAtributos(variante.atributos)}`
                    .toLocaleLowerCase("es")
                    .includes(textoFiltro)
                );
                const expandido = productoExpandidoId === producto.id;
                return (
                  <Fragment key={producto.id}>
                    <tr>
                      <td data-label="Producto" className="admin-producto-name">
                        {producto.imagenes?.[0]
                          ? <img src={producto.imagenes[0]} alt="" />
                          : <span className="admin-producto-no-image">IMG</span>}
                        <span>{producto.nombre}</span>
                      </td>
                      <td data-label="Categoría">{obtenerNombreCategoria(producto, categorias)}</td>
                      <td data-label="Stock">{producto.stock ?? 0}</td>
                      <td data-label="Precio tienda física">{formatearPrecio(producto.precio)}</td>
                      <td data-label="Precio mayorista">{formatearPrecio(producto.precio_emprendedor)}</td>
                      <td data-label="Precio supermayorista">{formatearPrecio(producto.precio_mayorista)}</td>
                      <td data-label="Precio costo">{formatearPrecio(producto.precio_costo)}</td>
                      <td data-label="Catálogos"><span className={`admin-producto-status ${producto.catalogos_ocultos?.length ? "oculto" : "visible"}`}>{producto.catalogos_ocultos?.length ? `Oculto en ${producto.catalogos_ocultos.length}` : "Visible en todos"}</span></td>
                      <td data-label="Variantes">
                        <button
                          type="button"
                          className="admin-producto-toggle-variantes"
                          aria-expanded={expandido}
                          onClick={() => alternarVariantes(producto)}
                        >
                          <span aria-hidden="true">{expandido ? "▾" : "▸"}</span>
                          {Object.prototype.hasOwnProperty.call(variantesPorProducto, producto.id)
                            ? ` ${variantes.length}`
                            : " Ver"}
                        </button>
                      </td>
                      <td data-label="Acciones" className="admin-producto-actions">
                        <button type="button" onClick={() => abrirEdicion(producto)}>Editar</button>
                        <button type="button" className="danger" onClick={() => borrarProducto(producto)}>Eliminar</button>
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="admin-productos-variants-row">
                        <td colSpan="10">
                          <section className="admin-productos-variants-panel" aria-label={`Variantes de ${producto.nombre}`}>
                            <header className="admin-productos-variants-header">
                              <div>
                                <h3>Variantes de {producto.nombre}</h3>
                                <span>{variantes.length} {variantes.length === 1 ? "variante" : "variantes"}</span>
                              </div>
                              <label className="admin-productos-variant-search">
                                <span>Filtrar variantes</span>
                                <input
                                  value={filtroVariantes}
                                  onChange={(event) => setFiltroVariantes(event.target.value)}
                                  placeholder="Nombre o atributos"
                                />
                              </label>
                              <button type="button" className="admin-productos-primary" onClick={() => abrirNuevaVariante(producto)}>+ Añadir variante</button>
                            </header>
                            {cargandoVariantes[producto.id] ? (
                              <p className="admin-productos-variants-message">Cargando variantes...</p>
                            ) : erroresVariantes[producto.id] ? (
                              <div className="admin-productos-variants-error" role="alert">
                                <span>{erroresVariantes[producto.id]}</span>
                                <button type="button" onClick={() => cargarVariantes(producto.id)}>Reintentar</button>
                              </div>
                            ) : variantesFiltradas.length > 0 ? (
                              <HorizontalScroll viewportClassName="admin-productos-variants-table-wrap">
                                <table className="admin-productos-variants-table">
                                  <thead><tr><th>Variante</th><th>Atributos</th><th>Stock</th><th>Tienda física</th><th>Mayorista</th><th>Supermayorista</th><th>Acciones</th></tr></thead>
                                  <tbody>
                                    {variantesFiltradas.map((variante) => (
                                      <tr key={variante.id}>
                                        <td className="admin-productos-variant-name">
                                          {variante.imagenes?.[0] && <img src={variante.imagenes[0]} alt="" />}
                                          <strong>{variante.nombre || "Variante"}</strong>
                                        </td>
                                        <td>{formatearAtributos(variante.atributos)}</td>
                                        <td>{variante.stock ?? 0}</td>
                                        <td>{formatearPrecio(variante.precio)}</td>
                                        <td>{formatearPrecio(variante.precio_emprendedor)}</td>
                                        <td>{formatearPrecio(variante.precio_mayorista)}</td>
                                        <td className="admin-producto-actions admin-productos-variant-actions">
                                          {variante.archivada ? (
                                            <>
                                              <span className="admin-producto-status oculto">Archivada</span>
                                              <button type="button" onClick={() => restaurarVariante(producto, variante)}>Restaurar</button>
                                            </>
                                          ) : (
                                            <>
                                              <button type="button" onClick={() => abrirEdicionVariante(producto, variante)}>Editar</button>
                                              <button type="button" className="danger" onClick={() => eliminarVariante(producto, variante)}>Eliminar</button>
                                            </>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </HorizontalScroll>
                            ) : (
                              <p className="admin-productos-variants-message">
                                {variantes.length ? "No hay variantes que coincidan con el filtro." : "Este producto todavía no tiene variantes."}
                              </p>
                            )}
                          </section>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {productosFiltrados.length === 0 && <tr><td className="admin-productos-empty" colSpan="10">No hay productos para mostrar.</td></tr>}
            </tbody>
          </table>
        </HorizontalScroll>
      </section>

      {formularioAbierto && (
        <div className="admin-productos-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardando) cerrarFormulario(); }}>
          <section className="admin-productos-modal" role="dialog" aria-modal="true" aria-labelledby="admin-producto-form-title">
            <header className="admin-productos-modal-header">
              <div><span>DETALLE DEL PRODUCTO</span><h2 id="admin-producto-form-title">{productoActivo ? "Editar producto" : "Nuevo producto"}</h2></div>
              <button type="button" aria-label="Cerrar" onClick={cerrarFormulario}>×</button>
            </header>
            <form onSubmit={guardar}>
              <div className="admin-productos-form-grid">
                <label className="span-two">Nombre<input value={formulario.nombre} onChange={(event) => actualizarCampo("nombre", event.target.value)} required /></label>
                <label>Categoría<select value={formulario.categoria_id} onChange={(event) => actualizarCampo("categoria_id", event.target.value)} required>
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                </select></label>
                <label>Stock<input type="number" min="0" step="1" value={formulario.stock} onChange={(event) => actualizarCampo("stock", event.target.value)} required /></label>
                <label>Precio tienda física<input type="number" min="0" step="any" value={formulario.precio} onChange={(event) => actualizarCampo("precio", event.target.value)} /></label>
                <label>Precio mayorista<input type="number" min="0" step="any" value={formulario.precio_emprendedor} onChange={(event) => actualizarCampo("precio_emprendedor", event.target.value)} /></label>
                <label>Precio supermayorista<input type="number" min="0" step="any" value={formulario.precio_mayorista} onChange={(event) => actualizarCampo("precio_mayorista", event.target.value)} /></label>
                <fieldset className="span-two admin-productos-checkbox">
                  <legend>Mínimo de compra por catálogo</legend>
                  <small>Déjalo vacío para usar el valor general. Supermayorista se vende en múltiplos del mínimo.</small>
                  <div className="admin-productos-form-grid">
                    {CATALOGOS.map((catalogo) => <label key={catalogo.id}>{catalogo.label}<input type="number" min="1" step="1" value={formulario.minimos_compra?.[catalogo.id] ?? ""} placeholder={String(minimosCompraCatalogo?.[catalogo.id] ?? (catalogo.id === "General" ? 1 : catalogo.id === "Emprendedor" ? 3 : 6))} onChange={(event) => actualizarCampo("minimos_compra", { ...formulario.minimos_compra, [catalogo.id]: event.target.value })} /></label>)}
                  </div>
                </fieldset>
                <label>Precio costo (interno)<input type="number" min="0" step="any" value={formulario.precio_costo} onChange={(event) => actualizarCampo("precio_costo", event.target.value)} /></label>
                <label className="span-two">Descripción<textarea rows="3" value={formulario.descripcion} onChange={(event) => actualizarCampo("descripcion", event.target.value)} /></label>
                <fieldset className="span-two admin-producto-images">
                  <legend>Imágenes <span>{formulario.imagenes.length}/3</span></legend>
                  <label className="admin-productos-upload">Añadir imágenes<input type="file" accept="image/*" multiple onChange={agregarImagenes} disabled={formulario.imagenes.length >= 3} /></label>
                  <div className="admin-productos-previews">
                    {formulario.imagenes.map((imagen, indice) => <div key={`${indice}-${imagen.slice(0, 24)}`}><img src={imagen} alt={`Imagen ${indice + 1}`} /><button type="button" aria-label={`Quitar imagen ${indice + 1}`} onClick={() => actualizarCampo("imagenes", formulario.imagenes.filter((_, posicion) => posicion !== indice))}>×</button></div>)}
                    {formulario.imagenes.length === 0 && <span>Sin imágenes</span>}
                  </div>
                </fieldset>
                <fieldset className="admin-productos-checkbox span-two">
                  <legend>Ocultar por catálogo</legend>
                  <small>Marca los catálogos donde este producto no debe aparecer.</small>
                  <div className="admin-productos-catalogos">
                    {CATALOGOS.map((catalogo) => (
                      <label key={catalogo.id}>
                        <input type="checkbox" checked={formulario.catalogos_ocultos.includes(catalogo.id)} onChange={(event) => alternarCatalogoOculto(catalogo.id, event.target.checked)} />
                        <span>{catalogo.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              {error && <p className="admin-productos-form-error" role="alert">{error}</p>}
              <footer className="admin-productos-form-actions">
                <button type="button" className="admin-productos-secondary" onClick={cerrarFormulario}>Cancelar</button>
                <button type="submit" className="admin-productos-primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar producto"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {productoVarianteActivo && (
        <div className="admin-productos-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardandoVariante) cerrarVariante(); }}>
          <section className="admin-productos-modal admin-productos-variant-modal" role="dialog" aria-modal="true" aria-labelledby="admin-variante-form-title">
            <header className="admin-productos-modal-header">
              <div>
                <span>{productoVarianteActivo.nombre}</span>
                <h2 id="admin-variante-form-title">{varianteActiva ? "Editar variante" : "Nueva variante"}</h2>
              </div>
              <button type="button" aria-label="Cerrar" onClick={cerrarVariante}>×</button>
            </header>
            <form onSubmit={guardarVariante}>
              <div className="admin-productos-form-grid">
                <label className="span-two">Nombre<input value={formularioVariante.nombre} onChange={(event) => setFormularioVariante((actual) => ({ ...actual, nombre: event.target.value }))} required /></label>
                <label className="span-two">Atributos<textarea rows="2" placeholder="Ej: COLOR: ROJO, TALLA: M" value={formularioVariante.atributos} onChange={(event) => setFormularioVariante((actual) => ({ ...actual, atributos: event.target.value }))} /></label>
                <label>Stock<input type="number" min="0" step="1" value={formularioVariante.stock} onChange={(event) => setFormularioVariante((actual) => ({ ...actual, stock: event.target.value }))} required /></label>
                <label>Precio tienda física<input type="number" min="0" step="any" value={formularioVariante.precio} onChange={(event) => setFormularioVariante((actual) => ({ ...actual, precio: event.target.value }))} /></label>
                <label>Precio mayorista<input type="number" min="0" step="any" value={formularioVariante.precio_emprendedor} onChange={(event) => setFormularioVariante((actual) => ({ ...actual, precio_emprendedor: event.target.value }))} /></label>
                <label>Precio supermayorista<input type="number" min="0" step="any" value={formularioVariante.precio_mayorista} onChange={(event) => setFormularioVariante((actual) => ({ ...actual, precio_mayorista: event.target.value }))} /></label>
                <fieldset className="span-two admin-producto-images">
                  <legend>Imágenes <span>{formularioVariante.imagenes.length}/5</span></legend>
                  <label className="admin-productos-upload">Añadir imágenes<input type="file" accept="image/*" multiple onChange={agregarImagenesVariante} disabled={formularioVariante.imagenes.length >= 5} /></label>
                  <div className="admin-productos-previews">
                    {formularioVariante.imagenes.map((imagen, indice) => (
                      <div key={`${indice}-${imagen.slice(0, 24)}`}>
                        <img src={imagen} alt={`Imagen ${indice + 1} de variante`} />
                        <button type="button" aria-label={`Quitar imagen ${indice + 1}`} onClick={() => setFormularioVariante((actual) => ({ ...actual, imagenes: actual.imagenes.filter((_, posicion) => posicion !== indice) }))}>×</button>
                      </div>
                    ))}
                    {formularioVariante.imagenes.length === 0 && <span>Sin imágenes</span>}
                  </div>
                </fieldset>
              </div>
              {errorVariante && <p className="admin-productos-form-error" role="alert">{errorVariante}</p>}
              <footer className="admin-productos-form-actions">
                <button type="button" className="admin-productos-secondary" onClick={cerrarVariante} disabled={guardandoVariante}>Cancelar</button>
                <button type="submit" className="admin-productos-primary" disabled={guardandoVariante}>{guardandoVariante ? "Guardando..." : varianteActiva ? "Guardar cambios" : "Agregar variante"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

import { Fragment, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { supabase } from "../context/supabaseClient";
import HorizontalScroll from "../components/HorizontalScroll";
import "../styles/admin-productos.css";

const FORMULARIO_VACIO = {
  nombre: "",
  categoria_id: "",
  stock: "0",
  precio: "",
  precio_emprendedor: "",
  precio_mayorista: "",
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
  const { productos, categorias, crearProducto, actualizarProducto, eliminarProducto } = useStore();
  const [borradorInicial] = useState(leerBorrador);
  const [busqueda, setBusqueda] = useState("");
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

  if (!esAdmin()) return <Navigate to="/" replace />;

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
        .select("*")
        .eq("producto_id", Number(productoId));
      if (errorConsulta) throw errorConsulta;
      setVariantesPorProducto((actuales) => ({ ...actuales, [productoId]: data || [] }));
      return data || [];
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
      const { data, error: errorGuardado } = await consulta.select().single();
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
    if (!window.confirm(`¿Eliminar la variante “${variante.nombre || "Variante"}”?`)) return;
    const { error: errorEliminacion } = await supabase
      .from("producto_variantes")
      .delete()
      .eq("id", variante.id)
      .eq("producto_id", Number(producto.id));
    if (errorEliminacion) {
      setErroresVariantes((actuales) => ({ ...actuales, [producto.id]: errorEliminacion.message }));
      return;
    }
    setVariantesPorProducto((actuales) => ({
      ...actuales,
      [producto.id]: (actuales[producto.id] || []).filter((actual) => actual.id !== variante.id),
    }));
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
            { precio_costo: datos.precio_costo, catalogos_ocultos: datos.catalogos_ocultos }
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
    if (!window.confirm(`¿Eliminar definitivamente “${producto.nombre}”?`)) return;
    const resultado = await eliminarProducto(producto.id);
    if (resultado?.error) setError(`No se pudo eliminar: ${resultado.error}`);
    else setMensaje("Producto eliminado.");
  };

  return (
    <main className="admin-productos-page">
      <header className="admin-productos-header">
        <div>
          <span className="admin-productos-eyebrow">INVENTARIO</span>
          <h1>Administrar productos</h1>
          <p>Precios, disponibilidad e imágenes en un solo lugar.</p>
        </div>
        <button className="admin-productos-primary" type="button" onClick={abrirNuevo}>+ Nuevo producto</button>
      </header>

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
                                          <button type="button" onClick={() => abrirEdicionVariante(producto, variante)}>Editar</button>
                                          <button type="button" className="danger" onClick={() => eliminarVariante(producto, variante)}>Eliminar</button>
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
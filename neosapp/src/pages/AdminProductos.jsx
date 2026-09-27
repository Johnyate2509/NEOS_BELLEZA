import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
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

const CATALOGOS = [
  { id: "General", label: "Tienda física" },
  { id: "Emprendedor", label: "Mayorista" },
  { id: "Mayorista", label: "Supermayorista" },
];

const formatearPrecio = (precio) =>
  precio == null || precio === "" || Number(precio) === 0
    ? "—"
    : `$${Number(precio).toLocaleString("es-CO")}`;

const obtenerNombreCategoria = (producto, categorias) =>
  producto.categorias?.nombre ||
  producto.categoria ||
  categorias.find((categoria) => String(categoria.id) === String(producto.categoria_id))?.nombre ||
  "Sin categoría";

export default function AdminProductos() {
  const { esAdmin } = useAuth();
  const { productos, categorias, crearProducto, actualizarProducto, eliminarProducto } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [filtroVisibilidad, setFiltroVisibilidad] = useState("todos");
  const [productoActivo, setProductoActivo] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

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
      setProductoActivo(null);
      setFormularioAbierto(false);
      setMensaje(productoActivo ? "Producto actualizado." : "Producto creado.");
      setFormulario(FORMULARIO_VACIO);
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
        <div className="admin-productos-table-wrap">
          <table className="admin-productos-table">
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Tienda física</th><th>Mayorista</th><th>Supermayorista</th><th>Costo</th><th>Catálogo</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {productosFiltrados.map((producto) => (
                <tr key={producto.id}>
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
                  <td data-label="Acciones" className="admin-producto-actions">
                    <button type="button" onClick={() => abrirEdicion(producto)}>Editar</button>
                    <button type="button" className="danger" onClick={() => borrarProducto(producto)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {productosFiltrados.length === 0 && <tr><td className="admin-productos-empty" colSpan="9">No hay productos para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {formularioAbierto && (
        <div className="admin-productos-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardando) { setProductoActivo(null); setFormularioAbierto(false); setFormulario(FORMULARIO_VACIO); } }}>
          <section className="admin-productos-modal" role="dialog" aria-modal="true" aria-labelledby="admin-producto-form-title">
            <header className="admin-productos-modal-header">
              <div><span>DETALLE DEL PRODUCTO</span><h2 id="admin-producto-form-title">{productoActivo ? "Editar producto" : "Nuevo producto"}</h2></div>
              <button type="button" aria-label="Cerrar" onClick={() => { setProductoActivo(null); setFormularioAbierto(false); setFormulario(FORMULARIO_VACIO); }}>×</button>
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
                <button type="button" className="admin-productos-secondary" onClick={() => { setProductoActivo(null); setFormularioAbierto(false); setFormulario(FORMULARIO_VACIO); }}>Cancelar</button>
                <button type="submit" className="admin-productos-primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar producto"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
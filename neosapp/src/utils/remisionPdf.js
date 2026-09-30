import { jsPDF } from "jspdf";

const cargarImagenComoPng = (src = "/favicon.ico") => new Promise((resolve, reject) => {
  const image = new Image();
  if (!src.startsWith("/") && !src.startsWith("data:")) image.crossOrigin = "anonymous";
  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 48;
      canvas.height = image.naturalHeight || 48;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo procesar el logo.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error("No se pudo cargar el logo de la remisión."));
  image.src = src;
});

const normalizarItemsPedido = (pedido) => {
  let items = pedido.items ?? pedido.detalles ?? [];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) return [];

  const productos = Array.isArray(pedido.productos) ? pedido.productos : [];
  return items.map((item, index) => {
    const productoId = item.producto_id ?? item.productoId ?? item.product_id ?? item.id ?? item.producto?.id;
    const producto = productos.find((candidato) => String(candidato.id) === String(productoId));
    const nombreGuardado = item.nombre ?? item.nombre_producto ?? item.producto_nombre ?? item.nombreProducto ?? item.product_name;
    const esNombreFallback = typeof nombreGuardado === "string" && /^Producto #\d+$/.test(nombreGuardado);
    const nombre = (esNombreFallback ? "" : nombreGuardado) || item.producto?.nombre || producto?.nombre || nombreGuardado || `Producto ${index + 1}`;

    return {
      ...item,
      nombre: String(nombre),
      cantidad: Number(item.cantidad ?? item.quantity ?? item.qty ?? 1),
      precio: Number(item.precio ?? item.precio_unitario ?? item.valor_unitario ?? item.unit_price ?? producto?.precio ?? 0),
    };
  });
};

const formatoMoneda = (valor) => {
  const numero = Number(valor ?? 0);
  return `$${numero.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

const getNumeroContacto = (pedido = {}) => {
  const numero = pedido.contactoTelefono || pedido.telefonoContacto || pedido.telefono || pedido.celular || "+57 300 123 4567";
  return String(numero || "+57 300 123 4567");
};

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin fecha";
  const fechaDate = new Date(fecha);
  if (Number.isNaN(fechaDate.getTime())) return String(fecha);
  return fechaDate.toLocaleDateString("es-CO");
};

export const generarRemisionPedidoPDF = async (pedido = {}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 40;
  const top = 40;
  const innerWidth = pageWidth - left * 2;
  const configuracion = {
    logoUrl: "/favicon.ico",
    encabezado: "Remisión de pedido",
    pieTexto: "NEOS BELLEZA · Cualquier duda, comunícate con nosotros:",
    pieTelefono: "3001234567",
    ...(pedido.configRemision || {}),
  };
  const items = normalizarItemsPedido(pedido);
  const totalPedido = Number(pedido.total ?? items.reduce(
    (sum, item) => sum + Number(item.precio ?? 0) * Number(item.cantidad ?? 1),
    0
  ));
  const footerTop = pageHeight - 70;
  const bodyBottom = footerTop - 16;
  const productX = left + 12;
  const productWidth = 252;
  const quantityX = left + 298;
  const unitPriceRight = left + 410;
  const subtotalRight = pageWidth - left - 12;
  const rowLineHeight = 12;

  const drawTableHeader = () => {
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(left, y, innerWidth, 28, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Nombre de producto", productX, y + 18);
    doc.text("Cantidad", quantityX, y + 18, { align: "center" });
    doc.text("Valor unitario", unitPriceRight, y + 18, { align: "right" });
    doc.text("Subtotal", subtotalRight, y + 18, { align: "right" });
    y += 28;
  };

  const drawContinuationHeading = () => {
    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Remisión #${pedido.id ?? "-"} · Continuación`, left, y + 14);
    y += 26;
    drawTableHeader();
  };

  const startContinuationPage = () => {
    doc.addPage();
    y = top;
    drawContinuationHeading();
  };

  doc.setFillColor(17, 17, 17);
  doc.roundedRect(left, top, innerWidth, 88, 12, 12, "F");
  let logoPng;
  try {
    logoPng = await cargarImagenComoPng(configuracion.logoUrl);
  } catch {
    logoPng = await cargarImagenComoPng("/favicon.ico");
  }
  doc.addImage(logoPng, "PNG", left + 18, top + 20, 48, 48);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NEOS BELLEZA", left + 78, top + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(configuracion.encabezado, left + 78, top + 58);

  const rightX = pageWidth - left - 130;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Pedido #${pedido.id ?? "-"}`, rightX, top + 27);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${formatearFecha(pedido.fechaEntrega || pedido.fecha || new Date().toISOString())}`, rightX, top + 45);
  doc.text(`Estado: ${pedido.estado || "Pendiente"}`, rightX, top + 63);

  let y = top + 108;
  const customerName = doc.splitTextToSize(`Nombre: ${pedido.cliente || "Cliente sin nombre"}`, 230);
  const customerAddress = doc.splitTextToSize(`Dirección: ${pedido.direccion || "Sin dirección registrada"}`, 230);
  const customerPhone = doc.splitTextToSize(`Celular: ${pedido.telefono || pedido.celular || "Sin celular registrado"}`, innerWidth - 36);
  const customerFirstRowHeight = Math.max(customerName.length, customerAddress.length) * rowLineHeight;
  const phoneY = y + 38 + customerFirstRowHeight + 7;
  const customerBoxHeight = phoneY - y + customerPhone.length * rowLineHeight + 12;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(left, y, innerWidth, customerBoxHeight, 8, 8, "F");

  doc.setTextColor(33, 33, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos del cliente", left + 14, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(customerName, left + 14, y + 38);
  doc.text(customerAddress, left + 270, y + 38);
  doc.text(customerPhone, left + 14, phoneY);

  y += customerBoxHeight + 22;
  doc.setTextColor(33, 33, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detalle de artículos", left, y);
  y += 12;
  drawTableHeader();

  if (items.length === 0) {
    doc.setTextColor(90, 98, 110);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No hay artículos registrados en este pedido.", productX, y + 18);
    y += 32;
  } else {
    items.forEach((item, index) => {
      const nombreProducto = String(item.nombre || item.producto?.nombre || `Producto ${index + 1}`);
      const atributos = item.variante?.atributos;
      const atributoTexto = typeof atributos === "string"
        ? atributos
        : atributos && typeof atributos === "object"
          ? JSON.stringify(atributos)
          : "";
      const nombre = atributoTexto ? `${nombreProducto} (${atributoTexto})` : nombreProducto;
      const cantidad = Number(item.cantidad ?? 1);
      const precio = Number(item.precio ?? 0);
      const subtotal = cantidad * precio;

      const lines = doc.splitTextToSize(nombre, productWidth);
      const rowHeight = Math.max(26, lines.length * rowLineHeight + 12);
      if (y + rowHeight > bodyBottom) {
        startContinuationPage();
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(left, y, innerWidth, rowHeight, "F");
      }
      doc.setTextColor(33, 41, 52);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(lines, productX, y + 16);
      doc.text(String(cantidad), quantityX, y + 16, { align: "center" });
      doc.text(formatoMoneda(precio), unitPriceRight, y + 16, { align: "right" });
      doc.text(formatoMoneda(subtotal), subtotalRight, y + 16, { align: "right" });
      y += rowHeight;
      doc.setDrawColor(224, 229, 236);
      doc.setLineWidth(0.5);
      doc.line(left, y, pageWidth - left, y);
    });
  }

  if (y + 40 > bodyBottom) startContinuationPage();
  const totalY = y + 26;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(pageWidth - left - 190, y + 8, 190, 36, 5, 5, "F");
  doc.setTextColor(33, 41, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", pageWidth - left - 176, totalY);
  doc.text(formatoMoneda(totalPedido), subtotalRight, totalY, { align: "right" });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const footerY = pageHeight - 48;
    doc.setDrawColor(245, 191, 52);
    doc.setLineWidth(1.5);
    doc.line(left, footerY - 10, pageWidth - left, footerY - 10);
    doc.setTextColor(70, 70, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const pieLineas = doc.splitTextToSize(configuracion.pieTexto, innerWidth - 100);
    doc.text(pieLineas, left, footerY + 4);
    doc.text(configuracion.pieTelefono || getNumeroContacto(pedido), left, footerY + 17 + (pieLineas.length - 1) * 9);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - left, footerY + 17, { align: "right" });
  }

  doc.save(`Remision-Pedido-${pedido.id ?? "pedido"}.pdf`);
  return doc;
};

export const descargarRemisionPedido = async (pedido = {}) => {
  return generarRemisionPedidoPDF(pedido);
};

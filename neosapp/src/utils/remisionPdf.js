import { jsPDF } from "jspdf";

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

export const generarRemisionPedidoPDF = (pedido = {}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 40;
  const top = 40;
  const innerWidth = pageWidth - left * 2;

  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const totalPedido = Number(pedido.total ?? items.reduce((sum, item) => sum + Number(item.precio ?? 0) * Number(item.cantidad ?? 1), 0) ?? 0);

  doc.setFillColor(18, 52, 100);
  doc.roundedRect(left, top, innerWidth, 88, 12, 12, "F");

  doc.setFillColor(245, 191, 52);
  doc.roundedRect(left + 18, top + 18, 40, 40, 10, 10, "F");
  doc.setTextColor(18, 52, 100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("N", left + 33, top + 42);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("NEOS BELLEZA", left + 76, top + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Remisión de pedido", left + 76, top + 58);

  const rightX = pageWidth - left - 120;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Pedido #${pedido.id ?? "-"}`, rightX, top + 30);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${formatearFecha(pedido.fechaEntrega || pedido.fecha || new Date().toISOString())}`, rightX, top + 48);
  doc.text(`Estado: ${pedido.estado || "Pendiente"}`, rightX, top + 66);

  let y = top + 120;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(left, y, innerWidth, 92, 12, 12, "F");

  doc.setTextColor(33, 33, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Datos del cliente", left + 18, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nombre: ${pedido.cliente || "Cliente sin nombre"}`, left + 18, y + 42);
  doc.text(`Dirección: ${pedido.direccion || "Sin dirección registrada"}`, left + 18, y + 60);
  doc.text(`Celular: ${pedido.telefono || pedido.celular || "Sin celular registrado"}`, left + 18, y + 78);

  y += 120;
  doc.setTextColor(33, 33, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detalle de artículos", left, y);

  y += 18;
  doc.setDrawColor(214, 220, 229);
  doc.setLineWidth(1);
  doc.line(left, y, pageWidth - left, y);

  const tableHeaderY = y + 12;
  const colNombre = left + 16;
  const colCantidad = left + 280;
  const colValor = left + 360;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Artículo", colNombre, tableHeaderY);
  doc.text("Cant.", colCantidad, tableHeaderY);
  doc.text("Valor", colValor, tableHeaderY);

  y = tableHeaderY + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  if (items.length === 0) {
    doc.text("No hay artículos registrados en este pedido.", left + 16, y + 12);
    y += 22;
  } else {
    items.forEach((item, index) => {
      const nombre = String(item.nombre || `Producto ${index + 1}`);
      const cantidad = Number(item.cantidad ?? 1);
      const precio = Number(item.precio ?? 0);
      const subtotal = cantidad * precio;

      const lines = doc.splitTextToSize(nombre, 230);
      const lineHeight = 12;
      const totalLines = lines.length || 1;

      if (y + totalLines * lineHeight > pageHeight - 140) {
        doc.addPage();
        y = 60;
      }

      doc.text(lines, colNombre, y);
      doc.text(String(cantidad), colCantidad, y);
      doc.text(formatoMoneda(subtotal), colValor, y);
      y += totalLines * lineHeight + 8;
      doc.line(left, y, pageWidth - left, y);
      y += 6;
    });
  }

  const totalY = y + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", pageWidth - left - 110, totalY);
  doc.text(formatoMoneda(totalPedido), pageWidth - left - 22, totalY, { align: "right" });

  const footerY = pageHeight - 72;
  doc.setDrawColor(245, 191, 52);
  doc.setLineWidth(2);
  doc.line(left, footerY - 8, pageWidth - left, footerY - 8);

  doc.setTextColor(70, 70, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("NEOS BELLEZA", left, footerY);
  doc.text("Cualquier duda o inquietud, comunícate con nosotros:", left, footerY + 14);
  doc.text(getNumeroContacto(pedido), left, footerY + 28);
  doc.text("Gracias por tu compra.", pageWidth - left - 110, footerY + 28, { align: "right" });

  doc.save(`remision-neosbelleza-${pedido.id ?? "pedido"}.pdf`);
  return doc;
};

export const descargarRemisionPedido = (pedido = {}) => {
  generarRemisionPedidoPDF(pedido);
};

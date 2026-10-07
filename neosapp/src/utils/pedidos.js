export const obtenerClavePrealistamiento = (item, index) =>
  `${item.producto_id ?? item.id}:${item.variante?.id ?? item.variante_id ?? "base"}:${index}`;

export const pedidoEstaConfirmado = (pedido) =>
  pedido?.estado === "Confirmado" || pedido?.pre_alistamiento?.confirmado === true;

export const obtenerResumenPrealistamiento = (pedido) => {
  const cantidades = pedido.pre_alistamiento?.cantidades || {};
  const total = (pedido.items || []).reduce((suma, item) => suma + Number(item.cantidad || 0), 0);
  const empacadas = (pedido.items || []).reduce((suma, item, index) => {
    const solicitadas = Number(item.cantidad || 0);
    const registradas = Number(cantidades[obtenerClavePrealistamiento(item, index)] || 0);
    return suma + Math.min(solicitadas, Math.max(0, registradas));
  }, 0);
  return {
    total,
    empacadas,
    faltantes: Math.max(0, total - empacadas),
    confirmado: pedido.pre_alistamiento?.confirmado === true,
  };
};

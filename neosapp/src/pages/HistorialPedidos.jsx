import { useState } from "react";
import PedidosTabla from "./PedidosTabla";
import { pedidoEstaConfirmado } from "../utils/pedidos";

const normalizarValorBusqueda = (valor) =>
  String(valor ?? "").toLowerCase().replace(/[\s$.,]/g, "");

export default function HistorialPedidos({
  pedidos,
  obtenerNombreRepartidor,
  onAsignarRepartidor,
  onVerDetalle,
  onDescargarRemision,
  onEliminarPedido,
}) {
  const [busqueda, setBusqueda] = useState("");
  const filtro = busqueda.trim().toLowerCase();
  const filtroValor = normalizarValorBusqueda(filtro);
  const pedidosConfirmados = pedidos
    .filter(pedidoEstaConfirmado)
    .filter((pedido) => !filtro
      || String(pedido.cliente || "").toLowerCase().includes(filtro)
      || String(pedido.id ?? "").toLowerCase().includes(filtro)
      || normalizarValorBusqueda(pedido.total).includes(filtroValor))
    .sort((a, b) => Number(b.id) - Number(a.id));

  return (
    <section className="pedidos-historico">
      <header className="pedidos-historico-header">
        <h3>Histórico de pedidos</h3>
        <div className="buscador-container">
          <input
            type="search"
            placeholder="Buscar por nombre, ID o valor..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="buscador-input"
            aria-label="Buscar pedidos confirmados por nombre, ID o valor"
          />
        </div>
      </header>
      <PedidosTabla
        pedidos={pedidosConfirmados}
        mensajeVacio="No hay pedidos confirmados que coincidan con la búsqueda."
        obtenerNombreRepartidor={obtenerNombreRepartidor}
        onAsignarRepartidor={onAsignarRepartidor}
        onVerDetalle={onVerDetalle}
        onDescargarRemision={onDescargarRemision}
        onEliminarPedido={onEliminarPedido}
      />
    </section>
  );
}

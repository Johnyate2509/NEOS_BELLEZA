/**
 * Servicio de Email usando Resend
 * Nota: Se ejecuta desde el servidor. Requiere configurar Edge Functions en Supabase
 * o usar un backend externo
 */

// Las claves VITE_* se publican en el bundle del navegador. El envío con
// Resend debe trasladarse a una función de servidor antes de habilitarlo.
const RESEND_API_KEY = "";
const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || "noreply@neosbelleza.com";

/**
 * Envía un correo de confirmación de pedido
 * @param {object} datos - Datos del pedido
 * @returns {Promise<object>}
 */
export const enviarConfirmacionPedido = async (datos) => {
  try {
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY no configurada. Simulando envío de correo.");
      return {
        success: true,
        simulado: true,
        mensaje: "Correo simulado (configurar RESEND_API_KEY en .env)",
      };
    }

    const { pedidoId, cliente, email, telefono, items, total, formaPago, direccion } = datos;

    // Construir el HTML del correo
    const htmlContent = generarHTMLPedido({
      pedidoId,
      cliente,
      items,
      total,
      formaPago,
      direccion,
    });

    // Enviar con Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: `Confirmación de Pedido #${pedidoId} - NEOS BELLEZA`,
        html: htmlContent,
        reply_to: "soporte@neosbelleza.com",
      }),
    });

    if (!response.ok) {
      throw new Error(`Error enviando correo: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
    };
  } catch (error) {
    console.error("Error en enviarConfirmacionPedido:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Genera el HTML para el correo de confirmación
 * @param {object} datos - Datos del pedido
 * @returns {string} HTML del correo
 */
const generarHTMLPedido = ({ pedidoId, cliente, items, total, formaPago, direccion }) => {
  const itemsHTML = items
    .map(
      (item) =>
        `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nombre}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.cantidad}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.precio).toLocaleString("es-CO")}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(
        Number(item.precio) * Number(item.cantidad)
      ).toLocaleString("es-CO")}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif;
            color: #333;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .info-section {
            margin: 20px 0;
            border-left: 4px solid #667eea;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 4px;
          }
          .info-section h3 {
            margin-top: 0;
            color: #667eea;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #667eea;
            color: white;
            padding: 10px;
            text-align: left;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #eee;
          }
          .total {
            font-size: 20px;
            font-weight: bold;
            color: #667eea;
            text-align: right;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #667eea;
          }
          .footer {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Pedido Confirmado</h1>
            <p>Gracias por tu compra en NEOS BELLEZA</p>
          </div>
          
          <div class="content">
            <p>Hola <strong>${cliente}</strong>,</p>
            <p>Tu pedido ha sido confirmado exitosamente. A continuación encontrarás los detalles:</p>

            <div class="info-section">
              <h3>Número de Pedido</h3>
              <p><strong>#${pedidoId}</strong></p>
            </div>

            <div class="info-section">
              <h3>Dirección de Entrega</h3>
              <p>${direccion}</p>
            </div>

            <div class="info-section">
              <h3>Detalles de tu Pedido</h3>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio Unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
              <div class="total">
                Total: $${Number(total).toLocaleString("es-CO")}
              </div>
            </div>

            <div class="info-section">
              <h3>Método de Pago</h3>
              <p><span class="badge">${formaPago}</span></p>
            </div>

            <p style="margin-top: 30px; color: #666;">
              <strong>Estado del Pedido:</strong> Pendiente de confirmación del vendedor
            </p>

            <p style="color: #666; margin-top: 20px; font-size: 14px;">
              Pronto recibirás una notificación cuando el pedido sea procesado y enviado.
            </p>

            <div class="footer">
              <p>NEOS BELLEZA | Soporte: soporte@neosbelleza.com</p>
              <p>Este correo fue enviado a ${cliente}</p>
              <p>&copy; ${new Date().getFullYear()} NEOS BELLEZA. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Envía un correo de notificación al vendedor
 * @param {object} datos - Datos del pedido
 * @returns {Promise<object>}
 */
export const enviarNotificacionVendedor = async (datos) => {
  try {
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY no configurada. Simulando envío de correo.");
      return {
        success: true,
        simulado: true,
      };
    }

    const { pedidoId, cliente, email, items, total, vendedor } = datos;

    const itemsHTML = items
      .map(
        (item) =>
          `<li>${item.nombre} x${item.cantidad} - $${(Number(item.precio) * Number(item.cantidad)).toLocaleString("es-CO")}</li>`
      )
      .join("");

    const htmlContent = `
      <h2>Nuevo Pedido Confirmado - #${pedidoId}</h2>
      <p><strong>Cliente:</strong> ${cliente}</p>
      <p><strong>Email Cliente:</strong> ${email}</p>
      <p><strong>Total:</strong> $${Number(total).toLocaleString("es-CO")}</p>
      <p><strong>Productos:</strong></p>
      <ul>${itemsHTML}</ul>
      <p>Por favor procesa este pedido lo antes posible.</p>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: vendedor?.email || "admin@neosbelleza.com",
        subject: `Nuevo Pedido #${pedidoId} - ${cliente}`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error enviando correo: ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error en enviarNotificacionVendedor:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

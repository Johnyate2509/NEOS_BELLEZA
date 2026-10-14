/**
 * Validaciones para pedidos
 */

/**
 * Valida si un email es válido
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
export const validarEmail = (email) => {
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && regexEmail.test(email);
};

/**
 * Valida un teléfono básico
 * @param {string} telefono - Teléfono a validar
 * @returns {boolean}
 */
export const validarTelefono = (telefono) => {
  const regexTelefono = /^[0-9]{7,}$/;
  return telefono && regexTelefono.test(telefono);
};

/**
 * Valida si una cédula es válida (formato básico)
 * @param {string} cedula - Cédula a validar
 * @returns {boolean}
 */
export const validarCedula = (cedula) => {
  return cedula && cedula.toString().trim().length > 0;
};

/**
 * Valida un item del pedido
 * @param {object} item - Item a validar
 * @returns {object} { valido: boolean, errores: string[] }
 */
export const validarItemPedido = (item) => {
  const errores = [];

  if (!item.id || item.id <= 0) {
    errores.push("El producto debe tener un ID válido");
  }

  if (!item.nombre || item.nombre.trim().length === 0) {
    errores.push("El producto debe tener un nombre");
  }

  if (!item.precio || item.precio <= 0) {
    errores.push("El producto debe tener un precio mayor a 0");
  }

  if (!item.cantidad || item.cantidad <= 0) {
    errores.push("La cantidad debe ser mayor a 0");
  }

  if ((item.tipo_catalogo || "General") === "General" && item.cantidad > Number(item.stock || 0)) {
    errores.push(`No hay stock suficiente para ${item.nombre}. Stock disponible: ${item.stock}`);
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

/**
 * Valida el carrito completo
 * @param {array} carrito - Array de items del pedido
 * @returns {object} { valido: boolean, errores: string[] }
 */
export const validarCarrito = (carrito) => {
  const errores = [];

  if (!Array.isArray(carrito) || carrito.length === 0) {
    errores.push("El carrito debe tener al menos un producto");
    return { valido: false, errores };
  }

  let totalCarrito = 0;

  carrito.forEach((item, index) => {
    const validacion = validarItemPedido(item);
    if (!validacion.valido) {
      validacion.errores.forEach((error) => {
        errores.push(`Producto ${index + 1}: ${error}`);
      });
    }
    totalCarrito += (item.precio || 0) * (item.cantidad || 0);
  });

  if (totalCarrito <= 0) {
    errores.push("El total del pedido debe ser mayor a 0");
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

/**
 * Valida los datos del pedido
 * @param {object} datoPedido - Datos a validar
 * @returns {object} { valido: boolean, errores: string[] }
 */
export const validarDatosPedido = (datoPedido) => {
  const errores = [];

  // Validar cédula
  if (!validarCedula(datoPedido.cedula)) {
    errores.push("Cédula inválida o vacía");
  }

  // Validar nombre
  if (!datoPedido.nombre || datoPedido.nombre.trim().length === 0) {
    errores.push("El nombre del cliente es requerido");
  }

  // Validar dirección
  if (!datoPedido.direccion || datoPedido.direccion.trim().length === 0) {
    errores.push("La dirección es requerida");
  }

  // Validar email
  if (datoPedido.email && !validarEmail(datoPedido.email)) {
    errores.push("El email no es válido");
  }

  // Validar teléfono
  if (!datoPedido.telefono || !validarTelefono(datoPedido.telefono)) {
    errores.push("El teléfono es requerido y debe tener al menos 7 dígitos");
  }

  // Validar forma de pago
  const formasPagoValidas = ["Efectivo", "Crédito", "Abono", "Tarjeta"];
  if (!datoPedido.formaPago || !formasPagoValidas.includes(datoPedido.formaPago)) {
    errores.push("Forma de pago inválida");
  }

  // Validar carrito
  if (datoPedido.carrito) {
    const validacionCarrito = validarCarrito(datoPedido.carrito);
    if (!validacionCarrito.valido) {
      errores.push(...validacionCarrito.errores);
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

/**
 * Calcula el total del pedido
 * @param {array} carrito - Array de items
 * @returns {number}
 */
export const calcularTotal = (carrito) => {
  return carrito.reduce((sum, item) => sum + Number(item.precio) * Number(item.cantidad || 1), 0);
};

const PERFIL_COLUMNAS = "id,nombre,cedula,rol,zona,email";
const CLIENTE_COLUMNAS = "id,usuario_id,nombre,cedula,direccion,telefono,correo,saldo,transacciones,vendedor_usuario_id";

export async function asegurarPerfilCliente(supabase, authUser, datos = {}) {
  const userId = authUser?.id;
  const metadata = authUser?.user_metadata || {};
  const nombre = String(datos.nombre || metadata.nombre || "").trim();
  const cedula = String(datos.cedula || metadata.cedula || "").trim();
  const email = authUser?.email || datos.correo || "";

  if (!userId || !nombre || !cedula || !email) {
    return { error: "Faltan datos para completar el perfil del cliente." };
  }

  let { data: perfil, error } = await supabase
    .from("usuarios")
    .select(PERFIL_COLUMNAS)
    .eq("id", userId)
    .maybeSingle();
  if (error) return { error: error.message };

  if (!perfil) {
    const perfilNuevo = { id: userId, nombre, cedula, email, rol: "cliente" };
    const resultado = await supabase.from("usuarios").insert(perfilNuevo);
    if (resultado.error && resultado.error.code !== "23505") {
      return { error: resultado.error.message };
    }
    const perfilActualizado = await supabase
      .from("usuarios")
      .select(PERFIL_COLUMNAS)
      .eq("id", userId)
      .maybeSingle();
    if (perfilActualizado.error) return { error: perfilActualizado.error.message };
    perfil = perfilActualizado.data;
  }

  if (perfil?.rol !== "cliente") return { perfil, cliente: null };

  let clienteQuery = await supabase
    .from("clientes")
    .select(CLIENTE_COLUMNAS)
    .eq("usuario_id", userId)
    .maybeSingle();
  if (clienteQuery.error) return { error: clienteQuery.error.message };

  if (!clienteQuery.data) {
    const clienteNuevo = {
      usuario_id: userId,
      nombre,
      cedula,
      direccion: datos.direccion || metadata.direccion || "",
      telefono: datos.telefono || metadata.telefono || "",
      correo: email,
      vendedor_usuario_id: null,
      saldo: 0,
      transacciones: [],
    };
    const resultado = await supabase.from("clientes").insert(clienteNuevo);
    if (resultado.error && resultado.error.code !== "23505") {
      return { error: resultado.error.message };
    }
    clienteQuery = await supabase
      .from("clientes")
      .select(CLIENTE_COLUMNAS)
      .eq("usuario_id", userId)
      .maybeSingle();
    if (clienteQuery.error) return { error: clienteQuery.error.message };
  }

  return { perfil, cliente: clienteQuery.data };
}

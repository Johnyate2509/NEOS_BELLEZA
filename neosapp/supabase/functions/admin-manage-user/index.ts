import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const rolesValidos = ["cliente", "vendedor", "repartidor", "admin"];
const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Método no permitido" });

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return response(401, { error: "Se requiere una sesión válida" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(500, { error: "La función no está configurada" });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !authData.user) return response(401, { error: "Sesión no válida" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await adminClient
    .from("usuarios")
    .select("rol")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (callerError) return response(500, { error: "No se pudo verificar el permiso administrador" });
  if (caller?.rol !== "admin") return response(403, { error: "Solo un administrador puede gestionar usuarios" });

  let solicitud: { action?: string; userId?: string; role?: string };
  try {
    solicitud = await request.json();
  } catch {
    return response(400, { error: "Solicitud inválida" });
  }

  const { action, userId, role } = solicitud;
  if (typeof userId !== "string" || !uuidValido.test(userId)) {
    return response(400, { error: "ID de usuario inválido" });
  }
  if (userId === authData.user.id) return response(400, { error: "No puedes cambiar tu propio rol ni eliminar tu cuenta desde aquí" });

  const { data: usuario, error: errorUsuario } = await adminClient
    .from("usuarios")
    .select("id,nombre,email,rol,zona,cedula,created_at")
    .eq("id", userId)
    .maybeSingle();
  if (errorUsuario) return response(500, { error: "No se pudo cargar el usuario" });
  if (!usuario) return response(404, { error: "El usuario ya no existe" });

  if (action === "update_role") {
    if (typeof role !== "string" || !rolesValidos.includes(role)) {
      return response(400, { error: "Rol inválido" });
    }
    if (usuario.rol === "admin" && role !== "admin") {
      const { count, error: errorConteo } = await adminClient
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .eq("rol", "admin");
      if (errorConteo) return response(500, { error: "No se pudo comprobar cuántos administradores hay" });
      if ((count || 0) <= 1) return response(400, { error: "Debe quedar al menos un administrador activo" });
    }

    const { data: usuarioActualizado, error: errorActualizacion } = await adminClient
      .from("usuarios")
      .update({ rol: role })
      .eq("id", userId)
      .select("id,nombre,email,rol,zona,cedula,created_at")
      .single();
    if (errorActualizacion) return response(400, { error: errorActualizacion.message });
    return response(200, { success: true, usuario: usuarioActualizado });
  }

  if (action !== "delete") return response(400, { error: "Acción inválida" });

  if (usuario.rol === "admin") {
    const { count, error: errorConteo } = await adminClient
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("rol", "admin");
    if (errorConteo) return response(500, { error: "No se pudo comprobar cuántos administradores hay" });
    if ((count || 0) <= 1) return response(400, { error: "Debe quedar al menos un administrador activo" });
  }

  // Desvincula referencias operativas y conserva los registros usados por el historial.
  const { error: errorClienteUsuario } = await adminClient
    .from("clientes")
    .update({ usuario_id: null, cuenta_eliminada: true })
    .eq("usuario_id", userId);
  if (errorClienteUsuario) return response(400, { error: `No se pudo desvincular su ficha de cliente: ${errorClienteUsuario.message}` });

  if (usuario.rol === "vendedor") {
    const { error } = await adminClient.from("clientes").update({ vendedor_usuario_id: null }).eq("vendedor_usuario_id", userId);
    if (error) return response(400, { error: `No se pudieron desasignar sus clientes: ${error.message}` });
  }
  if (usuario.rol === "repartidor") {
    const { error } = await adminClient.from("pedidos").update({ repartidor_id: null }).eq("repartidor_id", userId);
    if (error) return response(400, { error: `No se pudieron desasignar sus pedidos: ${error.message}` });
  }
  const { error: errorAuth } = await adminClient.auth.admin.deleteUser(userId);
  if (errorAuth) return response(400, { error: errorAuth.message });

  const { error: errorPerfil } = await adminClient.from("usuarios").delete().eq("id", userId);
  if (errorPerfil) return response(500, { error: `Se eliminó el acceso, pero no se pudo borrar el perfil: ${errorPerfil.message}` });

  return response(200, { success: true, deletedUserId: userId });
});

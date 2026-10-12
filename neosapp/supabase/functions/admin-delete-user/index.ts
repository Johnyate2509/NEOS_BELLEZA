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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Método no permitido" });

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
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
  const { data: caller, error: roleError } = await adminClient
    .from("usuarios")
    .select("rol")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (roleError) return response(500, { error: "No se pudo verificar el permiso administrador" });
  if (caller?.rol !== "admin") return response(403, { error: "Solo un administrador puede eliminar cuentas" });

  let userId: string;
  try {
    userId = (await request.json())?.userId;
  } catch {
    return response(400, { error: "Solicitud inválida" });
  }
  if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return response(400, { error: "ID de usuario inválido" });
  }
  if (userId === authData.user.id) return response(400, { error: "No puedes eliminar tu propia cuenta desde aquí" });

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) return response(400, { error: deleteError.message });
  return response(200, { success: true });
});

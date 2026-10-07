import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { asegurarPerfilCliente } from "../utils/asegurarPerfilCliente";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfilUsuario = async (authUser) => {
    const userId = typeof authUser === "string" ? authUser : authUser?.id;
    if (!userId) {
      setPerfil(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, email, zona, rol")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error cargando perfil de usuario:", error);
        setPerfil(null);
        return;
      }

      const metadata = typeof authUser === "object" ? authUser.user_metadata || {} : {};
      let perfilUsuario = data;
      if (metadata.role === "cliente" && metadata.perfil_creado_por_admin !== true) {
        const resultadoPerfil = await asegurarPerfilCliente(supabase, authUser, metadata);
        if (resultadoPerfil.error) {
          console.error("No se pudo completar el perfil de cliente:", resultadoPerfil.error);
          if (!perfilUsuario) {
            setPerfil(null);
            return;
          }
        } else {
          perfilUsuario = resultadoPerfil.perfil || perfilUsuario;
        }
      }

      setPerfil(perfilUsuario || null);
    } catch (err) {
      console.error("Excepción cargando perfil de usuario:", err);
      setPerfil(null);
    }
  };

  useEffect(() => {
    const handleSession = async (session) => {
      try {
        setLoading(true);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await cargarPerfilUsuario(currentUser);
        } else {
          setPerfil(null);
        }
      } catch (err) {
        console.error("Error manejando sesión de auth:", err);
      } finally {
        setLoading(false);
      }
    };

    const getInitialSession = async () => {
      try {
        const sessionResponse = await supabase.auth.getSession();
        const currentUser = sessionResponse?.data?.session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await cargarPerfilUsuario(currentUser);
        }
      } catch (err) {
        console.error("Error obteniendo sesión inicial:", err);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Escuchar cambios de autenticación
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Usar un task separado para evitar posibles deadlocks con Supabase
      setTimeout(() => {
        handleSession(session);
      }, 0);
    });

    const subscription = data?.subscription;

    return () => subscription?.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const register = async (email, password, _role = 'cliente', metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...metadata,
          role: 'cliente'
        }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.session) return { success: true, user: data.user, confirmationRequired: true };
    const resultadoPerfil = await asegurarPerfilCliente(supabase, data.user, metadata);
    if (resultadoPerfil.error) return { success: false, error: resultadoPerfil.error };
    return { success: true, user: data.user };
  };

  const getUserRole = () => {
    // user_metadata es modificable por el propio usuario en Supabase Auth.
    // Los permisos solo se derivan del perfil controlado por el servidor.
    return perfil?.rol || 'cliente';
  };

  const getUserMetadata = () => {
    const metadataBase = {
      ...(user?.user_metadata || {}),
      id: user?.id || perfil?.id || undefined,
      usuario_id: user?.id || perfil?.id || undefined,
    };

    if (perfil) {
      return {
        ...metadataBase,
        ...perfil,
        id: perfil.id || metadataBase.id,
        usuario_id: perfil.id || metadataBase.usuario_id,
      };
    }

    return metadataBase;
  };

  const getUserAvatarUrl = () => {
    const metadata = getUserMetadata();
    if (metadata.avatar_url) return metadata.avatar_url;

    const seed = user?.id || user?.email || "anon";
    return `https://api.dicebear.com/6.x/identicon/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  };

  // Funciones de compatibilidad con el código existente
  const esAdmin = () => getUserRole() === "admin";
  const esRepartidor = () => getUserRole() === "repartidor";
  const esVendedor = () => getUserRole() === "vendedor";
  const obtenerUsuario = () => perfil?.nombre || user?.email;
  const obtenerDatosUsuario = () => getUserMetadata();
  const obtenerAvatarUsuario = () => getUserAvatarUrl();
  const isAuthenticated = () => !!user;
  const usuarioAutenticado = !!user;

  const value = {
    user,
    perfil,
    loading,
    login,
    logout,
    register,
    getUserRole,
    getUserMetadata,
    getUserAvatarUrl,
    // Funciones de compatibilidad
    esAdmin,
    esRepartidor,
    esVendedor,
    obtenerUsuario,
    obtenerDatosUsuario,
    obtenerAvatarUsuario,
    isAuthenticated,
    usuarioAutenticado,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/// FUNCIONES DE REGISTRAR USUARIO NUEVO (CLIENTE)

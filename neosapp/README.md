# NEOS BELLEZA - Sistema de Gestión de Pedidos

Aplicación React + Vite para la gestión de clientes, productos, pedidos y repartidores en NEOS BELLEZA.

## ✨ Características Principales

### 📱 Gestión de Clientes
- Cartera de clientes por vendedor
- Información de contacto y saldo
- Historial de transacciones

### 🛍️ Gestión de Pedidos
- Creación de pedidos por vendedor
- **Confirmación automática por email** ✨ NUEVO
- Validaciones completas de datos
- Seguimiento de estado
- Asignación a repartidores

### 📊 Dashboards
- Dashboard de vendedor
- Dashboard de repartidor
- Reportes de ventas
- Visualización de mapa

### 💳 Métodos de Pago
- Efectivo
- Crédito
- Abono
- Tarjeta

## 🚀 Nuevas Funcionalidades (V1.1)

### 📧 Confirmación de Pedidos por Email
- Validación completa de datos antes de crear pedido
- Envío automático de confirmación al cliente
- Email profesional con detalles del pedido
- Integración con Resend API

**Validaciones incluidas:**
- Email válido
- Teléfono con formato correcto
- Cantidad > 0
- Stock suficiente
- Total > 0
- Datos de cliente completos

## 📦 Stack Tecnológico

- **Frontend**: React 19 + Vite
- **Base de Datos**: Supabase
- **Autenticación**: Supabase Auth
- **Email**: Resend API
- **Gráficos**: Chart.js + React Chart JS 2

## 🛠️ Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd neosapp

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Iniciar desarrollo
npm run dev
```

## Seguridad de variables

`.env.local` y las variantes `.env.*` se excluyen de Git. Las variables
`VITE_*` se incluyen en el bundle del navegador: úsalas sólo para configuración
pública, como la URL y la clave publishable/anon de Supabase. Nunca pongas una
clave `service_role`, Resend u otro secreto en una variable `VITE_*`; configura
los secretos de servidor en una función/backend.

En Vercel, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en
Project Settings → Environment Variables.

## 📝 Configuración de Email

El envío de emails está deshabilitado desde el navegador. Para reactivarlo,
impleméntalo en una función de servidor y guarda allí la clave de Resend como
secreto; nunca uses `VITE_RESEND_API_KEY`.

Ver [CONFIGURACION_EMAILS.md](./CONFIGURACION_EMAILS.md) para más detalles.

## 📚 Documentación

- [CONFIGURACION_EMAILS.md](./CONFIGURACION_EMAILS.md) - Análisis de BD y setup técnico
- [RESUMEN_IMPLEMENTACION.md](./RESUMEN_IMPLEMENTACION.md) - Overview de cambios
- [GUIA_PRUEBAS.md](./GUIA_PRUEBAS.md) - Suite de pruebas
- [CHECKLIST_IMPLEMENTACION.md](./CHECKLIST_IMPLEMENTACION.md) - Pasos de implementación

## 🏗️ Estructura del Proyecto

```
neosapp/
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── context/             # Context API (Auth, Store)
│   ├── pages/               # Páginas principales
│   ├── layout/              # Componentes de layout
│   ├── services/            # Servicios (email, etc)
│   ├── utils/               # Funciones utilitarias
│   ├── styles/              # CSS global
│   ├── App.jsx              # Componente principal
│   └── main.jsx             # Entry point
├── public/                  # Archivos estáticos
├── .env.example             # Variables de entorno
└── vite.config.js           # Configuración de Vite
```

## 🔗 Rutas Principales

### Públicas
- `/login` - Iniciar sesión
- `/register` - Registrarse

### Protegidas (Requieren autenticación)
- `/dashboard` - Dashboard principal
- `/clientes` - Gestión de clientes
- `/pedidos` - Gestión de pedidos
- `/productos` - Catálogo de productos
- `/vendedores` - Gestión de vendedores
- `/repartidores` - Gestión de repartidores

## 💻 Scripts Disponibles

```bash
npm run dev      # Iniciar servidor de desarrollo
npm run build    # Compilar para producción
npm run preview  # Preview de build
npm run lint     # Ejecutar ESLint
```

## 🧪 Pruebas

Ver [GUIA_PRUEBAS.md](./GUIA_PRUEBAS.md) para:
- Suite completa de pruebas
- Casos de prueba detallados
- Verificación de email
- Manejo de errores

## 📧 Sistema de Email

### Características
- Confirmación automática de pedidos
- Notificación al vendedor
- HTML profesional y responsive
- Incluye detalles del pedido
- Template personalizable

### Validaciones
- Email válido
- Cliente con datos completos
- Carrito con productos válidos
- Stock disponible

## 🔐 Seguridad

- Validación en frontend
- Variables de entorno para credenciales
- Autenticación con Supabase
- Contraseñas encriptadas

## 🤝 Contribución

Las nuevas funcionalidades deben incluir:
1. Validaciones completas
2. Documentación
3. Pruebas
4. Actualización de changelog

## 📝 Changelog

### v1.1 (Mayo 2026)
- ✨ Confirmación de pedidos por email
- ✨ Validaciones completas
- 🎨 Interfaz mejorada
- 📚 Documentación completa

### v1.0
- Gestión de clientes
- Gestión de pedidos
- Gestión de productos
- Dashboards

## 📧 Soporte

Para problemas o sugerencias:
- Email: soporte@neosbelleza.com
- Revisar documentación en archivos .md

## 📄 Licencia

Privada - NEOS BELLEZA 2026

# IT Dashboard - Sistema de Gestión y Soporte TI

Plataforma web centralizada para el control de inventario de hardware, gestión de equipos en terreno y seguimiento de incidencias, diseñada para departamentos de soporte técnico. Cuenta con control de acceso por roles (RBAC) y almacenamiento local ligero.

## 🚀 Características Principales

*   **Gestión de Accesos:** Sistema de inicio de sesión seguro con sesiones (`express-session`) y división de roles (Administrador y Técnico).
*   **Inventario CUA & GLPI:** Visualización, gestión y cruce de datos de activos tecnológicos.
*   **Gestión de Hardware:** Control del ciclo de vida de los equipos mediante módulos de **Recepciones IT**, **Instalaciones** y **Devoluciones a Bodega**.
*   **Fallas Avaya:** Registro, seguimiento y automatización de notificaciones por correo de teléfonos dañados.
*   **Interfaz Moderna:** Diseño responsivo con Bootstrap 5 y soporte nativo para Modo Oscuro.
*   **Persistencia Local:** Bases de datos en formato JSON (`/data`), eliminando la necesidad de configurar motores SQL externos.

## 📋 Prerrequisitos

Para ejecutar este proyecto en un servidor o equipo local, el sistema debe contar con:
*   [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada).
*   **NPM** (Gestor de paquetes, se instala automáticamente con Node.js).
*   *(Opcional)* **PM2** para ejecución en segundo plano en entornos de producción.

## ⚙️ Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/TU-USUARIO/it-dashboard.git](https://github.com/TU-USUARIO/it-dashboard.git)
   cd it-dashboard

   Instalar dependencias:
El proyecto requiere las librerías express y express-session. Instálalas ejecutando:

Bash
npm install
(Esto leerá el archivo package.json, o creará los módulos necesarios si lo haces manualmente).

Iniciar el servidor:

Bash
node server.js
Acceder a la plataforma:
Abre tu navegador web e ingresa a la dirección de tu servidor local en el puerto asignado (por defecto 3000):
http://localhost:3000

🔐 Primer Acceso (Credenciales por defecto)
El sistema es autoconfigurable. La primera vez que ejecutes node server.js, detectará que no existe una base de datos de usuarios y creará automáticamente el perfil maestro para que puedas ingresar:

Usuario: admin

Contraseña: soporte123

Nota de Seguridad: Se recomienda encarecidamente iniciar sesión, ir al módulo Gestión de Usuarios, crear tu cuenta administrativa personalizada y eliminar o cambiar la clave de esta cuenta por defecto.

📁 Estructura del Proyecto
/public - Interfaz frontend (Archivos HTML, CSS y scripts del cliente).

/data - Directorio autogenerado que almacena las bases de datos JSON (usuarios, devoluciones, avaya, etc.).

server.js - Motor de la aplicación. Maneja el servidor Express, la seguridad de rutas y las operaciones CRUD (API).

.gitignore - Archivos bloqueados para no subir datos sensibles ni carpetas pesadas a GitHub.


🛠️ Despliegue en Producción (Recomendado)
Para mantener el dashboard activo 24/7 sin depender de una ventana de consola abierta, utiliza PM2:

Bash
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Iniciar el sistema de forma invisible
pm2 start server.js --name "it-dashboard"

# 3. Comprobar el estado del sistema
pm2 list

*** 

**Un detalle final:** Recuerda reemplazar `TU-USUARIO` en el enlace de clonación por tu nombre de usuario real de GitHub una vez que lo subas. ¿Tienes alguna duda sobre cómo inicializar el repositorio o instalar PM2 en tu servidor de TI?

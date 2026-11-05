# Algarrobo Connect - Ecosistema Completo de Gestión y Reservas

Este repositorio contiene la solución tecnológica integral para **Cabañas Algarrobo Connect**, compuesta por una arquitectura desacoplada y sincronizada a través de una base de datos relacional centralizada:

1. 🖥️ **Aplicación de Escritorio (Administración):** Construida con **Electron** y **Node.js** para la gestión operativa, inventario, confirmación de pagos, bloqueos de fechas y reportes del personal administrativo.
2. 🌐 **Plataforma Web (Portal de Clientes):** Desarrollada en **Django 5.2** para que los huéspedes puedan explorar cabañas con precios por noche, reservar en línea, pagar con tarjeta mediante Webpay Plus o registrar comprobantes de transferencia y calificar su experiencia con estrellas.
3. ⚡ **Microservicio de Autenticación (API):** Desarrollado en **FastAPI**, **SQLAlchemy** y **bcrypt** para el registro seguro, hashing matemático y validación de credenciales.
4. 🗄️ **Base de Datos Centralizada:** **MySQL / MariaDB** (`algarrobo_connect`) en el puerto estándar `3306`, compartida por todos los frentes.

---

## 🏛️ Arquitectura del Sistema

```
                         ┌────────────────────────────────────────┐
                         │   MySQL / MariaDB (algarrobo_connect)  │
                         │              Puerto 3306               │
                         └───────▲────────────────────▲───────────┘
                                 │                    │
              Consultas SQL      │                    │ ORM / PyMySQL
          (mysql2 / Connection   │                    │
                 Pool)           │                    │
                                 │                    │
        ┌────────────────────────┴─────┐     ┌────────┴───────────────────┐
        │  App de Escritorio (Admin)  │     │   Plataforma Web (Cliente) │
        │      Electron + Node.js      │     │          Django 5          │
        │   (main.js, preload.js,      │     │     (Puerto 8000)          │
        │         renderer.js)         │     └──────────────▲─────────────┘
        └──────────────────────────────┘                    │
                                                            │ HTTP REST (JSON)
                                                            ▼
                                             ┌────────────────────────────┐
                                             │  Microservicio de Usuarios │
                                             │      FastAPI + bcrypt      │
                                             │        (Puerto 8001)       │
                                             └────────────────────────────┘
```

* **Fuente única de verdad:** La base de datos centraliza toda la persistencia de transacciones, inventarios, reservas y estados de pago.
* **Separación de responsabilidades:**
  * Las tareas administrativas (aprobar reservas, validar comprobantes de pago, registrar movimientos de inventario, bloquear fechas por mantenimiento y exportar reportes) se ejecutan exclusivamente desde la **App de Escritorio**.
  * La **Plataforma Web** se orienta a la experiencia del huésped (catálogo dinámico, cálculo de rutas, consulta climática, pagos en línea y reseñas).

---

## 🌐 Catálogo y Funcionamiento de las 6 APIs Integradas

La plataforma integra 6 APIs complementarias que enriquecen los servicios al cliente, la seguridad del sistema y la operativa del negocio:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   APIs DEL SISTEMA                                     │
├──────────────────────────┬─────────────────────────────────┬───────────────────────────┤
│ 1. OpenStreetMap         │ Cartografía y mapas interactivos│ Mapas georreferenciados   │
│ 2. Open-Meteo            │ Clima y pronóstico en tiempo real│ Meteorología en balneario │
│ 3. FastAPI Usuarios      │ Autenticación y cifrado Bcrypt  │ Seguridad e identidades   │
│ 4. OSRM Routing Machine  │ Rutas viales, distancias y km   │ Cálculo de viaje en ruta  │
│ 5. Transbank Webpay Plus │ Pasarela de pagos con tarjeta   │ Cobro digital bancario    │
│ 6. WhatsApp Cloud/Gateway│ Notificaciones automáticas      │ Mensajería instantánea    │
└──────────────────────────┴─────────────────────────────────┴───────────────────────────┘
```

### 1. API de Cartografía y Georreferenciación (OpenStreetMap & Leaflet)
* **Proveedor:** OpenStreetMap Foundation / Tile Server REST.
* **Objetivo en el negocio:** Desplegar la ubicación geográfica exacta de las cabañas en Algarrobo, permitiendo a los turistas ubicar visualmente el recinto frente a la costa.
* **Tecnología e Integración:** Cliente JavaScript mediante la librería **Leaflet**, consumiendo mosaicos vectoriales y ráster vía solicitudes HTTPS a `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.
* **Flujo de datos:** El navegador solicita los azulejos cartográficos de las coordenadas de Algarrobo (`[-33.3667, -71.6667]`) y renderiza marcadores personalizados con ventanas emergentes interactivas de cada cabaña disponible.

### 2. API Meteorológica y Pronóstico del Tiempo (Open-Meteo / OpenWeather)
* **Proveedor:** Open-Meteo REST API.
* **Objetivo en el negocio:** Informar a los futuros huéspedes sobre el clima en tiempo real, temperatura actual, velocidad del viento y estado meteorológico en Algarrobo antes de su estadía.
* **Tecnología e Integración:** Peticiones asíncronas GET a `https://api.open-meteo.com/v1/forecast?latitude=-33.3667&longitude=-71.6667&current_weather=true`.
* **Flujo de datos:** La plataforma consulta el servicio sin requerir claves API privadas ni cuotas restrictivas, interpreta la respuesta JSON (`temperature`, `windspeed`, `weathercode`) y proyecta dinámicamente un banner meteorológico adaptado con iconografía SVG.

### 3. API REST de Autenticación y Cifrado (Microservicio FastAPI + Bcrypt)
* **Proveedor:** Servicio interno desacoplado desarrollado con FastAPI, SQLAlchemy y Python `bcrypt`.
* **Objetivo en el negocio:** Aislar la capa de identidad y credenciales de los usuarios, gestionando altas de cuenta e inicios de sesión bajo estándares criptográficos modernos.
* **Tecnología e Integración:** Endpoints HTTP RESTful JSON (`/usuarios/login` y `/usuarios/registro`) expuestos en el puerto `8001`.
* **Flujo de datos:**
  1. Durante el registro, la API aplica un algoritmo de hash unidireccional con sal aleatoria (`bcrypt.hashpw(pass, gensalt(rounds=10))`) antes de escribir en la base de datos.
  2. En el login, la API valida el texto ingresado contra el hash almacenado mediante `bcrypt.checkpw`, retornando un objeto JSON de sesión sin exponer jamás la contraseña ni el hash al cliente.

### 4. API Vial de Rutas, Distancias y Tiempos (OSRM - Open Source Routing Machine)
* **Proveedor:** Project OSRM Routing Engine REST API.
* **Objetivo en el negocio:** Calcular la distancia exacta en kilómetros y el tiempo estimado de viaje en automóvil y transporte público desde el punto de origen del visitante (detectado por GPS o con origen en Santiago) hasta el complejo de cabañas.
* **Tecnología e Integración:** Endpoint REST:
  `https://router.project-osrm.org/route/v1/driving/{lon_origen},{lat_origen};{lon_destino},{lat_destino}?overview=full&geometries=geojson`
* **Flujo de datos:**
  1. El portal obtiene las coordenadas del usuario vía la API de Geolocalización HTML5 del navegador o toma las coordenadas predeterminadas de Santiago Centro (`-70.6506, -33.4372`).
  2. Envía las coordenadas a OSRM, el cual procesa la red vial chilena y retorna la geometría de la ruta en formato GeoJSON, la distancia en metros y la duración en segundos.
  3. La plataforma dibuja la polilínea azul de navegación directamente sobre el mapa interactivo y presenta un desglose visual con la distancia total en km y el tiempo proyectado.

### 5. API de Pasarela de Pagos Digitales (Transbank Webpay Plus REST Sandbox)
* **Proveedor:** Transbank S.A. (API REST Oficial Webpay Plus v1.2).
* **Objetivo en el negocio:** Brindar a los clientes la posibilidad de abonar sus reservas al instante utilizando tarjetas de crédito, débito o prepago con confirmación bancaria automática.
* **Tecnología e Integración:** Consumo de la API REST mediante la librería `requests` de Python contra el ambiente de integración Transbank:
  * Código de Comercio: `597055555532`
  * Endpoint de Creación: `https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions`
  * Endpoint de Confirmación: `.../transactions/{token}`
* **Flujo de datos:**
  1. El cliente pulsa "Pagar con Webpay Plus"; el backend de Django genera una orden de compra única y solicita un token a Transbank enviando las cabeceras `Tbk-Api-Key-Id` y `Tbk-Api-Key-Secret`.
  2. La vista redirige al cliente a la pasarela bancaria oficial de Transbank mediante un formulario POST automático.
  3. Tras la autorización en Transbank, el flujo retorna a `/pago/webpay/retorno/`, donde el backend confirma la transacción (método `PUT`), actualiza el pago a estado *Aprobado* (`id_estado_pago = 2`), confirma la reserva (`estado = 'Confirmada'`) y genera el comprobante digital bancario con código de autorización y últimos dígitos de la tarjeta.

### 6. API de Mensajería y Notificaciones (WhatsApp Cloud / Gateway Directo)
* **Proveedor:** Meta WhatsApp API / Gateway Web Directo (`api.whatsapp.com/send`).
* **Objetivo en el negocio:** Notificar al cliente y al administrador acerca de la creación o pago exitoso de una reserva, además de permitir la comunicación directa con el huésped desde la aplicación de escritorio.
* **Tecnología e Integración:** 
  * Generación y envío mediante el esquema estandarizado de WhatsApp API:
    `https://api.whatsapp.com/send?phone={telefono_limpio}&text={mensaje_url_encoded}`
  * Registro y trazabilidad centralizada en la tabla `historial_mensajes_whatsapp` de la base de datos.
* **Flujo de datos:**
  1. Al confirmarse un pago o registrarse un evento relevante en Django o Electron, el sistema genera la plantilla de notificación y la persiste en el historial.
  2. El personal administrativo cuenta en la aplicación de escritorio con un panel dedicado de comunicaciones para enviar mensajes directos con un clic mediante el protocolo de WhatsApp.

---

## 📁 Estructura del Repositorio

```text
avancecapstone/
├── BD/
│   └── cabanas algarrobo.sql       # Script SQL maestro con estructura relacional y datos semilla
├── Mockups/                        # Diseños visuales de referencia de la app de escritorio
├── src/
│   ├── index.html                  # Interfaz gráfica de la app de escritorio (Electron)
│   ├── styles.css                  # Hoja de estilos con variables de diseño institucional
│   └── renderer.js                 # Lógica cliente, reactividad y eventos IPC
├── cabanas-algarrobo/              # Módulos Web y API (Python)
│   ├── cabanas-main/               # Proyecto Django (Portal del huésped)
│   │   ├── app/                    # Vistas, modelos ORM y controladores de negocio
│   │   ├── cabanas/                # Configuración global, enrutamiento y WSGI
│   │   ├── static/                 # Hojas de estilo, assets e iconografía
│   │   ├── templates/              # Plantillas HTML con motor de templates Django
│   │   └── manage.py               # Punto de entrada de comandos Django
│   ├── usuaruios_api/              # Microservicio FastAPI de gestión de identidades
│   │   ├── main.py                 # Enrutamiento de endpoints REST
│   │   ├── crud.py                 # Lógica de persistencia y hashing Bcrypt
│   │   ├── database.py             # Conexión SQLAlchemy a la base de datos MySQL
│   │   ├── models.py               # Modelo declarativo de la entidad Usuario
│   │   └── schemas.py              # Validación tipada con esquemas Pydantic
│   └── requirements.txt            # Manifiesto de dependencias de Python
├── db.js                           # Configuración del Connection Pool de MySQL en Node.js
├── main.js                         # Proceso principal de Electron, controladores IPC y sincronización
├── preload.js                      # Context Bridge seguro para la comunicación IPC
├── start-db.bat                    # Script para inicio asistido de base de datos en Windows
├── start-db.sh                     # Script para inicio asistido de base de datos en Linux
├── test-db.js                      # Script de verificación de conexión relacional desde Node.js
├── package.json                    # Manifiesto de dependencias y scripts de Node.js / Electron
└── .gitignore                      # Exclusiones de entornos virtuales y dependencias
```

---

## 🔑 Credenciales de Acceso

| Perfil | Correo Electrónico | Contraseña | Entorno Destinado |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@algarroboconnect.cl` | `admin123` | **App de Escritorio (Electron)** |
| **Cliente Demostración 1** | `carlos.munoz@gmail.com` | `cliente123` | **Plataforma Web (Django)** |
| **Cliente Demostración 2** | `camila.soto@gmail.com` | `cliente123` | **Plataforma Web (Django)** |

> El registro de nuevos clientes se encuentra habilitado en el formulario web a través del botón **"Crear Cuenta"**.

---

## 🪟 Guía de Instalación y Despliegue en Windows

### 1. Requisitos Previos en Windows
* **Node.js** (versión 18 LTS o superior): [Sitio Oficial Node.js](https://nodejs.org/)
* **Python** (versión 3.11, 3.12 o 3.13): [Sitio Oficial Python](https://www.python.org/) *(Es obligatorio marcar la opción "Add Python to PATH" durante la instalación)*.
* **MySQL Server** o **XAMPP / WampServer** con servicio MySQL activo en el puerto `3306`.
* **Git**: [Sitio Oficial Git](https://git-scm.com/)

---

### 2. Configurar e Iniciar la Base de Datos en Windows
1. Iniciar el motor de base de datos según el entorno disponible:
   * **Con XAMPP:** Abrir el panel de control y activar el módulo **MySQL**.
   * **Con Servicio de Windows:** Ejecutar en PowerShell o CMD con privilegios de Administrador:
     ```powershell
     net start MySQL
     ```
   * **Con Script asistido:** Ejecutar el archivo `start-db.bat` ubicado en la raíz del repositorio.
2. Crear la base de datos relacional mediante la consola o gestor visual (Workbench / phpMyAdmin):
   ```sql
   CREATE DATABASE IF NOT EXISTS algarrobo_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Importar el archivo SQL maestro ubicado en `BD/cabanas algarrobo.sql`:
   ```powershell
   mysql -u root -p algarrobo_connect < "BD\cabanas algarrobo.sql"
   ```
4. Comprobar la conexión desde Node.js:
   ```powershell
   node test-db.js
   ```

---

### 3. Configurar y Ejecutar la App de Escritorio (Electron)
Desde una terminal situada en la raíz del repositorio (`avancecapstone/`):

```powershell
# 1. Instalar dependencias de Node.js
npm install

# 2. Iniciar la aplicación de escritorio
npm start
```

---

### 4. Configurar y Levantar el Microservicio de Autenticación (FastAPI)
Desde una segunda terminal en la carpeta `cabanas-algarrobo/`:

```powershell
cd cabanas-algarrobo

# 1. Crear el entorno virtual
python -m venv venv

# 2. Activar el entorno virtual
.\venv\Scripts\activate

# 3. Instalar las dependencias de Python
pip install -r requirements.txt

# 4. Iniciar el servidor Uvicorn en el puerto 8001
cd usuaruios_api
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
*Documentación interactiva Swagger disponible en:* `http://127.0.0.1:8001/docs`

---

### 5. Ejecutar la Plataforma Web (Django)
Desde una tercera terminal en la carpeta `cabanas-algarrobo\cabanas-main\`:

```powershell
cd cabanas-algarrobo\cabanas-main

# 1. Activar el entorno virtual
..\venv\Scripts\activate

# 2. Ejecutar las migraciones de Django
python manage.py migrate

# 3. Iniciar el servidor de desarrollo en el puerto 8000
python manage.py runserver 127.0.0.1:8000
```
*Portal web disponible en:* `http://127.0.0.1:8000/`

---

## 🐧 Guía de Instalación y Despliegue en Linux

Instrucciones de despliegue según la distribución utilizada (**Arch Linux**, **Ubuntu/Debian** o **Fedora**).

---

### 1. Instalación de Paquetes Base por Distribución

#### 🏹 Arch Linux / Manjaro / EndeavourOS
```bash
# 1. Instalar paquetes oficiales con pacman
sudo pacman -Syu nodejs npm python python-pip mariadb git

# 2. Inicializar el directorio de datos de MariaDB (paso mandatorio en Arch Linux)
sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql

# 3. Iniciar y habilitar el servicio del motor relacional
sudo systemctl enable --now mariadb
```

#### 🔵 Ubuntu / Debian / Linux Mint / WSL
```bash
# 1. Actualizar repositorios e instalar paquetes
sudo apt update
sudo apt install -y nodejs npm python3 python3-venv python3-pip mariadb-server git

# 2. Iniciar y habilitar el servicio de MariaDB
sudo systemctl enable --now mariadb
```

#### 🎩 Fedora / RHEL / Rocky Linux
```bash
# 1. Instalar dependencias mediante DNF
sudo dnf install -y nodejs npm python3 python3-pip mariadb-server git

# 2. Iniciar y habilitar el servicio de MariaDB
sudo systemctl enable --now mariadb
```

---

### 2. Creación e Importación de la Base de Datos
Con el motor relacional en ejecución:

```bash
# 1. Crear el esquema relacional
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS algarrobo_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Importar la estructura y datos iniciales
sudo mariadb algarrobo_connect < "BD/cabanas algarrobo.sql"
```

*(En instalaciones configuradas con contraseña para el usuario root, se debe anexar el argumento `-u root -p`).*

---

### 3. Ejecutar la App de Escritorio (Electron)
Desde la raíz del repositorio (`avancecapstone/`):

```bash
# 1. Instalar paquetes de Node.js
npm install

# 2. Comprobar conectividad con la base de datos
node test-db.js

# 3. Iniciar el proceso de Electron
npm start
```

---

### 4. Configurar Entorno Python y Levantar Servicios Web (FastAPI y Django)

```bash
cd cabanas-algarrobo

# 1. Crear y activar el entorno virtual
python3 -m venv venv
source venv/bin/activate

# 2. Instalar el conjunto de dependencias requeridas
pip install -r requirements.txt

# 3. Levantar el Microservicio FastAPI (Terminal 1)
cd usuaruios_api
uvicorn main:app --host 127.0.0.1 --port 8001

# 4. Levantar la Plataforma Web Django (Terminal 2)
# En una terminal adicional con el entorno virtual activo:
cd cabanas-algarrobo/cabanas-main
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

---

## 🔒 Mecanismos de Seguridad y Sincronización

1. **Cifrado Robusto de Contraseñas (Bcrypt):**
   * El sistema incorpora el algoritmo criptográfico **Bcrypt** con un factor de trabajo (*cost factor*) de 10 iteraciones saladas, implementado tanto en el proceso de Electron (`bcryptjs`) como en la API de autenticación (`bcrypt` en Python).
   * Al registrarse un usuario, la contraseña en texto plano es transformada inmediatamente en un hash de 60 caracteres (`$2b$10$...`) antes de su persistencia en la base de datos, imposibilitando el almacenamiento de claves legibles.
   * La validación de credenciales se efectúa mediante comparación segura de funciones hash (`bcrypt.compare`), sin exponer ni transmitir las contraseñas originales.
   * Cuenta con un mecanismo de actualización progresiva: si una cuenta histórica fue creada previamente sin hash, el sistema la autentica y actualiza automáticamente su registro al nuevo formato cifrado.

2. **Sincronización Dinámica sin Recargas Manuales:**
   * La aplicación de escritorio implementa un ciclo de sincronización periódica en segundo plano combinado con la detección de foco de ventana.
   * Las interacciones generadas desde el portal web (nuevas reservas, pagos procesados por Webpay, comprobantes de transferencia y reseñas con estrellas) se reflejan de forma automática en los paneles del administrador sin requerir la intervención del usuario ni reinicios de la aplicación.
   * El sistema detecta cuándo existen formularios en edición activa para prevenir que la actualización de datos interfiera con el texto que el operador se encuentre redactando.

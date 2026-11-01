# Algarrobo Connect - Ecosistema Completo de Gestión y Reservas

Este repositorio contiene la solución tecnológica integral para **Cabañas Algarrobo Connect**, compuesta por una arquitectura desacoplada y sincronizada a través de una base de datos relacional centralizada:

1. 🖥️ **Aplicación de Escritorio (Administración):** Construida con **Electron** y **Node.js** para la gestión operativa, inventario, confirmación de pagos, bloqueos de fechas y reportes del personal administrativo.
2. 🌐 **Plataforma Web (Portal de Clientes):** Desarrollada en **Django 5.2** para que los huéspedes puedan explorar cabañas con precios por noche, reservar online, registrar pagos por transferencia y calificar su experiencia con estrellas.
3. ⚡ **Microservicio de Autenticación (API):** Desarrollado en **FastAPI**, **SQLAlchemy** y **bcrypt** para el registro seguro, hashing y validación de usuarios.
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

* **Principio rector:** La Base de Datos es la fuente única de verdad para el sistema.
* **Separación de responsabilidades:**
  * Las tareas administrativas (aprobar reservas, cambiar estados de pago, gestionar inventario, bloquear fechas por mantención, reportes CSV) se realizan exclusivamente desde la **App de Escritorio**.
  * La **Web** está optimizada para la interacción del cliente (catálogo, reservas, pagos y comentarios).

---

## 📁 Estructura del Repositorio

```text
avancecapstone/
├── BD/
│   └── cabanas algarrobo.sql       # Script SQL maestro con estructura y datos semilla
├── Mockups/                        # Diseños visuales de referencia de la app de escritorio
├── src/
│   ├── index.html                  # Interfaz gráfica de la app de escritorio
│   ├── styles.css                  # Estilos visuales de la app de escritorio
│   └── renderer.js                 # Lógica visual e invocación de eventos IPC
├── cabanas-algarrobo/              # Módulos Web y API (Python)
│   ├── cabanas-main/               # Proyecto Django (Portal de clientes)
│   │   ├── app/                    # Modelos, vistas y lógica cliente
│   │   ├── cabanas/                # Configuración, URLs y WSGI
│   │   ├── static/                 # CSS, imágenes y JS públicos
│   │   ├── templates/              # Plantillas HTML (vistas del cliente)
│   │   └── manage.py
│   ├── usuaruios_api/              # Microservicio FastAPI de autenticación
│   │   ├── main.py                 # Endpoints (/usuarios/login, /usuarios/registro)
│   │   ├── crud.py                 # Lógica con hashing seguro bcrypt
│   │   ├── database.py             # Conexión SQLAlchemy a MySQL
│   │   ├── models.py               # Modelo de Usuario
│   │   └── schemas.py              # Esquemas Pydantic
│   └── requirements.txt            # Dependencias Python
├── db.js                           # Configuración del Pool de conexiones MySQL en Node.js
├── main.js                         # Proceso principal de Electron y controladores IPC
├── preload.js                      # Puente seguro IPC entre frontend y backend de Electron
├── start-db.sh                     # Script para iniciar MariaDB local en Linux
├── test-db.js                      # Test rápido de conectividad a la BD desde Node
├── package.json                    # Dependencias y scripts de Node.js / Electron
└── .gitignore                      # Exclusión de venv, node_modules y temporales
```

---

## 🔑 Credenciales de Acceso

| Rol | Correo | Contraseña | Plataforma Recomendada |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@algarroboconnect.cl` | `admin123` | **App de Escritorio (Electron)** |
| **Cliente de Prueba 1** | `carlos.munoz@gmail.com` | `cliente123` | **Plataforma Web (Django)** |
| **Cliente de Prueba 2** | `camila.soto@gmail.com` | `cliente123` | **Plataforma Web (Django)** |

> 💡 Los clientes también pueden registrar cuentas nuevas directamente desde el botón **"Crear Cuenta"** en la web.

---

## 🪟 Guía de Instalación y Despliegue en Windows

### 1. Requisitos Previos en Windows
* **Node.js** (versión 18 LTS o superior): [Descargar Node.js](https://nodejs.org/)
* **Python** (versión 3.11, 3.12 o 3.13): [Descargar Python](https://www.python.org/) *(Asegúrate de marcar la casilla "Add Python to PATH")*.
* **MySQL Server** o **XAMPP / WampServer** con MySQL corriendo en el puerto `3306`.
* **Git**: [Descargar Git](https://git-scm.com/)

---

### 2. Configurar la Base de Datos en Windows
1. Inicia el servicio de MySQL desde el panel de XAMPP o desde los servicios de Windows.
2. Abre tu terminal (PowerShell o CMD) o phpMyAdmin / MySQL Workbench y crea la base de datos:
   ```sql
   CREATE DATABASE IF NOT EXISTS algarrobo_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Importa el archivo SQL maestro ubicado en `BD/cabanas algarrobo.sql`:
   * Desde consola:
     ```powershell
     mysql -u root -p algarrobo_connect < "BD/cabanas algarrobo.sql"
     ```
   * *(O importa el archivo directamente usando la pestaña "Importar" de phpMyAdmin o Workbench)*.

---

### 3. Configurar y Ejecutar la App de Escritorio (Electron)
Abre una terminal en la raíz del proyecto (`avancecapstone/`):

```powershell
# 1. Instalar dependencias de Node.js
npm install

# 2. (Opcional) Probar la conexión a MySQL
node test-db.js

# 3. Iniciar la aplicación de escritorio
npm start
```

---

### 4. Configurar y Ejecutar la API de Autenticación (FastAPI)
Abre una **segunda terminal** en `cabanas-algarrobo/`:

```powershell
cd cabanas-algarrobo

# 1. Crear el entorno virtual
python -m venv venv

# 2. Activar el entorno virtual
.\venv\Scripts\activate

# 3. Instalar las dependencias de Python
pip install -r requirements.txt

# 4. Iniciar el microservicio FastAPI en el puerto 8001
cd usuaruios_api
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
*API disponible en:* `http://127.0.0.1:8001/docs`

---

### 5. Ejecutar la Plataforma Web (Django)
Abre una **tercera terminal** en `cabanas-algarrobo/cabanas-main/`:

```powershell
cd cabanas-algarrobo\cabanas-main

# Activar el mismo entorno virtual
..\venv\Scripts\activate

# Aplicar migraciones iniciales de sesiones y auth de Django
python manage.py migrate

# Iniciar el servidor web en el puerto 8000
python manage.py runserver 127.0.0.1:8000
```
*Sitio web disponible en:* `http://127.0.0.1:8000/`

---

## 🐧 Guía de Instalación y Despliegue en Linux (Ubuntu / Debian / WSL)

### 1. Instalar Requisitos del Sistema
Ejecuta en tu terminal:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-venv python3-pip mariadb-server git
```

---

### 2. Configurar la Base de Datos en Linux
1. Inicia y habilita el servicio de MariaDB / MySQL:
   ```bash
   sudo systemctl start mariadb
   sudo systemctl enable mariadb
   ```
2. Crea la base de datos e importa el esquema:
   ```bash
   sudo mariadb -e "CREATE DATABASE IF NOT EXISTS algarrobo_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   sudo mariadb algarrobo_connect < "BD/cabanas algarrobo.sql"
   ```
3. Asegura que el usuario `root` local pueda conectarse sin contraseña o configura las credenciales correspondientes en `db.js`, `settings.py` y `database.py`.

---

### 3. Configurar y Ejecutar la App de Escritorio (Electron)
Desde la raíz del repositorio (`avancecapstone/`):

```bash
# 1. Instalar dependencias de Node
npm install

# 2. Probar la conexión a la BD
node test-db.js

# 3. Iniciar la aplicación
npm start
```

---

### 4. Configurar el Entorno Virtual de Python y Levantar Servicios Web

```bash
cd cabanas-algarrobo

# 1. Crear y activar entorno virtual
python3 -m venv venv
source venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Levantar Microservicio FastAPI (Terminal 1)
cd usuaruios_api
uvicorn main:app --host 127.0.0.1 --port 8001 &

# 4. Levantar Plataforma Web Django (Terminal 2)
cd ../cabanas-main
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

---

## 🔄 Resumen de Ajustes e Integraciones Realizadas

1. **Gestión de Cabañas y Precios:**
   - Adición de la columna `precio_por_noche` a la tabla `cabanas`.
   - Visualización del valor por noche en el catálogo web público de cabañas.
   - Cálculo automático del monto a pagar según la cantidad de noches seleccionadas por el cliente.
2. **Estados y Métodos de Pago:**
   - Sincronización del modelo `Pago` con las tablas relacionales `estados_pago` y `metodos_pago`.
   - Los pagos por transferencia inician con `id_estado_pago = 1` (*Pendiente Revisión*).
   - Los administradores aprueban o rechazan el pago desde la App de Escritorio (`id_estado_pago = 2`, *Aprobado*).
3. **Calificaciones con Estrellas:**
   - Creación de la columna `estrellas INT DEFAULT 5` en la tabla `comentarios`.
   - Sistema de calificación interactivo (1 a 5 estrellas) plenamente operativo en el formulario web y visible en el listado de reseñas.
4. **Desacoplamiento Limpio:**
   - Eliminación total de rutas y plantillas administrativas en Django, centralizando el control y la seguridad operativa en la aplicación nativa de Electron.

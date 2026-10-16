# Algarrobo Connect - Sistema de Administración de Cabañas (Avance Escritorio)

Este repositorio contiene el avance de la aplicación de escritorio para la administración de **Cabañas Algarrobo Connect**, construida con **Electron**, **Node.js** y conectada a una base de datos relacional **MySQL / MariaDB** a partir del script `BD/cabanas algarrobo.sql`.

---

## 1. ¿Cómo funciona Electron y por qué está estructurado así?

Para quienes vienen de frameworks web como Django o Flask, **Electron** permite crear aplicaciones de escritorio reales (para Windows, Linux o Mac) utilizando tecnologías web (HTML, CSS y JavaScript) junto con Node.js.

Electron divide la aplicación en **dos procesos separados** que trabajan en equipo:

1. **Proceso Principal / Backend (`main.js` y `db.js`)**:
   * Corre en **Node.js** directamente en el sistema operativo.
   * Es el encargado de abrir la ventana del programa (`BrowserWindow`) y de conectarse a la base de datos **MySQL** usando la librería `mysql2`.
   * Aquí viven todas las consultas SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) dentro de bloques `ipcMain.handle(...)`.

2. **Proceso de Renderizado / Frontend (`src/index.html`, `src/styles.css`, `src/renderer.js`)**:
   * Es la interfaz visual que ve el usuario (las pantallas basadas en la carpeta `Mockups/`).
   * Por seguridad, el HTML/JS de la ventana no se conecta directo a MySQL, sino que le pide los datos a `main.js`.

3. **El Puente de Comunicación (`preload.js`)**:
   * Conecta el Frontend con el Backend de forma segura.
   * Expone la función `window.api.invoke('nombre-accion', datos)` para que desde `renderer.js` podamos llamar a cualquier consulta SQL definida en `main.js` y recibir la respuesta con `async / await`.

---

## 2. Explicación de `package.json` y Dependencias (Equivalencia con Python/Django)

En proyectos de Node.js no se utiliza `requirements.txt`, sino el archivo **`package.json`**:

* **`package.json`**: Lista el nombre del proyecto, el archivo principal donde arranca la app (`"main": "main.js"`), los comandos rápidos (`"scripts"`) y las librerías necesarias (`"dependencies"`).
* **`package-lock.json`**: Guarda el historial exacto de versiones instaladas para que a todos los integrantes del equipo les instale exactamente las mismas versiones.
* **`node_modules/`**: Es la carpeta donde se descargan las librerías al ejecutar `npm install` (equivalente a la carpeta `venv` en Python). **No se sube a GitHub** porque está ignorada en `.gitignore`.

### Librerías instaladas en este proyecto:
* **`electron`**: Descarga el motor de escritorio para abrir la aplicación como ventana nativa.
* **`mysql2`**: Driver oficial y rápido para conectar Node.js con servidores MySQL y MariaDB soportando promesas (`async/await`) y *Connection Pools*.

---

## 3. Base de Datos: MySQL / MariaDB

El script original se encuentra en `BD/cabanas algarrobo.sql`.

> **Nota técnica sobre MySQL y MariaDB:**
> MariaDB es el motor libre totalmente compatible con MySQL (utiliza el mismo puerto `3306`, el mismo protocolo, los mismos tipos de datos y las mismas consultas SQL). Por eso, la librería `mysql2` de Node.js se conecta indistintamente tanto a **MySQL Server** (XAMPP, WAMP, MySQL Workbench) como a **MariaDB**.

### Parámetros de conexión configurados en `db.js`:
* **Host:** `127.0.0.1` (localhost)
* **Puerto:** `3306`
* **Usuario:** `root`
* **Contraseña:** *(vacía por defecto)*
* **Base de datos:** `algarrobo_connect`

*(Si algún compañero tiene contraseña en su usuario `root` de MySQL local, solo debe cambiar el campo `password` en `db.js` o definir la variable de entorno `DB_PASSWORD`).*

---

## 4. Guía Paso a Paso para Clonar y Ejecutar el Proyecto

### Paso 1: Instalar las dependencias de Node
Al clonar el repositorio por primera vez, abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```
*(Esto leerá el `package.json` y creará la carpeta `node_modules/` con Electron y mysql2).*

### Paso 2: Tener la Base de Datos lista
* **En el entorno Linux configurado:** El script `./start-db.sh` levanta automáticamente el motor local con la base de datos `algarrobo_connect` ya importada.
* **Si lo ejecutas en otro PC (Windows/Mac con XAMPP o MySQL Server):**
  1. Abre tu gestor de MySQL (phpMyAdmin, Workbench o consola) y crea la base de datos `algarrobo_connect`:
     ```sql
     CREATE DATABASE IF NOT EXISTS algarrobo_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     ```
  2. Importa el archivo `BD/cabanas algarrobo.sql`.

### Paso 3: Iniciar la Aplicación
Ejecuta en la terminal:

```bash
npm start
```

También puedes verificar únicamente la conexión a la base de datos por consola ejecutando:
```bash
npm run test:db
```

---

## 5. Credenciales de Prueba

Para ingresar en la pantalla de **Iniciar Sesión**:

* **Correo electrónico:** `admin@algarroboconnect.cl`
* **Contraseña:** `admin123`

*(También está habilitado el enlace **"Crear cuenta"** para registrar nuevos usuarios directamente en la tabla `usuarios` seleccionando su Rol y Comuna).*

---

## 6. Alcance Funcional de este Avance

Siguiendo la regla de que **la Base de Datos manda sobre los Mockups**, este avance incluye el módulo completo de **Cabañas y sus tablas relacionadas**:

1. **Autenticación (`usuarios`, `roles`, `comunas`)**:
   * Inicio de sesión y registro de usuarios conectado a las tablas geográficas y de roles.
2. **Listado y Búsqueda de Cabañas (`cabanas`)**:
   * Tarjetas con collage de 3 fotos, capacidad de personas, precio por noche, dirección, sector, comuna, estado y comodidades.
   * Buscador en tiempo real por nombre, dirección, sector o estado.
3. **Agregar y Editar Cabaña + Dependencias**:
   * **Datos generales (`cabanas`)**: Nombre, dirección (`ubicacion`), capacidad y precio por noche (`precio_por_noche`).
   * **Catálogos (`sectores_algarrobo`, `estados_cabana`, `comunas`)**: Selectores dinámicos cargados desde la BD.
   * **Fotografías (`fotos_cabana`)**: Carga de imágenes mediante selector de archivos del sistema o enlaces, marcando la imagen principal.
   * **Descripción y Reglas (`reglas_cabana`)**: Como la tabla `cabanas` no posee una columna de descripción, el texto descriptivo y reglas se almacenan de forma relacional en `reglas_cabana`.
   * **Comodidades (`comodidades` y `cabanas_comodidades`)**: Selección múltiple con checkboxes (Wifi Gratis, Tinaja Caliente, Parrilla, Vista al Mar, Estacionamiento).
   * **Mantenciones (`mantenciones_cabana`)**: Registro y eliminación de trabajos de mantención con costo y fecha al editar una cabaña.
   * **Bloqueo de Fechas (`bloqueos_fechas`)**: Bloqueo de rangos de fechas con motivo.
4. **Inventario de Cabañas (`inventario` y `categorias_inventario`)**:
   * Registro, listado y eliminación de artículos de equipamiento asignados a cada cabaña y clasificados por categoría.

---

## 7. Estructura de Archivos del Proyecto

```text
├── BD/
│   └── cabanas algarrobo.sql   # Script SQL con la estructura y datos semilla
├── Mockups/                    # Diseños visuales de referencia
├── src/
│   ├── index.html              # Estructura HTML de las pantallas activas
│   ├── styles.css              # Hoja de estilos basada en los Mockups
│   └── renderer.js             # Lógica visual, eventos de botones y llamadas a main.js
├── .gitignore                  # Ignora node_modules y archivos temporales en Git
├── db.js                       # Configuración del pool de conexión a MySQL
├── main.js                     # Proceso principal de Electron y consultas SQL
├── preload.js                  # Puente de comunicación IPC entre ventana y Node.js
├── start-db.sh                 # Script para iniciar el servicio local de BD en Linux
├── test-db.js                  # Script rápido para probar la conexión a MySQL
└── package.json                # Definición del proyecto, scripts y dependencias
```

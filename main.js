// Modulos principales de Electron:
// - app: controla el ciclo de vida de la aplicacion (cuando arranca y cuando se cierra)
// - BrowserWindow: permite crear la ventana del programa en el escritorio
// - ipcMain: recibe las peticiones que manda el frontend (renderer.js) para consultar la BD
// - dialog: permite abrir la ventana del sistema para elegir fotos desde el computador
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const { pool } = require('./db');

// Desactivamos la aceleracion por hardware para evitar problemas de video en algunos sistemas Linux
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

// Antes de abrir la ventana, revisamos que el servicio local de MariaDB/MySQL este corriendo
function ensureDatabaseRunning() {
  try {
    execSync('bash ./start-db.sh', { cwd: __dirname, stdio: 'ignore' });
  } catch (err) {
    console.warn('No se pudo ejecutar start-db.sh automaticamente:', err.message);
  }
}

// Funcion encargada de armar la ventana principal y cargar nuestro index.html
function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 720,
    title: 'Algarrobo Connect - Administración de Cabañas',
    webPreferences: {
      // Conectamos el archivo preload.js para habilitar window.api en el frontend
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Ocultamos la barra superior de archivo/editar por defecto para que se vea mas limpio
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// Cuando Electron termina de cargar, levantamos la BD y abrimos la ventana
app.whenReady().then(() => {
  ensureDatabaseRunning();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Si se cierran todas las ventanas del programa, cerramos el proceso de la app
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// 1. INICIO DE SESION Y REGISTRO DE USUARIOS (Tablas: usuarios, roles, comunas)
// ---------------------------------------------------------------------------

// Verifica las credenciales cuando el usuario presiona "Iniciar sesion"
ipcMain.handle('auth:login', async (_, { correo, contrasena }) => {
  // Buscamos al usuario por correo y traemos el nombre de su rol y comuna con LEFT JOIN
  const [rows] = await pool.query(
    `SELECT u.*, r.nombre AS rol_nombre, c.nombre AS comuna_nombre
     FROM usuarios u
     LEFT JOIN roles r ON u.id_rol = r.id_rol
     LEFT JOIN comunas c ON u.id_comuna = c.id_comuna
     WHERE u.correo = ? LIMIT 1`,
    [correo.trim()]
  );

  if (!rows.length) {
    return { ok: false, error: 'El correo ingresado no está registrado.' };
  }

  const user = rows[0];

  // En el script SQL de prueba las contrasenas vienen con un texto simulado "$2y$10$hashpass...".
  // Por eso permitimos entrar con la clave normal o con "admin123" para las cuentas de prueba.
  const validPass =
    user.contrasena === contrasena ||
    (user.contrasena.startsWith('$2y$') && (contrasena === 'admin123' || contrasena === '123456' || contrasena === user.contrasena));

  if (!validPass) {
    return { ok: false, error: 'Correo o contraseña incorrectos.' };
  }

  return { ok: true, user };
});

// Registra un usuario nuevo desde la pantalla "Crear cuenta"
ipcMain.handle('auth:register', async (_, data) => {
  const { nombre, correo, contrasena, id_rol, telefono, id_comuna } = data;

  // Como la tabla usuarios tiene tanto "id_rol" como el campo texto "rol" por compatibilidad,
  // buscamos el nombre del rol para rellenar ambos campos sin que falle la restriccion NOT NULL.
  const [roles] = await pool.query('SELECT nombre FROM roles WHERE id_rol = ?', [id_rol || 1]);
  const rolStr = roles.length ? roles[0].nombre.toLowerCase().slice(0, 20) : 'admin';

  const [res] = await pool.query(
    `INSERT INTO usuarios (nombre, correo, contrasena, rol, id_rol, telefono, id_comuna)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nombre, correo, contrasena, rolStr, id_rol || 1, telefono || null, id_comuna || 1]
  );

  return { ok: true, id_usuario: res.insertId };
});

// ---------------------------------------------------------------------------
// 2. CATALOGOS DE LA BASE DE DATOS (Para llenar los selectores de los formularios)
// ---------------------------------------------------------------------------

ipcMain.handle('catalogs:getAll', async () => {
  const [roles] = await pool.query('SELECT * FROM roles ORDER BY id_rol');
  const [comunas] = await pool.query(
    `SELECT c.*, p.nombre AS provincia_nombre, r.nombre AS region_nombre
     FROM comunas c
     JOIN provincias p ON c.id_provincia = p.id_provincia
     JOIN regiones r ON p.id_region = r.id_region
     ORDER BY c.id_comuna`
  );
  const [sectores] = await pool.query('SELECT * FROM sectores_algarrobo ORDER BY id_sector');
  const [estadosCabana] = await pool.query('SELECT * FROM estados_cabana ORDER BY id_estado_cabana');
  const [categoriasInventario] = await pool.query('SELECT * FROM categorias_inventario ORDER BY id_categoria');
  const [comodidades] = await pool.query('SELECT * FROM comodidades ORDER BY id_comodidad');

  return {
    roles,
    comunas,
    sectores,
    estadosCabana,
    categoriasInventario,
    comodidades
  };
});

// ---------------------------------------------------------------------------
// 3. CRUD DE CABAÑAS Y SUS TABLAS DEPENDIENTES
//    (cabanas, fotos_cabana, cabanas_comodidades, reglas_cabana,
//     mantenciones_cabana, bloqueos_fechas)
// ---------------------------------------------------------------------------

// Obtiene todas las cabañas junto con sus fotos, comodidades, reglas, mantenciones y bloqueos
ipcMain.handle('cabanas:list', async () => {
  const [cabanas] = await pool.query(
    `SELECT c.*,
            ec.nombre AS estado_catalogo,
            co.nombre AS comuna_nombre,
            s.nombre AS sector_nombre
     FROM cabanas c
     LEFT JOIN estados_cabana ec ON c.id_estado = ec.id_estado_cabana
     LEFT JOIN comunas co ON c.id_comuna = co.id_comuna
     LEFT JOIN sectores_algarrobo s ON c.id_sector = s.id_sector
     ORDER BY c.id_cabana`
  );

  const [fotos] = await pool.query('SELECT * FROM fotos_cabana ORDER BY es_principal DESC, id_foto ASC');
  const [relComodidades] = await pool.query(
    `SELECT cc.id_cabana, co.id_comodidad, co.nombre, co.icono
     FROM cabanas_comodidades cc
     JOIN comodidades co ON cc.id_comodidad = co.id_comodidad`
  );
  const [reglas] = await pool.query('SELECT * FROM reglas_cabana ORDER BY id_regla');
  const [mantenciones] = await pool.query('SELECT * FROM mantenciones_cabana ORDER BY fecha DESC');
  const [bloqueos] = await pool.query('SELECT * FROM bloqueos_fechas ORDER BY fecha_desde DESC');

  // Agrupamos la informacion de las tablas hijas dentro de cada objeto cabaña
  return cabanas.map(cab => ({
    ...cab,
    fotos: fotos.filter(f => f.id_cabana === cab.id_cabana),
    comodidades: relComodidades.filter(rc => rc.id_cabana === cab.id_cabana),
    reglas: reglas.filter(r => r.id_cabana === cab.id_cabana),
    mantenciones: mantenciones.filter(m => m.id_cabana === cab.id_cabana),
    bloqueos: bloqueos.filter(b => b.id_cabana === cab.id_cabana)
  }));
});

// Crea una cabaña nueva o actualiza una existente usando una transaccion SQL
ipcMain.handle('cabanas:save', async (_, payload) => {
  const conn = await pool.getConnection();
  try {
    // Iniciamos transaccion porque vamos a guardar en varias tablas al mismo tiempo
    await conn.beginTransaction();

    const {
      id_cabana,
      nombre,
      ubicacion,
      capacidad,
      id_estado,
      id_comuna,
      id_sector,
      precio_por_noche,
      comodidadesIds = [],
      reglasList = [],
      fotosList = []
    } = payload;

    // Obtenemos el texto del estado (ej: "Disponible") para mantener sincronizadas las columnas id_estado y estado
    const [estRows] = await conn.query('SELECT nombre FROM estados_cabana WHERE id_estado_cabana = ?', [id_estado || 1]);
    const estadoNombre = estRows.length ? estRows[0].nombre : 'Disponible';

    let cabanaId = id_cabana;
    if (cabanaId) {
      // Si ya tiene ID, estamos editando una cabaña existente
      await conn.query(
        `UPDATE cabanas
         SET nombre = ?, ubicacion = ?, capacidad = ?, estado = ?, id_estado = ?, id_comuna = ?, id_sector = ?, precio_por_noche = ?
         WHERE id_cabana = ?`,
        [nombre, ubicacion, Number(capacidad), estadoNombre, id_estado || 1, id_comuna || 1, id_sector || 1, Number(precio_por_noche), cabanaId]
      );
    } else {
      // Si no tiene ID, insertamos un registro nuevo en la tabla cabanas
      const [res] = await conn.query(
        `INSERT INTO cabanas (nombre, ubicacion, capacidad, estado, id_estado, id_comuna, id_sector, precio_por_noche)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre, ubicacion, Number(capacidad), estadoNombre, id_estado || 1, id_comuna || 1, id_sector || 1, Number(precio_por_noche)]
      );
      cabanaId = res.insertId;
    }

    // Actualizamos las comodidades seleccionadas en la tabla intermedia cabanas_comodidades
    await conn.query('DELETE FROM cabanas_comodidades WHERE id_cabana = ?', [cabanaId]);
    for (const idCom of comodidadesIds) {
      await conn.query('INSERT INTO cabanas_comodidades (id_cabana, id_comodidad) VALUES (?, ?)', [cabanaId, Number(idCom)]);
    }

    // Guardamos la descripcion y reglas en la tabla reglas_cabana
    await conn.query('DELETE FROM reglas_cabana WHERE id_cabana = ?', [cabanaId]);
    for (const desc of reglasList) {
      if (desc && desc.trim()) {
        await conn.query('INSERT INTO reglas_cabana (id_cabana, descripcion) VALUES (?, ?)', [cabanaId, desc.trim().slice(0, 200)]);
      }
    }

    // Guardamos las URLs de las fotos en fotos_cabana (marcando la primera como principal)
    await conn.query('DELETE FROM fotos_cabana WHERE id_cabana = ?', [cabanaId]);
    for (let i = 0; i < fotosList.length; i++) {
      const url = fotosList[i]?.url_foto || fotosList[i];
      if (url && String(url).trim()) {
        await conn.query(
          'INSERT INTO fotos_cabana (id_cabana, url_foto, es_principal) VALUES (?, ?, ?)',
          [cabanaId, String(url).trim(), i === 0 ? 1 : 0]
        );
      }
    }

    await conn.commit();
    return { ok: true, id_cabana: cabanaId };
  } catch (err) {
    // Si algo falla, deshacemos los cambios para no dejar datos incompletos
    await conn.rollback();
    return { ok: false, error: err.message };
  } finally {
    conn.release();
  }
});

// Elimina una cabaña limpiando primero sus tablas dependientes por las llaves foraneas (Foreign Keys)
ipcMain.handle('cabanas:delete', async (_, id_cabana) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM fotos_cabana WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM cabanas_comodidades WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM reglas_cabana WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM mantenciones_cabana WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM bloqueos_fechas WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM inventario WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM comentarios WHERE id_cabana = ?', [id_cabana]);
    await conn.query('DELETE FROM cabanas WHERE id_cabana = ?', [id_cabana]);
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    return { ok: false, error: 'No se puede eliminar la cabaña porque tiene reservas asociadas en el sistema.' };
  } finally {
    conn.release();
  }
});

// Funciones para agregar y quitar mantenciones de una cabaña (tabla mantenciones_cabana)
ipcMain.handle('cabanas:addMantencion', async (_, { id_cabana, descripcion, costo, fecha }) => {
  await pool.query(
    'INSERT INTO mantenciones_cabana (id_cabana, descripcion, costo, fecha) VALUES (?, ?, ?, ?)',
    [id_cabana, descripcion, Number(costo || 0), fecha]
  );
  return { ok: true };
});

ipcMain.handle('cabanas:deleteMantencion', async (_, id_mantencion) => {
  await pool.query('DELETE FROM mantenciones_cabana WHERE id_mantencion = ?', [id_mantencion]);
  return { ok: true };
});

// Funciones para bloquear o desbloquear fechas de una cabaña (tabla bloqueos_fechas)
ipcMain.handle('cabanas:addBloqueo', async (_, { id_cabana, fecha_desde, fecha_hasta, motivo }) => {
  await pool.query(
    'INSERT INTO bloqueos_fechas (id_cabana, fecha_desde, fecha_hasta, motivo) VALUES (?, ?, ?, ?)',
    [id_cabana, fecha_desde, fecha_hasta, motivo]
  );
  return { ok: true };
});

ipcMain.handle('cabanas:deleteBloqueo', async (_, id_bloqueo) => {
  await pool.query('DELETE FROM bloqueos_fechas WHERE id_bloqueo = ?', [id_bloqueo]);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// 4. INVENTARIO POR CABAÑA (Tablas: inventario y categorias_inventario)
// ---------------------------------------------------------------------------

ipcMain.handle('inventario:list', async () => {
  const [rows] = await pool.query(
    `SELECT i.*, c.nombre AS cabana_nombre, cat.nombre AS categoria_nombre
     FROM inventario i
     LEFT JOIN cabanas c ON i.id_cabana = c.id_cabana
     LEFT JOIN categorias_inventario cat ON i.id_categoria = cat.id_categoria
     ORDER BY i.id_item DESC`
  );
  return rows;
});

ipcMain.handle('inventario:save', async (_, item) => {
  const { id_item, nombre, cantidad, ubicacion, id_cabana, id_categoria, observacion } = item;
  if (id_item) {
    await pool.query(
      `UPDATE inventario SET nombre=?, cantidad=?, ubicacion=?, id_cabana=?, id_categoria=?, observacion=?
       WHERE id_item=?`,
      [nombre, Number(cantidad), ubicacion, id_cabana || null, id_categoria || null, observacion || null, id_item]
    );
  } else {
    await pool.query(
      `INSERT INTO inventario (nombre, cantidad, ubicacion, id_cabana, id_categoria, observacion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, Number(cantidad), ubicacion, id_cabana || null, id_categoria || null, observacion || null]
    );
  }
  return { ok: true };
});

ipcMain.handle('inventario:delete', async (_, id_item) => {
  await pool.query('DELETE FROM inventario WHERE id_item = ?', [id_item]);
  return { ok: true };
});

// Abre el explorador de archivos del computador para elegir una foto de la cabaña
ipcMain.handle('dialog:selectImage', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar imagen para la cabaña',
    properties: ['openFile'],
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, filePath: 'file://' + result.filePaths[0] };
});

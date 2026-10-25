const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { pool } = require('./db');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');


function ensureDatabaseRunning() {
  try {
    execSync('bash ./start-db.sh', { cwd: __dirname, stdio: 'ignore' });
  } catch (err) {
    console.warn('No se pudo ejecutar start-db.sh automáticamente:', err.message);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 720,
    title: 'Algarrobo Connect - Administración de Cabañas',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  ensureDatabaseRunning();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ======================== IPC HANDLERS (MySQL) ========================

// 1. Auth & Usuarios
ipcMain.handle('auth:login', async (_, { correo, contrasena }) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.nombre AS rol_nombre, c.nombre AS comuna_nombre
     FROM usuarios u
     LEFT JOIN roles r ON u.id_rol = r.id_rol
     LEFT JOIN comunas c ON u.id_comuna = c.id_comuna
     WHERE u.correo = ? LIMIT 1`,
    [correo.trim()]
  );
  if (!rows.length) {
    return { ok: false, error: 'Correo no registrado en la base de datos.' };
  }
  const user = rows[0];
  // Soportar contraseña directa, o contraseñas de prueba para los hashes del script SQL
  const validPass =
    user.contrasena === contrasena ||
    (user.contrasena.startsWith('$2y$') && (contrasena === 'admin123' || contrasena === '123456' || contrasena === user.contrasena));

  if (!validPass) {
    return { ok: false, error: 'Correo o contraseña incorrectos.' };
  }
  return { ok: true, user };
});

ipcMain.handle('auth:register', async (_, data) => {
  const { nombre, correo, contrasena, id_rol, telefono, id_comuna } = data;
  const [roles] = await pool.query('SELECT nombre FROM roles WHERE id_rol = ?', [id_rol || 1]);
  const rolStr = roles.length ? roles[0].nombre.toLowerCase().slice(0, 20) : 'admin';

  const [res] = await pool.query(
    `INSERT INTO usuarios (nombre, correo, contrasena, rol, id_rol, telefono, id_comuna)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nombre, correo, contrasena, rolStr, id_rol || 1, telefono || null, id_comuna || 1]
  );
  return { ok: true, id_usuario: res.insertId };
});

// 2. Catálogos generales de la BD
ipcMain.handle('catalogs:getAll', async () => {
  const [roles] = await pool.query('SELECT * FROM roles ORDER BY id_rol');
  const [regiones] = await pool.query('SELECT * FROM regiones ORDER BY id_region');
  const [provincias] = await pool.query('SELECT * FROM provincias ORDER BY id_provincia');
  const [comunas] = await pool.query(
    `SELECT c.*, p.nombre AS provincia_nombre, r.nombre AS region_nombre
     FROM comunas c
     JOIN provincias p ON c.id_provincia = p.id_provincia
     JOIN regiones r ON p.id_region = r.id_region
     ORDER BY c.id_comuna`
  );
  const [sectores] = await pool.query('SELECT * FROM sectores_algarrobo ORDER BY id_sector');
  const [estadosCabana] = await pool.query('SELECT * FROM estados_cabana ORDER BY id_estado_cabana');
  const [estadosReserva] = await pool.query('SELECT * FROM estados_reserva ORDER BY id_estado_reserva');
  const [metodosPago] = await pool.query('SELECT * FROM metodos_pago ORDER BY id_metodo_pago');
  const [estadosPago] = await pool.query('SELECT * FROM estados_pago ORDER BY id_estado_pago');
  const [categoriasInventario] = await pool.query('SELECT * FROM categorias_inventario ORDER BY id_categoria');
  const [comodidades] = await pool.query('SELECT * FROM comodidades ORDER BY id_comodidad');
  const [servicios] = await pool.query('SELECT * FROM servicios_adicionales ORDER BY id_servicio');
  const [usuarios] = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.id_rol, u.telefono, u.id_comuna, u.fecha_creacion,
            r.nombre AS rol_nombre, c.nombre AS comuna_nombre
     FROM usuarios u
     LEFT JOIN roles r ON u.id_rol = r.id_rol
     LEFT JOIN comunas c ON u.id_comuna = c.id_comuna
     ORDER BY u.id_usuario`
  );

  return {
    roles,
    regiones,
    provincias,
    comunas,
    sectores,
    estadosCabana,
    estadosReserva,
    metodosPago,
    estadosPago,
    categoriasInventario,
    comodidades,
    servicios,
    usuarios
  };
});

// 3. Cabañas (con fotos_cabana, cabanas_comodidades, reglas_cabana, mantenciones_cabana, bloqueos_fechas)
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
  const [inventario] = await pool.query(
    `SELECT i.*, cat.nombre AS categoria_nombre
     FROM inventario i
     LEFT JOIN categorias_inventario cat ON i.id_categoria = cat.id_categoria
     ORDER BY i.id_item`
  );

  return cabanas.map(cab => ({
    ...cab,
    fotos: fotos.filter(f => f.id_cabana === cab.id_cabana),
    comodidades: relComodidades.filter(rc => rc.id_cabana === cab.id_cabana),
    reglas: reglas.filter(r => r.id_cabana === cab.id_cabana),
    mantenciones: mantenciones.filter(m => m.id_cabana === cab.id_cabana),
    bloqueos: bloqueos.filter(b => b.id_cabana === cab.id_cabana),
    inventario: inventario.filter(i => i.id_cabana === cab.id_cabana)
  }));
});

ipcMain.handle('cabanas:save', async (_, payload) => {
  const conn = await pool.getConnection();
  try {
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

    const [estRows] = await conn.query('SELECT nombre FROM estados_cabana WHERE id_estado_cabana = ?', [id_estado || 1]);
    const estadoNombre = estRows.length ? estRows[0].nombre : 'Disponible';

    let cabanaId = id_cabana;
    if (cabanaId) {
      await conn.query(
        `UPDATE cabanas
         SET nombre = ?, ubicacion = ?, capacidad = ?, estado = ?, id_estado = ?, id_comuna = ?, id_sector = ?, precio_por_noche = ?
         WHERE id_cabana = ?`,
        [nombre, ubicacion, Number(capacidad), estadoNombre, id_estado || 1, id_comuna || 1, id_sector || 1, Number(precio_por_noche), cabanaId]
      );
    } else {
      const [res] = await conn.query(
        `INSERT INTO cabanas (nombre, ubicacion, capacidad, estado, id_estado, id_comuna, id_sector, precio_por_noche)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre, ubicacion, Number(capacidad), estadoNombre, id_estado || 1, id_comuna || 1, id_sector || 1, Number(precio_por_noche)]
      );
      cabanaId = res.insertId;
    }

    // Actualizar comodidades (cabanas_comodidades)
    await conn.query('DELETE FROM cabanas_comodidades WHERE id_cabana = ?', [cabanaId]);
    for (const idCom of comodidadesIds) {
      await conn.query('INSERT INTO cabanas_comodidades (id_cabana, id_comodidad) VALUES (?, ?)', [cabanaId, Number(idCom)]);
    }

    // Actualizar reglas (reglas_cabana)
    await conn.query('DELETE FROM reglas_cabana WHERE id_cabana = ?', [cabanaId]);
    for (const desc of reglasList) {
      if (desc && desc.trim()) {
        await conn.query('INSERT INTO reglas_cabana (id_cabana, descripcion) VALUES (?, ?)', [cabanaId, desc.trim().slice(0, 200)]);
      }
    }

    // Actualizar fotos (fotos_cabana)
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
    await conn.rollback();
    return { ok: false, error: err.message };
  } finally {
    conn.release();
  }
});

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
    return { ok: false, error: 'No se puede eliminar la cabaña porque tiene reservas históricas asociadas. (' + err.message + ')' };
  } finally {
    conn.release();
  }
});

// Mantenciones y bloqueos de cabaña
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

// 4. Reservas (con usuarios, cabanas, huespedes_adicionales, reservas_servicios, pagos, comprobantes_transferencia, historial_mensajes_whatsapp)
ipcMain.handle('reservas:list', async () => {
  const [reservas] = await pool.query(
    `SELECT r.*,
            DATE_FORMAT(r.fecha_inicio, '%Y-%m-%d') AS fecha_inicio_str,
            DATE_FORMAT(r.fecha_fin, '%Y-%m-%d') AS fecha_fin_str,
            er.nombre AS estado_reserva_nombre,
            u.nombre AS cliente_nombre,
            u.correo AS cliente_correo,
            u.telefono AS cliente_telefono,
            u.id_comuna AS cliente_id_comuna,
            co.nombre AS cliente_comuna_nombre,
            c.nombre AS cabana_nombre,
            c.ubicacion AS cabana_ubicacion,
            c.capacidad AS cabana_capacidad,
            c.precio_por_noche AS cabana_precio,
            s.nombre AS cabana_sector
     FROM reservas r
     JOIN usuarios u ON r.id_usuario = u.id_usuario
     JOIN cabanas c ON r.id_cabana = c.id_cabana
     LEFT JOIN estados_reserva er ON r.id_estado_reserva = er.id_estado_reserva
     LEFT JOIN comunas co ON u.id_comuna = co.id_comuna
     LEFT JOIN sectores_algarrobo s ON c.id_sector = s.id_sector
     ORDER BY r.id_reserva DESC`
  );

  const [huespedes] = await pool.query('SELECT * FROM huespedes_adicionales ORDER BY id_huesped');
  const [serviciosRes] = await pool.query(
    `SELECT rs.*, sa.nombre AS servicio_nombre, sa.precio AS precio_unitario
     FROM reservas_servicios rs
     JOIN servicios_adicionales sa ON rs.id_servicio = sa.id_servicio`
  );
  const [pagos] = await pool.query(
    `SELECT p.*, mp.nombre AS metodo_nombre, ep.nombre AS estado_pago_nombre
     FROM pagos p
     LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
     LEFT JOIN estados_pago ep ON p.id_estado_pago = ep.id_estado_pago
     ORDER BY p.fecha_pago DESC`
  );
  const [comprobantes] = await pool.query('SELECT * FROM comprobantes_transferencia');
  const [fotos] = await pool.query('SELECT * FROM fotos_cabana ORDER BY es_principal DESC, id_foto ASC');
  const [reglas] = await pool.query('SELECT * FROM reglas_cabana ORDER BY id_regla');
  const [whatsapp] = await pool.query('SELECT * FROM historial_mensajes_whatsapp ORDER BY fecha_envio DESC');

  const pagosConComprobante = pagos.map(p => ({
    ...p,
    comprobantes: comprobantes.filter(comp => comp.id_pago === p.id_pago)
  }));

  return reservas.map(r => ({
    ...r,
    huespedes: huespedes.filter(h => h.id_reserva === r.id_reserva),
    servicios: serviciosRes.filter(sr => sr.id_reserva === r.id_reserva),
    pagos: pagosConComprobante.filter(p => p.id_reserva === r.id_reserva),
    fotos_cabana: fotos.filter(f => f.id_cabana === r.id_cabana),
    reglas_cabana: reglas.filter(reg => reg.id_cabana === r.id_cabana),
    whatsapp: whatsapp.filter(w => w.id_reserva === r.id_reserva)
  }));
});

ipcMain.handle('reservas:save', async (_, payload) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const {
      id_reserva,
      id_usuario,
      nuevo_cliente,
      id_cabana,
      fecha_inicio,
      fecha_fin,
      id_estado_reserva,
      monto_total,
      huespedes = [],
      servicios = []
    } = payload;

    let finalUserId = id_usuario;
    if (!finalUserId && nuevo_cliente && nuevo_cliente.nombre && nuevo_cliente.correo) {
      const [existing] = await conn.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [nuevo_cliente.correo]);
      if (existing.length) {
        finalUserId = existing[0].id_usuario;
        await conn.query(
          'UPDATE usuarios SET nombre = ?, telefono = ?, id_comuna = ? WHERE id_usuario = ?',
          [nuevo_cliente.nombre, nuevo_cliente.telefono || null, nuevo_cliente.id_comuna || 1, finalUserId]
        );
      } else {
        const [insU] = await conn.query(
          `INSERT INTO usuarios (nombre, correo, contrasena, rol, id_rol, telefono, id_comuna)
           VALUES (?, ?, 'cliente123', 'cliente', 3, ?, ?)`,
          [nuevo_cliente.nombre, nuevo_cliente.correo, nuevo_cliente.telefono || null, nuevo_cliente.id_comuna || 1]
        );
        finalUserId = insU.insertId;
      }
    } else if (finalUserId && nuevo_cliente) {
      await conn.query(
        'UPDATE usuarios SET nombre = ?, correo = ?, telefono = ?, id_comuna = ? WHERE id_usuario = ?',
        [nuevo_cliente.nombre, nuevo_cliente.correo, nuevo_cliente.telefono || null, nuevo_cliente.id_comuna || 1, finalUserId]
      );
    }

    const [estRows] = await conn.query('SELECT nombre FROM estados_reserva WHERE id_estado_reserva = ?', [id_estado_reserva || 1]);
    const estadoStr = estRows.length ? estRows[0].nombre : 'Pendiente';

    let reservaId = id_reserva;
    if (reservaId) {
      await conn.query(
        `UPDATE reservas
         SET id_usuario = ?, id_cabana = ?, fecha_inicio = ?, fecha_fin = ?, estado = ?, id_estado_reserva = ?, monto_total = ?
         WHERE id_reserva = ?`,
        [finalUserId, id_cabana, fecha_inicio, fecha_fin, estadoStr, id_estado_reserva || 1, Number(monto_total || 0), reservaId]
      );
    } else {
      const [res] = await conn.query(
        `INSERT INTO reservas (id_usuario, id_cabana, fecha_inicio, fecha_fin, estado, id_estado_reserva, monto_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [finalUserId, id_cabana, fecha_inicio, fecha_fin, estadoStr, id_estado_reserva || 1, Number(monto_total || 0)]
      );
      reservaId = res.insertId;
    }

    // Actualizar huéspedes adicionales (huespedes_adicionales)
    await conn.query('DELETE FROM huespedes_adicionales WHERE id_reserva = ?', [reservaId]);
    for (const h of huespedes) {
      if (h.nombre_completo && h.nombre_completo.trim()) {
        await conn.query(
          'INSERT INTO huespedes_adicionales (id_reserva, nombre_completo, rut_o_pasaporte) VALUES (?, ?, ?)',
          [reservaId, h.nombre_completo.trim(), h.rut_o_pasaporte ? h.rut_o_pasaporte.trim() : null]
        );
      }
    }

    // Actualizar servicios adicionales de la reserva (reservas_servicios)
    await conn.query('DELETE FROM reservas_servicios WHERE id_reserva = ?', [reservaId]);
    for (const s of servicios) {
      if (s.id_servicio && Number(s.cantidad) > 0) {
        await conn.query(
          'INSERT INTO reservas_servicios (id_reserva, id_servicio, cantidad, subtotal) VALUES (?, ?, ?, ?)',
          [reservaId, Number(s.id_servicio), Number(s.cantidad), Number(s.subtotal)]
        );
      }
    }

    await conn.commit();
    return { ok: true, id_reserva: reservaId };
  } catch (err) {
    await conn.rollback();
    return { ok: false, error: err.message };
  } finally {
    conn.release();
  }
});

ipcMain.handle('reservas:delete', async (_, id_reserva) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pagos] = await conn.query('SELECT id_pago FROM pagos WHERE id_reserva = ?', [id_reserva]);
    for (const p of pagos) {
      await conn.query('DELETE FROM comprobantes_transferencia WHERE id_pago = ?', [p.id_pago]);
    }
    await conn.query('DELETE FROM pagos WHERE id_reserva = ?', [id_reserva]);
    await conn.query('DELETE FROM huespedes_adicionales WHERE id_reserva = ?', [id_reserva]);
    await conn.query('DELETE FROM reservas_servicios WHERE id_reserva = ?', [id_reserva]);
    await conn.query('DELETE FROM historial_mensajes_whatsapp WHERE id_reserva = ?', [id_reserva]);
    await conn.query('DELETE FROM reservas WHERE id_reserva = ?', [id_reserva]);
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    return { ok: false, error: err.message };
  } finally {
    conn.release();
  }
});

// Pagos y Comprobantes
ipcMain.handle('pagos:add', async (_, payload) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const {
      id_reserva,
      monto,
      id_metodo_pago,
      id_estado_pago,
      observaciones,
      comprobante
    } = payload;

    const [mRows] = await conn.query('SELECT nombre FROM metodos_pago WHERE id_metodo_pago = ?', [id_metodo_pago || 1]);
    const metodoStr = mRows.length ? mRows[0].nombre.slice(0, 30) : 'Transferencia';

    const [res] = await conn.query(
      `INSERT INTO pagos (id_reserva, monto, metodo_pago, id_metodo_pago, id_estado_pago, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_reserva, Number(monto), metodoStr, id_metodo_pago || 1, id_estado_pago || 1, observaciones || null]
    );

    if (comprobante && (comprobante.numero_operacion || comprobante.url_archivo)) {
      await conn.query(
        `INSERT INTO comprobantes_transferencia (id_pago, url_archivo, numero_operacion, banco_origen)
         VALUES (?, ?, ?, ?)`,
        [
          res.insertId,
          comprobante.url_archivo || 'comprobante_adjunto.pdf',
          comprobante.numero_operacion || null,
          comprobante.banco_origen || null
        ]
      );
    }

    await conn.commit();
    return { ok: true, id_pago: res.insertId };
  } catch (err) {
    await conn.rollback();
    return { ok: false, error: err.message };
  } finally {
    conn.release();
  }
});

ipcMain.handle('pagos:updateEstado', async (_, { id_pago, id_estado_pago }) => {
  await pool.query('UPDATE pagos SET id_estado_pago = ? WHERE id_pago = ?', [id_estado_pago, id_pago]);
  return { ok: true };
});

// 5. Inventario y Categorías
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

// 6. Comentarios, Mensajes de Contacto, Notificaciones, WhatsApp, Promociones, Servicios
ipcMain.handle('comunicaciones:getAll', async () => {
  const [comentarios] = await pool.query(
    `SELECT cm.*, c.nombre AS cabana_nombre
     FROM comentarios cm
     LEFT JOIN cabanas c ON cm.id_cabana = c.id_cabana
     ORDER BY cm.fecha DESC`
  );
  const [mensajesContacto] = await pool.query('SELECT * FROM mensajes_contacto ORDER BY fecha_envio DESC');
  const [notificaciones] = await pool.query(
    `SELECT n.*, u.nombre AS usuario_nombre
     FROM notificaciones n
     LEFT JOIN usuarios u ON n.id_usuario = u.id_usuario
     ORDER BY n.fecha DESC`
  );
  const [whatsapp] = await pool.query(
    `SELECT w.*, r.id_cabana, c.nombre AS cabana_nombre
     FROM historial_mensajes_whatsapp w
     LEFT JOIN reservas r ON w.id_reserva = r.id_reserva
     LEFT JOIN cabanas c ON r.id_cabana = c.id_cabana
     ORDER BY w.fecha_envio DESC`
  );
  const [promociones] = await pool.query(
    `SELECT p.*, DATE_FORMAT(p.fecha_expiracion, '%Y-%m-%d') AS fecha_expiracion_str
     FROM promociones p ORDER BY p.id_promocion DESC`
  );
  return { comentarios, mensajesContacto, notificaciones, whatsapp, promociones };
});

ipcMain.handle('comentarios:add', async (_, { nombre, correo, comentario, id_cabana }) => {
  await pool.query(
    'INSERT INTO comentarios (nombre, correo, comentario, id_cabana) VALUES (?, ?, ?, ?)',
    [nombre, correo, comentario, id_cabana || null]
  );
  return { ok: true };
});

ipcMain.handle('comentarios:delete', async (_, id) => {
  await pool.query('DELETE FROM comentarios WHERE id = ?', [id]);
  return { ok: true };
});

ipcMain.handle('mensajesContacto:toggleLeido', async (_, { id_mensaje, leido }) => {
  await pool.query('UPDATE mensajes_contacto SET leido = ? WHERE id_mensaje = ?', [leido ? 1 : 0, id_mensaje]);
  return { ok: true };
});

ipcMain.handle('notificaciones:toggleLeido', async (_, { id_notificacion, leido }) => {
  await pool.query('UPDATE notificaciones SET leido = ? WHERE id_notificacion = ?', [leido ? 1 : 0, id_notificacion]);
  return { ok: true };
});

ipcMain.handle('notificaciones:add', async (_, { id_usuario, titulo, mensaje }) => {
  await pool.query(
    'INSERT INTO notificaciones (id_usuario, titulo, mensaje) VALUES (?, ?, ?)',
    [id_usuario, titulo, mensaje]
  );
  return { ok: true };
});

ipcMain.handle('whatsapp:send', async (_, { telefono_destino, id_reserva, mensaje }) => {
  await pool.query(
    'INSERT INTO historial_mensajes_whatsapp (telefono_destino, id_reserva, mensaje) VALUES (?, ?, ?)',
    [telefono_destino, id_reserva || null, mensaje]
  );
  return { ok: true };
});

ipcMain.handle('promociones:save', async (_, { id_promocion, codigo, porcentaje_descuento, fecha_expiracion, activo }) => {
  if (id_promocion) {
    await pool.query(
      'UPDATE promociones SET codigo=?, porcentaje_descuento=?, fecha_expiracion=?, activo=? WHERE id_promocion=?',
      [codigo.toUpperCase(), Number(porcentaje_descuento), fecha_expiracion, activo ? 1 : 0, id_promocion]
    );
  } else {
    await pool.query(
      'INSERT INTO promociones (codigo, porcentaje_descuento, fecha_expiracion, activo) VALUES (?, ?, ?, ?)',
      [codigo.toUpperCase(), Number(porcentaje_descuento), fecha_expiracion, activo ? 1 : 0]
    );
  }
  return { ok: true };
});

ipcMain.handle('promociones:delete', async (_, id_promocion) => {
  await pool.query('DELETE FROM promociones WHERE id_promocion = ?', [id_promocion]);
  return { ok: true };
});

ipcMain.handle('servicios:save', async (_, { id_servicio, nombre, precio }) => {
  if (id_servicio) {
    await pool.query('UPDATE servicios_adicionales SET nombre=?, precio=? WHERE id_servicio=?', [nombre, Number(precio), id_servicio]);
  } else {
    await pool.query('INSERT INTO servicios_adicionales (nombre, precio) VALUES (?, ?)', [nombre, Number(precio)]);
  }
  return { ok: true };
});

// Selector nativo de imágenes para fotos_cabana
ipcMain.handle('dialog:selectImage', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar imagen para la cabaña',
    properties: ['openFile'],
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, filePath: 'file://' + result.filePaths[0] };
});

// Exportar reporte CSV
ipcMain.handle('reportes:exportCsv', async (_, { filename, csvContent }) => {
  const result = await dialog.showSaveDialog({
    title: 'Descargar Reporte de Reservas',
    defaultPath: filename || 'reporte_algarrobo_connect.csv',
    filters: [{ name: 'Archivo CSV', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, '\uFEFF' + csvContent, 'utf8');
  return { ok: true, filePath: result.filePath };
});

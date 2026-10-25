// Estado global en memoria sincronizado con MySQL
let currentUser = null;
let catalogs = {};
let cabanas = [];
let reservas = [];
let inventario = [];
let comunicaciones = {};

// Estado temporal en formularios
let activeCabanaEdit = null;
let activeReservaEdit = null;
let tempHuespedes = [];
let tempResServicios = [];

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1540518614846-7ede433c4573?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80'
];

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function formatCLP(val) {
  const num = Number(val || 0);
  return '$ ' + num.toLocaleString('es-CL');
}

function getPhotosTriple(fotosArr) {
  const urls = (fotosArr || []).map(f => f.url_foto || f).filter(Boolean);
  return [
    urls[0] || DEFAULT_IMAGES[0],
    urls[1] || DEFAULT_IMAGES[1],
    urls[2] || DEFAULT_IMAGES[2]
  ];
}

// ======================== CARGA DE DATOS DESDE MYSQL ========================
async function refreshAllData() {
  catalogs = await window.api.invoke('catalogs:getAll');
  cabanas = await window.api.invoke('cabanas:list');
  reservas = await window.api.invoke('reservas:list');
  inventario = await window.api.invoke('inventario:list');
  comunicaciones = await window.api.invoke('comunicaciones:getAll');

  populateStaticSelects();
  renderInicioDashboard();
  renderCabanasList();
  renderReservasList();
  renderReportesTable();
  renderComunicaciones();
  renderInventarioSection();
}

function populateStaticSelects() {
  // Registro: roles y comunas
  const regRol = document.getElementById('reg-rol');
  regRol.innerHTML = (catalogs.roles || [])
    .map(r => `<option value="${r.id_rol}">${r.nombre} - ${r.descripcion || ''}</option>`)
    .join('');

  const regComuna = document.getElementById('reg-comuna');
  const comunaOptions = (catalogs.comunas || [])
    .map(c => `<option value="${c.id_comuna}">${c.nombre} (${c.provincia_nombre}, ${c.region_nombre})</option>`)
    .join('');
  regComuna.innerHTML = comunaOptions;

  // Formulario Cabaña: sectores, estados_cabana, comunas, comodidades
  document.getElementById('cab-sector').innerHTML = (catalogs.sectores || [])
    .map(s => `<option value="${s.id_sector}">${s.nombre}</option>`)
    .join('');
  document.getElementById('cab-estado').innerHTML = (catalogs.estadosCabana || [])
    .map(e => `<option value="${e.id_estado_cabana}">${e.nombre}</option>`)
    .join('');
  document.getElementById('cab-comuna').innerHTML = comunaOptions;

  // Formulario Reserva: cabanas, estados_reserva, usuarios, comunas, servicios_adicionales, metodos_pago, estados_pago
  document.getElementById('res-cabana').innerHTML = cabanas
    .map(c => `<option value="${c.id_cabana}">${c.nombre} (${formatCLP(c.precio_por_noche)}/noche - Cap: ${c.capacidad})</option>`)
    .join('');
  document.getElementById('res-estado').innerHTML = (catalogs.estadosReserva || [])
    .map(er => `<option value="${er.id_estado_reserva}">${er.nombre}</option>`)
    .join('');
  document.getElementById('res-usuario-select').innerHTML =
    `<option value="">-- Nuevo Cliente / Editar Manual --</option>` +
    (catalogs.usuarios || [])
      .map(u => `<option value="${u.id_usuario}">${u.nombre} (${u.correo})</option>`)
      .join('');
  document.getElementById('res-cli-comuna').innerHTML = comunaOptions;
  document.getElementById('new-res-servicio').innerHTML = (catalogs.servicios || [])
    .map(s => `<option value="${s.id_servicio}">${s.nombre} (${formatCLP(s.precio)})</option>`)
    .join('');
  document.getElementById('pago-metodo').innerHTML = (catalogs.metodosPago || [])
    .map(m => `<option value="${m.id_metodo_pago}">${m.nombre}</option>`)
    .join('');
  document.getElementById('pago-estado').innerHTML = (catalogs.estadosPago || [])
    .map(ep => `<option value="${ep.id_estado_pago}">${ep.nombre}</option>`)
    .join('');

  // Comentarios y WhatsApp e Inventario selects
  const cabSelectHtml = cabanas.map(c => `<option value="${c.id_cabana}">${c.nombre}</option>`).join('');
  document.getElementById('com-cabana').innerHTML = cabSelectHtml;
  document.getElementById('inv-cabana').innerHTML = cabSelectHtml;
  document.getElementById('inv-categoria').innerHTML = (catalogs.categoriasInventario || [])
    .map(cat => `<option value="${cat.id_categoria}">${cat.nombre}</option>`)
    .join('');
  document.getElementById('wa-reserva').innerHTML =
    `<option value="">Sin reserva asociada</option>` +
    reservas.map(r => `<option value="${r.id_reserva}">Reserva #${r.id_reserva} - ${r.cliente_nombre}</option>`).join('');

  // Badge de notificaciones no leídas
  const unreadNotifs = (comunicaciones.notificaciones || []).filter(n => !n.leido).length;
  document.getElementById('notif-count-badge').textContent = unreadNotifs;
}

// ======================== NAVEGACIÓN DE SECCIONES ========================
const HERO_CONFIG = {
  inicio: { title: 'Inicio', subtitle: 'Panel General Algarrobo Connect', bg: 'hero-cabins' },
  cabanas: { title: 'Cabañas', subtitle: 'Administración de Cabañas', bg: 'hero-cabins' },
  'cabana-add': { title: 'Agregar Cabaña', subtitle: 'Información sobre la Cabaña', bg: 'hero-beach' },
  'cabana-edit': { title: 'Editar Cabaña', subtitle: 'Información sobre la Cabaña', bg: 'hero-beach' },
  reservas: { title: 'Reservas', subtitle: 'Administración de reservas', bg: 'hero-cabins' },
  'reserva-detail': { title: 'Datos de Reserva', subtitle: 'Información sobre la reserva', bg: 'hero-beach' },
  reportes: { title: 'Reportes', subtitle: 'Generación de reportes sobre las reservas y cabañas', bg: 'hero-cabins' },
  comentarios: { title: 'Comentarios', subtitle: 'Comentarios, Contacto Web, WhatsApp y Notificaciones', bg: 'hero-cabins' },
  inventario: { title: 'Inventario y Catálogos', subtitle: 'Inventario, Promociones, Servicios y Catálogos BD', bg: 'hero-cabins' }
};

function navigateTo(viewKey) {
  const sections = [
    'section-inicio',
    'section-cabanas',
    'section-cabana-form',
    'section-reservas',
    'section-reserva-detail',
    'section-reportes',
    'section-comentarios',
    'section-inventario'
  ];
  sections.forEach(id => document.getElementById(id).classList.add('hidden'));

  const hero = document.getElementById('hero-banner');
  const cfg = HERO_CONFIG[viewKey] || HERO_CONFIG.cabanas;
  document.getElementById('hero-title').textContent = cfg.title;
  document.getElementById('hero-subtitle').textContent = cfg.subtitle;
  hero.className = `hero-banner ${cfg.bg}`;

  document.querySelectorAll('.nav-link').forEach(link => {
    const navTarget = link.getAttribute('data-nav');
    const isActive =
      navTarget === viewKey ||
      (viewKey.startsWith('cabana-') && navTarget === 'cabanas') ||
      (viewKey === 'reserva-detail' && navTarget === 'reservas');
    link.classList.toggle('active', isActive);
  });

  if (viewKey === 'inicio') document.getElementById('section-inicio').classList.remove('hidden');
  else if (viewKey === 'cabanas') document.getElementById('section-cabanas').classList.remove('hidden');
  else if (viewKey === 'cabana-add' || viewKey === 'cabana-edit') document.getElementById('section-cabana-form').classList.remove('hidden');
  else if (viewKey === 'reservas') document.getElementById('section-reservas').classList.remove('hidden');
  else if (viewKey === 'reserva-detail') document.getElementById('section-reserva-detail').classList.remove('hidden');
  else if (viewKey === 'reportes') document.getElementById('section-reportes').classList.remove('hidden');
  else if (viewKey === 'comentarios') document.getElementById('section-comentarios').classList.remove('hidden');
  else if (viewKey === 'inventario') document.getElementById('section-inventario').classList.remove('hidden');
}

// ======================== RENDER: INICIO ========================
function renderInicioDashboard() {
  const totalGanancias = reservas.reduce((acc, r) => acc + Number(r.monto_total || 0), 0);
  const pagosAprobados = reservas.reduce(
    (acc, r) => acc + (r.pagos || []).filter(p => p.id_estado_pago === 2).reduce((s, p) => s + Number(p.monto || 0), 0),
    0
  );
  const stats = [
    { label: 'Cabañas Registradas', value: cabanas.length },
    { label: 'Reservas Totales', value: reservas.length },
    { label: 'Monto Total Reservas', value: formatCLP(totalGanancias) },
    { label: 'Pagos Aprobados', value: formatCLP(pagosAprobados) },
    { label: 'Artículos en Inventario', value: inventario.length },
    { label: 'Promociones Activas', value: (comunicaciones.promociones || []).filter(p => p.activo).length }
  ];
  document.getElementById('inicio-stats-grid').innerHTML = stats
    .map(
      s => `
      <div class="report-card" style="padding:18px 22px;">
        <div style="font-size:12.5px; color:#5a6572; font-weight:600;">${s.label}</div>
        <div style="font-size:26px; font-weight:700; color:var(--brand-blue); margin-top:6px;">${s.value}</div>
      </div>`
    )
    .join('');
}

// ======================== RENDER: CABAÑAS (Mockup: inicio_admin.png) ========================
function renderCabanasList() {
  const q = (document.getElementById('search-cabanas')?.value || '').toLowerCase().trim();
  const filtered = cabanas.filter(c => {
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.ubicacion || '').toLowerCase().includes(q) ||
      (c.sector_nombre || '').toLowerCase().includes(q) ||
      (c.estado_catalogo || c.estado || '').toLowerCase().includes(q)
    );
  });

  const container = document.getElementById('cabanas-cards-list');
  if (!filtered.length) {
    container.innerHTML = `<div class="report-card">No se encontraron cabañas con ese filtro.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(cab => {
      const [img1, img2, img3] = getPhotosTriple(cab.fotos);
      const estadoLabel = cab.estado_catalogo || cab.estado || 'Disponible';
      const statusClass =
        estadoLabel === 'Disponible'
          ? 'status-Disponible'
          : estadoLabel === 'Ocupada'
          ? 'status-Ocupada'
          : 'status-Pendiente';

      const reglasTexto =
        cab.reglas && cab.reglas.length
          ? cab.reglas.map(r => r.descripcion).join(' • ')
          : `${cab.ubicacion} — Sector ${cab.sector_nombre || 'Algarrobo'}`;

      const amenitiesBadges = (cab.comodidades || [])
        .map(cm => `<span class="badge badge-amenity">✓ ${cm.nombre}</span>`)
        .join('');

      return `
      <article class="entity-card">
        <div class="photo-collage">
          <img class="photo-main" src="${img1}" alt="${cab.nombre}" />
          <img src="${img2}" alt="${cab.nombre}" />
          <img src="${img3}" alt="${cab.nombre}" />
        </div>

        <div class="entity-info">
          <h3>${cab.nombre}</h3>
          <div class="capacity-row">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span>X ${cab.capacidad}</span>
            <span style="font-size:15px; margin-left:14px; color:#147a3d; font-weight:700;">
              ${formatCLP(cab.precio_por_noche)} / noche
            </span>
          </div>
          <p class="entity-desc">${reglasTexto}</p>
          <div class="db-badges">
            <span class="badge">📍 ${cab.ubicacion}</span>
            <span class="badge">🏖️ Sector: ${cab.sector_nombre || 'N/A'}</span>
            <span class="badge">🏙️ Comuna: ${cab.comuna_nombre || 'Algarrobo'}</span>
            <span class="badge">🛠️ Mantenciones: ${(cab.mantenciones || []).length}</span>
            <span class="badge">📅 Bloqueos: ${(cab.bloqueos || []).length}</span>
          </div>
          <div class="db-badges">${amenitiesBadges}</div>
        </div>

        <div class="entity-actions">
          <div class="status-banner ${statusClass}">${estadoLabel}</div>
          <button class="btn-pill btn-primary btn-sm" style="width:170px;" onclick="openEditCabana(${cab.id_cabana})">Editar Cabaña</button>
          <button class="btn-pill btn-primary btn-sm" style="width:170px;" onclick="deleteCabana(${cab.id_cabana})">Eliminar Cabaña</button>
        </div>
      </article>`;
    })
    .join('');
}

// ======================== ABRIR CREAR / EDITAR CABAÑA ========================
function renderCabanaFormGallery() {
  const f1 = document.getElementById('cab-foto-1').value.trim() || DEFAULT_IMAGES[0];
  const f2 = document.getElementById('cab-foto-2').value.trim() || DEFAULT_IMAGES[1];
  const f3 = document.getElementById('cab-foto-3').value.trim() || DEFAULT_IMAGES[2];
  document.getElementById('cabana-form-gallery').innerHTML = `
    <img src="${f1}" alt="Foto 1" />
    <img src="${f2}" alt="Foto 2" />
    <img class="img-bottom-wide" src="${f3}" alt="Foto 3" />
  `;
}

function openAddCabana() {
  activeCabanaEdit = null;
  document.getElementById('cab-id').value = '';
  document.getElementById('cab-nombre').value = '';
  document.getElementById('cab-ubicacion').value = '';
  document.getElementById('cab-capacidad').value = 4;
  document.getElementById('cab-precio').value = 55000;
  document.getElementById('cab-sector').value = catalogs.sectores?.[0]?.id_sector || 1;
  document.getElementById('cab-estado').value = catalogs.estadosCabana?.[0]?.id_estado_cabana || 1;
  document.getElementById('cab-comuna').value = catalogs.comunas?.[0]?.id_comuna || 1;
  document.getElementById('cab-reglas').value = '';
  document.getElementById('cab-foto-1').value = DEFAULT_IMAGES[0];
  document.getElementById('cab-foto-2').value = DEFAULT_IMAGES[1];
  document.getElementById('cab-foto-3').value = DEFAULT_IMAGES[2];
  document.getElementById('btn-submit-cabana').textContent = 'Crear';
  document.getElementById('cabana-extra-bd-panels').classList.add('hidden');

  renderComodidadesChecks([]);
  renderCabanaFormGallery();
  navigateTo('cabana-add');
}

window.openEditCabana = function(id_cabana) {
  const cab = cabanas.find(c => c.id_cabana === id_cabana);
  if (!cab) return;
  activeCabanaEdit = cab;

  document.getElementById('cab-id').value = cab.id_cabana;
  document.getElementById('cab-nombre').value = cab.nombre;
  document.getElementById('cab-ubicacion').value = cab.ubicacion;
  document.getElementById('cab-capacidad').value = cab.capacidad;
  document.getElementById('cab-precio').value = cab.precio_por_noche;
  document.getElementById('cab-sector').value = cab.id_sector || 1;
  document.getElementById('cab-estado').value = cab.id_estado || 1;
  document.getElementById('cab-comuna').value = cab.id_comuna || 1;
  document.getElementById('cab-reglas').value = (cab.reglas || []).map(r => r.descripcion).join('\n');

  const [img1, img2, img3] = getPhotosTriple(cab.fotos);
  document.getElementById('cab-foto-1').value = img1;
  document.getElementById('cab-foto-2').value = img2;
  document.getElementById('cab-foto-3').value = img3;

  document.getElementById('btn-submit-cabana').textContent = 'Guardar';
  document.getElementById('cabana-extra-bd-panels').classList.remove('hidden');

  renderComodidadesChecks((cab.comodidades || []).map(cm => cm.id_comodidad));
  renderCabanaFormGallery();
  renderMantencionesYBloqueos(cab);
  navigateTo('cabana-edit');
};

function renderComodidadesChecks(selectedIds) {
  const box = document.getElementById('cab-comodidades-checks');
  box.innerHTML = (catalogs.comodidades || [])
    .map(cm => {
      const checked = selectedIds.includes(cm.id_comodidad) ? 'checked' : '';
      return `
      <label class="amenity-check-item">
        <input type="checkbox" name="cab-comodidad" value="${cm.id_comodidad}" ${checked} />
        <span>${cm.nombre}</span>
      </label>`;
    })
    .join('');
}

function renderMantencionesYBloqueos(cab) {
  const mantBox = document.getElementById('cab-mantenciones-list');
  mantBox.innerHTML = (cab.mantenciones || []).length
    ? cab.mantenciones
        .map(
          m => `
        <div class="mini-list-item">
          <span><strong>${String(m.fecha).slice(0, 10)}</strong>: ${m.descripcion} (${formatCLP(m.costo)})</span>
          <button type="button" class="btn-pill btn-danger btn-sm" style="padding:3px 10px;" onclick="removeMantencion(${m.id_mantencion})">×</button>
        </div>`
        )
        .join('')
    : `<div style="font-size:12px; color:#666;">Sin mantenciones registradas.</div>`;

  const bloqBox = document.getElementById('cab-bloqueos-list');
  bloqBox.innerHTML = (cab.bloqueos || []).length
    ? cab.bloqueos
        .map(
          b => `
        <div class="mini-list-item">
          <span><strong>${String(b.fecha_desde).slice(0, 10)} a ${String(b.fecha_hasta).slice(0, 10)}</strong>: ${b.motivo || 'Bloqueo'}</span>
          <button type="button" class="btn-pill btn-danger btn-sm" style="padding:3px 10px;" onclick="removeBloqueo(${b.id_bloqueo})">×</button>
        </div>`
        )
        .join('')
    : `<div style="font-size:12px; color:#666;">Sin bloqueos de fechas.</div>`;
}

window.removeMantencion = async function(id_mantencion) {
  await window.api.invoke('cabanas:deleteMantencion', id_mantencion);
  await refreshAllData();
  if (activeCabanaEdit) window.openEditCabana(activeCabanaEdit.id_cabana);
  showToast('Mantención eliminada');
};

window.removeBloqueo = async function(id_bloqueo) {
  await window.api.invoke('cabanas:deleteBloqueo', id_bloqueo);
  await refreshAllData();
  if (activeCabanaEdit) window.openEditCabana(activeCabanaEdit.id_cabana);
  showToast('Bloqueo de fecha eliminado');
};

window.deleteCabana = async function(id_cabana) {
  const res = await window.api.invoke('cabanas:delete', id_cabana);
  if (!res.ok) {
    showToast(res.error);
    return;
  }
  await refreshAllData();
  showToast('Cabaña eliminada correctamente');
};

// ======================== RENDER: RESERVAS LISTA (Mockup: inicio reservas.png) ========================
function renderReservasList() {
  const q = (document.getElementById('search-reservas')?.value || '').toLowerCase().trim();
  const filtered = reservas.filter(r => {
    if (!q) return true;
    return (
      (r.cabana_nombre || '').toLowerCase().includes(q) ||
      (r.cliente_nombre || '').toLowerCase().includes(q) ||
      (r.estado_reserva_nombre || r.estado || '').toLowerCase().includes(q)
    );
  });

  const container = document.getElementById('reservas-cards-list');
  if (!filtered.length) {
    container.innerHTML = `<div class="report-card">No hay reservas que coincidan con la búsqueda.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(res => {
      const [img1, img2, img3] = getPhotosTriple(res.fotos_cabana);
      const estadoNombre = res.estado_reserva_nombre || res.estado || 'Reservado';
      const statusClass =
        estadoNombre === 'Confirmada' || estadoNombre === 'Finalizada'
          ? 'status-Confirmada'
          : estadoNombre === 'Pendiente'
          ? 'status-Pendiente'
          : 'status-Reservado';

      const totalPersonas = 1 + (res.huespedes || []).length;
      const desc =
        res.reglas_cabana && res.reglas_cabana.length
          ? res.reglas_cabana[0].descripcion
          : `Reserva de ${res.cliente_nombre} en ${res.cabana_ubicacion}`;

      return `
      <article class="entity-card">
        <div class="photo-collage">
          <img class="photo-main" src="${img1}" alt="${res.cabana_nombre}" />
          <img src="${img2}" alt="${res.cabana_nombre}" />
          <img src="${img3}" alt="${res.cabana_nombre}" />
        </div>

        <div class="entity-info">
          <h3>${res.cabana_nombre} <small style="font-size:14px; color:#556;">(Reserva #${res.id_reserva})</small></h3>
          <div class="capacity-row">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span>X ${res.cabana_capacidad} <small style="font-size:13px;">(${totalPersonas} huéspedes reg.)</small></span>
          </div>
          <p class="entity-desc">${desc}</p>
          <div class="db-badges">
            <span class="badge">👤 Cliente: ${res.cliente_nombre}</span>
            <span class="badge">📅 ${res.fecha_inicio_str} → ${res.fecha_fin_str}</span>
            <span class="badge">💰 Total: ${formatCLP(res.monto_total)}</span>
            <span class="badge">💳 Pagos: ${(res.pagos || []).length}</span>
            <span class="badge">🛎️ Servicios extra: ${(res.servicios || []).length}</span>
          </div>
        </div>

        <div class="entity-actions">
          <div class="status-banner ${statusClass}">${estadoNombre}</div>
          <button class="btn-pill btn-primary btn-sm" style="width:175px;" onclick="openReservaDetail(${res.id_reserva})">Información de Reserva</button>
          <button class="btn-pill btn-primary btn-sm" style="width:175px;" onclick="deleteReservaById(${res.id_reserva})">Eliminar Reserva</button>
        </div>
      </article>`;
    })
    .join('');
}

// ======================== ABRIR DETALLE / NUEVA RESERVA (Mockup: datos de reserva.png) ========================
function updateReservaGalleryByCabana(id_cabana) {
  const cab = cabanas.find(c => Number(c.id_cabana) === Number(id_cabana)) || cabanas[0];
  if (!cab) return;
  const [img1, img2, img3] = getPhotosTriple(cab.fotos);
  document.getElementById('reserva-detail-gallery').innerHTML = `
    <img src="${img1}" alt="${cab.nombre}" />
    <img src="${img2}" alt="${cab.nombre}" />
    <img class="img-bottom-wide" src="${img3}" alt="${cab.nombre}" />
  `;
  document.getElementById('reserva-detail-cabana-summary').innerHTML = `
    <div><strong>${cab.nombre}</strong></div>
    <div style="font-size:12.5px; color:#445; margin-top:4px;">📍 ${cab.ubicacion} (${cab.sector_nombre || 'Algarrobo'})</div>
    <div style="font-size:12.5px; color:#147a3d; font-weight:700; margin-top:4px;">Precio base: ${formatCLP(cab.precio_por_noche)} / noche • Capacidad: ${cab.capacidad} personas</div>
  `;
}

function renderTempHuespedesAndServicios() {
  const hBox = document.getElementById('res-huespedes-list');
  hBox.innerHTML = tempHuespedes.length
    ? tempHuespedes
        .map(
          (h, idx) => `
        <div class="mini-list-item">
          <span>👤 <strong>${h.nombre_completo}</strong> — RUT/Pasaporte: <code>${h.rut_o_pasaporte || 'S/I'}</code></span>
          <button type="button" class="btn-pill btn-danger btn-sm" style="padding:2px 9px;" onclick="removeTempHuesped(${idx})">×</button>
        </div>`
        )
        .join('')
    : `<div style="font-size:12px; color:#666;">Sin acompañantes adicionales registrados en \`huespedes_adicionales\`.</div>`;

  const sBox = document.getElementById('res-servicios-list');
  sBox.innerHTML = tempResServicios.length
    ? tempResServicios
        .map(
          (s, idx) => `
        <div class="mini-list-item">
          <span>🛎️ <strong>${s.servicio_nombre}</strong> x ${s.cantidad} — Subtotal: <strong>${formatCLP(s.subtotal)}</strong></span>
          <button type="button" class="btn-pill btn-danger btn-sm" style="padding:2px 9px;" onclick="removeTempServicio(${idx})">×</button>
        </div>`
        )
        .join('')
    : `<div style="font-size:12px; color:#666;">Sin servicios adicionales contratados en \`reservas_servicios\`.</div>`;
}

window.removeTempHuesped = function(idx) {
  tempHuespedes.splice(idx, 1);
  renderTempHuespedesAndServicios();
};

window.removeTempServicio = function(idx) {
  tempResServicios.splice(idx, 1);
  renderTempHuespedesAndServicios();
};

window.openReservaDetail = function(id_reserva) {
  const res = reservas.find(r => r.id_reserva === id_reserva);
  if (!res) return;
  activeReservaEdit = res;

  document.getElementById('res-id').value = res.id_reserva;
  document.getElementById('res-cabana').value = res.id_cabana;
  document.getElementById('res-inicio').value = res.fecha_inicio_str;
  document.getElementById('res-fin').value = res.fecha_fin_str;
  document.getElementById('res-estado').value = res.id_estado_reserva || 1;
  document.getElementById('res-monto-total').value = res.monto_total;

  document.getElementById('res-usuario-select').value = res.id_usuario;
  document.getElementById('res-cli-nombre').value = res.cliente_nombre || '';
  document.getElementById('res-cli-correo').value = res.cliente_correo || '';
  document.getElementById('res-cli-telefono').value = res.cliente_telefono || '';
  document.getElementById('res-cli-comuna').value = res.cliente_id_comuna || 1;

  tempHuespedes = (res.huespedes || []).map(h => ({ ...h }));
  tempResServicios = (res.servicios || []).map(s => ({ ...s }));

  updateReservaGalleryByCabana(res.id_cabana);
  renderTempHuespedesAndServicios();
  renderReservaPagos(res);
  document.getElementById('btn-reserva-delete').classList.remove('hidden');
  document.getElementById('res-pagos-section').classList.remove('hidden');
  navigateTo('reserva-detail');
};

function openNewReserva() {
  activeReservaEdit = null;
  const firstCab = cabanas[0];
  document.getElementById('res-id').value = '';
  document.getElementById('res-cabana').value = firstCab ? firstCab.id_cabana : '';
  document.getElementById('res-inicio').value = '2026-11-10';
  document.getElementById('res-fin').value = '2026-11-12';
  document.getElementById('res-estado').value = 1;
  document.getElementById('res-monto-total').value = firstCab ? Number(firstCab.precio_por_noche) * 2 : 100000;

  document.getElementById('res-usuario-select').value = '';
  document.getElementById('res-cli-nombre').value = '';
  document.getElementById('res-cli-correo').value = '';
  document.getElementById('res-cli-telefono').value = '+569';
  document.getElementById('res-cli-comuna').value = 1;

  tempHuespedes = [];
  tempResServicios = [];
  if (firstCab) updateReservaGalleryByCabana(firstCab.id_cabana);
  renderTempHuespedesAndServicios();
  document.getElementById('btn-reserva-delete').classList.add('hidden');
  document.getElementById('res-pagos-section').classList.add('hidden');
  navigateTo('reserva-detail');
}

function renderReservaPagos(res) {
  const box = document.getElementById('res-pagos-list');
  const pagos = res.pagos || [];
  if (!pagos.length) {
    box.innerHTML = `<div style="font-size:12.5px; color:#666;">No hay pagos registrados para esta reserva.</div>`;
    return;
  }
  box.innerHTML = pagos
    .map(p => {
      const compHtml = (p.comprobantes || [])
        .map(c => `<span class="badge">🧾 Op: ${c.numero_operacion || 'S/N'} (${c.banco_origen || 'Banco'})</span>`)
        .join(' ');
      return `
      <div class="mini-list-item" style="flex-wrap:wrap; gap:8px;">
        <div>
          <strong>${formatCLP(p.monto)}</strong> — ${p.metodo_nombre || p.metodo_pago}
          <span class="badge">${p.estado_pago_nombre || 'Pendiente'}</span>
          ${compHtml}
          <div style="font-size:12px; color:#555;">${p.observaciones || ''}</div>
        </div>
        <div style="display:flex; gap:4px;">
          <button type="button" class="btn-pill btn-secondary btn-sm" style="padding:3px 10px;" onclick="cambiarEstadoPago(${p.id_pago}, 2)">Aprobar</button>
          <button type="button" class="btn-pill btn-danger btn-sm" style="padding:3px 10px;" onclick="cambiarEstadoPago(${p.id_pago}, 3)">Rechazar</button>
        </div>
      </div>`;
    })
    .join('');
}

window.cambiarEstadoPago = async function(id_pago, id_estado_pago) {
  await window.api.invoke('pagos:updateEstado', { id_pago, id_estado_pago });
  await refreshAllData();
  if (activeReservaEdit) window.openReservaDetail(activeReservaEdit.id_reserva);
  showToast('Estado del pago actualizado');
};

window.deleteReservaById = async function(id_reserva) {
  const res = await window.api.invoke('reservas:delete', id_reserva);
  if (!res.ok) {
    showToast(res.error);
    return;
  }
  await refreshAllData();
  navigateTo('reservas');
  showToast('Reserva eliminada exitosamente');
};

// ======================== RENDER: REPORTES (Mockup: reportes.png) ========================
function getFilteredReportReservas() {
  const desde = document.getElementById('rep-desde')?.value || '2000-01-01';
  const hasta = document.getElementById('rep-hasta')?.value || '2099-12-31';
  return reservas.filter(r => r.fecha_inicio_str >= desde && r.fecha_inicio_str <= hasta);
}

function renderReportesTable() {
  const desde = document.getElementById('rep-desde')?.value || '2026-01-01';
  const hasta = document.getElementById('rep-hasta')?.value || '2026-12-31';
  const rows = getFilteredReportReservas();

  let totalPersonasSum = 0;
  let totalMontoSum = 0;

  const tbody = document.getElementById('rep-table-body');
  const htmlRows = rows
    .map(r => {
      const nroPersonas = 1 + (r.huespedes || []).length;
      const precio = Number(r.monto_total || 0);
      totalPersonasSum += nroPersonas;
      totalMontoSum += precio;
      const code = `RC - ${String(r.id_reserva).padStart(3, '0')}`;

      return `
      <tr>
        <td>${code}</td>
        <td>${r.cabana_nombre}</td>
        <td>${r.cliente_nombre}</td>
        <td>${r.fecha_inicio_str}</td>
        <td>${r.fecha_fin_str}</td>
        <td>${nroPersonas}</td>
        <td>${formatCLP(precio)}</td>
        <td>
          <button class="btn-pill btn-primary btn-sm" onclick="openReservaDetail(${r.id_reserva})">Ver Reserva</button>
        </td>
      </tr>`;
    })
    .join('');

  const totalRow = `
    <tr class="total-row">
      <td>TOTAL</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>${totalPersonasSum}</td>
      <td>${formatCLP(totalMontoSum)}</td>
      <td></td>
    </tr>`;

  tbody.innerHTML = htmlRows + totalRow;
  document.getElementById('rep-range-label').textContent = `${desde} hasta ${hasta}`;
  document.getElementById('rep-total-label').textContent = formatCLP(totalMontoSum);
}

// ======================== RENDER: COMENTARIOS, CONTACTO, WHATSAPP Y NOTIFICACIONES ========================
function renderComunicaciones() {
  // 1. Comentarios
  const comBox = document.getElementById('list-comentarios');
  comBox.innerHTML = (comunicaciones.comentarios || []).length
    ? comunicaciones.comentarios
        .map(
          cm => `
        <div class="mini-list-item">
          <div>
            <strong>${cm.nombre}</strong> (${cm.correo}) — <span class="badge">${cm.cabana_nombre || 'General'}</span>
            <div style="margin-top:4px; color:#223;">"${cm.comentario}"</div>
          </div>
          <button class="btn-pill btn-danger btn-sm" onclick="eliminarComentario(${cm.id})">Eliminar</button>
        </div>`
        )
        .join('')
    : `<p style="font-size:13px; color:#666;">No hay comentarios registrados.</p>`;

  // 2. Mensajes de Contacto
  const msgBox = document.getElementById('list-mensajes-contacto');
  msgBox.innerHTML = (comunicaciones.mensajesContacto || []).length
    ? comunicaciones.mensajesContacto
        .map(
          m => `
        <div class="mini-list-item">
          <div>
            <strong>${m.nombre}</strong> (${m.correo})
            <span class="badge" style="background:${m.leido ? '#e2e8f0' : '#fefcbf'};">${m.leido ? 'Leído' : 'No leído'}</span>
            <div style="margin-top:4px;">${m.mensaje}</div>
          </div>
          <button class="btn-pill btn-secondary btn-sm" onclick="toggleMensajeContacto(${m.id_mensaje}, ${!m.leido})">
            Marcar ${m.leido ? 'No Leído' : 'Leído'}
          </button>
        </div>`
        )
        .join('')
    : `<p style="font-size:13px; color:#666;">No hay mensajes de contacto.</p>`;

  // 3. WhatsApp
  const waBox = document.getElementById('list-whatsapp');
  waBox.innerHTML = (comunicaciones.whatsapp || []).length
    ? comunicaciones.whatsapp
        .map(
          w => `
        <div class="mini-list-item">
          <div>
            <strong>📱 ${w.telefono_destino}</strong>
            ${w.id_reserva ? `<span class="badge">Reserva #${w.id_reserva} (${w.cabana_nombre || ''})</span>` : ''}
            <div style="margin-top:4px;">${w.mensaje}</div>
          </div>
          <span style="font-size:12px; color:#667;">${String(w.fecha_envio).slice(0, 16).replace('T', ' ')}</span>
        </div>`
        )
        .join('')
    : `<p style="font-size:13px; color:#666;">Sin mensajes de WhatsApp registrados.</p>`;

  // 4. Notificaciones
  const notifBox = document.getElementById('list-notificaciones');
  notifBox.innerHTML = (comunicaciones.notificaciones || []).length
    ? comunicaciones.notificaciones
        .map(
          n => `
        <div class="mini-list-item">
          <div>
            <strong>🔔 ${n.titulo}</strong> — <small>${n.usuario_nombre || ''}</small>
            <span class="badge">${n.leido ? 'Leída' : 'Nueva'}</span>
            <div style="margin-top:4px;">${n.mensaje}</div>
          </div>
          <button class="btn-pill btn-secondary btn-sm" onclick="toggleNotificacion(${n.id_notificacion}, ${!n.leido})">
            ${n.leido ? 'Marcar No Leída' : 'Marcar Leída'}
          </button>
        </div>`
        )
        .join('')
    : `<p style="font-size:13px; color:#666;">Sin notificaciones.</p>`;
}

window.eliminarComentario = async function(id) {
  await window.api.invoke('comentarios:delete', id);
  await refreshAllData();
  showToast('Comentario eliminado');
};

window.toggleMensajeContacto = async function(id_mensaje, leido) {
  await window.api.invoke('mensajesContacto:toggleLeido', { id_mensaje, leido });
  await refreshAllData();
};

window.toggleNotificacion = async function(id_notificacion, leido) {
  await window.api.invoke('notificaciones:toggleLeido', { id_notificacion, leido });
  await refreshAllData();
};

// ======================== RENDER: INVENTARIO, PROMOCIONES, SERVICIOS Y CATÁLOGOS ========================
function renderInventarioSection() {
  const invBody = document.getElementById('inv-table-body');
  invBody.innerHTML = inventario
    .map(
      it => `
      <tr>
        <td>${it.id_item}</td>
        <td>${it.nombre}</td>
        <td>${it.cantidad}</td>
        <td>${it.ubicacion || '-'}</td>
        <td>${it.cabana_nombre || '-'}</td>
        <td>${it.categoria_nombre || '-'}</td>
        <td>${it.observacion || '-'}</td>
        <td>
          <button class="btn-pill btn-danger btn-sm" onclick="deleteInventarioItem(${it.id_item})">Eliminar</button>
        </td>
      </tr>`
    )
    .join('');

  // Promociones
  const promoBox = document.getElementById('list-promociones');
  promoBox.innerHTML = (comunicaciones.promociones || [])
    .map(
      p => `
      <div class="mini-list-item">
        <div>
          <strong>🏷️ Código: <code>${p.codigo}</code></strong> — <strong>${p.porcentaje_descuento}% DCTO</strong>
          (Expira: ${p.fecha_expiracion_str})
          <span class="badge">${p.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
        <button class="btn-pill btn-danger btn-sm" onclick="deletePromocion(${p.id_promocion})">Eliminar</button>
      </div>`
    )
    .join('');

  // Servicios adicionales
  const servBox = document.getElementById('list-servicios');
  servBox.innerHTML = (catalogs.servicios || [])
    .map(
      s => `
      <div class="mini-list-item">
        <span>🛎️ <strong>${s.nombre}</strong></span>
        <strong>${formatCLP(s.precio)}</strong>
      </div>`
    )
    .join('');

  // Catálogos Maestros
  document.getElementById('catalogos-summary-grid').innerHTML = `
    <div class="mini-list-box">
      <strong>Regiones, Provincias y Comunas (\`regiones\`, \`provincias\`, \`comunas\`)</strong>
      ${(catalogs.comunas || []).map(c => `<div class="mini-list-item"><span>${c.nombre}</span><small>${c.provincia_nombre} / ${c.region_nombre}</small></div>`).join('')}
    </div>
    <div class="mini-list-box">
      <strong>Sectores de Algarrobo (\`sectores_algarrobo\`)</strong>
      ${(catalogs.sectores || []).map(s => `<div class="mini-list-item"><span>#${s.id_sector}</span><strong>${s.nombre}</strong></div>`).join('')}
    </div>
    <div class="mini-list-box">
      <strong>Roles del Sistema (\`roles\`)</strong>
      ${(catalogs.roles || []).map(r => `<div class="mini-list-item"><strong>${r.nombre}</strong><small>${r.descripcion}</small></div>`).join('')}
    </div>
    <div class="mini-list-box">
      <strong>Estados y Métodos (\`estados_cabana\`, \`estados_reserva\`, \`metodos_pago\`, \`estados_pago\`)</strong>
      <div style="font-size:12.5px; margin-top:6px;">
        <div><strong>Cabaña:</strong> ${(catalogs.estadosCabana || []).map(x => x.nombre).join(', ')}</div>
        <div style="margin-top:4px;"><strong>Reserva:</strong> ${(catalogs.estadosReserva || []).map(x => x.nombre).join(', ')}</div>
        <div style="margin-top:4px;"><strong>Métodos Pago:</strong> ${(catalogs.metodosPago || []).map(x => x.nombre).join(', ')}</div>
        <div style="margin-top:4px;"><strong>Estados Pago:</strong> ${(catalogs.estadosPago || []).map(x => x.nombre).join(', ')}</div>
      </div>
    </div>
  `;
}

window.deleteInventarioItem = async function(id_item) {
  await window.api.invoke('inventario:delete', id_item);
  await refreshAllData();
  showToast('Artículo de inventario eliminado');
};

window.deletePromocion = async function(id_promocion) {
  await window.api.invoke('promociones:delete', id_promocion);
  await refreshAllData();
  showToast('Promoción eliminada');
};

// ======================== EVENTOS DOM ========================
window.addEventListener('DOMContentLoaded', async () => {
  await refreshAllData();

  // Login submit
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const correo = document.getElementById('login-correo').value;
    const contrasena = document.getElementById('login-pass').value;
    const res = await window.api.invoke('auth:login', { correo, contrasena });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    currentUser = res.user;
    document.getElementById('nav-user-label').textContent = currentUser.rol_nombre || currentUser.nombre;
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    navigateTo('cabanas');
    showToast(`Bienvenido, ${currentUser.nombre}`);
  });

  // Mostrar / ocultar crear cuenta
  document.getElementById('link-show-register').addEventListener('click', () => {
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('register-box').classList.remove('hidden');
  });
  document.getElementById('link-back-login').addEventListener('click', () => {
    document.getElementById('register-box').classList.add('hidden');
    document.getElementById('login-box').classList.remove('hidden');
  });

  // Registro submit
  document.getElementById('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById('reg-nombre').value,
      correo: document.getElementById('reg-correo').value,
      contrasena: document.getElementById('reg-pass').value,
      telefono: document.getElementById('reg-telefono').value,
      id_rol: Number(document.getElementById('reg-rol').value),
      id_comuna: Number(document.getElementById('reg-comuna').value)
    };
    const res = await window.api.invoke('auth:register', payload);
    if (res.ok) {
      await refreshAllData();
      document.getElementById('login-correo').value = payload.correo;
      document.getElementById('login-pass').value = payload.contrasena;
      document.getElementById('register-box').classList.add('hidden');
      document.getElementById('login-box').classList.remove('hidden');
      showToast('Usuario creado con éxito. Ahora puedes iniciar sesión.');
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
  });

  // Links de navegación
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.getAttribute('data-nav')));
  });
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.getAttribute('data-goto')));
  });

  // Botón campana notificaciones
  document.getElementById('btn-top-notificaciones').addEventListener('click', () => {
    navigateTo('comentarios');
    document.querySelector('[data-commtab="tab-notificaciones"]').click();
  });

  // Buscadores
  document.getElementById('search-cabanas').addEventListener('input', renderCabanasList);
  document.getElementById('search-reservas').addEventListener('input', renderReservasList);

  // Botones Agregar / Cancelar Cabaña
  document.getElementById('btn-open-add-cabana').addEventListener('click', openAddCabana);
  document.getElementById('btn-cancel-cabana').addEventListener('click', () => navigateTo('cabanas'));

  ['cab-foto-1', 'cab-foto-2', 'cab-foto-3'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderCabanaFormGallery);
  });

  document.getElementById('btn-add-foto-file').addEventListener('click', async () => {
    const res = await window.api.invoke('dialog:selectImage');
    if (!res.canceled && res.filePath) {
      const f1 = document.getElementById('cab-foto-1');
      const f2 = document.getElementById('cab-foto-2');
      const f3 = document.getElementById('cab-foto-3');
      if (!f1.value || f1.value === DEFAULT_IMAGES[0]) f1.value = res.filePath;
      else if (!f2.value || f2.value === DEFAULT_IMAGES[1]) f2.value = res.filePath;
      else f3.value = res.filePath;
      renderCabanaFormGallery();
    }
  });

  // Guardar Cabaña
  document.getElementById('form-cabana').addEventListener('submit', async e => {
    e.preventDefault();
    const checkedComodidades = Array.from(document.querySelectorAll('input[name="cab-comodidad"]:checked')).map(el =>
      Number(el.value)
    );
    const reglasList = document
      .getElementById('cab-reglas')
      .value.split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const fotosList = [
      document.getElementById('cab-foto-1').value.trim(),
      document.getElementById('cab-foto-2').value.trim(),
      document.getElementById('cab-foto-3').value.trim()
    ].filter(Boolean);

    const payload = {
      id_cabana: document.getElementById('cab-id').value ? Number(document.getElementById('cab-id').value) : null,
      nombre: document.getElementById('cab-nombre').value.trim(),
      ubicacion: document.getElementById('cab-ubicacion').value.trim(),
      capacidad: Number(document.getElementById('cab-capacidad').value),
      precio_por_noche: Number(document.getElementById('cab-precio').value),
      id_sector: Number(document.getElementById('cab-sector').value),
      id_estado: Number(document.getElementById('cab-estado').value),
      id_comuna: Number(document.getElementById('cab-comuna').value),
      comodidadesIds: checkedComodidades,
      reglasList,
      fotosList
    };

    const res = await window.api.invoke('cabanas:save', payload);
    if (!res.ok) {
      showToast('Error al guardar cabaña: ' + res.error);
      return;
    }
    await refreshAllData();
    navigateTo('cabanas');
    showToast('Cabaña guardada exitosamente');
  });

  // Agregar Mantención y Bloqueo en Edición de Cabaña
  document.getElementById('btn-add-mantencion').addEventListener('click', async () => {
    if (!activeCabanaEdit) return;
    const descripcion = document.getElementById('new-mant-desc').value.trim();
    const costo = document.getElementById('new-mant-costo').value;
    const fecha = document.getElementById('new-mant-fecha').value;
    if (!descripcion || !fecha) {
      showToast('Ingresa descripción y fecha de la mantención');
      return;
    }
    await window.api.invoke('cabanas:addMantencion', {
      id_cabana: activeCabanaEdit.id_cabana,
      descripcion,
      costo,
      fecha
    });
    document.getElementById('new-mant-desc').value = '';
    document.getElementById('new-mant-costo').value = '';
    await refreshAllData();
    window.openEditCabana(activeCabanaEdit.id_cabana);
    showToast('Mantención registrada correctamente');
  });

  document.getElementById('btn-add-bloqueo').addEventListener('click', async () => {
    if (!activeCabanaEdit) return;
    const fecha_desde = document.getElementById('new-bloq-desde').value;
    const fecha_hasta = document.getElementById('new-bloq-hasta').value;
    const motivo = document.getElementById('new-bloq-motivo').value.trim();
    if (!fecha_desde || !fecha_hasta) {
      showToast('Selecciona fecha desde y hasta para bloquear');
      return;
    }
    await window.api.invoke('cabanas:addBloqueo', {
      id_cabana: activeCabanaEdit.id_cabana,
      fecha_desde,
      fecha_hasta,
      motivo
    });
    document.getElementById('new-bloq-motivo').value = '';
    await refreshAllData();
    window.openEditCabana(activeCabanaEdit.id_cabana);
    showToast('Bloqueo de fechas registrado');
  });

  // Reservas: abrir nueva, cambiar cabaña o usuario, calcular monto sugerido
  document.getElementById('btn-open-new-reserva').addEventListener('click', openNewReserva);
  document.getElementById('btn-reserva-back').addEventListener('click', () => navigateTo('reservas'));

  document.getElementById('res-cabana').addEventListener('change', e => {
    updateReservaGalleryByCabana(e.target.value);
    recalcSuggestedReservaTotal();
  });
  document.getElementById('res-inicio').addEventListener('change', recalcSuggestedReservaTotal);
  document.getElementById('res-fin').addEventListener('change', recalcSuggestedReservaTotal);

  document.getElementById('res-usuario-select').addEventListener('change', e => {
    const uid = Number(e.target.value);
    const u = (catalogs.usuarios || []).find(x => x.id_usuario === uid);
    if (u) {
      document.getElementById('res-cli-nombre').value = u.nombre || '';
      document.getElementById('res-cli-correo').value = u.correo || '';
      document.getElementById('res-cli-telefono').value = u.telefono || '';
      document.getElementById('res-cli-comuna').value = u.id_comuna || 1;
    }
  });

  document.getElementById('btn-add-huesped').addEventListener('click', () => {
    const nombre_completo = document.getElementById('new-huesped-nombre').value.trim();
    const rut_o_pasaporte = document.getElementById('new-huesped-rut').value.trim();
    if (!nombre_completo) {
      showToast('Ingresa el nombre completo del huésped adicional');
      return;
    }
    tempHuespedes.push({ nombre_completo, rut_o_pasaporte });
    document.getElementById('new-huesped-nombre').value = '';
    document.getElementById('new-huesped-rut').value = '';
    renderTempHuespedesAndServicios();
  });

  document.getElementById('btn-add-res-servicio').addEventListener('click', () => {
    const id_servicio = Number(document.getElementById('new-res-servicio').value);
    const cantidad = Number(document.getElementById('new-res-serv-cant').value || 1);
    const srv = (catalogs.servicios || []).find(s => s.id_servicio === id_servicio);
    if (!srv) return;
    const existing = tempResServicios.find(s => Number(s.id_servicio) === id_servicio);
    if (existing) {
      existing.cantidad += cantidad;
      existing.subtotal = existing.cantidad * Number(srv.precio);
    } else {
      tempResServicios.push({
        id_servicio,
        servicio_nombre: srv.nombre,
        cantidad,
        subtotal: cantidad * Number(srv.precio)
      });
    }
    renderTempHuespedesAndServicios();
    recalcSuggestedReservaTotal();
  });

  // Guardar Reserva
  document.getElementById('form-reserva').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      id_reserva: document.getElementById('res-id').value ? Number(document.getElementById('res-id').value) : null,
      id_usuario: document.getElementById('res-usuario-select').value
        ? Number(document.getElementById('res-usuario-select').value)
        : null,
      nuevo_cliente: {
        nombre: document.getElementById('res-cli-nombre').value.trim(),
        correo: document.getElementById('res-cli-correo').value.trim(),
        telefono: document.getElementById('res-cli-telefono').value.trim(),
        id_comuna: Number(document.getElementById('res-cli-comuna').value)
      },
      id_cabana: Number(document.getElementById('res-cabana').value),
      fecha_inicio: document.getElementById('res-inicio').value,
      fecha_fin: document.getElementById('res-fin').value,
      id_estado_reserva: Number(document.getElementById('res-estado').value),
      monto_total: Number(document.getElementById('res-monto-total').value),
      huespedes: tempHuespedes,
      servicios: tempResServicios
    };

    const res = await window.api.invoke('reservas:save', payload);
    if (!res.ok) {
      showToast('Error al guardar reserva: ' + res.error);
      return;
    }
    await refreshAllData();
    navigateTo('reservas');
    showToast('Reserva guardada exitosamente');
  });

  document.getElementById('btn-reserva-delete').addEventListener('click', async () => {
    if (activeReservaEdit) {
      await window.deleteReservaById(activeReservaEdit.id_reserva);
    }
  });

  // Registrar Pago y Comprobante
  document.getElementById('btn-add-pago').addEventListener('click', async () => {
    if (!activeReservaEdit) return;
    const monto = document.getElementById('pago-monto').value;
    if (!monto) {
      showToast('Ingresa el monto del pago');
      return;
    }
    await window.api.invoke('pagos:add', {
      id_reserva: activeReservaEdit.id_reserva,
      monto: Number(monto),
      id_metodo_pago: Number(document.getElementById('pago-metodo').value),
      id_estado_pago: Number(document.getElementById('pago-estado').value),
      observaciones: document.getElementById('pago-obs').value.trim(),
      comprobante: {
        numero_operacion: document.getElementById('pago-num-op').value.trim(),
        banco_origen: document.getElementById('pago-banco').value.trim(),
        url_archivo: 'comprobante_registrado.pdf'
      }
    });
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-obs').value = '';
    document.getElementById('pago-num-op').value = '';
    document.getElementById('pago-banco').value = '';
    await refreshAllData();
    window.openReservaDetail(activeReservaEdit.id_reserva);
    showToast('Pago registrado exitosamente');
  });

  // Filtros de Reportes y Descarga CSV
  document.getElementById('rep-desde').addEventListener('change', renderReportesTable);
  document.getElementById('rep-hasta').addEventListener('change', renderReportesTable);

  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const rows = getFilteredReportReservas();
    const lines = [
      ['Id Reserva', 'Nombre Cabana', 'Nombre Cliente', 'Fecha Llegada', 'Fecha Salida', 'Nro Personas', 'Precio Total'].join(';')
    ];
    rows.forEach(r => {
      const nroPersonas = 1 + (r.huespedes || []).length;
      lines.push(
        [
          `RC-${String(r.id_reserva).padStart(3, '0')}`,
          r.cabana_nombre,
          r.cliente_nombre,
          r.fecha_inicio_str,
          r.fecha_fin_str,
          nroPersonas,
          r.monto_total
        ].join(';')
      );
    });
    const res = await window.api.invoke('reportes:exportCsv', {
      filename: 'reporte_reservas_algarrobo.csv',
      csvContent: lines.join('\n')
    });
    if (res.ok) showToast('Reporte exportado en: ' + res.filePath);
  });

  // Subtabs Comunicaciones
  document.querySelectorAll('[data-commtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-commtab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['tab-comentarios', 'tab-contacto', 'tab-whatsapp', 'tab-notificaciones'].forEach(id => {
        document.getElementById(id).classList.toggle('hidden', id !== btn.getAttribute('data-commtab'));
      });
    });
  });

  // Subtabs Inventario
  document.querySelectorAll('[data-invtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-invtab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['tab-inv-items', 'tab-promociones', 'tab-servicios', 'tab-catalogos'].forEach(id => {
        document.getElementById(id).classList.toggle('hidden', id !== btn.getAttribute('data-invtab'));
      });
    });
  });

  // Forms de Comentarios, WhatsApp, Inventario, Promociones, Servicios
  document.getElementById('form-add-comentario').addEventListener('submit', async e => {
    e.preventDefault();
    await window.api.invoke('comentarios:add', {
      nombre: document.getElementById('com-nombre').value.trim(),
      correo: document.getElementById('com-correo').value.trim(),
      id_cabana: Number(document.getElementById('com-cabana').value),
      comentario: document.getElementById('com-texto').value.trim()
    });
    e.target.reset();
    await refreshAllData();
    showToast('Comentario publicado');
  });

  document.getElementById('form-send-whatsapp').addEventListener('submit', async e => {
    e.preventDefault();
    await window.api.invoke('whatsapp:send', {
      telefono_destino: document.getElementById('wa-telefono').value.trim(),
      id_reserva: document.getElementById('wa-reserva').value ? Number(document.getElementById('wa-reserva').value) : null,
      mensaje: document.getElementById('wa-mensaje').value.trim()
    });
    e.target.reset();
    await refreshAllData();
    showToast('Mensaje de WhatsApp registrado');
  });

  document.getElementById('form-inventario').addEventListener('submit', async e => {
    e.preventDefault();
    await window.api.invoke('inventario:save', {
      nombre: document.getElementById('inv-nombre').value.trim(),
      cantidad: Number(document.getElementById('inv-cantidad').value),
      ubicacion: document.getElementById('inv-ubicacion').value.trim(),
      id_cabana: Number(document.getElementById('inv-cabana').value),
      id_categoria: Number(document.getElementById('inv-categoria').value),
      observacion: document.getElementById('inv-obs').value.trim()
    });
    e.target.reset();
    await refreshAllData();
    showToast('Artículo de inventario guardado');
  });

  document.getElementById('form-promocion').addEventListener('submit', async e => {
    e.preventDefault();
    await window.api.invoke('promociones:save', {
      codigo: document.getElementById('promo-codigo').value.trim(),
      porcentaje_descuento: Number(document.getElementById('promo-desc').value),
      fecha_expiracion: document.getElementById('promo-exp').value,
      activo: true
    });
    e.target.reset();
    await refreshAllData();
    showToast('Promoción creada exitosamente');
  });

  document.getElementById('form-servicio').addEventListener('submit', async e => {
    e.preventDefault();
    await window.api.invoke('servicios:save', {
      nombre: document.getElementById('serv-nombre').value.trim(),
      precio: Number(document.getElementById('serv-precio').value)
    });
    e.target.reset();
    await refreshAllData();
    showToast('Servicio adicional guardado');
  });
});

function recalcSuggestedReservaTotal() {
  const id_cabana = Number(document.getElementById('res-cabana').value);
  const cab = cabanas.find(c => c.id_cabana === id_cabana);
  const d1 = new Date(document.getElementById('res-inicio').value);
  const d2 = new Date(document.getElementById('res-fin').value);
  if (!cab || isNaN(d1) || isNaN(d2)) return;
  const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  const servSum = tempResServicios.reduce((acc, s) => acc + Number(s.subtotal || 0), 0);
  document.getElementById('res-monto-total').value = diffDays * Number(cab.precio_por_noche || 0) + servSum;
}

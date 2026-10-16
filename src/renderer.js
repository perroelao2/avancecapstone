// Variables donde guardamos los datos traidos desde MySQL para pintarlos en pantalla
let currentUser = null;
let catalogs = {};
let cabanas = [];
let inventario = [];
let activeCabanaEdit = null;

// Fotos de respaldo por si se crea una cabaña sin subir imagenes todavia
const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1540518614846-7ede433c4573?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80'
];

// Muestra un mensaje flotante en la esquina inferior derecha por 3 segundos
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// Formatea un numero a pesos chilenos (ej: 55000 -> "$ 55.000")
function formatCLP(val) {
  const num = Number(val || 0);
  return '$ ' + num.toLocaleString('es-CL');
}

// Asegura que siempre tengamos un arreglo de 3 imagenes para armar el collage de cada cabaña
function getPhotosTriple(fotosArr) {
  const urls = (fotosArr || []).map(f => f.url_foto || f).filter(Boolean);
  return [
    urls[0] || DEFAULT_IMAGES[0],
    urls[1] || DEFAULT_IMAGES[1],
    urls[2] || DEFAULT_IMAGES[2]
  ];
}

// Pide los catalogos, cabañas e inventario a main.js y vuelve a dibujar la pantalla
async function refreshAllData() {
  catalogs = await window.api.invoke('catalogs:getAll');
  cabanas = await window.api.invoke('cabanas:list');
  inventario = await window.api.invoke('inventario:list');

  populateStaticSelects();
  renderCabanasList();
  renderInventarioSection();
}

// Llena todos los <select> de los formularios con los datos reales de la BD (sectores, estados, comunas, roles, etc.)
function populateStaticSelects() {
  const regRol = document.getElementById('reg-rol');
  if (regRol) {
    regRol.innerHTML = (catalogs.roles || [])
      .map(r => `<option value="${r.id_rol}">${r.nombre}</option>`)
      .join('');
  }

  const comunaOptions = (catalogs.comunas || [])
    .map(c => `<option value="${c.id_comuna}">${c.nombre} (${c.region_nombre})</option>`)
    .join('');

  const regComuna = document.getElementById('reg-comuna');
  if (regComuna) regComuna.innerHTML = comunaOptions;

  document.getElementById('cab-sector').innerHTML = (catalogs.sectores || [])
    .map(s => `<option value="${s.id_sector}">${s.nombre}</option>`)
    .join('');
  document.getElementById('cab-estado').innerHTML = (catalogs.estadosCabana || [])
    .map(e => `<option value="${e.id_estado_cabana}">${e.nombre}</option>`)
    .join('');
  document.getElementById('cab-comuna').innerHTML = comunaOptions;

  const cabSelectHtml = cabanas.map(c => `<option value="${c.id_cabana}">${c.nombre}</option>`).join('');
  const invCab = document.getElementById('inv-cabana');
  if (invCab) invCab.innerHTML = cabSelectHtml;

  const invCat = document.getElementById('inv-categoria');
  if (invCat) {
    invCat.innerHTML = (catalogs.categoriasInventario || [])
      .map(cat => `<option value="${cat.id_categoria}">${cat.nombre}</option>`)
      .join('');
  }
}

// Textos e imagen de fondo que usa el banner superior segun la vista donde estemos
const HERO_CONFIG = {
  cabanas: { title: 'Cabañas', subtitle: 'Administración de Cabañas', bg: 'hero-cabins' },
  'cabana-add': { title: 'Agregar Cabaña', subtitle: 'Información sobre la Cabaña', bg: 'hero-beach' },
  'cabana-edit': { title: 'Editar Cabaña', subtitle: 'Información sobre la Cabaña', bg: 'hero-beach' },
  inventario: { title: 'Inventario', subtitle: 'Equipamiento por Cabaña', bg: 'hero-cabins' }
};

// Cambia entre las vistas principales ocultando las demas y actualizando el banner
function navigateTo(viewKey) {
  const sections = ['section-cabanas', 'section-cabana-form', 'section-inventario'];
  sections.forEach(id => document.getElementById(id)?.classList.add('hidden'));

  const hero = document.getElementById('hero-banner');
  const cfg = HERO_CONFIG[viewKey] || HERO_CONFIG.cabanas;
  document.getElementById('hero-title').textContent = cfg.title;
  document.getElementById('hero-subtitle').textContent = cfg.subtitle;
  hero.className = `hero-banner ${cfg.bg}`;

  document.querySelectorAll('.nav-link').forEach(link => {
    const navTarget = link.getAttribute('data-nav');
    const isActive =
      navTarget === viewKey || (viewKey.startsWith('cabana-') && navTarget === 'cabanas');
    link.classList.toggle('active', isActive);
  });

  if (viewKey === 'cabanas') document.getElementById('section-cabanas').classList.remove('hidden');
  else if (viewKey === 'cabana-add' || viewKey === 'cabana-edit') document.getElementById('section-cabana-form').classList.remove('hidden');
  else if (viewKey === 'inventario') document.getElementById('section-inventario').classList.remove('hidden');
}

// Dibuja la lista de tarjetas de cabañas filtrando por lo que se escriba en el buscador
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
    container.innerHTML = `<div class="report-card">No se encontraron cabañas registradas.</div>`;
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
            <span class="badge">🏖️ ${cab.sector_nombre || 'Algarrobo'}</span>
            <span class="badge">🏙️ ${cab.comuna_nombre || 'Algarrobo'}</span>
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

// Actualiza las 3 fotos de vista previa a la izquierda del formulario de cabaña
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

// Limpia el formulario y abre la vista para crear una cabaña desde cero
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

// Carga los datos de la cabaña elegida en el formulario para poder editarla
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

// Dibuja los checkboxes de comodidades (Wifi, Tinaja, Parrilla, etc.) y marca los que ya tiene la cabaña
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

// Dibuja la lista de mantenciones y bloqueos de fechas cuando estamos editando una cabaña
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
          <span><strong>${String(b.fecha_desde).slice(0, 10)} a ${String(b.fecha_hasta).slice(0, 10)}</strong>: ${b.motivo || 'Bloqueado'}</span>
          <button type="button" class="btn-pill btn-danger btn-sm" style="padding:3px 10px;" onclick="removeBloqueo(${b.id_bloqueo})">×</button>
        </div>`
        )
        .join('')
    : `<div style="font-size:12px; color:#666;">Sin bloqueos de fechas.</div>`;
}

// Funciones para borrar una mantencion, un bloqueo de fecha o una cabaña completa
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
  showToast('Bloqueo eliminado');
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

// Dibuja la tabla de inventario con los articulos asignados a cada cabaña
function renderInventarioSection() {
  const invBody = document.getElementById('inv-table-body');
  if (!invBody) return;
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
}

window.deleteInventarioItem = async function(id_item) {
  await window.api.invoke('inventario:delete', id_item);
  await refreshAllData();
  showToast('Artículo eliminado del inventario');
};

// Cuando el documento HTML termina de cargar, conectamos todos los botones y formularios
window.addEventListener('DOMContentLoaded', async () => {
  await refreshAllData();

  // Evento al enviar el formulario de Iniciar Sesion
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

  // Botones para alternar entre Iniciar Sesion y Crear Cuenta
  document.getElementById('link-show-register').addEventListener('click', () => {
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('register-box').classList.remove('hidden');
  });
  document.getElementById('link-back-login').addEventListener('click', () => {
    document.getElementById('register-box').classList.add('hidden');
    document.getElementById('login-box').classList.remove('hidden');
  });

  // Evento al enviar el formulario de Crear Cuenta
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
      showToast('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
    }
  });

  // Cerrar sesion al hacer clic en el icono de usuario arriba a la derecha
  document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
  });

  // Enlaces de la barra de navegacion
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.getAttribute('data-nav')));
  });
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.getAttribute('data-goto')));
  });

  // Filtrar cabañas a medida que el usuario escribe en la barra de busqueda
  document.getElementById('search-cabanas').addEventListener('input', renderCabanasList);

  // Abrir y cancelar el formulario de cabaña
  document.getElementById('btn-open-add-cabana').addEventListener('click', openAddCabana);
  document.getElementById('btn-cancel-cabana').addEventListener('click', () => navigateTo('cabanas'));

  // Actualizar las fotos de vista previa cuando se cambia un enlace manualmente
  ['cab-foto-1', 'cab-foto-2', 'cab-foto-3'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderCabanaFormGallery);
  });

  // Boton "Agregar Imagen" que abre el selector de archivos del computador
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

  // Guardar los datos de la cabaña (tanto al crear como al editar)
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

  // Boton para agregar una mantencion dentro de la vista Editar Cabaña
  document.getElementById('btn-add-mantencion').addEventListener('click', async () => {
    if (!activeCabanaEdit) return;
    const descripcion = document.getElementById('new-mant-desc').value.trim();
    const costo = document.getElementById('new-mant-costo').value;
    const fecha = document.getElementById('new-mant-fecha').value;
    if (!descripcion || !fecha) {
      showToast('Ingresa el detalle y la fecha de la mantención');
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
    showToast('Mantención registrada');
  });

  // Boton para bloquear un rango de fechas dentro de la vista Editar Cabaña
  document.getElementById('btn-add-bloqueo').addEventListener('click', async () => {
    if (!activeCabanaEdit) return;
    const fecha_desde = document.getElementById('new-bloq-desde').value;
    const fecha_hasta = document.getElementById('new-bloq-hasta').value;
    const motivo = document.getElementById('new-bloq-motivo').value.trim();
    if (!fecha_desde || !fecha_hasta) {
      showToast('Selecciona la fecha de inicio y término del bloqueo');
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
    showToast('Fechas bloqueadas correctamente');
  });

  // Formulario para registrar un nuevo articulo en el inventario de una cabaña
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
    showToast('Artículo agregado al inventario');
  });
});


/* =========================================================
   COSTA BOUTIQUE — HOUSE MANAGEMENT
   Versión corregida y estable
   ========================================================= */

let houses = loadData();
let current = 0;
let propertyFilter = 'Todas';
let paso = 0;

const ambientes = [
  {title:"Exterior",items:["Entrada limpia","Jardín","Pileta","Parrilla","Luces"]},
  {title:"Living",items:["TV","Aroma","Almohadones","Cortinas","Piso"]},
  {title:"Cocina",items:["Heladera","Bebidas","Vajilla","Detergente","Esponja"]},
  {title:"Dormitorio Principal",items:["Cama","Toallas","Placard","Ventanas","Luz"]},
  {title:"Dormitorio 2",items:["Cama","Toallas","Placard","Ventanas","Luz"]},
  {title:"Dormitorio 3",items:["Cama","Toallas","Placard","Ventanas","Luz"]},
  {title:"Baños",items:["Inodoro","Ducha","Espejo","Papel","Jabón"]},
  {title:"Parrilla",items:["Limpia","Utensilios","Carbón"]},
  {title:"Pileta",items:["Agua","Filtro","Reposeras"]},
  {title:"Control Final",items:["Fotos","Alarma","Internet","Casa lista"]}
];

let evidencias = JSON.parse(localStorage.getItem("cb_evidencias") || "{}");
let checks = JSON.parse(localStorage.getItem("cb_checks") || "{}");
let checklistData = JSON.parse(localStorage.getItem("cb_checklists") || "{}");
let manualCasa = JSON.parse(localStorage.getItem("cb_manual") || "{}");
let manualActual = "emergencias";

/* ---------------------------------------------------------
   STORAGE
   --------------------------------------------------------- */
const HOUSE_STORAGE_KEY = 'cb_house_data';

function loadData(){
  let raw = localStorage.getItem(HOUSE_STORAGE_KEY);

  if(raw){
    try{
      const data = JSON.parse(raw);
      if(Array.isArray(data) && data.length){
        return data.map((h,i)=>({
          ...h,
          nombre: (h.nombre || h.name || h.nombreCasa || h.nombre_casa || `Casa ${i+1}`),
          lote: h.lote ?? '',
          estado: h.estado || 'Pendiente',
          checklistPorcentaje: Number.isFinite(Number(h.checklistPorcentaje))
            ? Number(h.checklistPorcentaje)
            : 0
        }));
      }
    }catch(e){
      console.warn('No se pudo leer cb_house_data. Se recrearán datos base.', e);
    }
  }

  const data = [];
  for(let i=1;i<=18;i++){
    data.push({
      id:i,
      nombre:`Casa ${i}`,
      barrio:'Golf',
      lote:'',
      capacidad:'8 huéspedes',
      wifi:'',
      obs:'',
      situacion:'Disponible',
      estado:'Pendiente',
      ingreso:'',
      rating:'-',
      checklistPorcentaje:0
    });
  }

  localStorage.setItem(HOUSE_STORAGE_KEY, JSON.stringify(data));
  return data;
}

function saveData(data){
  localStorage.setItem(HOUSE_STORAGE_KEY, JSON.stringify(data));
}

/* ---------------------------------------------------------
   ICONOS
   --------------------------------------------------------- */
function cbIcon(name){
  const icons = {
    back:`<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"></path></svg>`,
    search:`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 5 5"></path></svg>`,
    location:`<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>`,
    users:`<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"></circle><path d="M3.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5"></path><path d="M15 6.5a3 3 0 0 1 0 5.5"></path><path d="M17 14.5c2 .6 3.2 2 3.5 4.5"></path></svg>`,
    star:`<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path></svg>`,
    calendar:`<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"></rect><line x1="8" y1="3" x2="8" y2="7"></line><line x1="16" y1="3" x2="16" y2="7"></line><line x1="4" y1="9" x2="20" y2="9"></line></svg>`,
    check:`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"></rect><polyline points="8,12 11,15 17,8"></polyline></svg>`,
    alert:`<svg viewBox="0 0 24 24"><path d="M12 4 21 20H3L12 4Z"></path><line x1="12" y1="10" x2="12" y2="14"></line><circle cx="12" cy="17" r=".8"></circle></svg>`
  };
  return `<span class="cb-icon">${icons[name] || ''}</span>`;
}

/* ---------------------------------------------------------
   PHOTOS — FALLBACK
   Si photos.js existe, se utilizan sus funciones.
   Si no existe, estas funciones mantienen el módulo operativo.
   --------------------------------------------------------- */
if(typeof window.initPhotoDB !== 'function'){
  let cbPhotoDBPromise = null;

  window.initPhotoDB = function(){
    if(cbPhotoDBPromise) return cbPhotoDBPromise;

    cbPhotoDBPromise = new Promise((resolve,reject)=>{
      if(!window.indexedDB){
        resolve(null);
        return;
      }

      const request = indexedDB.open('cb_house_photos', 1);

      request.onupgradeneeded = function(event){
        const db = event.target.result;
        if(!db.objectStoreNames.contains('photos')){
          const store = db.createObjectStore('photos', {keyPath:'id', autoIncrement:true});
          store.createIndex('casa','casa',{unique:false});
        }
      };

      request.onsuccess = e => resolve(e.target.result);
      request.onerror = e => reject(e.target.error);
    });

    return cbPhotoDBPromise;
  };

  window.savePhoto = async function(file, casa, ambiente){
    try{
      const db = await window.initPhotoDB();
      if(!db){
        alert('El navegador no permite guardar fotos en este dispositivo.');
        return;
      }

      const tx = db.transaction('photos','readwrite');
      tx.objectStore('photos').add({
        casa,
        ambiente,
        nombre:file.name,
        tipo:file.type,
        blob:file,
        fecha:Date.now()
      });

      tx.oncomplete = () => {
        if(typeof window.mostrarFotos === 'function'){
          window.mostrarFotos(casa);
        }
      };
    }catch(e){
      console.error(e);
      alert('No se pudo guardar la foto.');
    }
  };

  window.obtenerPrimeraFoto = async function(casa, callback){
    try{
      const db = await window.initPhotoDB();
      if(!db){
        callback(null);
        return;
      }

      const tx = db.transaction('photos','readonly');
      const store = tx.objectStore('photos');
      const index = store.index('casa');
      const req = index.openCursor(IDBKeyRange.only(casa));

      req.onsuccess = function(e){
        const cursor = e.target.result;
        if(cursor){
          callback(URL.createObjectURL(cursor.value.blob));
        }else{
          callback(null);
        }
      };
      req.onerror = () => callback(null);
    }catch(e){
      console.warn('No se pudo leer la primera foto.', e);
      callback(null);
    }
  };

  window.mostrarFotos = async function(casa){
    const container = document.getElementById('photosContainer');
    if(!container) return;

    try{
      const db = await window.initPhotoDB();
      if(!db){
        container.innerHTML = '<div class="card">No se pueden cargar fotos en este navegador.</div>';
        return;
      }

      const tx = db.transaction('photos','readonly');
      const store = tx.objectStore('photos');
      const index = store.index('casa');
      const req = index.getAll(IDBKeyRange.only(casa));

      req.onsuccess = function(){
        const fotos = req.result || [];

        if(!fotos.length){
          container.innerHTML = 'No hay fotos.';
          return;
        }

        container.innerHTML = '';

        fotos.forEach(photo=>{
          const wrap = document.createElement('div');
          const img = document.createElement('img');
          img.src = URL.createObjectURL(photo.blob);
          img.alt = photo.ambiente || 'Foto de la casa';
          img.onclick = function(ev){
            ev.stopPropagation();
            const viewer = document.getElementById('photoViewer');
            const viewerImg = document.getElementById('photoViewerImg');
            viewerImg.src = img.src;
            viewer.style.display = 'flex';
          };

          const meta = document.createElement('div');
          meta.className = 'sub';
          meta.textContent = photo.ambiente || 'Sin ambiente';

          const del = document.createElement('div');
          del.className = 'btn';
          del.textContent = '🗑️ Eliminar';
          del.onclick = function(ev){
            ev.stopPropagation();
            if(!confirm('¿Eliminar esta foto?')) return;
            const t = db.transaction('photos','readwrite');
            t.objectStore('photos').delete(photo.id);
            t.oncomplete = () => window.mostrarFotos(casa);
          };

          wrap.appendChild(img);
          wrap.appendChild(meta);
          wrap.appendChild(del);
          container.appendChild(wrap);
        });
      };
    }catch(e){
      console.error(e);
      container.innerHTML = '<div class="card">No se pudieron cargar las fotos.</div>';
    }
  };

  window.cerrarVisorFoto = function(){
    const viewer = document.getElementById('photoViewer');
    if(viewer) viewer.style.display = 'none';
  };
}

window.initPhotoDB();

/* ---------------------------------------------------------
   NAVEGACIÓN
   --------------------------------------------------------- */
function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));

  const target = document.getElementById(id);
  if(!target) return;

  target.classList.add('active');

  const backIcon = document.getElementById('backIcon');
  if(backIcon) backIcon.innerHTML = cbIcon('back');

  if(id === 'home'){
    render();
  }
  if(id === 'photos'){
    mostrarFotos(current);
  }
}

function setPropertyFilter(filtro){
  propertyFilter = filtro;

  document.querySelectorAll('#propertyFilters button').forEach(btn=>{
    btn.classList.toggle('filter-active', btn.dataset.filter === filtro);
  });

  render();
}

/* ---------------------------------------------------------
   PROPIEDADES
   --------------------------------------------------------- */
function render(){
  const c = document.getElementById('houses');
  if(!c) return;

  c.innerHTML = '';

  const buscador = document.getElementById('searchProperty');
  const texto = buscador ? buscador.value.toLowerCase().trim() : '';

  const incidencias = JSON.parse(localStorage.getItem('cb_incidencias') || '[]');

  const casasFiltradas = houses.filter(h=>{
    const nombre = String(h.nombre || h.name || h.nombreCasa || h.nombre_casa || '').toLowerCase();
    const barrio = String(h.barrio || '').toLowerCase();
    const lote = String(h.lote || '').toLowerCase();

    const coincideTexto =
      nombre.includes(texto) ||
      barrio.includes(texto) ||
      lote.includes(texto);

    const coincideSituacion =
      propertyFilter === 'Todas' ||
      (h.situacion || 'Disponible') === propertyFilter;

    return coincideTexto && coincideSituacion;
  });

  if(!casasFiltradas.length){
    c.innerHTML = '<div class="card"><div class="sub">No se encontraron propiedades.</div></div>';
    return;
  }

  casasFiltradas.forEach(h=>{
    const i = houses.indexOf(h);

    const incidenciasCasa = incidencias.filter(
      item => item.casa === i && item.estado !== 'Resuelta'
    ).length;

    const nombre = h.nombre || h.name || h.nombreCasa || h.nombre_casa || `Casa ${i+1}`;
    const estado = h.estado || 'Pendiente';
    const porcentaje = obtenerPorcentajeChecklist(i);

    const d = document.createElement('div');
    d.className = 'card';

    d.innerHTML = `
      <div class="property-card-main">
        <div id="fotoCasa-${i}" class="property-card-photo"></div>

        <div class="property-card-content">
          <div class="property-card-header">
            <div class="property-card-title-area">
              <div class="title">${escapeHTML(nombre)}</div>

              <div class="sub">
                ${cbIcon('location')}
                <span>${escapeHTML(h.barrio || '')}${h.lote ? ', Lote ' + escapeHTML(h.lote) : ''}</span>
              </div>

              <div class="sub">
                ${cbIcon('users')}
                <span>${escapeHTML(h.capacidad || '-')} huéspedes</span>
              </div>
            </div>

            <div class="property-rating">
              ${cbIcon('star')}
              <span>${escapeHTML(h.rating || '-')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="property-card-stats">
        <div class="property-status">
          <span class="property-status-dot ${estado === 'Pendiente' ? 'pending' : estado === 'En preparación' ? 'preparing' : 'ready'}"></span>
          <span>${escapeHTML(estado)}</span>
        </div>

        <div class="property-stat">
          ${cbIcon('calendar')}
          <span>
            <small>Próximo ingreso</small>
            ${escapeHTML(h.ingreso || '-')}
          </span>
        </div>

        <div class="property-stat">
          ${cbIcon('check')}
          <span>
            <small>Checklist</small>
            ${porcentaje}%
          </span>
        </div>

        <div class="property-stat">
          ${cbIcon('alert')}
          <span>
            <small>Incidencias</small>
            ${incidenciasCasa}
          </span>
        </div>
      </div>
    `;

    window.obtenerPrimeraFoto(i, function(url){
      const contenedorFoto = document.getElementById('fotoCasa-' + i);
      if(url && contenedorFoto){
        const img = document.createElement('img');
        img.src = url;
        img.alt = nombre;
        contenedorFoto.appendChild(img);
      }
    });

    d.onclick = () => openHouse(i);
    c.appendChild(d);
  });
}

function escapeHTML(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/* ---------------------------------------------------------
   CASA
   --------------------------------------------------------- */
function openHouse(i){
  current = i;

  const h = houses[i];
  if(!h) return;

  const nombre = h.nombre || h.name || h.nombreCasa || h.nombre_casa || `Casa ${i+1}`;
  const incidencias = JSON.parse(localStorage.getItem('cb_incidencias') || '[]');
  const incidenciasCasa = incidencias.filter(
    item => item.casa === current && item.estado !== 'Resuelta'
  ).length;

  const checklist = obtenerPorcentajeChecklist(current);
  const estado = h.estado || 'Pendiente';

  document.getElementById('houseDetailName').textContent = nombre;
  document.getElementById('houseDetailLocation').textContent =
    '📍 ' + (h.barrio || '') + (h.lote ? ' · Lote ' + h.lote : '');

  const status = document.getElementById('houseDetailStatus');
  status.innerHTML =
    '<span class="house-status-dot">●</span> ' + escapeHTML(estado);

  document.getElementById('houseDetailIngreso').textContent =
    'Próximo ingreso: ' + (h.ingreso || '-');

  document.getElementById('houseDetailChecklist').textContent =
    'Checklist: ' + checklist + '%';

  document.getElementById('houseDetailIncidencias').textContent =
    'Incidencias: ' + incidenciasCasa;

  document.getElementById('houseDetailRating').textContent =
    '★ ' + (h.rating || '-');

  const foto = document.getElementById('houseHeroPhoto');
  foto.innerHTML = '';

  window.obtenerPrimeraFoto(current,function(url){
    if(url){
      const img = document.createElement('img');
      img.src = url;
      img.alt = nombre;
      foto.appendChild(img);
    }
  });

  go('property');
}

/* ---------------------------------------------------------
   INFORMACIÓN GENERAL
   --------------------------------------------------------- */
function openInfoGeneral(){
  const h = houses[current];
  if(!h) return;

  document.getElementById('infoNombre').value = h.nombre || h.name || h.nombreCasa || h.nombre_casa || '';
  document.getElementById('infoDireccion').value = h.direccion || '';
  document.getElementById('infoPropietario').value = h.propietario || '';
  document.getElementById('infoTelefono').value = h.telefono || '';
  document.getElementById('infoCapacidad').value = h.capacidad || '';
  document.getElementById('infoHabitaciones').value = h.habitaciones || '';
  document.getElementById('infoBanios').value = h.banios || '';
  document.getElementById('infoWifi').value = h.wifi || '';
  document.getElementById('infoAlarma').value = h.alarma || '';
  document.getElementById('infoObservaciones').value = h.obs || '';

  go('infoGeneral');
}

function guardarInfoGeneral(){
  const h = houses[current];
  if(!h) return;

  h.nombre = document.getElementById('infoNombre').value.trim();
  h.name = h.nombre;
  h.nombreCasa = h.nombre;
  h.nombre_casa = h.nombre;
  h.direccion = document.getElementById('infoDireccion').value.trim();
  h.propietario = document.getElementById('infoPropietario').value.trim();
  h.telefono = document.getElementById('infoTelefono').value.trim();
  h.capacidad = document.getElementById('infoCapacidad').value.trim();
  h.habitaciones = document.getElementById('infoHabitaciones').value.trim();
  h.banios = document.getElementById('infoBanios').value.trim();
  h.wifi = document.getElementById('infoWifi').value.trim();
  h.alarma = document.getElementById('infoAlarma').value.trim();
  h.obs = document.getElementById('infoObservaciones').value.trim();

  saveData(houses);
  openHouse(current);
}

/* ---------------------------------------------------------
   INVENTARIO
   --------------------------------------------------------- */
function openInventario(){
  const lista = document.getElementById('listaInventario');
  if(!lista) return;

  const key = 'c' + current + '_inventario';
  const inventario = JSON.parse(localStorage.getItem('cb_inventario') || '{}');
  const items = inventario[key] || [];

  go('inventario');

  if(items.length === 0){
    lista.innerHTML = `
      <div class="card">
        <b>📦 No hay elementos cargados</b>
        <div class="sub">Todavía no cargaste el inventario de esta casa.</div>
      </div>
    `;
    return;
  }

  lista.innerHTML = '';

  items.forEach(item=>{
    lista.innerHTML += `
      <div class="card">
        <div class="title">📦 ${escapeHTML(item.nombre)}</div>
        <div class="sub">
          ${item.control === 'danado' ? '🟠 Dañado' : item.control === 'falta' ? '🔴 Falta' : '🟢 Está'}
        </div>
      </div>
    `;
  });
}

function nuevoItemInventario(){
  const nombre = prompt('¿Qué elemento querés agregar al inventario?');
  if(!nombre || !nombre.trim()) return;

  const key = 'c' + current + '_inventario';
  const inventario = JSON.parse(localStorage.getItem('cb_inventario') || '{}');

  if(!inventario[key]) inventario[key] = [];

  inventario[key].push({
    nombre:nombre.trim(),
    presente:true,
    control:'presente'
  });

  localStorage.setItem('cb_inventario',JSON.stringify(inventario));
  openInventario();
}

function iniciarControlInventario(){
  const key = 'c' + current + '_inventario';
  const inventario = JSON.parse(localStorage.getItem('cb_inventario') || '{}');
  const items = inventario[key] || [];

  if(items.length === 0){
    alert('Esta casa todavía no tiene elementos cargados en el inventario.');
    return;
  }

  items.forEach(item=>{
    if(!item.control) item.control='presente';
  });

  inventario[key] = items;
  localStorage.setItem('cb_inventario',JSON.stringify(inventario));
  renderControlInventario();
}

function renderControlInventario(){
  const lista = document.getElementById('listaInventario');
  if(!lista) return;

  const key = 'c' + current + '_inventario';
  const inventario = JSON.parse(localStorage.getItem('cb_inventario') || '{}');
  const items = inventario[key] || [];

  go('inventario');

  lista.innerHTML = `
    <div class="card">
      <b>🔎 Control de salida</b>
      <div class="sub">Revisá cada elemento y marcá si está, falta o está dañado.</div>
    </div>
  `;

  items.forEach((item,index)=>{
    const estado = item.control || 'presente';

    lista.innerHTML += `
      <div class="card">
        <div class="title">📦 ${escapeHTML(item.nombre)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
          <button onclick="cambiarEstadoInventario(${index},'presente')" ${estado === 'presente' ? 'style="font-weight:700;"' : ''}>🟢 Está</button>
          <button onclick="cambiarEstadoInventario(${index},'falta')" ${estado === 'falta' ? 'style="font-weight:700;"' : ''}>🔴 Falta</button>
          <button onclick="cambiarEstadoInventario(${index},'danado')" ${estado === 'danado' ? 'style="font-weight:700;"' : ''}>🟠 Dañado</button>
        </div>
      </div>
    `;
  });
}

function cambiarEstadoInventario(index,estado){
  const key = 'c' + current + '_inventario';
  const inventario = JSON.parse(localStorage.getItem('cb_inventario') || '{}');

  if(!inventario[key] || !inventario[key][index]) return;

  inventario[key][index].control = estado;
  localStorage.setItem('cb_inventario',JSON.stringify(inventario));
  renderControlInventario();
}

/* ---------------------------------------------------------
   INCIDENCIAS
   --------------------------------------------------------- */
function openIncidencias(){
  const lista = document.getElementById('listaIncidencias');
  if(!lista) return;

  const incidencias = JSON.parse(localStorage.getItem('cb_incidencias') || '[]');

  const incidenciasCasa = incidencias
    .map((incidencia,index)=>({incidencia,index}))
    .filter(item=>item.incidencia.casa === current);

  if(incidenciasCasa.length === 0){
    lista.innerHTML = `
      <div class="card">
        <b>🚨 No hay incidencias registradas</b>
        <div class="sub">Esta casa no tiene incidencias registradas.</div>
      </div>
    `;
  }else{
    lista.innerHTML = '';

    incidenciasCasa.forEach(item=>{
      const incidencia = item.incidencia;
      const indice = item.index;

      const prioridadIcono =
        incidencia.prioridad === 'Alta' ? '🔴' :
        incidencia.prioridad === 'Media' ? '🟡' : '🟢';

      const estadoIcono =
        incidencia.estado === 'Resuelta' ? '🟢' :
        incidencia.estado === 'En curso' ? '🟡' : '🔴';

      lista.innerHTML += `
        <div class="card">
          <div class="title">🚨 ${escapeHTML(incidencia.ambiente || 'Sin ambiente')}</div>
          <div class="sub">${escapeHTML(incidencia.descripcion || '')}</div>
          <div class="sub">${prioridadIcono} Prioridad: ${escapeHTML(incidencia.prioridad || '')}</div>
          <div class="sub">${estadoIcono} Estado: ${escapeHTML(incidencia.estado || '')}</div>
          <div class="sub">👤 ${escapeHTML(incidencia.responsable || 'Sin responsable')}</div>
          <div class="sub">📅 ${escapeHTML(incidencia.fecha || '')}</div>
          <div class="btn" onclick="cambiarEstadoIncidencia(${indice})">🔄 Cambiar estado</div>
        </div>
      `;
    });
  }

  const form = document.getElementById('formIncidencia');
  if(form) form.style.display = 'none';

  go('incidencias');
}

function nuevaIncidencia(){
  const form = document.getElementById('formIncidencia');
  if(!form) return;

  form.style.display = 'block';
  document.getElementById('incAmbiente').value = '';
  document.getElementById('incDescripcion').value = '';
  document.getElementById('incPrioridad').value = 'Media';
  document.getElementById('incEstado').value = 'Abierta';
  document.getElementById('incResponsable').value = '';
}

function guardarIncidencia(){
  const incidencia = {
    casa:current,
    ambiente:document.getElementById('incAmbiente').value,
    descripcion:document.getElementById('incDescripcion').value.trim(),
    prioridad:document.getElementById('incPrioridad').value,
    estado:document.getElementById('incEstado').value,
    responsable:document.getElementById('incResponsable').value.trim(),
    fecha:new Date().toLocaleDateString('es-AR')
  };

  const incidencias = JSON.parse(localStorage.getItem('cb_incidencias') || '[]');
  incidencias.push(incidencia);
  localStorage.setItem('cb_incidencias',JSON.stringify(incidencias));

  alert('Incidencia guardada');
  openIncidencias();
}

function cambiarEstadoIncidencia(indice){
  const incidencias = JSON.parse(localStorage.getItem('cb_incidencias') || '[]');
  const incidencia = incidencias[indice];
  if(!incidencia) return;

  if(incidencia.estado === 'Abierta'){
    incidencia.estado = 'En curso';
  }else if(incidencia.estado === 'En curso'){
    incidencia.estado = 'Resuelta';
  }else{
    incidencia.estado = 'Abierta';
  }

  localStorage.setItem('cb_incidencias',JSON.stringify(incidencias));
  openIncidencias();
}

/* ---------------------------------------------------------
   MANUAL
   --------------------------------------------------------- */
function abrirManualCasa(){
  const tipos = ['emergencias','accesos','tecnologia','exterior','blancos','proveedores'];

  tipos.forEach(tipo=>{
    const id = 'txt' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const el = document.getElementById(id);
    if(el){
      el.innerText = manualCasa['c' + current + '_' + tipo] || 'No hay información.';
    }
  });

  go('manual');
}

function abrirManual(tipo){
  const clave = 'c' + current + '_' + tipo;
  manualActual = tipo;

  document.getElementById('manualTitulo').innerText =
    tipo.charAt(0).toUpperCase() + tipo.slice(1);

  document.getElementById('manualTexto').value =
    manualCasa[clave] || '';

  go('manualEdit');
}

function guardarManual(){
  const clave = 'c' + current + '_' + manualActual;

  manualCasa[clave] = document.getElementById('manualTexto').value;
  localStorage.setItem('cb_manual',JSON.stringify(manualCasa));

  abrirManualCasa();
}

/* ---------------------------------------------------------
   EDICIÓN DE CASA
   --------------------------------------------------------- */
function editCurrent(){
  const h = houses[current];
  if(!h) return;

  document.getElementById('name').value = h.nombre || h.name || h.nombreCasa || h.nombre_casa || '';
  document.getElementById('barrio').value = h.barrio || '';
  document.getElementById('lote').value = h.lote || '';
  document.getElementById('capacidad').value = h.capacidad || '';
  document.getElementById('wifi').value = h.wifi || '';
  document.getElementById('obs').value = h.obs || '';
  document.getElementById('situacion').value = h.situacion || 'Disponible';

  go('edit');
}

function saveCurrent(){
  const h = houses[current];
  if(!h) return;

  h.nombre = document.getElementById('name').value.trim();
  h.name = h.nombre;
  h.nombreCasa = h.nombre;
  h.nombre_casa = h.nombre;
  h.barrio = document.getElementById('barrio').value.trim();
  h.lote = document.getElementById('lote').value.trim();
  h.capacidad = document.getElementById('capacidad').value.trim();
  h.wifi = document.getElementById('wifi').value.trim();
  h.obs = document.getElementById('obs').value.trim();
  h.situacion = document.getElementById('situacion').value;

  saveData(houses);
  render();
  openHouse(current);
}

/* ---------------------------------------------------------
   CHECKLIST
   --------------------------------------------------------- */
function getChecklistForHouse(houseIndex){
  const key = 'c' + houseIndex;

  if(!checklistData[key]){
    checklistData[key] = JSON.parse(JSON.stringify(ambientes));
    localStorage.setItem('cb_checklists',JSON.stringify(checklistData));
  }

  return checklistData[key];
}

function ensureChecklist(){
  return getChecklistForHouse(current);
}

function startPreparation(){
  paso = 0;
  renderPrep();
  go('prep');
}

function renderPrep(){
  const lista = getChecklistForHouse(current);
  const env = lista[paso];

  if(!env){
    go('property');
    return;
  }

  const key = 'c' + current + '_' + paso;
  const observaciones = JSON.parse(localStorage.getItem('cb_observaciones') || '{}');
  const obsKey = 'c' + current + '_' + paso;

  if(!Array.isArray(checks[key]) || checks[key].length !== env.items.length){
    const old = Array.isArray(checks[key]) ? checks[key] : [];
    checks[key] = env.items.map((_,i)=>old[i] === true);
    localStorage.setItem('cb_checks',JSON.stringify(checks));
  }

  document.getElementById('prepTitle').textContent = env.title;

  const checklistEl = document.getElementById('checklist');
  checklistEl.innerHTML = '';

  env.items.forEach((item,i)=>{
    const label = document.createElement('label');
    label.className = 'chk';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checks[key][i] === true;

    input.addEventListener('change',function(){
      checks[key][i] = input.checked;
      localStorage.setItem('cb_checks',JSON.stringify(checks));
      actualizarEstadoCasa();
      render();
    });

    const span = document.createElement('span');
    span.textContent = item;

    label.appendChild(input);
    label.appendChild(span);
    checklistEl.appendChild(label);
  });

  const obsWrap = document.createElement('div');
  obsWrap.style.marginTop = '20px';
  obsWrap.innerHTML = '<b>📝 Observaciones</b>';

  const textarea = document.createElement('textarea');
  textarea.id = 'obsPrep';
  textarea.style.width = '100%';
  textarea.style.height = '90px';
  textarea.style.marginTop = '8px';
  textarea.value = observaciones[obsKey] || '';

  obsWrap.appendChild(textarea);
  checklistEl.appendChild(obsWrap);

  const progress = document.getElementById('progressBar');
  if(progress){
    progress.style.width = ((paso + 1) / lista.length * 100) + '%';
  }
}

function obtenerPorcentajeChecklist(houseIndex){
  const lista = getChecklistForHouse(houseIndex);
  const checksActuales = JSON.parse(localStorage.getItem('cb_checks') || '{}');

  let totalChecks = 0;
  let checksCompletados = 0;

  lista.forEach((ambiente,ambienteIndex)=>{
    const key = 'c' + houseIndex + '_' + ambienteIndex;

    ambiente.items.forEach((_,itemIndex)=>{
      totalChecks++;

      if(
        checksActuales[key] &&
        checksActuales[key][itemIndex] === true
      ){
        checksCompletados++;
      }
    });
  });

  if(totalChecks === 0) return 0;

  return Math.round((checksCompletados / totalChecks) * 100);
}

function actualizarEstadoCasa(){
  const house = houses[current];
  if(!house) return;

  const lista = getChecklistForHouse(current);
  const checksActuales = JSON.parse(localStorage.getItem('cb_checks') || '{}');

  let totalChecks = 0;
  let checksCompletados = 0;

  lista.forEach((ambiente,ambienteIndex)=>{
    const key = 'c' + current + '_' + ambienteIndex;

    ambiente.items.forEach((_,itemIndex)=>{
      totalChecks++;

      if(
        checksActuales[key] &&
        checksActuales[key][itemIndex] === true
      ){
        checksCompletados++;
      }
    });
  });

  house.checklistPorcentaje = totalChecks
    ? Math.round((checksCompletados / totalChecks) * 100)
    : 0;

  if(checksCompletados === 0){
    house.estado = 'Pendiente';
  }else if(checksCompletados < totalChecks){
    house.estado = 'En preparación';
  }else{
    house.estado = 'Lista para entregar';
  }

  saveData(houses);
}

function actualizarEstadosTodasLasCasas(){
  houses.forEach((_,houseIndex)=>{
    const lista = getChecklistForHouse(houseIndex);
    const checksActuales = JSON.parse(localStorage.getItem('cb_checks') || '{}');

    let totalChecks = 0;
    let checksCompletados = 0;

    lista.forEach((ambiente,ambienteIndex)=>{
      const key = 'c' + houseIndex + '_' + ambienteIndex;

      ambiente.items.forEach((_,itemIndex)=>{
        totalChecks++;

        if(
          checksActuales[key] &&
          checksActuales[key][itemIndex] === true
        ){
          checksCompletados++;
        }
      });
    });

    houses[houseIndex].checklistPorcentaje = totalChecks
      ? Math.round((checksCompletados / totalChecks) * 100)
      : 0;

    if(checksCompletados === 0){
      houses[houseIndex].estado = 'Pendiente';
    }else if(checksCompletados < totalChecks){
      houses[houseIndex].estado = 'En preparación';
    }else{
      houses[houseIndex].estado = 'Lista para entregar';
    }
  });

  saveData(houses);
}

function nextStep(){
  const observaciones = JSON.parse(localStorage.getItem('cb_observaciones') || '{}');
  const obs = document.getElementById('obsPrep');

  if(obs){
    observaciones['c' + current + '_' + paso] = obs.value;
    localStorage.setItem('cb_observaciones',JSON.stringify(observaciones));
  }

  if(paso < getChecklistForHouse(current).length - 1){
    paso++;
    renderPrep();
  }else{
    actualizarEstadoCasa();
    render();
    go('property');
  }
}

/* ---------------------------------------------------------
   EDITOR CHECKLIST
   --------------------------------------------------------- */
function openChecklistEditor(){
  const sel = document.getElementById('ambienteSel');
  if(!sel) return;

  sel.innerHTML = '';

  ensureChecklist().forEach((a,i)=>{
    sel.innerHTML += `<option value="${i}">${escapeHTML(a.title)}</option>`;
  });

  loadChecklistEditor();
  go('editChecklist');
}

function loadChecklistEditor(){
  const data = ensureChecklist();
  const idx = parseInt(document.getElementById('ambienteSel').value || 0,10);
  const box = document.getElementById('items');
  if(!box || !data[idx]) return;

  box.innerHTML = '';

  data[idx].items.forEach((text,i)=>{
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.style.margin = '4px 0';

    const input = document.createElement('input');
    input.value = text;
    input.onchange = () => editItem(idx,i,input.value);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '🗑️';
    button.onclick = () => delItem(idx,i);

    row.appendChild(input);
    row.appendChild(button);
    box.appendChild(row);
  });
}

function editItem(a,i,v){
  const data = ensureChecklist();
  if(!data[a] || data[a].items[i] === undefined) return;

  data[a].items[i] = v;
  checklistData['c' + current] = data;
  localStorage.setItem('cb_checklists',JSON.stringify(checklistData));
  actualizarEstadoCasa();
}

function delItem(a,i){
  const data = ensureChecklist();
  if(!data[a]) return;

  data[a].items.splice(i,1);
  checklistData['c' + current] = data;
  localStorage.setItem('cb_checklists',JSON.stringify(checklistData));
  loadChecklistEditor();
  actualizarEstadoCasa();
}

function addItem(){
  const a = parseInt(document.getElementById('ambienteSel').value || 0,10);
  const input = document.getElementById('nuevoItem');
  const value = input ? input.value.trim() : '';

  if(!value) return;

  const data = ensureChecklist();
  if(!data[a]) return;

  data[a].items.push(value);
  checklistData['c' + current] = data;
  localStorage.setItem('cb_checklists',JSON.stringify(checklistData));

  if(input) input.value = '';

  loadChecklistEditor();
  actualizarEstadoCasa();
}

/* ---------------------------------------------------------
   FOTOS
   --------------------------------------------------------- */
function openPhotos(){
  go('photos');
}

function saveSelectedPhoto(){
  const input = document.getElementById('photoInput');
  const ambiente = document.getElementById('photoAmbiente').value;

  if(!input || !input.files || !input.files.length){
    alert('Seleccioná una foto primero.');
    return;
  }

  window.savePhoto(input.files[0],current,ambiente);
  input.value = '';
  setTimeout(()=>window.mostrarFotos(current),300);
}

function cerrarVisorFoto(){
  if(typeof window.cerrarVisorFoto === 'function'){
    window.cerrarVisorFoto();
  }else{
    const viewer = document.getElementById('photoViewer');
    if(viewer) viewer.style.display = 'none';
  }
}

/* ---------------------------------------------------------
   INICIO
   --------------------------------------------------------- */
actualizarEstadosTodasLasCasas();
render();

document.addEventListener('keydown',function(event){
  if(event.key === 'Escape'){
    cerrarVisorFoto();
  }
});

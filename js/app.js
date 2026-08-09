let houses=loadData(),current=0;
let propertyFilter='Todas';
function setPropertyFilter(filtro){
    propertyFilter = filtro;
    render();
}
initPhotoDB();
function go(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    if(id === 'home'){
        render();
    }
}

function render(){

    const c = document.getElementById('houses');
    c.innerHTML = '';

    const buscador = document.getElementById('searchProperty');
    const texto = buscador ? buscador.value.toLowerCase().trim() : '';

    const casasFiltradas = houses.filter(h => {

    const nombre = (h.nombre || '').toLowerCase();
    const barrio = (h.barrio || '').toLowerCase();
    const lote = (h.lote || '').toLowerCase();

    const coincideTexto =
        nombre.includes(texto) ||
        barrio.includes(texto) ||
        lote.includes(texto);

    const coincideSituacion =
        propertyFilter === 'Todas' ||
        (h.situacion || 'Disponible') === propertyFilter;

    return coincideTexto && coincideSituacion;
});

casasFiltradas.forEach((h)=>{
    const i = houses.indexOf(h);
    const incidencias = JSON.parse(localStorage.getItem('cb_incidencias') || '[]');

const incidenciasCasa = incidencias.filter(
    item => item.casa === i
).length;

    const d=document.createElement('div');

   d.className = 'card';

d.style.display = window.innerWidth <= 600 ? "block" : "flex";
d.style.alignItems = "flex-start";
d.style.gap = "20px";

d.innerHTML = `

    <!-- COLUMNA IZQUIERDA -->
    <div style="
        width:130px;
        flex-shrink:0;
    ">

        <!-- ESPACIO PARA FOTO -->
        <div
            id="fotoCasa-${i}"
            style="
                width:110px;
                height:80px;
                border-radius:8px;
                background:#f2f2f2;
                overflow:hidden;
                margin-bottom:10px;
            "
        ></div>

        <!-- DATOS DE LA CASA -->
        <div class="title">
            ${h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? ('Casa ' + (i+1))}
        </div>

        <div class="sub">
            📍 ${h.barrio ?? ''}
        </div>

        <div class="sub">
            Lote ${h.lote ?? ''}
        </div>

    </div>


    <!-- COLUMNA DERECHA -->
    <div style="
        flex:1;
        padding-top:10px;
    ">

        <!-- PRIMERA LINEA -->
        <div style="
            display:flex;
            align-items:center;
            gap:30px;
            margin-bottom:25px;
        ">

            <div class="badge">
                ${h.estado === "Pendiente"
                    ? "🔴"
                    : h.estado === "En preparación"
                        ? "🟡"
                        : "🟢"
                }
                ${h.estado ?? "Pendiente"}
            </div>

            <div class="sub">
                👥 Próximo ingreso: ${h.ingreso ?? '-'}
            </div>

            <div class="sub">
                ⭐ ${h.rating ?? '-'}
            </div>

        </div>


        <!-- SEGUNDA LINEA -->
        <div style="
            display:flex;
            align-items:center;
            gap:30px;
        ">

            <div class="sub">
                ☑️ Checklist: ${h.checklistPorcentaje ?? 0}%
            </div>

            <div class="sub">
                ⚠️ Incidencias: ${incidenciasCasa}
            </div>

        </div>

    </div>
`;

if (window.innerWidth <= 600) {

    const izquierda = d.children[0];
    const derecha = d.children[1];

    izquierda.style.display = "grid";
    izquierda.style.gridTemplateColumns = "100px 1fr";
    izquierda.style.columnGap = "12px";
    izquierda.style.width = "100%";

    const foto = izquierda.children[0];

    foto.style.gridColumn = "1";
    foto.style.gridRow = "1 / span 3";
    foto.style.width = "100px";
    foto.style.height = "75px";
    foto.style.marginBottom = "0";

    izquierda.querySelectorAll(".title, .sub").forEach(elemento => {
        elemento.style.gridColumn = "2";
    });

    derecha.style.width = "100%";
    derecha.style.paddingTop = "15px";

    Array.from(derecha.children).forEach(fila => {
        fila.style.display = "contents";
    });

    derecha.querySelectorAll(".badge, .sub").forEach(elemento => {
        elemento.style.display = "block";
        elemento.style.marginBottom = "8px";
    });
}

obtenerPrimeraFoto(i, function(url) {

    const contenedorFoto =
        document.getElementById("fotoCasa-" + i);

    if (url && contenedorFoto) {

        const img = document.createElement("img");

        img.src = url;

        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";

        contenedorFoto.appendChild(img);
    }

});


d.onclick = () => openHouse(i);

c.appendChild(d);
});
}
function openPhotos(){

    go("photos");

    mostrarFotos(current);
}

function saveSelectedPhoto(){

    const input = document.getElementById("photoInput");
    const ambiente = document.getElementById("photoAmbiente").value;

    if(!input.files.length){
        alert("Seleccioná una foto primero.");
        return;
    }

    const file = input.files[0];

    savePhoto(file, current, ambiente);

    setTimeout(function(){
        mostrarFotos(current);
    }, 300);

    input.value = "";
}

function openHouse(i){
    current=i;
    let h=houses[i];

    document.getElementById('title').textContent=(h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? ('Casa '+(current+1)));

    summary.innerHTML=`<div class="card"><b>📍 Barrio:</b> ${h.barrio}<br><b>🏠 Lote:</b> ${h.lote}<br><b>👥 Capacidad:</b> ${h.capacidad}<br><b>📶 WiFi:</b> ${h.wifi}<br><b>📝 Obs:</b> ${h.obs||'-'}</div>`;

    go("property");
}

function openInfoGeneral(){

    const h = houses[current];

    document.getElementById('infoNombre').value =
        h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? '';

    document.getElementById('infoDireccion').value =
        h.direccion ?? '';

    document.getElementById('infoPropietario').value =
        h.propietario ?? '';

    document.getElementById('infoTelefono').value =
        h.telefono ?? '';

    document.getElementById('infoCapacidad').value =
        h.capacidad ?? '';

    document.getElementById('infoHabitaciones').value =
        h.habitaciones ?? '';

    document.getElementById('infoBanios').value =
        h.banios ?? '';

    document.getElementById('infoWifi').value =
        h.wifi ?? '';

    document.getElementById('infoAlarma').value =
        h.alarma ?? '';

    document.getElementById('infoObservaciones').value =
        h.obs ?? '';

    go('infoGeneral');
}

function openInventario(){

    go('inventario');

    const lista = document.getElementById('listaInventario');

    const key = "c" + current + "_inventario";

    let inventario = JSON.parse(
        localStorage.getItem("cb_inventario") || "{}"
    );

    const items = inventario[key] || [];

    if(items.length === 0){

        lista.innerHTML = `
            <div class="card">
                <b>📦 No hay elementos cargados</b>
                <div class="sub">
                    Todavía no cargaste el inventario de esta casa.
                </div>
            </div>
        `;

        return;
    }

    lista.innerHTML = "";

    items.forEach((item, index) => {

        lista.innerHTML += `
            <div class="card">

                <div class="title">
                    📦 ${item.nombre}
                </div>

                <div class="sub">
${item.control === "danado" ? "🟠 Dañado" : item.control === "falta" ? "🔴 Falta" : "🟢 Está"}
                </div>

            </div>
        `;

    });
}

function nuevoItemInventario(){
    const nombre = prompt("¿Qué elemento querés agregar al inventario?");
    
    if(!nombre || !nombre.trim()) return;

    const key = "c" + current + "_inventario";

    let inventario = JSON.parse(
        localStorage.getItem("cb_inventario") || "{}"
    );

    if(!inventario[key]){
        inventario[key] = [];
    }

    inventario[key].push({
        nombre: nombre.trim(),
        presente: true
    });

    localStorage.setItem(
        "cb_inventario",
        JSON.stringify(inventario)
    );

    openInventario();
}

function iniciarControlInventario(){

    const key = "c" + current + "_inventario";

    let inventario = JSON.parse(
        localStorage.getItem("cb_inventario") || "{}"
    );

    const items = inventario[key] || [];

    if(items.length === 0){
        alert("Esta casa todavía no tiene elementos cargados en el inventario.");
        return;
    }

items.forEach(item => {
    if (!item.control) {
        item.control = "presente";
    }
});

    inventario[key] = items;

    localStorage.setItem(
        "cb_inventario",
        JSON.stringify(inventario)
    );

    renderControlInventario();
}

function renderControlInventario(){

    const lista = document.getElementById('listaInventario');

    const key = "c" + current + "_inventario";

    let inventario = JSON.parse(
        localStorage.getItem("cb_inventario") || "{}"
    );

    const items = inventario[key] || [];

    lista.innerHTML = `
        <div class="card">
            <b>🔎 Control de salida</b>
            <div class="sub">
                Revisá cada elemento y marcá si está, falta o está dañado.
            </div>
        </div>
    `;

    items.forEach((item, index) => {

        const estado = item.control || "presente";

        lista.innerHTML += `
            <div class="card">

                <div class="title">
                    📦 ${item.nombre}
                </div>

                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">

                    <button onclick="cambiarEstadoInventario(${index}, 'presente')"
                        ${estado === 'presente' ? 'style="font-weight:bold;"' : ''}>
                        🟢 Está
                    </button>

                    <button onclick="cambiarEstadoInventario(${index}, 'falta')"
                        ${estado === 'falta' ? 'style="font-weight:bold;"' : ''}>
                        🔴 Falta
                    </button>

                    <button onclick="cambiarEstadoInventario(${index}, 'danado')"
                        ${estado === 'danado' ? 'style="font-weight:bold;"' : ''}>
                        🟠 Dañado
                    </button>

                </div>

            </div>
        `;
    });
}

function cambiarEstadoInventario(index, estado){

    const key = "c" + current + "_inventario";

    let inventario = JSON.parse(
        localStorage.getItem("cb_inventario") || "{}"
    );

    if(!inventario[key] || !inventario[key][index]) return;

    inventario[key][index].control = estado;

    localStorage.setItem(
        "cb_inventario",
        JSON.stringify(inventario)
    );

    renderControlInventario();
}

function openIncidencias(){

    const lista = document.getElementById('listaIncidencias');

    let incidencias = JSON.parse(
        localStorage.getItem('cb_incidencias') || '[]'
    );

    const incidenciasCasa = incidencias
        .map((incidencia, index) => ({
            incidencia,
            index
        }))
        .filter(item => item.incidencia.casa === current);

    if(incidenciasCasa.length === 0){

        lista.innerHTML = `
            <div class="card">
                <b>🚨 No hay incidencias registradas</b>
                <div class="sub">
                    Esta casa no tiene incidencias pendientes.
                </div>
            </div>
        `;

    } else {

        lista.innerHTML = '';

        incidenciasCasa.forEach(item => {

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

                    <div class="title">
                        🚨 ${incidencia.ambiente || 'Sin ambiente'}
                    </div>

                    <div class="sub">
                        ${incidencia.descripcion}
                    </div>

                    <div class="sub">
                        ${prioridadIcono}
                        Prioridad: ${incidencia.prioridad}
                    </div>

                    <div class="sub">
                        ${estadoIcono}
                        Estado: ${incidencia.estado}
                    </div>

                    <div class="sub">
                        👤 ${incidencia.responsable || 'Sin responsable'}
                    </div>

                    <div class="sub">
                        📅 ${incidencia.fecha}
                    </div>

                    <div class="btn"
                         onclick="cambiarEstadoIncidencia(${indice})">
                        🔄 Cambiar estado
                    </div>

                </div>
            `;
        });
    }
    go('incidencias');
}
 
function cambiarEstadoIncidencia(indice){

    let incidencias = JSON.parse(
        localStorage.getItem('cb_incidencias') || '[]'
    );

    const incidencia = incidencias[indice];

    if(!incidencia) return;

    if(incidencia.estado === 'Abierta'){

        incidencia.estado = 'En curso';

    } else if(incidencia.estado === 'En curso'){

        incidencia.estado = 'Resuelta';

    } else {

        incidencia.estado = 'Abierta';

    }

    localStorage.setItem(
        'cb_incidencias',
        JSON.stringify(incidencias)
    );

    openIncidencias();
}

    document.getElementById('formIncidencia').style.display='none';

function nuevaIncidencia(){

    document.getElementById('formIncidencia').style.display='block';

    document.getElementById('incAmbiente').value='';
    document.getElementById('incDescripcion').value='';
    document.getElementById('incPrioridad').value='Media';
    document.getElementById('incEstado').value='Abierta';
    document.getElementById('incResponsable').value='';
}

function guardarIncidencia(){

    const incidencia = {
        casa: current,
        ambiente: document.getElementById('incAmbiente').value,
        descripcion: document.getElementById('incDescripcion').value,
        prioridad: document.getElementById('incPrioridad').value,
        estado: document.getElementById('incEstado').value,
        responsable: document.getElementById('incResponsable').value,
        fecha: new Date().toLocaleDateString()
    };

    let incidencias = JSON.parse(
        localStorage.getItem('cb_incidencias') || '[]'
    );

    incidencias.push(incidencia);

    localStorage.setItem(
        'cb_incidencias',
        JSON.stringify(incidencias)
    );

    alert('Incidencia guardada');

    document.getElementById('formIncidencia').style.display='none';

    openIncidencias();
}

console.log("LLEGUE A abrirManualCasa");
function abrirManualCasa(){

    document.getElementById("txtEmergencias").innerText =
        manualCasa["c"+current+"_emergencias"] || "No hay información.";

    document.getElementById("txtAccesos").innerText =
        manualCasa["c"+current+"_accesos"] || "No hay información.";

    const t = document.getElementById("txtTecnologia");

console.log("Tecnologia =", t);

if (t) {
    t.innerText =
        manualCasa["c"+current+"_tecnologia"] || "No hay información.";
}
const e = document.getElementById("txtExterior");
if (e) {
    e.innerText = manualCasa["c"+current+"_exterior"] || "No hay información.";
}

const b = document.getElementById("txtBlancos");
if (b) {
    b.innerText = manualCasa["c"+current+"_blancos"] || "No hay información.";
}

const p = document.getElementById("txtProveedores");
if (p) {
    p.innerText = manualCasa["c"+current+"_proveedores"] || "No hay información.";
}
    go("manual");
}
function editCurrent(){let h=houses[current];
document.getElementById('name').value=(h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? '');document.getElementById('barrio').value=h.barrio;document.getElementById('lote').value=h.lote||'';document.getElementById('capacidad').value=h.capacidad;document.getElementById('wifi').value=h.wifi;document.getElementById('obs').value=h.obs;document.getElementById('situacion').value=h.situacion || 'Disponible';go('edit');}
function saveCurrent(){let h=houses[current];
h.nombre=document.getElementById('name').value; h.name=document.getElementById('name').value; h.nombreCasa=document.getElementById('name').value; h.nombre_casa=document.getElementById('name').value;h.barrio=document.getElementById('barrio').value;h.lote=document.getElementById('lote').value;h.capacidad=document.getElementById('capacidad').value;h.wifi=document.getElementById('wifi').value;h.obs=document.getElementById('obs').value;h.situacion=document.getElementById('situacion').value;
saveData(houses);document.getElementById('title').textContent=h.nombre;render();openHouse(current);}
render();

const ambientes=[
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

actualizarEstadosTodasLasCasas();
render();

let paso = 0;
let evidencias = JSON.parse(localStorage.getItem("cb_evidencias") || "{}");
let checks = JSON.parse(localStorage.getItem("cb_checks") || "{}");
function startPreparation(){

    console.log("CURRENT =", current);
    console.log("CHECKS =", checks);

    paso=0;
    renderPrep();
    go('prep');

}
function renderPrep(){

const env = ensureChecklist()[paso];
const key = "c"+current+"_"+paso;

let observaciones = JSON.parse(localStorage.getItem("cb_observaciones") || "{}");
const obsKey = "c" + current + "_" + paso;

if(!checks[key]){
    checks[key] = new Array(env.items.length).fill(false);
}

prepTitle.innerHTML = env.title;

checklist.innerHTML = "";

env.items.forEach((c,i)=>{

    const marcado = checks[key][i] ? "checked" : "";

    checklist.innerHTML += `
    <label class="chk">
       <input type="checkbox" ${marcado}
    onchange="
        checks['${key}'][${i}] = this.checked;
        localStorage.setItem('cb_checks', JSON.stringify(checks));
        actualizarEstadoCasa();
    "
>
        <span>${c}</span>
    </label>`;
});

progressBar.style.width=((paso+1)/ambientes.length*100)+"%";

checklist.innerHTML += `

<div style="margin-top:20px">

<b>📝 Observaciones</b>

<textarea
id="obsPrep"
style="width:100%;height:90px;margin-top:8px"

">${observaciones[obsKey]||""}</textarea>

</div>
`;

}

function obtenerPorcentajeChecklist(houseIndex) {

    const checksActuales = JSON.parse(
        localStorage.getItem('cb_checks') || '{}'
    );

    let totalChecks = 0;
    let checksCompletados = 0;

    ambientes.forEach((ambiente, ambienteIndex) => {

        const key = "c" + houseIndex + "_" + ambienteIndex;

        ambiente.items.forEach((item, itemIndex) => {

            totalChecks++;

            if (
                checksActuales[key] &&
                checksActuales[key][itemIndex] === true
            ) {
                checksCompletados++;
            }

        });

    });

    if (totalChecks === 0) {
        return 0;
    }

    return Math.round(
        (checksCompletados / totalChecks) * 100
    );
}

function actualizarEstadoCasa() {

    const checksActuales = JSON.parse(
        localStorage.getItem("cb_checks") || "{}"
    );

    let totalChecks = 0;
    let checksCompletados = 0;

    ambientes.forEach((ambiente, i) => {

        const key = "c" + current + "_" + i;

        ambiente.items.forEach((item, j) => {

            totalChecks++;

            if (
                checksActuales[key] &&
                checksActuales[key][j] === true
            ) {
                checksCompletados++;
            }

        });

    });

    house.checklistPorcentaje = totalChecks > 0
    ? Math.round((checksCompletados / totalChecks) * 100)
    : 0;

    if (checksCompletados === 0) {

        houses[current].estado = "Pendiente";

    } else if (checksCompletados < totalChecks) {

        houses[current].estado = "En preparación";

    } else {

        houses[current].estado = "Lista para entregar";

    }

    saveData(houses);
}

function actualizarEstadosTodasLasCasas() {

    const checksActuales = JSON.parse(
        localStorage.getItem("cb_checks") || "{}"
    );

    houses.forEach((house, houseIndex) => {

        let totalChecks = 0;
        let checksCompletados = 0;

        ambientes.forEach((ambiente, ambienteIndex) => {

            const key = "c" + houseIndex + "_" + ambienteIndex;

            ambiente.items.forEach((item, itemIndex) => {

                totalChecks++;

                if (
                    checksActuales[key] &&
                    checksActuales[key][itemIndex] === true
                ) {
                    checksCompletados++;
                }

            });

        });

        if (checksCompletados === 0) {

            house.estado = "Pendiente";

        } else if (checksCompletados < totalChecks) {

            house.estado = "En preparación";

        } else {

            house.estado = "Lista para entregar";

        }

    });

    saveData(houses);
}

function nextStep(){

    const observaciones = JSON.parse(localStorage.getItem("cb_observaciones") || "{}");

const obs = document.getElementById("obsPrep");

if (obs) {
    console.log("GUARDANDO:", obs.value);
    observaciones["c" + current + "_" + paso] = obs.value;
    localStorage.setItem("cb_observaciones", JSON.stringify(observaciones));
}

    if(paso < ambientes.length-1){
        paso++;
        renderPrep();
    }
    else{
    actualizarEstadoCasa();
    render();
    go('property');
}

}

let checklistData=JSON.parse(localStorage.getItem('cb_checklists')||'{}');
function ensureChecklist(){
 const key='c'+current;
 if(!checklistData[key]){
  checklistData[key]=JSON.parse(JSON.stringify(ambientes));
  localStorage.setItem('cb_checklists',JSON.stringify(checklistData));
 }
 return checklistData[key];
}
function openChecklistEditor(){
 const sel=document.getElementById('ambienteSel');
 sel.innerHTML='';
ensureChecklist().forEach((a,i)=>{
    sel.innerHTML+=`<option value="${i}">${a.title}</option>`
});
 loadChecklistEditor(); go('editChecklist');
}
function loadChecklistEditor(){
 const data=ensureChecklist();
 const idx=parseInt(document.getElementById('ambienteSel').value||0);
 const box=document.getElementById('items');
 box.innerHTML='';
const env = data[idx];

env.items.forEach((t,i)=>{

box.innerHTML += `<div style="display:flex;gap:6px;margin:4px 0"><input value="${t}" onchange="editItem(${idx},${i},this.value)"><button onclick="delItem(${idx},${i})">🗑️</button></div>`;

});
}
function editItem(a,i,v){
    ensureChecklist()[a].items[i]=v;
    localStorage.setItem('cb_checklists',JSON.stringify(checklistData));
}
function delItem(a,i){ensureChecklist()[a].items.splice(i,1);localStorage.setItem('cb_checklists',JSON.stringify(checklistData));loadChecklistEditor();}
function addItem(){
 const a=parseInt(document.getElementById('ambienteSel').value||0);
 const v=document.getElementById('nuevoItem').value.trim();
 if(!v)return;
ensureChecklist()[a].items.push(v);
 document.getElementById('nuevoItem').value='';
 localStorage.setItem('cb_checklists',JSON.stringify(checklistData));
 loadChecklistEditor();
}
let manualCasa = JSON.parse(localStorage.getItem("cb_manual") || "{}");
let manualActual = "emergencias";

function guardarManual(){

    const clave = "c" + current + "_" + manualActual;

    manualCasa[clave] = document.getElementById("manualTexto").value;

    localStorage.setItem("cb_manual", JSON.stringify(manualCasa));

    if (manualActual == "emergencias") {
        document.getElementById("txtEmergencias").innerText = manualCasa[clave];
    }

    if (manualActual == "accesos") {
        document.getElementById("txtAccesos").innerText = manualCasa[clave];
    }
if (manualActual == "tecnologia") {
    document.getElementById("txtTecnologia").innerText = manualCasa[clave];
}
if (manualActual == "exterior") {
    document.getElementById("txtExterior").innerText = manualCasa[clave];
}

if (manualActual == "blancos") {
    document.getElementById("txtBlancos").innerText = manualCasa[clave];
}

if (manualActual == "proveedores") {
    document.getElementById("txtProveedores").innerText = manualCasa[clave];
}
    go("manual");
}
function abrirManual(tipo){

    const clave = "c" + current + "_" + tipo;
    manualActual = tipo;

document.getElementById("manualTitulo").innerText =
    tipo.charAt(0).toUpperCase() + tipo.slice(1);

    document.getElementById("manualTexto").value =
        manualCasa[clave] || "";

    go("manualEdit");
}
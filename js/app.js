let houses=loadData(),current=0;
async function cargarCasasDesdeSupabase() {

    try {

        console.log("🏠 BUSCANDO CASAS EN SUPABASE...");

        const { data, error } = await supabaseClient
            .from("houses")
            .select("*");

        if (error) {

            console.error(
                "❌ Error cargando casas desde Supabase:",
                error
            );

            return;
        }

        if (!data || data.length === 0) {

            console.warn(
                "⚠️ Supabase no devolvió casas."
            );

            return;
        }

        console.log(
            "✅ CASAS ENCONTRADAS EN SUPABASE:",
            data.length
        );

        // Reemplazar las casas locales por las de Supabase
        houses = data.map(h => ({
            ...h,

            obs:
                h.observaciones ??
                h.obs ??
                "",

            capacidad:
                h.capacidad ?? 0,

            situacion:
                h.situacion ??
                "Disponible",

            estado:
                h.estado ??
                "Pendiente",

            ingreso:
                h.ingreso ??
                "",

            rating:
                h.rating ??
                ""
        }));

        // Guardar también una copia local
        saveData(houses);

        console.log(
            "💾 Casas sincronizadas con localStorage"
        );

        // Volver a dibujar la pantalla
        render();

    } catch (error) {

        console.error(
            "❌ Error inesperado cargando casas:",
            error
        );
    }
}
cargarCasasDesdeSupabase();
let propertyFilter='Todas';
function setPropertyFilter(filtro){
    propertyFilter = filtro;
    render();
}

function cbIcon(name){

    const icons = {

        back: `
    <svg viewBox="0 0 24 24">
        <path d="M15 5 8 12l7 7"></path>
    </svg>`,

        location: `
            <svg viewBox="0 0 24 24">
                <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"></path>
                <circle cx="12" cy="10" r="2.5"></circle>
            </svg>`,

        users: `
            <svg viewBox="0 0 24 24">
                <circle cx="9" cy="8" r="3"></circle>
                <path d="M3.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5"></path>
                <path d="M15 6.5a3 3 0 0 1 0 5.5"></path>
                <path d="M17 14.5c2 .6 3.2 2 3.5 4.5"></path>
            </svg>`,

        star: `
            <svg viewBox="0 0 24 24">
                <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path>
            </svg>`,

        calendar: `
    <svg viewBox="0 0 24 24">
        <rect x="4" y="5" width="16" height="15" rx="2"></rect>
        <line x1="8" y1="3" x2="8" y2="7"></line>
        <line x1="16" y1="3" x2="16" y2="7"></line>
        <line x1="4" y1="9" x2="20" y2="9"></line>
    </svg>`,

        check: `
            <svg viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                <polyline points="8,12 11,15 17,8"></polyline>
            </svg>`,

        alert: `
            <svg viewBox="0 0 24 24">
                <path d="M12 4 21 20H3L12 4Z"></path>
                <line x1="12" y1="10" x2="12" y2="14"></line>
                <circle cx="12" cy="17" r=".8"></circle>
            </svg>`
    };

    return `<span class="cb-icon">${icons[name] || ''}</span>`;
}

initPhotoDB();

async function go(id){

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));

    document.getElementById(id).classList.add('active');

    const backIcon = document.getElementById('backIcon');

    if(backIcon) {
        backIcon.innerHTML = cbIcon('back');
    }

    if(id === 'home'){
        await render();
    }
}

async function sincronizarChecklistsIniciales() {

    console.log("🔄 INICIANDO SINCRONIZACIÓN INICIAL DE CHECKLISTS...");

    const checksLocales = JSON.parse(
        localStorage.getItem("cb_checks") || "{}"
    );

    // Traemos los checklists que YA existen en Supabase
    const { data: existentes, error: errorExistentes } =
        await supabaseClient
            .from("house_checklists")
            .select("house_id");

    if (errorExistentes) {

        console.error(
            "❌ Error consultando checklists existentes:",
            errorExistentes
        );

        return;
    }

    const idsExistentes = new Set(
        (existentes || []).map(item => item.house_id)
    );

    let creados = 0;
    let yaExistian = 0;

    for (let houseIndex = 0; houseIndex < houses.length; houseIndex++) {

        const house = houses[houseIndex];

        if (!house || !house.id) {
            continue;
        }

        // Si ya existe en Supabase, NO hacemos nada
        if (idsExistentes.has(house.id)) {

            yaExistian++;

            continue;
        }

        const dataCasa = {};

        ambientes.forEach((ambiente, ambienteIndex) => {

            const key =
                "c" + houseIndex + "_" + ambienteIndex;

            dataCasa[ambienteIndex] =
                checksLocales[key] ||
                new Array(ambiente.items.length).fill(false);

        });

        const { error } = await supabaseClient
            .from("house_checklists")
            .insert({
                house_id: house.id,
                data: dataCasa,
                observaciones: {},
                updated_at: new Date().toISOString()
            });

        if (error) {

            console.error(
                "❌ Error sincronizando casa:",
                house.nombre,
                error
            );

        } else {

            creados++;

            console.log(
                "✅ Checklist inicial creado:",
                house.nombre
            );
        }
    }

    console.log(
        "🏁 SINCRONIZACIÓN TERMINADA.",
        "Creados:",
        creados,
        "Ya existentes:",
        yaExistian
    );

    alert(
        "Sincronización terminada.\n\n" +
        "Checklists creados: " + creados + "\n" +
        "Ya existentes: " + yaExistian
    );
}

function calcularPorcentajeChecklist(datos) {

    let totalChecks = 0;
    let checksCompletados = 0;

    const checklist = datos || {};

    ambientes.forEach((ambiente, ambienteIndex) => {

        const checksAmbiente =
            checklist[ambienteIndex] ||
            new Array(ambiente.items.length).fill(false);

        ambiente.items.forEach((item, itemIndex) => {

            totalChecks++;

            if (checksAmbiente[itemIndex] === true) {
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

async function render(){
    const c = document.getElementById('houses');
    c.innerHTML = '';

    // ============================================
// CHECKLISTS DESDE SUPABASE PARA HOME
// ============================================

const { data: checklistsSupabase, error: errorChecklists } =
    await supabaseClient
        .from("house_checklists")
        .select("house_id, data");

if (errorChecklists) {

    console.error(
        "❌ Error cargando checklists para Home:",
        errorChecklists
    );

}

const checklistPorCasa = {};

(checklistsSupabase || []).forEach(registro => {

    checklistPorCasa[registro.house_id] =
        calcularPorcentajeChecklist(registro.data);

});

    const buscador = document.getElementById('searchProperty');
    const texto = buscador ? buscador.value.toLowerCase().trim() : '';

    const casasFiltradas = houses.filter(h => {
            if (h.eliminada === true) {
        return false;
    }

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

const { data: incidenciasSupabase, error: errorIncidencias } =
    await supabaseClient
        .from("house_incidencias")
        .select("house_id");

if (errorIncidencias) {

    console.error(
        "❌ Error cargando incidencias para Home:",
        errorIncidencias
    );

}

const incidenciasPorCasa = {};

(incidenciasSupabase || []).forEach(incidencia => {

    if (!incidenciasPorCasa[incidencia.house_id]) {
        incidenciasPorCasa[incidencia.house_id] = 0;
    }

    incidenciasPorCasa[incidencia.house_id]++;

});


casasFiltradas.forEach((h)=>{

    const i = houses.indexOf(h);

const checklistCasa =
    checklistPorCasa[h.id] ??
    h.checklistPorcentaje ??
    0;
    const d=document.createElement('div');

   d.className = 'card';

d.style.display = window.innerWidth <= 600 ? "block" : "flex";
d.style.alignItems = "flex-start";
d.style.gap = "20px";

d.innerHTML = `

    <div class="property-card-main">

        <div
            id="fotoCasa-${i}"
            class="property-card-photo"
        ></div>

        <div class="property-card-content">

            <div class="property-card-header">

                <div class="property-card-title-area">

                    <div class="title">
                        ${h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? ('Casa ' + (i+1))}
                    </div>

                    <div class="sub">
                        ${cbIcon('location')}
                        <span>${h.barrio ?? ''}, Lote ${h.lote ?? ''}</span>
                    </div>

                    <div class="sub">
                        ${cbIcon('users')}
                        <span>${h.capacidad ?? '-'} huéspedes</span>
                    </div>

                </div>

                <div class="property-rating">
                    ${cbIcon('star')}
                    <span>${h.rating ?? '-'}</span>
                </div>

            </div>

        </div>

    </div>

    <div class="property-card-stats">

        <div class="property-status">
            <span class="property-status-dot ${
                h.estado === "Pendiente"
                    ? "pending"
                    : h.estado === "En preparación"
                        ? "preparing"
                        : "ready"
            }"></span>

            <span>${h.estado ?? "Pendiente"}</span>
        </div>

        <div class="property-stat">
            ${cbIcon('calendar')}
            <span>
                <small>Próximo ingreso</small>
                ${h.ingreso ?? '-'}
            </span>
        </div>

        <div class="property-stat">
            ${cbIcon('check')}
            <span>
                <small>Checklist</small>
                ${checklistCasa}%
            </span>
        </div>

        <div class="property-stat">
            ${cbIcon('alert')}
            <span>
                <small>Incidencias</small>
${incidenciasPorCasa[h.id] ?? 0}
            </span>
        </div>

    </div>

`;

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
console.log("🟢 RENDER EJECUTADO - AGREGANDO BOTÓN +");
// Botón para agregar una nueva propiedad
const agregar = document.createElement('div');

agregar.className = 'card';
agregar.style.display = 'flex';
agregar.style.alignItems = 'center';
agregar.style.justifyContent = 'center';
agregar.style.minHeight = '100px';
agregar.style.cursor = 'pointer';

agregar.innerHTML = `
    <div style="
        text-align:center;
        width:100%;
    ">
        <div style="
            font-size:30px;
            line-height:1;
            margin-bottom:10px;
        ">＋</div>

        <div style="
            font-size:16px;
            font-weight:600;
        ">
            Agregar propiedad
        </div>
    </div>
`;

agregar.onclick = function() {

    const nuevaCasa = {
        nombre: "",
        barrio: "",
        lote: "",
        capacidad: "",
        rating: "",
        estado: "Pendiente",
        ingreso: "",
        checklistPorcentaje: 0,
        situacion: "Disponible"
    };

    houses.push(nuevaCasa);

    const nuevoIndice = houses.length - 1;

    saveData(houses);

    render();

    openHouse(nuevoIndice);
};
c.appendChild(agregar);
}
function openPhotos(){

    const selector = document.getElementById("photoAmbiente");
    const texto = document.getElementById("photoAmbienteTexto");

    if (selector) {
        selector.value = "fachada";
    }

    if (texto) {
        texto.textContent = "Fachada";
    }

    go("photos");

    mostrarFotos(current);
}

async function saveSelectedPhoto(){

    const input = document.getElementById("photoInput");
    const ambiente = document.getElementById("photoAmbiente").value;

    if(!input.files.length){
        alert("Seleccioná una foto primero.");
        return;
    }

    const file = input.files[0];

    savePhoto(file, current, ambiente);

await savePhotoToSupabase(file, current, ambiente);

console.log("🟢 TERMINÓ savePhotoToSupabase");

console.log("🟢 AHORA VOY A MOSTRAR FOTOS");

await mostrarFotos(current);

console.log("🟢 TERMINÓ mostrarFotos");

    input.value = "";
}

async function openHouse(i){

    current = i;

    const h = houses[i];

    const nombre =
        h.nombre ??
        h.name ??
        h.nombreCasa ??
        h.nombre_casa ??
        ('Casa ' + (current + 1));

let incidenciasCasa = 0;

if (h.id) {

    const { count, error } = await supabaseClient
        .from("house_incidencias")
        .select("id", {
            count: "exact",
            head: true
        })
        .eq("house_id", h.id);

    if (error) {
        console.error(
            "❌ ERROR CONTANDO INCIDENCIAS:",
            error
        );
    } else {
        incidenciasCasa = count || 0;

        console.log(
            "📊 CASA:",
            nombre,
            "ID:",
            h.id,
            "INCIDENCIAS:",
            incidenciasCasa
        );
    }
}

    // ============================================
// CARGAR CHECKLIST REAL DESDE SUPABASE
// ============================================

let checklist = 0;

if (h.id) {

    const { data: checklistSupabase, error: errorChecklist } =
        await supabaseClient
            .from("house_checklists")
            .select("data")
            .eq("house_id", h.id)
            .maybeSingle();

    if (errorChecklist) {

        console.error(
            "❌ ERROR CARGANDO CHECKLIST DE LA CASA:",
            errorChecklist
        );

        // Si falla Supabase, usamos el valor local como respaldo
        checklist = h.checklistPorcentaje ?? 0;

    } else if (checklistSupabase && checklistSupabase.data) {

  checklist = calcularPorcentajeChecklist(checklistSupabase.data);

        // Actualizamos también el objeto local
        h.checklistPorcentaje = checklist;

        console.log(
            "📋 CHECKLIST REAL:",
            nombre,
            checklist + "%"
        );

    } else {

        // La casa no tiene checklist todavía
        checklist = h.checklistPorcentaje ?? 0;

    }
}

const estado = h.estado ?? "Pendiente";

    const estadoIcono =
        estado === "Pendiente" ? "●" :
        estado === "En preparación" ? "●" :
        "●";

    document.getElementById("houseDetailName").textContent = nombre;

    document.getElementById("houseDetailLocation").innerHTML =
    '<span class="house-location-icon">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"></path>' +
            '<circle cx="12" cy="9" r="2.2"></circle>' +
        '</svg>' +
    '</span>' +
    '<span>' +
        (h.barrio ?? "") +
        (h.lote ? " · Lote " + h.lote : "") +
    '</span>';

    document.getElementById("houseDetailStatus").innerHTML =
        '<span class="house-status-dot">' +
        estadoIcono +
        '</span> ' +
        estado;

    document.getElementById("houseDetailIngreso").textContent =
        "Próximo ingreso: " + (h.ingreso ?? "-");

    document.getElementById("houseDetailChecklist").textContent =
        "Checklist: " + checklist + "%";

    document.getElementById("houseDetailIncidencias").textContent =
        "Incidencias: " + incidenciasCasa;

    document.getElementById("houseDetailRating").textContent =
        "★ " + (h.rating ?? "-");

    go("property");
// Botón eliminar propiedad
const ratingElement = document.getElementById("houseDetailRating");

if (ratingElement) {

    const botonExistente =
        document.getElementById("btnEliminarPropiedad");

    if (botonExistente) {
        botonExistente.remove();
    }

    const botonEliminar =
        document.createElement("button");

    botonEliminar.id = "btnEliminarPropiedad";
    botonEliminar.className = "btn";

    botonEliminar.style.marginTop = "25px";
    botonEliminar.style.width = "100%";
    botonEliminar.style.background = "#8B4B4B";
    botonEliminar.style.color = "white";
    botonEliminar.style.border = "none";
    botonEliminar.style.padding = "14px";
    botonEliminar.style.borderRadius = "10px";
    botonEliminar.style.cursor = "pointer";
    botonEliminar.style.fontWeight = "600";

    botonEliminar.innerHTML = "🗑 Eliminar propiedad";

    botonEliminar.onclick = async function(event) {

        event.stopPropagation();

        const nombreCasa =
            h.nombre ||
            h.name ||
            h.nombreCasa ||
            h.nombre_casa ||
            "esta propiedad";

        const confirmar = confirm(
            "¿Querés eliminar " +
            nombreCasa +
            " de las propiedades disponibles?"
        );

        if (!confirmar) return;

        // Marcar la casa como eliminada en Supabase
const { error } = await supabaseClient
    .from("houses")
    .update({
        eliminada: true
    })
    .eq("id", h.id);

if (error) {

    console.error(
        "❌ Error marcando casa como eliminada en Supabase:",
        error
    );

    alert(
        "No se pudo eliminar la propiedad. Revisá la consola."
    );

    return;
}

console.log(
    "🗑️ CASA MARCADA COMO ELIMINADA EN SUPABASE:",
    h.id
);

// Eliminarla también de la memoria local
houses = houses.filter(casa => casa.id !== h.id);

        saveData(houses);

        current = null;

        render();

        go("home");
    };

    ratingElement.parentElement.appendChild(botonEliminar);
}
const foto = document.getElementById("houseHeroPhoto");

if (!foto) return;

foto.innerHTML = "";

obtenerPrimeraFoto(current, function(url){

    if(url){

        const img = document.createElement("img");

        img.src = url;
        img.alt = nombre;

        foto.appendChild(img);

    }

});
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

async function obtenerInventarioCasa(){

    const house = houses[current];

console.log(
    "🏠 INVENTARIO - CASA ACTUAL:",
            house?.nombre,
    "INDEX:",
    current,
    "UUID:",
    house?.id
);

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return [];
    }

    const { data, error } = await supabaseClient
        .from("house_inventario")
        .select("id, house_id, data, updated_at")
        .eq("house_id", house.id)
        .maybeSingle();

    if (error) {

        console.error(
            "❌ Error cargando inventario desde Supabase:",
            error
        );

        return null;
    }

    // ============================================
    // SI YA EXISTE EN SUPABASE
    // ============================================

    if (data) {

        console.log(
            "✅ INVENTARIO ENCONTRADO EN SUPABASE:",
            house.id
        );

        return Array.isArray(data.data)
            ? data.data
            : [];
    }

    // ============================================
    // SI TODAVÍA NO EXISTE:
    // BUSCAR INVENTARIO ANTIGUO EN LOCALSTORAGE
    // ============================================

    const key = "c" + current + "_inventario";

    let inventarioLocal = {};

    try {

        inventarioLocal = JSON.parse(
            localStorage.getItem("cb_inventario") || "{}"
        );

    } catch (error) {

        console.error(
            "❌ Error leyendo inventario local:",
            error
        );

        inventarioLocal = {};
    }

    const itemsLocales =
        Array.isArray(inventarioLocal[key])
            ? inventarioLocal[key]
            : [];

    // ============================================
    // MIGRAR AUTOMÁTICAMENTE A SUPABASE
    // ============================================

    if (itemsLocales.length > 0) {

        console.log(
            "📦 MIGRANDO INVENTARIO LOCAL A SUPABASE:",
            house.id,
            itemsLocales
        );

        const { error: errorMigracion } =
            await supabaseClient
                .from("house_inventario")
                .upsert(
                    {
                        house_id: house.id,
                        data: itemsLocales,
                        updated_at: new Date().toISOString()
                    },
                    {
                        onConflict: "house_id"
                    }
                );

        if (errorMigracion) {

            console.error(
                "❌ Error migrando inventario a Supabase:",
                errorMigracion
            );

            return itemsLocales;
        }

        console.log(
            "✅ INVENTARIO MIGRADO A SUPABASE:",
            house.id
        );
    }

    return itemsLocales;
}


// ============================================
// GUARDAR INVENTARIO EN SUPABASE
// ============================================

async function guardarInventarioSupabase(items){

    const house = houses[current];

    if (!house || !house.id) {

        console.error(
            "❌ No se puede guardar inventario: falta UUID de la casa"
        );

        return false;
    }

    const { error } =
        await supabaseClient
            .from("house_inventario")
            .upsert(
                {
                    house_id: house.id,
                    data: items,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "house_id"
                }
            );

    if (error) {

        console.error(
            "❌ Error guardando inventario en Supabase:",
            error
        );

        alert(
            "No se pudo guardar el inventario. Revisá la consola."
        );

        return false;
    }

    console.log(
        "✅ INVENTARIO GUARDADO EN SUPABASE:",
        house.id
    );

    return true;
}


// ============================================
// ABRIR INVENTARIO
// ============================================

async function openInventario(){

    go('inventario');

    const lista =
        document.getElementById('listaInventario');

    lista.innerHTML = `
        <div class="card">
            <b>📦 Cargando inventario...</b>
        </div>
    `;

    const items =
        await obtenerInventarioCasa();

    if (items === null) {

        lista.innerHTML = `
            <div class="card">
                <b>❌ No se pudo cargar el inventario</b>
                <div class="sub">
                    Revisá la consola para más información.
                </div>
            </div>
        `;

        return;
    }

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

    renderInventario(items);
}


// ============================================
// RENDER INVENTARIO
// ============================================

function renderInventario(items){

    const lista =
        document.getElementById('listaInventario');

    lista.innerHTML = "";

    items.forEach((item, index) => {

        lista.innerHTML += `
            <div class="card">

                <div class="title">

                    <span class="cb-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M4 7L12 3L20 7L12 11L4 7Z"></path>
                            <path d="M4 7V17L12 21L20 17V7"></path>
                            <path d="M12 11V21"></path>
                        </svg>
                    </span>

                    ${item.nombre}

                </div>

                <div class="sub">

                    ${
                        item.control === "danado"
                        ? '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#0D2B45;margin-right:5px;vertical-align:middle;"></span> Dañado'

                        : item.control === "falta"
                        ? '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#DCC9A6;margin-right:5px;vertical-align:middle;"></span> Falta'

                        : '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#6B7A5A;margin-right:5px;vertical-align:middle;"></span> Está'
                    }

                </div>

                <button
                    class="btn-eliminar-inventario"
                    onclick="eliminarItemInventario(${index})"
                >
                    Eliminar
                </button>

            </div>
        `;
    });
}


// ============================================
// NUEVO ITEM
// ============================================

async function nuevoItemInventario(){

    const nombre =
        prompt("¿Qué elemento querés agregar al inventario?");

    if(!nombre || !nombre.trim()) return;

    const items =
        await obtenerInventarioCasa();

    if(items === null) return;

    items.push({
        nombre: nombre.trim(),
        presente: true,
        control: "presente"
    });

    const guardado =
        await guardarInventarioSupabase(items);

    if (!guardado) return;

    await openInventario();
}


// ============================================
// ELIMINAR ITEM
// ============================================

async function eliminarItemInventario(index){

    if(
        !confirm(
            "¿Querés eliminar este elemento del inventario?"
        )
    ) {
        return;
    }

    const items =
        await obtenerInventarioCasa();

    if(items === null) return;

    if(!items[index]) return;

    items.splice(index, 1);

    const guardado =
        await guardarInventarioSupabase(items);

    if (!guardado) return;

    await openInventario();
}


// ============================================
// INICIAR CONTROL DE INVENTARIO
// ============================================

async function iniciarControlInventario(){

    const items =
        await obtenerInventarioCasa();

    if(items === null) return;

    if(items.length === 0){

        alert(
            "Esta casa todavía no tiene elementos cargados en el inventario."
        );

        return;
    }

    items.forEach(item => {

        if (!item.control) {
            item.control = "presente";
        }

    });

    const guardado =
        await guardarInventarioSupabase(items);

    if (!guardado) return;

    renderControlInventario();
}


// ============================================
// RENDER CONTROL DE INVENTARIO
// ============================================

async function renderControlInventario(){

    const lista =
        document.getElementById('listaInventario');

    const items =
        await obtenerInventarioCasa();

    if(items === null) return;

    lista.innerHTML = `

        <div
            class="back control-back"
            onclick="openInventario()"
        >

            <span class="cb-icon white">
                <svg viewBox="0 0 24 24">
                    <path d="M15 5 8 12l7 7"></path>
                </svg>
            </span>

            Inventario

        </div>

        <div class="card">

            <b>

                <span class="cb-icon">

                    <svg viewBox="0 0 24 24">
                        <circle
                            cx="11"
                            cy="11"
                            r="6"
                        ></circle>

                        <line
                            x1="16"
                            y1="16"
                            x2="21"
                            y2="21"
                        ></line>
                    </svg>

                </span>

                Control de salida

            </b>

            <div class="sub">
                Revisá cada elemento y marcá si está,
                falta o está dañado.
            </div>

        </div>
    `;

    items.forEach((item, index) => {

        const estado =
            item.control || "presente";

        lista.innerHTML += `

            <div class="card">

                <div class="title">

                    <span class="cb-icon">

                        <svg viewBox="0 0 24 24">

                            <path d="M4 7L12 3L20 7L12 11L4 7Z"></path>

                            <path d="M4 7V17L12 21L20 17V7"></path>

                            <path d="M12 11V21"></path>

                        </svg>

                    </span>

                    ${item.nombre}

                </div>


                <div
                    style="
                        display:flex;
                        gap:6px;
                        flex-wrap:wrap;
                        margin-top:10px;
                    "
                >

                    <button
                        onclick="
                            cambiarEstadoInventario(
                                ${index},
                                'presente'
                            )
                        "
                        style="
                            display:flex;
                            align-items:center;
                            gap:7px;
                        "
                    >

                        <span
                            style="
                                width:12px;
                                height:12px;
                                border-radius:50%;
                                display:inline-block;
                                background:#6B7A5A;
                                border:1px solid #6B7A5A;
                            "
                        ></span>

                        Está

                    </button>


                    <button
                        onclick="
                            cambiarEstadoInventario(
                                ${index},
                                'falta'
                            )
                        "
                        style="
                            display:flex;
                            align-items:center;
                            gap:7px;
                        "
                    >

                        <span
                            style="
                                width:12px;
                                height:12px;
                                border-radius:50%;
                                display:inline-block;
                                background:#DCC9A6;
                                border:1px solid #DCC9A6;
                            "
                        ></span>

                        Falta

                    </button>


                    <button
                        onclick="
                            cambiarEstadoInventario(
                                ${index},
                                'danado'
                            )
                        "
                        style="
                            display:flex;
                            align-items:center;
                            gap:7px;
                        "
                    >

                        <span
                            style="
                                width:12px;
                                height:12px;
                                border-radius:50%;
                                display:inline-block;
                                background:#0D2B45;
                                border:1px solid #0D2B45;
                            "
                        ></span>

                        Dañado

                    </button>

                </div>

            </div>
        `;
    });
}


// ============================================
// CAMBIAR ESTADO
// ============================================

async function cambiarEstadoInventario(index, estado){

    const items =
        await obtenerInventarioCasa();

    if(items === null) return;

    if(!items[index]) return;

    items[index].control = estado;

    const guardado =
        await guardarInventarioSupabase(items);

    if (!guardado) return;

    await renderControlInventario();
}

async function openIncidencias(){

    const lista = document.getElementById('listaIncidencias');

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

    console.log(
        "🚨 CARGANDO INCIDENCIAS DESDE SUPABASE:",
        house.id
    );

    const { data: incidencias, error } = await supabaseClient
        .from("house_incidencias")
        .select("*")
        .eq("house_id", house.id)
        .order("created_at", { ascending: false });

    if (error) {

        console.error(
            "❌ Error cargando incidencias desde Supabase:",
            error
        );

        lista.innerHTML = `
            <div class="card">
                <b>❌ No se pudieron cargar las incidencias</b>
                <div class="sub">
                    Revisá la consola para más información.
                </div>
            </div>
        `;

        go('incidencias');
        return;
    }

    console.log(
        "✅ INCIDENCIAS ENCONTRADAS EN SUPABASE:",
        incidencias
    );

    if (!incidencias || incidencias.length === 0) {

        lista.innerHTML = `
            <div class="card">
                <span class="cb-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 3 21 20H3L12 3Z"></path>
                        <line x1="12" y1="9" x2="12" y2="14"></line>
                        <circle cx="12" cy="17" r="0.8"></circle>
                    </svg>
                </span>

                No hay incidencias registradas

                <div class="sub">
                    Esta casa no tiene incidencias pendientes.
                </div>
            </div>
        `;

        go('incidencias');
        return;
    }

    lista.innerHTML = '';

    incidencias.forEach(incidencia => {

        const prioridadIcono =
            incidencia.prioridad === 'Alta' ? '🔴' :
            incidencia.prioridad === 'Media' ? '🟡' : '🟢';

        const estadoSemaforo =
            incidencia.estado === 'Resuelta' ? 'resuelta' :
            incidencia.estado === 'En curso' ? 'en-curso' :
            'pendiente';

        const estadoColor =
            incidencia.estado === 'Resuelta' ? '#6B7A5A' :
            incidencia.estado === 'En curso' ? '#DCC9A6' :
            '#0D2B45';

        lista.innerHTML += `
            <div class="card">

                <div class="card-header">

                    <div class="title">

                        <span class="cb-icon">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 3 21 20H3L12 3Z"></path>
                                <line x1="12" y1="9" x2="12" y2="14"></line>
                                <circle cx="12" cy="17" r="0.8"></circle>
                            </svg>
                        </span>

                        ${incidencia.ambiente || 'Sin ambiente'}

                    </div>

                    <button
                        class="btn-delete-incidencia"
                        onclick="eliminarIncidencia('${incidencia.id}')"
                        title="Eliminar incidencia"
                        aria-label="Eliminar incidencia"
                    >

                        <span class="cb-icon">
                            <svg viewBox="0 0 24 24">
                                <path d="M6 7H18"></path>
                                <path d="M9 7V5H15V7"></path>
                                <path d="M8 7L9 20H15L16 7"></path>
                                <path d="M10 11V17"></path>
                                <path d="M14 11V17"></path>
                            </svg>
                        </span>

                    </button>

                </div>

                <div class="sub">
                    ${incidencia.descripcion || ''}
                </div>

                <div class="sub">

                    <span class="cb-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 3 21 20H3L12 3Z"></path>
                            <line x1="12" y1="9" x2="12" y2="14"></line>
                            <circle cx="12" cy="17" r="0.8"></circle>
                        </svg>
                    </span>

                    Prioridad: ${incidencia.prioridad || ''}

                </div>

                <div class="sub estado-incidencia">

                    <span class="semaforo">

                        <span style="${estadoSemaforo === 'pendiente'
                            ? `background:${estadoColor}; border-color:${estadoColor};`
                            : ''}">
                        </span>

                        <span style="${estadoSemaforo === 'en-curso'
                            ? `background:${estadoColor}; border-color:${estadoColor};`
                            : ''}">
                        </span>

                        <span style="${estadoSemaforo === 'resuelta'
                            ? `background:${estadoColor}; border-color:${estadoColor};`
                            : ''}">
                        </span>

                    </span>

                    Estado: ${incidencia.estado || ''}

                </div>

                <div class="sub">

                    <span class="cb-icon">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="8" r="3"></circle>
                            <path d="M5 20c0-4 3-6 7-6s7 2 7 6"></path>
                        </svg>
                    </span>

                    ${incidencia.responsable || 'Sin responsable'}

                </div>

                <div class="sub">

                    <span class="cb-icon">
                        <svg viewBox="0 0 24 24">
                            <rect x="4" y="5" width="16" height="15" rx="2"></rect>
                            <line x1="8" y1="3" x2="8" y2="7"></line>
                            <line x1="16" y1="3" x2="16" y2="7"></line>
                            <line x1="4" y1="10" x2="20" y2="10"></line>
                        </svg>
                    </span>

                    ${incidencia.fecha || ''}

                </div>

                <div
                    class="btn"
                    onclick="cambiarEstadoIncidencia('${incidencia.id}')"
                >

                    <span class="cb-icon white">
                        <svg viewBox="0 0 24 24">
                            <path d="M20 11a8 8 0 0 0-14.9-3"></path>
                            <polyline points="5,4 5,9 10,9"></polyline>
                            <path d="M4 13a8 8 0 0 0 14.9 3"></path>
                            <polyline points="19,20 19,15 14,15"></polyline>
                        </svg>
                    </span>

                    Cambiar estado

                </div>

            </div>
        `;
    });

    go('incidencias');
}
 
async function cambiarEstadoIncidencia(id){

    const { data: incidencia, error: errorCarga } = await supabaseClient
        .from("house_incidencias")
        .select("estado")
        .eq("id", id)
        .single();

    if (errorCarga) {

        console.error(
            "❌ Error buscando incidencia:",
            errorCarga
        );

        return;
    }

    if (!incidencia) return;

    let nuevoEstado;

    if (incidencia.estado === 'Abierta') {

        nuevoEstado = 'En curso';

    } else if (incidencia.estado === 'En curso') {

        nuevoEstado = 'Resuelta';

    } else {

        nuevoEstado = 'Abierta';

    }

    const { error } = await supabaseClient
        .from("house_incidencias")
        .update({
            estado: nuevoEstado
        })
        .eq("id", id);

    if (error) {

        console.error(
            "❌ Error actualizando estado de incidencia:",
            error
        );

        return;
    }

    console.log(
        "✅ ESTADO DE INCIDENCIA ACTUALIZADO:",
        id,
        nuevoEstado
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

async function guardarIncidencia(){

    const house = houses[current];

    if (!house || !house.id) {

        console.error(
            "❌ La casa no tiene UUID de Supabase"
        );

        return;
    }

    const incidencia = {

        house_id: house.id,

        ambiente:
            document.getElementById('incAmbiente').value,

        descripcion:
            document.getElementById('incDescripcion').value,

        prioridad:
            document.getElementById('incPrioridad').value,

        estado:
            document.getElementById('incEstado').value,

        responsable:
            document.getElementById('incResponsable').value,

        fecha:
            new Date().toISOString().split('T')[0]
    };

    console.log(
        "🚨 GUARDANDO INCIDENCIA EN SUPABASE:",
        incidencia
    );

    const { data, error } = await supabaseClient
        .from("house_incidencias")
        .insert(incidencia)
        .select()
        .single();

    if (error) {

        console.error(
            "❌ Error guardando incidencia en Supabase:",
            error
        );

        alert(
            "No se pudo guardar la incidencia. Revisá la consola."
        );

        return;
    }

    console.log(
        "✅ INCIDENCIA GUARDADA EN SUPABASE:",
        data
    );

    alert('Incidencia guardada');

    document.getElementById('formIncidencia').style.display = 'none';

    await render();
await openIncidencias();
}

async function eliminarIncidencia(id){

    if(!confirm('¿Eliminar esta incidencia?')) {
        return;
    }

    const { error } = await supabaseClient
        .from("house_incidencias")
        .delete()
        .eq("id", id);

    if (error) {

        console.error(
            "❌ Error eliminando incidencia de Supabase:",
            error
        );

        alert(
            "No se pudo eliminar la incidencia. Revisá la consola."
        );

        return;
    }

    console.log(
        "🗑️ INCIDENCIA ELIMINADA DE SUPABASE:",
        id
    );

    await render();
await openIncidencias();
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

async function saveCurrent(){let h=houses[current];
h.nombre=document.getElementById('name').value; h.name=document.getElementById('name').value; h.nombreCasa=document.getElementById('name').value; h.nombre_casa=document.getElementById('name').value;h.barrio=document.getElementById('barrio').value;h.lote=document.getElementById('lote').value;h.capacidad=document.getElementById('capacidad').value;h.wifi=document.getElementById('wifi').value;h.obs=document.getElementById('obs').value;h.situacion=document.getElementById('situacion').value;
await saveHouseToSupabase(h);
saveData(houses);
const title = document.getElementById('title');
if (title) title.textContent = h.nombre;
render();
openHouse(current);
render();openHouse(current);}
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
async function guardarChecklistSupabase() {

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

const observaciones = JSON.parse(
    localStorage.getItem("cb_observaciones") || "{}"
);

    const dataCasa = {};

    ambientes.forEach((ambiente, i) => {

        const key = "c" + current + "_" + i;

        dataCasa[i] =
            checks[key] ||
            new Array(ambiente.items.length).fill(false);

    });

    const { error } = await supabaseClient
        .from("house_checklists")
        .upsert({
            house_id: house.id,
            data: dataCasa,
            observaciones: observaciones,
            updated_at: new Date().toISOString()
        });

    if (error) {

        console.error(
            "❌ Error guardando checklist en Supabase:",
            error
        );

        return;
    }

    console.log(
        "✅ CHECKLIST GUARDADO EN SUPABASE:",
        house.id
    );
}
let checks = JSON.parse(localStorage.getItem("cb_checks") || "{}");

async function startPreparation(){

    console.log("CURRENT =", current);

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

    console.log("🏠 Cargando checklist de Supabase:", house.id);
alert("ESTOY CARGANDO CHECKLIST DESDE SUPABASE");
    const diagnostico = document.getElementById("diagnosticoChecklist");

if (diagnostico) {
    diagnostico.textContent = "☁️ Cargando checklist desde Supabase...";
}

    const { data, error } = await supabaseClient
        .from("house_checklists")
        .select("data, observaciones")
        .eq("house_id", house.id)
        .maybeSingle();

    if (error) {

        console.error(
            "❌ Error cargando checklist desde Supabase:",
            error
        );

        return;
    }

    if (data && data.data) {

        console.log(
            "✅ CHECKLIST ENCONTRADO EN SUPABASE:",
            data.data
        );
        if (diagnostico) {
    diagnostico.textContent = "✅ Checklist encontrado en Supabase";
}

        Object.keys(data.data).forEach(ambienteIndex => {

            const key =
                "c" + current + "_" + ambienteIndex;

            checks[key] = data.data[ambienteIndex];

        });

        localStorage.setItem(
            "cb_checks",
            JSON.stringify(checks)
        );

if (data.observaciones) {

    localStorage.setItem(
        "cb_observaciones",
        JSON.stringify(data.observaciones)
    );

    console.log(
        "📝 OBSERVACIONES ENCONTRADAS EN SUPABASE:",
        data.observaciones
    );
}

    } else {

        console.log(
            "ℹ️ Esta casa todavía no tiene checklist en Supabase."
        );

    }

    console.log("CHECKS CARGADOS =", checks);

    paso = 0;

    go('prep');

    renderPrep();

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
    guardarChecklistSupabase();
    actualizarEstadoCasa();
"
>
        <span>${c}</span>
    </label>`;
});

progressBar.style.width=((paso+1)/ambientes.length*100)+"%";

checklist.innerHTML += `

<div style="margin-top:20px">

<b>
    <span class="cb-icon">
        <svg viewBox="0 0 24 24">
            <path d="M4 20L8 19L19 8L16 5L5 16L4 20Z"></path>
            <line x1="14" y1="7" x2="17" y2="10"></line>
        </svg>
    </span>
    Observaciones
</b>

<textarea
id="obsPrep"
style="width:100%;height:90px;margin-top:8px"
oninput="
    let obs = JSON.parse(localStorage.getItem('cb_observaciones') || '{}');
    obs['${obsKey}'] = this.value;
    localStorage.setItem('cb_observaciones', JSON.stringify(obs));
"
onblur="
    guardarChecklistSupabase();
"
>${observaciones[obsKey]||""}</textarea>

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

    houses[current].checklistPorcentaje = totalChecks > 0
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
    guardarChecklistSupabase();
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

box.innerHTML += `<div style="display:flex;gap:6px;margin:4px 0"><input value="${t}" onchange="editItem(${idx},${i},this.value)">
<button class="checklist-delete" onclick="delItem(${idx},${i})">
    <span class="cb-icon">
        <svg viewBox="0 0 24 24">
            <path d="M4 7H20"></path>
            <path d="M9 7V4H15V7"></path>
            <path d="M7 7L8 20H16L17 7"></path>
            <path d="M10 11V17"></path>
            <path d="M14 11V17"></path>
        </svg>
    </span>
</button>
</div>`;
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
sincronizarChecklistsIniciales();
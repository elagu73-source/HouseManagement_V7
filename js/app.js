let houses = [];
let current = 0;

let valoraciones = {};

const URL_VALORACIONES =
    "https://script.google.com/macros/s/AKfycbwS6PlI756K21HxlohFoLtXcfzhUK9W5S60aa5rW-11fbSaUUm1Wow7t59KwPZbsSuIXw/exec";

async function cargarValoraciones() {

    try {

        const respuesta = await fetch(URL_VALORACIONES);

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las valoraciones");
        }

        valoraciones = await respuesta.json();

        console.log("⭐ VALORACIONES CARGADAS:", valoraciones);

    } catch (error) {

        console.error(
            "❌ Error cargando valoraciones:",
            error
        );

        valoraciones = {};
    }
}

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

// Cargar valoraciones desde Google Sheets
await cargarValoraciones();

// Volver a dibujar la pantalla
render();

    } catch (error) {

        console.error(
            "❌ Error inesperado cargando casas:",
            error
        );
    }
}
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

    console.log("🚨 GO EJECUTADO:", id, new Error().stack);

    if (id === 'home' && window.usuarioAutenticado !== true) {
        return;
    }

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));

    document.getElementById(id).classList.add('active');

    const backIcon = document.getElementById('backIcon');

    if(backIcon) {
        backIcon.innerHTML = cbIcon('back');
    }

 if(id === 'home'){
    await cargarCasasDesdeSupabase();
}
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

let renderVersion = 0;

async function render(){
        const thisRender = ++renderVersion;
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
    if (thisRender !== renderVersion) return;
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

// ============================================
// CARGAR RESERVAS PARA MOSTRAR EN HOME
// ============================================

const hoy = new Date().toISOString().split("T")[0];

const { data: reservasSupabase, error: errorReservas } =
    await supabaseClient
        .from("house_reservations")
        .select("house_id, check_in, check_out")
        .gte("check_out", hoy)
        .order("check_in", { ascending: true });

if (errorReservas) {

    console.error(
        "❌ Error cargando reservas para Home:",
        errorReservas
    );

}

const proximaReservaPorCasa = {};

(reservasSupabase || []).forEach(reserva => {

    if (!proximaReservaPorCasa[reserva.house_id]) {

        proximaReservaPorCasa[reserva.house_id] =
            reserva;

    }

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
<span>${
    valoraciones[h.nombre]?.promedio ?? '-'
}</span>
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

            <span>${h.estado === "Lista para entregar" ? "Listo" : (h.estado ?? "Pendiente")}</span>
        </div>

      <div class="property-stat">
    ${cbIcon('calendar')}
    <span>
        <small>Ingreso</small>
        ${
            proximaReservaPorCasa[h.id]
                ? formatearFecha(
                    fechaDesdeISO(
                        proximaReservaPorCasa[h.id].check_in
                    )
                  )
                : '-'
        }
    </span>
</div>

<div class="property-stat">
    ${cbIcon('calendar')}
    <span>
        <small>Egreso</small>
        ${
            proximaReservaPorCasa[h.id]
                ? formatearFecha(
                    fechaDesdeISO(
                        proximaReservaPorCasa[h.id].check_out
                    )
                  )
                : '-'
        }
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

// ============================================
// CALENDARIO DE LA CASA
// ============================================

let calendarioFechaActual = new Date();
let calendarioIngreso = null;
let calendarioEgreso = null;
let calendarioCasaActual = null;
let calendarioReservas = [];

async function cargarReservasCasa(houseId) {

    calendarioReservas = [];

    if (!houseId) return;

    const { data, error } =
        await supabaseClient
            .from("house_reservations")
            .select("id, check_in, check_out")
            .eq("house_id", houseId)
            .order("check_in", { ascending: true });

    if (error) {

        console.error(
            "❌ Error cargando reservas:",
            error
        );

        return;
    }

    calendarioReservas = data || [];

    console.log(
        "📅 RESERVAS CARGADAS:",
        calendarioReservas
    );
}

async function abrirCalendarioCasa(h) {

    calendarioCasaActual = h;

    const modalExistente =
        document.getElementById("modalCalendarioCasa");

    if (modalExistente) {
        modalExistente.remove();
    }

    calendarioIngreso = null;
    calendarioEgreso = null;
    calendarioFechaActual = new Date();

    const modal = document.createElement("div");

    modal.id = "modalCalendarioCasa";

    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.background = "rgba(0,0,0,0.55)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "99999";
    modal.style.padding = "20px";
    modal.style.boxSizing = "border-box";

    const caja = document.createElement("div");

    caja.style.background = "#F7F3EA";
    caja.style.borderRadius = "18px";
    caja.style.padding = "22px";
    caja.style.width = "100%";
    caja.style.maxWidth = "390px";
    caja.style.maxHeight = "90vh";
    caja.style.overflowY = "auto";
    caja.style.boxSizing = "border-box";
    caja.style.boxShadow =
        "0 20px 60px rgba(0,0,0,0.25)";

    const titulo = document.createElement("div");

    titulo.innerText = "Calendario";

    titulo.style.fontFamily = "Georgia, serif";
    titulo.style.fontSize = "24px";
    titulo.style.color = "#0D2B45";
    titulo.style.textAlign = "center";
    titulo.style.marginBottom = "4px";

    const nombreCasa = document.createElement("div");

    nombreCasa.innerText =
        h.nombre ||
        h.name ||
        h.nombreCasa ||
        h.nombre_casa ||
        "";

    nombreCasa.style.textAlign = "center";
    nombreCasa.style.color = "#556B4F";
    nombreCasa.style.fontSize = "14px";
    nombreCasa.style.marginBottom = "20px";

    const calendario = document.createElement("div");

    calendario.id = "calendarioCasaContenido";

    caja.appendChild(titulo);
    caja.appendChild(nombreCasa);
    caja.appendChild(calendario);

    modal.appendChild(caja);

    document.body.appendChild(modal);

await cargarReservasCasa(
    calendarioCasaActual.id ||
    calendarioCasaActual.house_id
);

renderCalendarioCasa();

    modal.onclick = function(event) {

        if (event.target === modal) {
            modal.remove();
        }

    };
}

function renderCalendarioCasa() {

    const contenedor =
        document.getElementById("calendarioCasaContenido");

    if (!contenedor) return;

    contenedor.innerHTML = "";

    const año =
        calendarioFechaActual.getFullYear();

    const mes =
        calendarioFechaActual.getMonth();

    const primerDia =
        new Date(año, mes, 1);

    const ultimoDia =
        new Date(año, mes + 1, 0);

    const diasMes =
        ultimoDia.getDate();

    const nombreMes =
        calendarioFechaActual.toLocaleDateString(
            "es-AR",
            {
                month: "long",
                year: "numeric"
            }
        );

    const encabezado =
        document.createElement("div");

    encabezado.style.display = "flex";
    encabezado.style.alignItems = "center";
    encabezado.style.justifyContent = "space-between";
    encabezado.style.marginBottom = "14px";

    const anterior =
        document.createElement("button");

    anterior.innerText = "‹";

    anterior.style.border = "none";
    anterior.style.background = "transparent";
    anterior.style.color = "#0D2B45";
    anterior.style.fontSize = "28px";
    anterior.style.cursor = "pointer";

    anterior.onclick = function() {

        calendarioFechaActual =
            new Date(año, mes - 1, 1);

        renderCalendarioCasa();

    };

    const mesTitulo =
        document.createElement("div");

    mesTitulo.innerText =
        nombreMes.charAt(0).toUpperCase() +
        nombreMes.slice(1);

    mesTitulo.style.fontWeight = "600";
    mesTitulo.style.color = "#0D2B45";

    const siguiente =
        document.createElement("button");

    siguiente.innerText = "›";

    siguiente.style.border = "none";
    siguiente.style.background = "transparent";
    siguiente.style.color = "#0D2B45";
    siguiente.style.fontSize = "28px";
    siguiente.style.cursor = "pointer";

    siguiente.onclick = function() {

        calendarioFechaActual =
            new Date(año, mes + 1, 1);

        renderCalendarioCasa();

    };

    encabezado.appendChild(anterior);
    encabezado.appendChild(mesTitulo);
    encabezado.appendChild(siguiente);

    contenedor.appendChild(encabezado);


    const diasSemana =
        document.createElement("div");

    diasSemana.style.display = "grid";
    diasSemana.style.gridTemplateColumns =
        "repeat(7, 1fr)";
    diasSemana.style.gap = "4px";
    diasSemana.style.marginBottom = "5px";

    [
        "L",
        "M",
        "M",
        "J",
        "V",
        "S",
        "D"
    ].forEach(dia => {

        const celda =
            document.createElement("div");

        celda.innerText = dia;

        celda.style.textAlign = "center";
        celda.style.fontSize = "12px";
        celda.style.fontWeight = "600";
        celda.style.color = "#556B4F";
        celda.style.padding = "5px";

        diasSemana.appendChild(celda);

    });

    contenedor.appendChild(diasSemana);


    const dias =
        document.createElement("div");

    dias.style.display = "grid";
    dias.style.gridTemplateColumns =
        "repeat(7, 1fr)";
    dias.style.gap = "4px";


    let primerDiaSemana =
        primerDia.getDay();

    primerDiaSemana =
        primerDiaSemana === 0
            ? 6
            : primerDiaSemana - 1;


    for (let i = 0; i < primerDiaSemana; i++) {

        const vacio =
            document.createElement("div");

        dias.appendChild(vacio);

    }


    for (
        let numeroDia = 1;
        numeroDia <= diasMes;
        numeroDia++
    ) {

        const fecha =
            new Date(
                año,
                mes,
                numeroDia
            );

        const celda =
            document.createElement("button");

        celda.innerText = numeroDia;

        celda.style.border = "none";
        celda.style.background = "white";
        celda.style.borderRadius = "8px";
        celda.style.padding = "9px 4px";
        celda.style.cursor = "pointer";
        celda.style.color = "#0D2B45";
        celda.style.fontSize = "14px";

        // ============================================
// RESERVAS YA GUARDADAS
// ============================================

calendarioReservas.forEach(reserva => {

    const ingreso =
        fechaDesdeISO(reserva.check_in);

    const egreso =
        fechaDesdeISO(reserva.check_out);

    if (
        fecha >= ingreso &&
        fecha < egreso
    ) {

        // Días ocupados
        celda.style.background =
            "#0D2B45";

        celda.style.color =
            "white";

    }

    if (
        mismaFecha(fecha, egreso)
    ) {

        // Día de checkout
        celda.style.background =
            "#B8DDE8";

        celda.style.color =
            "#0D2B45";

    }

});

        if (
            calendarioIngreso &&
            mismaFecha(fecha, calendarioIngreso)
        ) {

            celda.style.background =
                "#0D2B45";

            celda.style.color =
                "white";

        }

        if (
            calendarioEgreso &&
            mismaFecha(fecha, calendarioEgreso)
        ) {

            celda.style.background =
                "#B8DDE8";

            celda.style.color =
                "#0D2B45";

        }

        if (
    calendarioIngreso &&
    calendarioEgreso &&
    fecha > calendarioIngreso &&
    fecha < calendarioEgreso
) {

    celda.style.background =
        "#0D2B45";

    celda.style.color =
        "white";
}

        celda.onclick = function() {

            seleccionarFechaCalendario(
                fecha
            );

        };

        dias.appendChild(celda);

    }

    contenedor.appendChild(dias);


    const info =
        document.createElement("div");

    info.style.marginTop = "18px";
    info.style.padding = "12px";
    info.style.background = "white";
    info.style.borderRadius = "10px";
    info.style.fontSize = "14px";
    info.style.color = "#0D2B45";

    info.innerHTML =

        "<b>Ingreso:</b> " +
        (
            calendarioIngreso
                ? formatearFecha(calendarioIngreso)
                : "Seleccionar"
        ) +
        "<br>" +
        "<b>Egreso:</b> " +
        (
            calendarioEgreso
                ? formatearFecha(calendarioEgreso)
                : "Seleccionar"
        );

    contenedor.appendChild(info);


    const acciones =
        document.createElement("div");

    acciones.style.display = "flex";
    acciones.style.gap = "10px";
    acciones.style.marginTop = "14px";


    const cancelar =
        document.createElement("button");

    cancelar.innerText = "Cancelar";

    cancelar.style.flex = "1";
    cancelar.style.padding = "12px";
    cancelar.style.border = "none";
    cancelar.style.borderRadius = "10px";
    cancelar.style.background = "#E7E1D6";
    cancelar.style.color = "#0D2B45";
    cancelar.style.cursor = "pointer";

    cancelar.onclick = function() {

        document
            .getElementById("modalCalendarioCasa")
            .remove();

    };


    const guardar =
        document.createElement("button");

    guardar.innerText = "OK";

    guardar.style.flex = "1";
    guardar.style.padding = "12px";
    guardar.style.border = "none";
    guardar.style.borderRadius = "10px";
    guardar.style.background = "#0D2B45";
    guardar.style.color = "white";
    guardar.style.cursor = "pointer";
    guardar.style.fontWeight = "600";

   guardar.onclick = async function() {

    if (
        !calendarioIngreso ||
        !calendarioEgreso
    ) {

        alert(
            "Seleccioná fecha de ingreso y egreso."
        );

        return;

    }

    if (
        calendarioEgreso <
        calendarioIngreso
    ) {

        alert(
            "La fecha de egreso debe ser posterior al ingreso."
        );

        return;

    }

    const houseId =
    calendarioCasaActual.id ||
    calendarioCasaActual.house_id;

if (!houseId) {

    alert(
        "No pudimos identificar esta casa."
    );

    console.error(
        "❌ No se encontró house_id:",
        h
    );

    return;

}

// ============================================
// VERIFICAR SUPERPOSICIÓN DE RESERVAS
// ============================================

const { data: reservasExistentes, error: errorReservas } =
    await supabaseClient
        .from("house_reservations")
        .select("check_in, check_out")
        .eq("house_id", houseId);

if (errorReservas) {

    console.error(
        "❌ Error verificando reservas existentes:",
        errorReservas
    );

    alert(
        "No pudimos verificar las reservas existentes."
    );

    return;

}

const nuevaEntrada = calendarioIngreso;
const nuevaSalida = calendarioEgreso;

const reservaSuperpuesta =
    (reservasExistentes || []).some(reserva => {

        const entradaExistente =
            fechaDesdeISO(reserva.check_in);

        const salidaExistente =
            fechaDesdeISO(reserva.check_out);

        return (
            nuevaEntrada <= salidaExistente &&
            nuevaSalida >= entradaExistente
        );

    });

if (reservaSuperpuesta) {

    alert(
        "Las fechas seleccionadas se superponen con una reserva existente."
    );

    return;

}

const { data, error } =
    await supabaseClient
        .from("house_reservations")
        .insert([{
            house_id: houseId,
            check_in:
                calendarioIngreso
                    .toISOString()
                    .split("T")[0],
            check_out:
                calendarioEgreso
                    .toISOString()
                    .split("T")[0]
        }])
        .select();

if (error) {

    console.error(
        "❌ Error guardando reserva:",
        error
    );

    alert(
        "No pudimos guardar la reserva."
    );

    return;

}

console.log(
    "✅ Reserva guardada:",
    data
);

document
    .getElementById("modalCalendarioCasa")
    .remove();
    await openHouse(current);

};

    acciones.appendChild(cancelar);
    acciones.appendChild(guardar);

    contenedor.appendChild(acciones);
}


function seleccionarFechaCalendario(fecha) {

    if (
        !calendarioIngreso ||
        (
            calendarioIngreso &&
            calendarioEgreso
        )
    ) {

        calendarioIngreso =
            fecha;

        calendarioEgreso =
            null;

    } else {

        if (
            fecha < calendarioIngreso
        ) {

            calendarioEgreso =
                calendarioIngreso;

            calendarioIngreso =
                fecha;

        } else {

            calendarioEgreso =
                fecha;

        }

    }

    renderCalendarioCasa();

}


function mismaFecha(a, b) {

    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );

}

function fechaDesdeISO(fechaISO) {

    const partes =
        fechaISO.split("-");

    return new Date(
        Number(partes[0]),
        Number(partes[1]) - 1,
        Number(partes[2])
    );

}

function formatearFecha(fecha) {

    return fecha.toLocaleDateString(
        "es-AR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

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

    const { data: reservasCasa, error: errorReservasCasa } =
    await supabaseClient
        .from("house_reservations")
        .select("check_in, check_out")
        .eq("house_id", h.id)
        .gte("check_out", new Date().toISOString().split("T")[0])
        .order("check_in", { ascending: true });

if (errorReservasCasa) {

    console.error(
        "❌ Error cargando reservas de la casa:",
        errorReservasCasa
    );

}

const proximaReserva =
    reservasCasa && reservasCasa.length > 0
        ? reservasCasa[0]
        : null;

if (proximaReserva) {

    // ============================================
// PRÓXIMA RESERVA DE LA CASA
// ============================================

const { data: reservasCasa, error: errorReservasCasa } =
    await supabaseClient
        .from("house_reservations")
        .select("check_in, check_out")
        .eq("house_id", h.id)
        .gte(
            "check_out",
            new Date().toISOString().split("T")[0]
        )
        .order("check_in", { ascending: true });

if (errorReservasCasa) {

    console.error(
        "❌ Error cargando reservas de la casa:",
        errorReservasCasa
    );

}

const proximaReserva =
    reservasCasa && reservasCasa.length > 0
        ? reservasCasa[0]
        : null;

if (proximaReserva) {

    document.getElementById("houseDetailIngreso").textContent =
        "Próximo ingreso: " +
        formatearFecha(
            fechaDesdeISO(proximaReserva.check_in)
        ) +
        " · Egreso: " +
        formatearFecha(
            fechaDesdeISO(proximaReserva.check_out)
        );

} else {

    document.getElementById("houseDetailIngreso").textContent =
        "Próximo ingreso: -";

}

        formatearFecha(
            fechaDesdeISO(proximaReserva.check_in)
        ) +
        " · Egreso: " +
        formatearFecha(
            fechaDesdeISO(proximaReserva.check_out)
        );

} else {

    document.getElementById("houseDetailIngreso").textContent =
        "Próximo ingreso: -";

}

    document.getElementById("houseDetailChecklist").textContent =
        "Checklist: " + checklist + "%";

    document.getElementById("houseDetailIncidencias").textContent =
        "Incidencias: " + incidenciasCasa;

   document.getElementById("houseDetailRating").textContent =
    "★ " +
    (
        valoraciones[h.nombre]?.promedio ?? "-"
    );

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

 botonEliminar.style.marginTop = "0";
botonEliminar.style.width = "auto";
botonEliminar.style.height = document.querySelector(".back").offsetHeight + "px";
botonEliminar.style.minHeight = "0";
botonEliminar.style.boxSizing = "border-box";
botonEliminar.style.background = "#8B4B4B";
botonEliminar.style.color = "white";
botonEliminar.style.border = "none";
botonEliminar.style.padding = "0 16px";
botonEliminar.style.borderRadius = "10px";
botonEliminar.style.position = "static";
botonEliminar.style.display = "flex";
botonEliminar.style.alignItems = "center";
botonEliminar.style.justifyContent = "center";
botonEliminar.style.transform = "translateY(-8px)";

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

        current = null;

        render();

        go("home");
    };

   document.querySelector(".property-top-bar").appendChild(botonEliminar);

// ============================================
// BOTÓN VALORACIÓN + QR
// ============================================

const linksValoracion = {
    "CASA GOSO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+GOSO",
    "CASA MORRISON": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+MORRISON",
    "AMANECER MARINO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=AMANECER+MARINO",
    "CASA LA HUELLA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+LA+HUELLA",
    "CASA OCEANO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+OCEANO",
    "CASA EL ENSUEÑO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+EL+ENSUE%C3%91O",
    "EL DESCANSO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=EL+DESCANSO",
    "LA MANSA Y LA BRAVA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=LA+MANSA+Y+LA+BRAVA",
    "CASA HUNT": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+HUNT",
    "CASA FILIPPA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+FILIPPA",
    "CASA OASIS": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+OASIS",
    "CASA COSTA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+COSTA",
    "CASA CHULA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+CHULA",
    "CASA AL MAR": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+AL+MAR",
    "CASA MIRADOR": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+MIRADOR",
    "CASA CABO SUELTO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+CABO+SUELTO",
    "CASA CORDOBA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+CORDOBA",
    "CASA DEL MEDANO": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=CASA+DEL+MEDANO",
    "COMO PEZ EN EL AGUA": "https://docs.google.com/forms/d/e/1FAIpQLScOz4UmYr9cznGdpskZXq016bjD1p1N2bWiN-12PeGDMHCCgg/viewform?usp=pp_url&entry.918470101=COMO+PEZ+EN+EL+AGUA"
};

const botonValoracionExistente =
    document.getElementById("btnValoracionPropiedad");

if (botonValoracionExistente) {
    botonValoracionExistente.remove();
}

const botonValoracion =
    document.createElement("button");

botonValoracion.id = "btnValoracionPropiedad";
botonValoracion.className = "btn";

botonValoracion.style.marginTop = "12px";
botonValoracion.style.width = "100%";
botonValoracion.style.background = "#556B4F";
botonValoracion.style.color = "white";
botonValoracion.style.border = "none";
botonValoracion.style.padding = "14px";
botonValoracion.style.borderRadius = "10px";
botonValoracion.style.cursor = "pointer";
botonValoracion.style.fontWeight = "600";

botonValoracion.innerHTML = "⭐ Valorar estadía";

botonValoracion.onclick = function(event) {

    event.stopPropagation();

    const nombreCasa =
        h.nombre ||
        h.name ||
        h.nombreCasa ||
        h.nombre_casa ||
        "";

    const link = linksValoracion[nombreCasa];

    if (!link) {
        alert("No encontramos el formulario de valoración para esta casa.");
        console.error("❌ No existe link de valoración para:", nombreCasa);
        return;
    }

    const modalExistente =
        document.getElementById("modalQRValoracion");

    if (modalExistente) {
        modalExistente.remove();
    }

    const modal =
        document.createElement("div");

    modal.id = "modalQRValoracion";

    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.background = "rgba(0,0,0,0.55)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "99999";
    modal.style.padding = "20px";
    modal.style.boxSizing = "border-box";

    const caja = document.createElement("div");

    caja.style.background = "#F7F3EA";
caja.style.borderRadius = "18px";
caja.style.padding = "24px 20px";
caja.style.maxWidth = "360px";
caja.style.width = "calc(100% - 40px)";
caja.style.boxSizing = "border-box";
caja.style.textAlign = "center";
    caja.style.boxShadow = "0 20px 60px rgba(0,0,0,0.25)";

    const titulo = document.createElement("div");

    titulo.innerText = "Valoración de estadía";
    titulo.style.fontFamily = "Georgia, serif";
    titulo.style.fontSize = "24px";
    titulo.style.color = "#0D2B45";
    titulo.style.marginBottom = "8px";

    const casa = document.createElement("div");

    casa.innerText = nombreCasa;
    casa.style.fontSize = "15px";
    casa.style.color = "#556B4F";
    casa.style.marginBottom = "18px";

    const qrContenedor = document.createElement("div");

    qrContenedor.style.background = "white";
qrContenedor.style.borderRadius = "14px";
qrContenedor.style.padding = "10px";
qrContenedor.style.width = "100%";
qrContenedor.style.maxWidth = "260px";
qrContenedor.style.boxSizing = "border-box";
qrContenedor.style.display = "block";
qrContenedor.style.margin = "0 auto 18px";

    const qr = document.createElement("img");

    qr.src =
        "https://quickchart.io/qr?text=" +
        encodeURIComponent(link) +
        "&size=260";

    qr.style.width = "100%";
qr.style.maxWidth = "240px";
qr.style.height = "auto";
qr.style.aspectRatio = "1 / 1";
qr.style.display = "block";
qr.style.margin = "0 auto";

    qr.alt = "QR de valoración";

    qrContenedor.appendChild(qr);

    const texto = document.createElement("div");

    texto.innerText =
        "Escaneá este código QR con el celular para dejar tu valoración.";

    texto.style.fontSize = "14px";
    texto.style.color = "#555";
    texto.style.lineHeight = "1.4";
    texto.style.marginBottom = "18px";

    const cerrar = document.createElement("button");

    cerrar.innerText = "Cerrar";
    cerrar.className = "btn";
    cerrar.style.width = "100%";
    cerrar.style.background = "#0D2B45";
    cerrar.style.color = "white";
    cerrar.style.border = "none";
    cerrar.style.padding = "13px";
    cerrar.style.borderRadius = "10px";
    cerrar.style.cursor = "pointer";
    cerrar.style.fontWeight = "600";

    cerrar.onclick = function() {
        modal.remove();
    };

    caja.appendChild(titulo);
    caja.appendChild(casa);
    caja.appendChild(qrContenedor);
    caja.appendChild(texto);
    caja.appendChild(cerrar);

    modal.appendChild(caja);

    document.body.appendChild(modal);

    modal.onclick = function(event) {
        if (event.target === modal) {
            modal.remove();
        }
    };
};

ratingElement.parentElement.appendChild(botonValoracion);


// ============================================
// BOTÓN CALENDARIO
// ============================================

const botonCalendarioExistente =
    document.getElementById("btnCalendarioPropiedad");

if (botonCalendarioExistente) {
    botonCalendarioExistente.remove();
}

const botonCalendario =
    document.createElement("button");

botonCalendario.id = "btnCalendarioPropiedad";
botonCalendario.className = "btn";

botonCalendario.style.marginTop = "12px";
botonCalendario.style.width = "100%";
botonCalendario.style.background = "#0D2B45";
botonCalendario.style.color = "white";
botonCalendario.style.border = "none";
botonCalendario.style.padding = "14px";
botonCalendario.style.borderRadius = "10px";
botonCalendario.style.cursor = "pointer";
botonCalendario.style.fontWeight = "600";
botonCalendario.style.display = "flex";
botonCalendario.style.alignItems = "center";
botonCalendario.style.justifyContent = "center";
botonCalendario.style.gap = "8px";

botonCalendario.innerHTML =
    cbIcon("calendar") + " Calendario";

botonCalendario.onclick = function(event) {

    event.stopPropagation();

    abrirCalendarioCasa(h);

};

ratingElement.parentElement.appendChild(botonCalendario);

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

async function guardarInfoGeneral() {

    const h = houses[current];

    if (!h || !h.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

    h.nombre = document.getElementById("infoNombre").value;
    h.name = h.nombre;
    h.nombreCasa = h.nombre;
    h.nombre_casa = h.nombre;

    h.direccion =
        document.getElementById("infoDireccion").value;

    h.propietario =
        document.getElementById("infoPropietario").value;

    h.telefono =
        document.getElementById("infoTelefono").value;

    h.capacidad =
        document.getElementById("infoCapacidad").value;

    h.habitaciones =
        document.getElementById("infoHabitaciones").value;

    h.banios =
        document.getElementById("infoBanios").value;

    h.wifi =
        document.getElementById("infoWifi").value;

    h.alarma =
        document.getElementById("infoAlarma").value;

    h.obs =
        document.getElementById("infoObservaciones").value;


    await saveHouseToSupabase(h);

    console.log(
        "✅ INFORMACIÓN GENERAL GUARDADA:",
        h.id
    );

    go("infoGeneral");
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
// NO HAY INVENTARIO EN SUPABASE
// ============================================

console.log(
    "ℹ️ No hay inventario en Supabase para esta casa."
);

return [];
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

function editCurrent(){let h=houses[current];
document.getElementById('name').value=(h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? '');document.getElementById('barrio').value=h.barrio;document.getElementById('lote').value=h.lote||'';document.getElementById('capacidad').value=h.capacidad;document.getElementById('wifi').value=h.wifi;document.getElementById('obs').value=h.obs;document.getElementById('situacion').value=h.situacion || 'Disponible';go('edit');}

async function saveCurrent(){let h=houses[current];
h.nombre=document.getElementById('name').value; h.name=document.getElementById('name').value; h.nombreCasa=document.getElementById('name').value; h.nombre_casa=document.getElementById('name').value;h.barrio=document.getElementById('barrio').value;h.lote=document.getElementById('lote').value;h.capacidad=document.getElementById('capacidad').value;h.wifi=document.getElementById('wifi').value;h.obs=document.getElementById('obs').value;h.situacion=document.getElementById('situacion').value;
await saveHouseToSupabase(h);
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

let checks = {};
actualizarEstadosTodasLasCasas();
render();

let paso = 0;
let observaciones = {};

async function guardarChecklistSupabase() {

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

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

async function startPreparation(){

    console.log("CURRENT =", current);

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

    console.log("🏠 Cargando checklist de Supabase:", house.id);

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

observaciones =
    data.observaciones &&
    typeof data.observaciones === "object"
        ? data.observaciones
        : {};

console.log(
    "📝 OBSERVACIONES ENCONTRADAS EN SUPABASE:",
    observaciones
);

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
 observaciones['${obsKey}'] = this.value;

guardarChecklistSupabase();
"
>${observaciones[obsKey]||""}</textarea>

</div>
`;

}

function obtenerPorcentajeChecklist(houseIndex) {

    let totalChecks = 0;
    let checksCompletados = 0;

    ambientes.forEach((ambiente, ambienteIndex) => {

        const key = "c" + houseIndex + "_" + ambienteIndex;

        ambiente.items.forEach((item, itemIndex) => {

            totalChecks++;

            if (
                checklistData &&
                checklistData[key] &&
                checklistData[key][itemIndex] === true
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

    const checksActuales = checks || {};

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

    houses[current].checklistPorcentaje =
        totalChecks > 0
            ? Math.round(
                (checksCompletados / totalChecks) * 100
            )
            : 0;

    if (checksCompletados === 0) {

        houses[current].estado = "Pendiente";

    } else if (checksCompletados < totalChecks) {

        houses[current].estado = "En preparación";

    } else {

        houses[current].estado = "Lista para entregar";

    }

    console.log(
        "🏠 ESTADO ACTUALIZADO:",
        houses[current].nombre,
        houses[current].estado,
        houses[current].checklistPorcentaje + "%"
    );
}

function actualizarEstadosTodasLasCasas() {

    const checksActuales = checks || {};

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

}

function nextStep(){

    const obs = document.getElementById("obsPrep");

    if (obs) {

        console.log("📝 GUARDANDO OBSERVACIÓN:", obs.value);

        observaciones["c" + current + "_" + paso] = obs.value;

        guardarChecklistSupabase();
    }

    if (paso < ambientes.length - 1) {

        paso++;
        renderPrep();

    } else {

        actualizarEstadoCasa();
        render();
        go("property");
    }
}

let checklistData = {};

// ============================================
// CARGAR CONFIGURACIÓN DEL CHECKLIST DESDE SUPABASE
// ============================================

async function cargarConfiguracionChecklistCasa(){

    const house = houses[current];

    if (!house || !house.id) {

        console.error(
            "❌ La casa no tiene UUID de Supabase"
        );

        return;
    }

    console.log(
        "☁️ CARGANDO CONFIGURACIÓN CHECKLIST:",
        house.id
    );

    const { data, error } =
        await supabaseClient
            .from("house_checklist_config")
            .select("data")
            .eq("house_id", house.id)
            .maybeSingle();

    if (error) {

        console.error(
            "❌ ERROR CARGANDO CONFIGURACIÓN CHECKLIST:",
            error
        );

        return;
    }

    const key = "c" + current;

    // ============================================
    // SI EXISTE EN SUPABASE
    // ============================================

    if (data && data.data) {

        checklistData[key] =
            JSON.parse(JSON.stringify(data.data));

        console.log(
            "✅ CONFIGURACIÓN CHECKLIST CARGADA DESDE SUPABASE:",
            house.id
        );

        return;
    }

    // ============================================
// SI NO EXISTE:
// USAR CONFIGURACIÓN ESTÁNDAR
// ============================================

    if (!checklistData[key]) {

        checklistData[key] =
            JSON.parse(JSON.stringify(ambientes));

    }

    // ============================================
    // GUARDAR CONFIGURACIÓN INICIAL EN SUPABASE
    // ============================================

    const { error: errorGuardar } =
        await supabaseClient
            .from("house_checklist_config")
            .upsert(
                {
                    house_id: house.id,
                    data: checklistData[key],
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "house_id"
                }
            );

    if (errorGuardar) {

        console.error(
            "❌ ERROR GUARDANDO CONFIGURACIÓN INICIAL:",
            errorGuardar
        );

        return;
    }

    console.log(
        "✅ CONFIGURACIÓN INICIAL GUARDADA EN SUPABASE:",
        house.id
    );
}


// ============================================
// CHECKLIST LOCAL — RESPALDO
// ============================================

function ensureChecklist(){

    const key = "c" + current;

    if(!checklistData[key]){

        checklistData[key] =
            JSON.parse(JSON.stringify(ambientes));
    }

    return checklistData[key];
}

// ============================================
// MIGRAR CONFIGURACIÓN DE CHECKLIST A SUPABASE
// ============================================

async function openChecklistEditor(){

    // Primero cargamos la configuración real desde Supabase
    await cargarConfiguracionChecklistCasa();

    const sel =
        document.getElementById("ambienteSel");

    sel.innerHTML = "";

    ensureChecklist().forEach((a, i) => {

        sel.innerHTML +=
            `<option value="${i}">
                ${a.title}
            </option>`;
    });

    loadChecklistEditor();

    go("editChecklist");
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

async function guardarConfiguracionChecklist(){

    const house = houses[current];

    if (!house || !house.id) {

        console.error(
            "❌ La casa no tiene UUID de Supabase"
        );

        return;
    }

    const key = "c" + current;

    const { error } =
        await supabaseClient
            .from("house_checklist_config")
            .upsert(
                {
                    house_id: house.id,
                    data: checklistData[key],
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "house_id"
                }
            );

    if (error) {

        console.error(
            "❌ ERROR GUARDANDO CONFIGURACIÓN CHECKLIST:",
            error
        );

        alert(
            "No se pudo guardar el checklist. Revisá la consola."
        );

        return;
    }

    console.log(
        "✅ CONFIGURACIÓN CHECKLIST GUARDADA EN SUPABASE:",
        house.id
    );
}


async function editItem(a, i, v){

    ensureChecklist()[a].items[i] = v;

    await guardarConfiguracionChecklist();
}


async function delItem(a, i){

    ensureChecklist()[a].items.splice(i, 1);

    await guardarConfiguracionChecklist();

    loadChecklistEditor();
}


async function addItem(){

    const a =
        parseInt(
            document.getElementById("ambienteSel").value || 0
        );

    const v =
        document
            .getElementById("nuevoItem")
            .value
            .trim();

    if(!v) return;

    ensureChecklist()[a].items.push(v);

    document.getElementById("nuevoItem").value = "";

    await guardarConfiguracionChecklist();

    loadChecklistEditor();
}

// ============================================
// MANUAL DE LA CASA - SUPABASE
// ============================================

let manualCasa = {};
let manualActual = "emergencias";


// ============================================
// CARGAR MANUAL DE LA CASA
// ============================================

async function cargarManualCasa(){

    const house = houses[current];

    if (!house || !house.id) {

        console.error(
            "❌ La casa no tiene UUID de Supabase"
        );

        return {};
    }

    const { data, error } = await supabaseClient
        .from("house_manual")
        .select("id, house_id, data, updated_at")
        .eq("house_id", house.id)
        .maybeSingle();

    if (error) {

        console.error(
            "❌ Error cargando manual desde Supabase:",
            error
        );

        return {};
    }

        // ============================================
    // YA EXISTE EN SUPABASE
    // ============================================

    if (data) {

        console.log(
            "✅ MANUAL ENCONTRADO EN SUPABASE:",
            house.id
        );

        manualCasa =
            data.data &&
            typeof data.data === "object"
                ? data.data
                : {};

        return manualCasa;
    }

    // ============================================
    // NO HAY MANUAL EN SUPABASE
    // ============================================

    console.log(
        "ℹ️ No hay manual en Supabase para esta casa."
    );

    manualCasa = {};

    return manualCasa;

}


// ============================================
// ABRIR UNA SECCIÓN DEL MANUAL
// ============================================

function abrirManual(tipo){

    manualActual = tipo;

    document.getElementById(
        "manualTitulo"
    ).innerText =
        tipo.charAt(0).toUpperCase() +
        tipo.slice(1);

    document.getElementById(
        "manualTexto"
    ).value =
        manualCasa[tipo] || "";

    go("manualEdit");
}


// ============================================
// ABRIR MANUAL COMPLETO DE LA CASA
// ============================================

async function abrirManualCasa(){

    console.log(
        "📖 CARGANDO MANUAL DESDE SUPABASE..."
    );

    await cargarManualCasa();

    const emergencias =
        document.getElementById("txtEmergencias");

    if (emergencias) {

        emergencias.innerText =
            manualCasa["emergencias"] ||
            "No hay información.";
    }

    const accesos =
        document.getElementById("txtAccesos");

    if (accesos) {

        accesos.innerText =
            manualCasa["accesos"] ||
            "No hay información.";
    }

    const tecnologia =
        document.getElementById("txtTecnologia");

    if (tecnologia) {

        tecnologia.innerText =
            manualCasa["tecnologia"] ||
            "No hay información.";
    }

    const exterior =
        document.getElementById("txtExterior");

    if (exterior) {

        exterior.innerText =
            manualCasa["exterior"] ||
            "No hay información.";
    }

    const blancos =
        document.getElementById("txtBlancos");

    if (blancos) {

        blancos.innerText =
            manualCasa["blancos"] ||
            "No hay información.";
    }

    const proveedores =
        document.getElementById("txtProveedores");

    if (proveedores) {

        proveedores.innerText =
            manualCasa["proveedores"] ||
            "No hay información.";
    }

    go("manual");
}
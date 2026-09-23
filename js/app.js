// ============================================
// MONITOREO CENTRALIZADO DE ERRORES
// ============================================

(function iniciarMonitoreoErrores() {

    const erroresRecientes = new Map();
    const LIMITE_POR_SESION = 20;
    const VENTANA_DUPLICADO_MS = 60000;

    let cantidadEnviada = 0;
    let enviandoError = false;

    function normalizarError(error) {

        if (error instanceof Error) {
            return {
                message:
                    error.message ||
                    "Error sin mensaje",
                stack:
                    error.stack ||
                    null
            };
        }

        if (
            error &&
            typeof error === "object"
        ) {
            return {
                message:
                    error.message ||
                    JSON.stringify(error),
                stack:
                    error.stack ||
                    null
            };
        }

        return {
            message:
                String(error || "Error sin mensaje"),
            stack: null
        };
    }


    async function reportarErrorAplicacion(
        error,
        opciones = {}
    ) {

        if (
            enviandoError ||
            !navigator.onLine ||
            cantidadEnviada >= LIMITE_POR_SESION ||
            typeof supabaseClient === "undefined"
        ) {
            return null;
        }

        const errorNormalizado =
            normalizarError(error);

        if (
            !errorNormalizado.message ||
            errorNormalizado.message ===
                "Script error."
        ) {
            return null;
        }

        const source =
            opciones.source ||
            "client";

        const huella =
            source +
            "|" +
            errorNormalizado.message +
            "|" +
            (
                errorNormalizado.stack ||
                ""
            ).slice(0, 300);

        const ahora = Date.now();
        const ultimoRegistro =
            erroresRecientes.get(huella);

        if (
            ultimoRegistro &&
            ahora - ultimoRegistro <
                VENTANA_DUPLICADO_MS
        ) {
            return null;
        }

        erroresRecientes.set(
            huella,
            ahora
        );

        enviandoError = true;

        try {

            const pageUrl =
                window.location.origin +
                window.location.pathname;

            const contexto = {
                filename:
                    opciones.filename ||
                    null,
                line:
                    opciones.line ||
                    null,
                column:
                    opciones.column ||
                    null,
                online:
                    navigator.onLine,
                standalone:
                    window.matchMedia(
                        "(display-mode: standalone)"
                    ).matches
            };

            const { data, error: rpcError } =
                await supabaseClient.rpc(
                    "log_client_error",
                    {
                        p_source: source,
                        p_message:
                            errorNormalizado.message,
                        p_stack:
                            errorNormalizado.stack,
                        p_context:
                            contexto,
                        p_page_url:
                            pageUrl,
                        p_user_agent:
                            navigator.userAgent
                    }
                );

            if (!rpcError && data) {
                cantidadEnviada++;
                return data;
            }

            return null;

        } catch (_) {

            return null;

        } finally {

            enviandoError = false;

        }
    }


    window.addEventListener(
        "error",
        function(event) {

            reportarErrorAplicacion(
                event.error ||
                event.message,
                {
                    source:
                        "window.error",
                    filename:
                        event.filename,
                    line:
                        event.lineno,
                    column:
                        event.colno
                }
            );

        }
    );


    window.addEventListener(
        "unhandledrejection",
        function(event) {

            reportarErrorAplicacion(
                event.reason,
                {
                    source:
                        "unhandledrejection"
                }
            );

        }
    );


    window.hmReportarError =
        reportarErrorAplicacion;

})();

let houses = [];
let current = 0;

let valoraciones = {};

const URL_VALORACIONES =
    "https://script.google.com/macros/s/AKfycbwS6PlI756K21HxlohFoLtXcfzhUK9W5S60aa5rW-11fbSaUUm1Wow7t59KwPZbsSuIXw/exec";

function mostrarLoader(texto = "Cargando...") {

    const loader =
        document.getElementById("appLoader");

    const textoLoader =
        document.getElementById("appLoaderTexto");

    if (!loader) return;

    if (textoLoader) {
        textoLoader.textContent = texto;
    }

    loader.classList.add("visible");
}

function ocultarLoader() {

    const loader =
        document.getElementById("appLoader");

    if (!loader) return;

    loader.classList.remove("visible");
}

function actualizarEstadoConexion() {

    const banner =
        document.getElementById("offlineBanner");

    if (!banner) return;

    if (navigator.onLine) {
        banner.classList.remove("visible");
    } else {
        banner.classList.add("visible");
    }
}

window.addEventListener(
    "online",
    actualizarEstadoConexion
);

window.addEventListener(
    "offline",
    actualizarEstadoConexion
);

document.addEventListener(
    "DOMContentLoaded",
    actualizarEstadoConexion
);

    async function cargarValoraciones() {

    try {

        const respuesta = await fetch(URL_VALORACIONES);

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las valoraciones");
        }

        valoraciones = await respuesta.json();

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

        mostrarLoader("Cargando propiedades...");

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

    houses = [];

    await cargarValoraciones();
    await render();

    return;
}

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
await render();

    } catch (error) {

    console.error(
        "❌ Error inesperado cargando casas:",
        error
    );

} finally {

    ocultarLoader();

}
}

let propertyFilter='Todas';
function setPropertyFilter(filtro){
    propertyFilter = filtro;
    render();
}

function cbIcon(name, extraClass = ""){

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

            trash: `
    <svg viewBox="0 0 24 24">
        <path d="M4 7h16"></path>
        <path d="M9 7V4h6v3"></path>
        <path d="M7 7l1 13h8l1-13"></path>
        <line x1="10" y1="10" x2="10.5" y2="17"></line>
        <line x1="14" y1="10" x2="13.5" y2="17"></line>
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

   return `<span class="cb-icon ${extraClass}">${icons[name] || ''}</span>`;
}

initPhotoDB();

async function go(id){

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
    await procesarDestinoNotificacionPendiente();
}
}

window.hmHandleBack = function() {

    const notificationsPanel =
        document.getElementById(
            "notificationsContent"
        );

    if (
        notificationsPanel &&
        notificationsPanel.style.display ===
            "block"
    ) {
        notificationsPanel.style.display =
            "none";

        return true;
    }

    const visibleModal =
        Array.from(
            document.querySelectorAll(
                ".hm-modal"
            )
        ).find(
            modal =>
                window.getComputedStyle(
                    modal
                ).display !== "none"
        );

    if (visibleModal) {
        visibleModal.style.display = "none";
        return true;
    }

    const activeScreen =
        document.querySelector(
            ".screen.active"
        )?.id;

    if (activeScreen === "cover") {
        return false;
    }

    if (activeScreen === "home") {

        const superadminAccess =
            document.getElementById(
                "superadminAccess"
            );

        if (
            superadminAccess &&
            superadminAccess.style.display ===
                "block"
        ) {
            abrirSuperadmin();
        } else {
            go("cover");
        }

        return true;
    }

    if (
        activeScreen === "activityHistory" ||
        activeScreen === "property" ||
        activeScreen === "usuarios" ||
        activeScreen ===
            "configuracionOrganizacion"
    ) {
        go("home");
        return true;
    }

    if (activeScreen === "superadmin") {
        go("cover");
        return true;
    }

    if (activeScreen === "manualEdit") {
        go("manual");
        return true;
    }

    if (activeScreen === "prep") {
    volverDesdeChecklist();
    return true;
}

    if (
        activeScreen === "infoGeneral" ||
        activeScreen === "incidencias" ||
        activeScreen === "inventario" ||
        activeScreen === "manual" ||
        activeScreen === "photos" ||
        activeScreen === "edit" ||
        activeScreen === "editChecklist"
    ) {
        openHouse(current);
        return true;
    }

if (activeScreen === "checkInReserva") {
    volverAReservaDesdeCheckIn();
    return true;
}

if (activeScreen === "checkOutReserva") {
    volverAReservaDesdeCheckOut();
    return true;
}

if (activeScreen === "preparacionReserva") {
    volverAReservaDesdePreparacion();
    return true;
}

if (activeScreen === "detalleReserva") {
    volverAlCalendarioDesdeReserva();
    return true;
}

if (activeScreen === "calendarioCasa") {
    openHouse(current);
    return true;
}

if (activeScreen === "estadoCuenta") {
    go("property");
    return true;
}

    go("home");
    return true;
};

window.history.pushState(
    { hmBackGuard: true },
    "",
    window.location.href
);

window.addEventListener("popstate", function() {
    window.history.pushState(
        { hmBackGuard: true },
        "",
        window.location.href
    );

    window.hmHandleBack();
});

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

function crearPropiedadVacia() {

    return {
        nombre: "",
        barrio: "",
        lote: "",
        capacidad: "",
        wifi: "",
        obs: "",
        rating: "",
        estado: "Pendiente",
        ingreso: "",
        checklistPorcentaje: 0,
        situacion: "Disponible"
    };
}


function iniciarNuevaPropiedad(
    directoAEdicion = false
) {

    const nuevaCasa =
        crearPropiedadVacia();

    houses.push(nuevaCasa);

    current =
        houses.length - 1;

    if (directoAEdicion) {
        editCurrent();
        return;
    }

    render();
    openHouse(current);
}


function comenzarPrimeraPropiedad() {

    const modal =
        document.getElementById(
            "modalBienvenidaOnboarding"
        );

    if (modal) {
        modal.style.display = "none";
    }

    window.bienvenidaOnboardingMostrada =
        true;

    iniciarNuevaPropiedad(true);
}


async function mostrarBienvenidaOnboardingSiCorresponde() {

    if (
    window.onboardingRecienCreado !== true ||
    houses.length > 0 ||
    window.bienvenidaOnboardingMostrada
) {
    return;
}

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) return;

    const {
        data: rolActual,
        error
    } = await supabaseClient.rpc(
        "current_organization_role"
    );

    if (
        error ||
        rolActual !== "admin"
    ) {
        return;
    }

    const modal =
        document.getElementById(
            "modalBienvenidaOnboarding"
        );

    if (modal) {
        window.bienvenidaOnboardingMostrada =
            true;

        modal.style.display = "flex";
    }
}

let cambioEstadoOrganizacionPendiente =
    null;

function cambiarEstadoOrganizacion(
    organizationId,
    organizationName,
    activoActual
) {
    cambioEstadoOrganizacionPendiente = {
        organizationId,
        organizationName,
        activoActual
    };

    const accion =
        activoActual
            ? "suspender"
            : "activar";

    const titulo =
        activoActual
            ? "Suspender organización"
            : "Activar organización";

    const texto =
        activoActual
            ? `¿Querés suspender temporalmente a “${organizationName}”? Sus usuarios no podrán ingresar hasta que vuelvas a activarla.`
            : `¿Querés activar nuevamente a “${organizationName}”? Sus usuarios recuperarán el acceso.`;

    document.getElementById(
        "modalEstadoTitulo"
    ).textContent = titulo;

    document.getElementById(
        "modalEstadoTexto"
    ).textContent = texto;

    const boton =
        document.getElementById(
            "modalEstadoConfirmar"
        );

    boton.textContent =
        activoActual
            ? "Sí, suspender"
            : "Sí, activar";

    boton.className =
        activoActual
            ? "btn estado-suspender"
            : "btn estado-activar";

    boton.disabled = false;

    const mensaje =
        document.getElementById(
            "modalEstadoMensaje"
        );

    mensaje.textContent = "";
    mensaje.style.display = "none";

    document.getElementById(
        "modalEstadoOrganizacion"
    ).style.display = "flex";
}

function cerrarModalEstadoOrganizacion() {
    document.getElementById(
        "modalEstadoOrganizacion"
    ).style.display = "none";

    cambioEstadoOrganizacionPendiente =
        null;
}

async function confirmarCambioEstadoOrganizacion() {
    if (
        !cambioEstadoOrganizacionPendiente
    ) {
        return;
    }

    const {
        organizationId,
        activoActual
    } =
        cambioEstadoOrganizacionPendiente;

    const boton =
        document.getElementById(
            "modalEstadoConfirmar"
        );

    const mensaje =
        document.getElementById(
            "modalEstadoMensaje"
        );

    boton.disabled = true;

    mensaje.textContent =
        activoActual
            ? "Suspendiendo organización..."
            : "Activando organización...";

    mensaje.style.display = "block";
    mensaje.style.background = "#F1F3ED";
    mensaje.style.color = "#687A59";

    const { error } =
        await supabaseClient.rpc(
            "superadmin_set_organization_status",
            {
                p_organization_id:
                    organizationId,
                p_activo:
                    !activoActual
            }
        );

    if (error) {
        console.error(
            "Error actualizando organización:",
            error
        );

        mensaje.textContent =
            "No se pudo actualizar el estado.";
        mensaje.style.background = "#F7EFE6";
        mensaje.style.color = "#9A4F43";

        boton.disabled = false;
        return;
    }

    mensaje.textContent =
        activoActual
            ? "Organización suspendida correctamente."
            : "Organización activada correctamente.";

    mensaje.style.background = "#EEF3E9";
    mensaje.style.color = "#687A59";

    setTimeout(
        async () => {
            cerrarModalEstadoOrganizacion();
            await abrirSuperadmin();
        },
        800
    );
}

function editarDatosComerciales(
    organizacion
) {
    organizacionComercialActual =
        organizacion;

    document.getElementById(
        "modalEditarPlanEmpresa"
    ).textContent =
        organizacion.nombre;

    document.getElementById(
        "superadminPlan"
    ).value =
        organizacion.plan ===
        "sin_asignar"
            ? ""
            : organizacion.plan || "";

    document.getElementById(
        "superadminLimitePropiedades"
    ).value =
        organizacion.limite_propiedades ??
        "";

    document.getElementById(
        "superadminLimiteUsuarios"
    ).value =
        organizacion.limite_usuarios ??
        "";

    document.getElementById(
        "superadminPrecioMensual"
    ).value =
        organizacion.precio_mensual ??
        "";

    document.getElementById(
        "superadminMoneda"
    ).value =
        organizacion.moneda || "USD";

    const mensaje =
        document.getElementById(
            "superadminPlanMensaje"
        );

    mensaje.textContent = "";
    mensaje.style.display = "none";

    document.getElementById(
        "modalEditarPlan"
    ).style.display = "flex";
}

function cerrarModalEditarPlan() {
    document.getElementById(
        "modalEditarPlan"
    ).style.display = "none";

    organizacionComercialActual = null;
}

async function guardarDatosComerciales() {
    if (!organizacionComercialActual) {
        return;
    }

    const plan =
        document.getElementById(
            "superadminPlan"
        ).value.trim();

    const propiedadesNumero =
        Number(
            document.getElementById(
                "superadminLimitePropiedades"
            ).value
        );

    const usuariosNumero =
        Number(
            document.getElementById(
                "superadminLimiteUsuarios"
            ).value
        );

    const precioNumero =
        Number(
            document.getElementById(
                "superadminPrecioMensual"
            ).value
        );

    const moneda =
        document.getElementById(
            "superadminMoneda"
        ).value;

    const mensaje =
        document.getElementById(
            "superadminPlanMensaje"
        );

    if (
        !plan ||
        !Number.isInteger(
            propiedadesNumero
        ) ||
        propiedadesNumero <= 0 ||
        !Number.isInteger(
            usuariosNumero
        ) ||
        usuariosNumero <= 0 ||
        !Number.isFinite(
            precioNumero
        ) ||
        precioNumero < 0
    ) {
        mensaje.textContent =
            "Completá correctamente todos los campos.";
        mensaje.style.display = "block";
        return;
    }

    mensaje.textContent =
        "Guardando cambios...";
    mensaje.style.display = "block";
    mensaje.style.background = "#F1F3ED";
    mensaje.style.color = "#687A59";

    const { error } =
        await supabaseClient.rpc(
            "superadmin_update_organization_commercial",
            {
                p_organization_id:
                    organizacionComercialActual.id,
                p_plan:
                    plan,
                p_limite_propiedades:
                    propiedadesNumero,
                p_limite_usuarios:
                    usuariosNumero,
                p_precio_mensual:
                    precioNumero,
                p_moneda:
                    moneda
            }
        );

    if (error) {
        console.error(
            "Error actualizando datos comerciales:",
            error
        );

        mensaje.textContent =
            "No se pudieron guardar los cambios.";
        mensaje.style.background = "#F7EFE6";
        mensaje.style.color = "#9A4F43";
        return;
    }

    mensaje.textContent =
        "Cambios guardados correctamente.";
    mensaje.style.background = "#EEF3E9";
    mensaje.style.color = "#687A59";

    setTimeout(
        async () => {
            cerrarModalEditarPlan();
            await abrirSuperadmin();
        },
        700
    );
}

async function reanudarSesionHM() {
    const url = new URL(window.location.href);

    if (
        url.hash.includes("type=recovery") ||
        url.hash.includes("type=invite") ||
        url.searchParams.get("hm_invite") === "1"
    ) {
        return false;
    }

    const { data: sesionData, error: sesionError } =
        await supabaseClient.auth.getSession();

    if (sesionError || !sesionData.session) {
        return false;
    }

    mostrarLoader("Recuperando sesión...");

    try {
        const { data: usuarioData, error: usuarioError } =
            await supabaseClient.auth.getUser();

        if (usuarioError || !usuarioData.user) {
            return false;
        }

        const { data: acceso, error: accesoError } =
            await supabaseClient.rpc(
                "current_user_access_status"
            );

        if (accesoError || acceso !== "activo") {
            return false;
        }

        window.usuarioAutenticado = true;
        await abrirDestinoInicial();
        return true;

    } catch (error) {
        window.usuarioAutenticado = false;
        console.error("Error recuperando sesión HM:", error);
        return false;

    } finally {
        ocultarLoader();
    }
}

async function iniciarIngreso() {
    const sesionReanudada = await reanudarSesionHM();

    if (sesionReanudada) {
        return;
    }

    const ok = await probarLogin();

    if (ok) {
        await abrirDestinoInicial();
    }
}

async function abrirDestinoInicial() {

    const {
        data: esSuperadmin,
        error
    } = await supabaseClient.rpc(
        "current_user_is_superadmin"
    );

    if (!error && esSuperadmin === true) {
        await abrirSuperadmin();
        return;
    }

    await go("home");
}


async function ingresarOrganizacionSuperadmin(
    organizationId,
    organizationName
) {

    mostrarLoader(
        `Ingresando a ${organizationName}...`
    );

    const { error } = await supabaseClient.rpc(
        "superadmin_select_organization",
        {
            p_organization_id: organizationId
        }
    );

    if (error) {

        ocultarLoader();

        console.error(
            "Error seleccionando organización:",
            error
        );

        alert(
            "No se pudo ingresar a la organización."
        );

        return;
    }

    propertyFilter = "Todas";
    current = 0;

    await go("home");
}

document.addEventListener("DOMContentLoaded", () => {
    reanudarSesionHM();
});

async function cerrarSesionHM() {
    const confirmado = await confirmarAccionHM(
        "Saldrás de House Management en este dispositivo.",
        "Cerrar sesión",
        "CERRAR SESIÓN",
        "#0D2B45",
        "CANCELAR"
    );

    if (!confirmado) {
        return;
    }

    mostrarLoader("Cerrando sesión...");

    try {
        const { error } =
            await supabaseClient.auth.signOut({
                scope: "local"
            });

        if (error) {
            console.error("Error cerrando sesión HM:", error);
            mostrarAvisoHM("No se pudo cerrar la sesión");
            return;
        }

        window.usuarioAutenticado = false;
        houses = [];
        current = 0;
        checks = {};

        await go("cover");

    } catch (error) {
        console.error("Error cerrando sesión HM:", error);
        mostrarAvisoHM("No se pudo cerrar la sesión");

    } finally {
        ocultarLoader();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document
        .querySelectorAll(".screen:not(#cover)")
        .forEach(pantalla => {
            const pie = document.createElement("div");
            pie.className = "hm-session-footer";

            const enlace = document.createElement("a");
            enlace.href = "#";
            enlace.textContent = "Cerrar sesión";

            enlace.addEventListener("click", event => {
                event.preventDefault();
                cerrarSesionHM();
            });

            pie.appendChild(enlace);
            pantalla.appendChild(pie);
        });
});

async function abrirSuperadmin() {

    const {
        data: esSuperadmin,
        error: accesoError
    } = await supabaseClient.rpc(
        "current_user_is_superadmin"
    );

    if (
        accesoError ||
        esSuperadmin !== true
    ) {
        alert(
            "No tenés permisos para acceder al panel de Superadministrador."
        );
        return;
    }

    go("superadmin");

    const contenido =
        document.getElementById(
            "superadminContent"
        );

    if (!contenido) return;

    contenido.textContent =
        "Cargando organizaciones...";

    const {
        data: organizaciones,
        error
    } = await supabaseClient.rpc(
        "superadmin_list_organizations"
    );

    if (error) {
        console.error(
            "Error cargando organizaciones:",
            error
        );

        contenido.textContent =
            "No se pudieron cargar las organizaciones.";

        return;
    }

    contenido.replaceChildren();

    if (!organizaciones?.length) {
        contenido.textContent =
            "Todavía no hay organizaciones registradas.";
        return;
    }

    const { data: casasVisibilidad, error: casasError } =
        await supabaseClient.rpc("superadmin_list_houses_visibility");

    organizaciones.forEach(
        organizacion => {

            const tarjeta =
                document.createElement("article");

            tarjeta.className =
    "organization-settings-card superadmin-company-card";

            const titulo =
                document.createElement("h3");

            titulo.textContent =
                organizacion.nombre;

                const botonIngresar =
    document.createElement("button");

botonIngresar.type = "button";
botonIngresar.className = "btn";
botonIngresar.textContent =
    "Ingresar a la empresa";

botonIngresar.disabled =
    organizacion.activo !== true;

botonIngresar.addEventListener(
    "click",
    () => ingresarOrganizacionSuperadmin(
        organizacion.id,
        organizacion.nombre
    )
);

            const estado =
                document.createElement("p");

            estado.className =
    organizacion.activo
        ? "superadmin-status activa"
        : "superadmin-status suspendida";

estado.textContent =
    organizacion.activo
        ? "Empresa activa"
        : "Empresa suspendida";

            const propiedades =
                document.createElement("p");

            propiedades.textContent =
                `Propiedades activas: ${
                    organizacion.propiedades_activas
                }`;

            const usuarios =
                document.createElement("p");

            usuarios.textContent =
                `Usuarios activos: ${
                    organizacion.usuarios_activos
                }`;

                const plan =
    document.createElement("p");

const nombrePlan =
    organizacion.plan &&
    organizacion.plan !== "sin_asignar"
        ? organizacion.plan
              .replaceAll("_", " ")
        : "Sin asignar";

plan.textContent =
    `Plan: ${nombrePlan}`;

const limites =
    document.createElement("p");

limites.textContent =
    `Límites: ${
        organizacion.limite_propiedades ??
        "sin definir"
    } propiedades / ${
        organizacion.limite_usuarios ??
        "sin definir"
    } usuarios`;

const abono =
    document.createElement("p");

abono.textContent =
    organizacion.precio_mensual !== null
        ? `Abono: ${
            organizacion.moneda
          } ${
            Number(
                organizacion.precio_mensual
            ).toLocaleString(
                "es-AR"
            )
          } por mes`
        : "Abono: sin definir";

            const alta =
                document.createElement("p");

            alta.textContent =
                `Creada: ${
                    new Date(
                        organizacion.created_at
                    ).toLocaleDateString(
                        "es-AR"
                    )
                }`;

                const botonEstado =
    document.createElement("button");

botonEstado.type = "button";
botonEstado.className = "btn";

botonEstado.textContent =
    organizacion.activo
        ? "Suspender organización"
        : "Activar organización";

botonEstado.addEventListener(
    "click",
    () => cambiarEstadoOrganizacion(
        organizacion.id,
        organizacion.nombre,
        organizacion.activo
    )
);

const botonEditarComercial =
    document.createElement("button");

botonEditarComercial.type =
    "button";

botonEditarComercial.className =
    "btn";

botonEditarComercial.textContent =
    "Editar plan y límites";

botonEditarComercial.addEventListener(
    "click",
    () => editarDatosComerciales(
        organizacion
    )
);

const acciones =
    document.createElement("div");

acciones.className =
    "superadmin-actions";

acciones.append(
    botonIngresar,
    botonEditarComercial,
    botonEstado
);

    propiedades.className =
    "superadmin-stat";

usuarios.className =
    "superadmin-stat";

const resumen =
    document.createElement("div");

resumen.className =
    "superadmin-stats";

resumen.append(
    propiedades,
    usuarios
);

plan.className =
    "superadmin-detail";

limites.className =
    "superadmin-detail";

abono.className =
    "superadmin-detail";

alta.className =
    "superadmin-detail superadmin-created";

const detalle =
    document.createElement("div");

detalle.className =
    "superadmin-details";

detalle.append(
    plan,
    limites,
    abono,
    alta
);

const casasEmpresa = document.createElement("div");
casasEmpresa.className = "superadmin-house-visibility";
const tituloCasas = document.createElement("h4");
tituloCasas.textContent = "Casas visibles para el cliente";
casasEmpresa.appendChild(tituloCasas);

if (casasError) {
    const aviso = document.createElement("p");
    aviso.textContent = "No se pudo cargar el control de casas.";
    casasEmpresa.appendChild(aviso);
} else {
    const casasDeEmpresa = (casasVisibilidad || [])
        .filter(casa => String(casa.organization_id) === String(organizacion.id));
    if (!casasDeEmpresa.length) {
        const vacio = document.createElement("p");
        vacio.textContent = "Esta empresa todavía no tiene casas.";
        casasEmpresa.appendChild(vacio);
    }
    casasDeEmpresa.forEach(casa => {
        const fila = document.createElement("div");
        fila.className = "superadmin-house-row";
        const nombre = document.createElement("span");
        nombre.textContent = `${casa.nombre} — ${casa.visible_to_clients ? "Visible" : "Oculta"}`;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn";
        boton.textContent = casa.visible_to_clients ? "Apagar" : "Prender";
        boton.addEventListener("click", async () => {
            const accion = casa.visible_to_clients ? "ocultar" : "mostrar";
            if (!window.confirm(`¿Querés ${accion} “${casa.nombre}” para sus usuarios? No se borrará ningún dato.`)) return;
            boton.disabled = true;
            const { error: cambioError } = await supabaseClient.rpc(
                "superadmin_set_house_visibility",
                { p_house_id: casa.id, p_visible: !casa.visible_to_clients }
            );
            if (cambioError) {
                alert("No se pudo cambiar la visibilidad de esta casa.");
                boton.disabled = false;
                return;
            }
            await abrirSuperadmin();
        });
        fila.append(nombre, boton);
        casasEmpresa.appendChild(fila);
    });
}

tarjeta.append(
    titulo,
    estado,
    resumen,
    detalle,
    casasEmpresa,
    acciones
);

            contenido.appendChild(
                tarjeta
            );
        }
    );
}

async function render(){
        const thisRender = ++renderVersion;
    const c = document.getElementById('houses');
    c.innerHTML = '';

    // ============================================
// ACCESO ADMINISTRACIÓN DE USUARIOS
// ============================================

const usersAdminAccess =
    document.getElementById("usersAdminAccess");

if (usersAdminAccess) {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {

        usersAdminAccess.style.display = "none";

    } else {

        const {
            data: rolActual,
            error: rolError
        } = await supabaseClient.rpc(
            "current_organization_role"
        );

        if (rolError) {

            console.error(
                "❌ Error obteniendo rol para Usuarios:",
                rolError
            );

            usersAdminAccess.style.display = "none";

        } else {

            usersAdminAccess.style.display =
                rolActual === "admin"
                    ? "block"
                    : "none";
        }
    }
}

// ============================================
// ACCESO A CONFIGURACIÓN DE LA ORGANIZACIÓN
// ============================================

const organizationSettingsAccess =
    document.getElementById(
        "organizationSettingsAccess"
    );

if (organizationSettingsAccess) {

    const {
        data: rolConfiguracion,
        error: errorRolConfiguracion
    } = await supabaseClient.rpc(
        "current_organization_role"
    );

    if (
        errorRolConfiguracion ||
        rolConfiguracion !== "admin"
    ) {
        organizationSettingsAccess.style.display =
            "none";
    } else {
        organizationSettingsAccess.style.display =
            "block";
    }
}

// ============================================
// ACCESO AL PANEL DE SUPERADMINISTRADOR
// ============================================

const superadminAccess =
    document.getElementById("superadminAccess");

if (superadminAccess) {

    const {
        data: esSuperadmin,
        error: superadminError
    } = await supabaseClient.rpc(
        "current_user_is_superadmin"
    );

    if (
        superadminError ||
        esSuperadmin !== true
    ) {
        superadminAccess.style.display = "none";
    } else {
        superadminAccess.style.display = "block";
    }
}

await aplicarModulosOrganizacion();
const { data: rolHome } =
    await supabaseClient.rpc(
        "current_organization_role"
    );

const campanaHome =
    document.getElementById(
        "notificationsButton"
    );

const actividadHome =
    document.getElementById(
        "activityDashboard"
    );

const panelNotificacionesHome =
    document.getElementById(
        "notificationsContent"
    );

if (rolHome === "propietario") {

    campanaHome?.style.setProperty(
        "display",
        "none",
        "important"
    );

    actividadHome?.style.setProperty(
        "display",
        "none",
        "important"
    );

    if (panelNotificacionesHome) {
        panelNotificacionesHome.style.display =
            "none";
    }

} else {

    campanaHome?.style.removeProperty(
        "display"
    );

    actividadHome?.style.removeProperty(
        "display"
    );
}

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

casasFiltradas.sort((a, b) => {
    const nombreA =
        a.nombre ?? a.name ?? a.nombreCasa ?? a.nombre_casa ?? "";

    const nombreB =
        b.nombre ?? b.name ?? b.nombreCasa ?? b.nombre_casa ?? "";

    const ordenNombre = nombreA.localeCompare(
        nombreB,
        "es-AR",
        { sensitivity: "base" }
    );

    return ordenNombre ||
        String(a.id ?? "").localeCompare(String(b.id ?? ""));
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

// ============================================
// ESTADO VACÍO - PROPIEDADES
// ============================================

if (casasFiltradas.length === 0) {

    const estadoVacio = document.createElement("div");

    estadoVacio.className = "empty-state";

    estadoVacio.innerHTML = `
        <div class="empty-state-title">
            No hay propiedades para mostrar
        </div>

        <div class="empty-state-text">
            No encontramos propiedades que coincidan con la búsqueda o el filtro seleccionado.
        </div>
    `;
    c.appendChild(estadoVacio);

}

casasFiltradas.forEach((h)=>{

    const i = houses.indexOf(h);

const checklistCasa =
    checklistPorCasa[h.id] ?? 0;

const estadoCasa =
    checklistCasa === 0
        ? "Pendiente"
        : checklistCasa === 100
            ? "Lista para entregar"
            : "Preparación";
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
        estadoCasa === "Pendiente"
            ? "pending"
            : estadoCasa === "Preparación"
                ? "preparing"
                : "ready"
    }"></span>

    <span>${
        estadoCasa === "Lista para entregar"
            ? "Listo"
            : estadoCasa
    }</span>
</div>

      <div class="property-stat">
    ${cbIcon('calendar')}
    <span>
        <small>Ingreso</small>
        
${
    proximaReservaPorCasa[h.id]
        ? formatearFechaCorta(
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
        ? formatearFechaCorta(
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
if (thisRender !== renderVersion) return;

const {
    data: rolParaCrearPropiedad
} = await supabaseClient.rpc(
    "current_organization_role"
);

if (
    ["admin", "colaborador"].includes(
        rolParaCrearPropiedad
    )
) {

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
    iniciarNuevaPropiedad(false);
};

c.appendChild(agregar);
}

if (rolHome !== "propietario") {

    await prepararDashboardActividad();

} else {

    const actividadPropietario =
        document.getElementById(
            "activityDashboard"
        );

    actividadPropietario?.style.setProperty(
        "display",
        "none",
        "important"
    );
}
await mostrarNotificaciones();
await mostrarBienvenidaOnboardingSiCorresponde();

}

async function prepararDashboardActividad() {

    const contenedor =
        document.getElementById("activityDashboard");

    const contenido =
        document.getElementById("activityDashboardContent");

    if (!contenedor || !contenido) return;

    const { data: rolActual, error: rolError } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    if (
        rolError ||
        !["admin", "colaborador"].includes(rolActual)
    ) {
        contenedor.style.display = "none";
        return;
    }

    contenedor.style.display = "block";
    contenido.style.display = "none";
    contenido.innerHTML = "";
}

window.abrirActividad = async function() {

    const contenido =
        document.getElementById("activityDashboardContent");

    const boton =
        document.querySelector(
            ".activity-dashboard-header button"
        );

    if (!contenido) return;

    const estaOculto =
        contenido.style.display === "none";

    if (estaOculto) {

        contenido.style.display = "block";
        contenido.innerHTML = "Cargando actividad...";

        if (boton) {
            boton.textContent = "Ocultar actividad";
        }

        await mostrarDashboardActividad();

    } else {

        contenido.style.display = "none";

        if (boton) {
            boton.textContent = "Ver actividad";
        }
    }
};

async function openPhotos(){

    const selector =
        document.getElementById(
            "photoAmbiente"
        );

    const texto =
        document.getElementById(
            "photoAmbienteTexto"
        );

    if (selector) {
        selector.value = "fachada";
    }

    if (texto) {
        texto.textContent = "Fachada";
    }

    const { data: rolFotos } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    const panelAgregarFoto =
        document.getElementById(
            "panelAgregarFoto"
        );

    if (panelAgregarFoto) {
        panelAgregarFoto.style.display =
            ["admin", "colaborador"].includes(
                rolFotos
            )
                ? ""
                : "none";
    }

    go("photos");

    await mostrarFotos(current);
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

await mostrarFotos(current);

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
let calendarioReservaEditando = null;
let calendarioReservaViendo = null;
let calendarioPuedeEditar = false;
let calendarioInquilinoNombre = "";
let calendarioInquilinoEmail = "";
let calendarioInquilinoTelefono = "";
let calendarioCantidadHuespedes = "";
let calendarioImporteAlquiler = "";
let calendarioDescuentoEstadia = "";
let calendarioComisionAlquiler = "15";
let calendarioImporteLimpieza = "";
let calendarioComisionLimpieza = "";
let detalleReservaActual = null;
let preparacionReservaActual = null;
let preparacionChecklistActual = null;
let preparacionTareas = [];
let preparacionPuedeEditar = false;
let checkInReservaActual = null;
let checkInChecklistActual = null;
let checkInTareas = [];
let checkInPuedeEditar = false;
let checkOutReservaActual = null;
let checkOutChecklistActual = null;
let checkOutTareas = [];
let checkOutPuedeEditar = false;

async function cargarReservasCasa(houseId) {
    calendarioReservas = [];

    if (!houseId) return;

    const {
        data: reservas,
        error: errorReservas
    } =
        await supabaseClient
            .from("house_reservations")
            .select("id, check_in, check_out")
            .eq("house_id", houseId)
            .order("check_in", {
                ascending: true
            });

    if (errorReservas) {
        console.error(
            "❌ Error cargando reservas:",
            errorReservas
        );

        return;
    }

    calendarioReservas = reservas || [];

    const idsReservas =
        calendarioReservas.map(
            reserva => reserva.id
        );

    if (idsReservas.length === 0) {
        return;
    }

    const {
        data: detalles,
        error: errorDetalles
    } =
        await supabaseClient
            .from("reservation_details")
          .select(`
    reservation_id,
    tenant_name,
    tenant_email,
    tenant_phone,
    guest_count,
    rental_amount,
    long_stay_discount,
    rental_net,
    rental_commission_pct,
    rental_profit,
    cleaning_amount,
    cleaning_commission_pct,
    cleaning_profit
`)
            .in(
                "reservation_id",
                idsReservas
            );

    if (errorDetalles) {
        console.error(
            "❌ Error cargando datos de inquilinos:",
            errorDetalles
        );

        return;
    }

    const detallesPorReserva =
        new Map(
            (detalles || []).map(
                detalle => [
                    detalle.reservation_id,
                    detalle
                ]
            )
        );

    calendarioReservas =
        calendarioReservas.map(
            reserva => ({
                ...reserva,

                reservation_details:
                    detallesPorReserva.get(
                        reserva.id
                    ) || null
            })
        );
}

async function abrirCalendarioCasa(h) {
    calendarioCasaActual = h;

    const { data: rolCalendario } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    calendarioPuedeEditar =
        ["admin", "colaborador"].includes(
            rolCalendario
        );

    calendarioIngreso = null;
    calendarioEgreso = null;
    calendarioReservaEditando = null;
    calendarioReservaViendo = null;
    calendarioInquilinoNombre = "";
calendarioInquilinoEmail = "";
calendarioInquilinoTelefono = "";
calendarioCantidadHuespedes = "";
calendarioImporteAlquiler = "";
calendarioDescuentoEstadia = "";
calendarioComisionAlquiler = "15";
calendarioImporteLimpieza = "";
calendarioComisionLimpieza = "";
    calendarioFechaActual = new Date();

    const nombreCasa =
        document.getElementById(
            "calendarioNombreCasa"
        );

    if (nombreCasa) {
        nombreCasa.textContent =
            h.nombre ||
            h.name ||
            h.nombreCasa ||
            h.nombre_casa ||
            "";
    }

    await cargarReservasCasa(
        calendarioCasaActual.id ||
        calendarioCasaActual.house_id
    );

    await go("calendarioCasa");

    renderCalendarioCasa();

    window.scrollTo(0, 0);
}

async function abrirDetalleReserva(reserva) {
    if (!reserva || !reserva.id) {
        mostrarAvisoHM(
            "No pudimos identificar la reserva"
        );
        return;
    }

    detalleReservaActual = reserva;
    calendarioReservaViendo = reserva.id;

    const detalle =
        Array.isArray(reserva.reservation_details)
            ? reserva.reservation_details[0]
            : reserva.reservation_details;

    const resumen =
        document.getElementById(
            "detalleReservaResumen"
        );

    const inquilino =
        document.getElementById(
            "detalleReservaInquilino"
        );

    if (resumen) {
        resumen.innerHTML = "";

        const titulo =
            document.createElement("h3");

        titulo.textContent = "Fechas";
        titulo.style.marginTop = "0";
        titulo.style.color = "#0D2B45";

        const fechas =
            document.createElement("div");

        fechas.textContent =
            "Ingreso: " +
            formatearFecha(
                fechaDesdeISO(reserva.check_in)
            ) +
            " · Egreso: " +
            formatearFecha(
                fechaDesdeISO(reserva.check_out)
            );

        resumen.appendChild(titulo);
        resumen.appendChild(fechas);
    }

    if (inquilino) {
        inquilino.innerHTML = "";

        const titulo =
            document.createElement("h3");

        titulo.textContent =
            "Datos del Propietario / Inquilino";
        titulo.style.marginTop = "0";
        titulo.style.color = "#0D2B45";

        const datos =
            document.createElement("div");

        datos.style.display = "grid";
        datos.style.gap = "8px";

        const lineas = [
            "Nombre: " +
                (
                    detalle?.tenant_name ||
                    "Sin informar"
                ),
            "Correo: " +
                (
                    detalle?.tenant_email ||
                    "Sin informar"
                ),
            "Celular: " +
                (
                    detalle?.tenant_phone ||
                    "Sin informar"
                ),
            "Huéspedes: " +
                (
                    detalle?.guest_count ||
                    "Sin informar"
                )
        ];

        lineas.forEach(texto => {
            const linea =
                document.createElement("div");

            linea.textContent = texto;
            datos.appendChild(linea);
        });

        inquilino.appendChild(titulo);
        inquilino.appendChild(datos);
    }

    // ============================================
// DATOS ECONÓMICOS DE LA RESERVA
// ============================================

if (inquilino) {
    const tituloEconomico =
        document.createElement("h3");

    tituloEconomico.textContent =
        "Datos económicos de la reserva";

    tituloEconomico.style.marginTop = "25px";
    tituloEconomico.style.marginBottom = "12px";
    tituloEconomico.style.color = "#0D2B45";

    const datosEconomicos =
        document.createElement("div");

    datosEconomicos.style.display = "grid";
    datosEconomicos.style.gap = "8px";

    const formatoDinero = valor =>
        "$ " + Number(valor || 0)
            .toLocaleString("es-AR");

    const lineasEconomicas = [
        "Importe del alquiler: " +
            formatoDinero(detalle?.rental_amount),

        "Descuento larga estadía: " +
            Number(detalle?.long_stay_discount || 0) +
            "%",

        "Alquiler neto: " +
            formatoDinero(detalle?.rental_net),

        "Comisión alquiler: " +
            Number(detalle?.rental_commission_pct || 0) +
            "%",

        "Ganancia Experiencia Costa por alquiler: " +
            formatoDinero(detalle?.rental_profit),

        "Importe de limpieza: " +
            formatoDinero(detalle?.cleaning_amount),

        "Comisión limpieza: " +
            Number(detalle?.cleaning_commission_pct || 0) +
            "%",

        "Ganancia Experiencia Costa por limpieza: " +
            formatoDinero(detalle?.cleaning_profit)
    ];

    lineasEconomicas.forEach(texto => {
        const linea =
            document.createElement("div");

        linea.textContent = texto;
        datosEconomicos.appendChild(linea);
    });

    inquilino.appendChild(tituloEconomico);
    inquilino.appendChild(datosEconomicos);
}

    const botonPreparacion =
        document.getElementById(
            "btnReservaPreparacion"
        );

    const botonCheckIn =
        document.getElementById(
            "btnReservaCheckIn"
        );

    const botonCheckOut =
        document.getElementById(
            "btnReservaCheckOut"
        );

    botonPreparacion.onclick = function() {
        abrirPreparacionReserva(
            detalleReservaActual
        );
    };

    botonCheckIn.disabled = false;
botonCheckIn.style.opacity = "1";
botonCheckIn.textContent =
    "Check-in";

botonCheckIn.onclick = function() {
    abrirCheckInReserva(
        detalleReservaActual
    );
};

botonCheckOut.disabled = false;
botonCheckOut.style.opacity = "1";
botonCheckOut.textContent =
    "Check-out";

botonCheckOut.onclick = function() {
    abrirCheckOutReserva(
        detalleReservaActual
    );
};

    await go("detalleReserva");

    window.scrollTo(0, 0);
}

async function volverAlCalendarioDesdeReserva() {
    detalleReservaActual = null;
    calendarioReservaViendo = null;

    await go("calendarioCasa");
    renderCalendarioCasa();
    window.scrollTo(0, 0);
}

async function abrirCheckOutReserva(reserva) {
    if (!reserva || !reserva.id) {
        mostrarAvisoHM(
            "No pudimos identificar la reserva"
        );
        return;
    }

    checkOutReservaActual = reserva;

    const { data: rolCheckOut } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    checkOutPuedeEditar =
        ["admin", "colaborador"].includes(
            rolCheckOut
        );

    const {
        data: checklist,
        error: errorChecklist
    } =
        await supabaseClient
            .from("reservation_checklists")
            .select(`
                id,
                status,
                started_at,
                completed_at
            `)
            .eq("reservation_id", reserva.id)
            .eq("checklist_type", "check_out")
            .single();

    if (errorChecklist || !checklist) {
        console.error(
            "❌ Error cargando check-out:",
            errorChecklist
        );

        mostrarAvisoHM(
            "No se pudo cargar el check-out de esta reserva"
        );
        return;
    }

    const {
        data: tareas,
        error: errorTareas
    } =
        await supabaseClient
            .from("reservation_checklist_tasks")
            .select(`
                id,
                task_code,
                title,
                responsible,
                status,
                observations,
                verified_by,
                verified_at,
                task_date,
                photo_path,
                incident_id,
                sort_order
            `)
            .eq("checklist_id", checklist.id)
            .order("sort_order", {
                ascending: true
            });

    if (errorTareas) {
        console.error(
            "❌ Error cargando tareas de check-out:",
            errorTareas
        );

        mostrarAvisoHM(
            "No se pudieron cargar las tareas de check-out"
        );
        return;
    }

    checkOutChecklistActual = checklist;
    checkOutTareas = tareas || [];

    const detalle =
        Array.isArray(reserva.reservation_details)
            ? reserva.reservation_details[0]
            : reserva.reservation_details;

    const datos =
        document.getElementById(
            "checkOutReservaDatos"
        );

    if (datos) {
        datos.textContent =
            (detalle?.tenant_name ||
                "Inquilino sin informar") +
            " · Egreso: " +
            formatearFecha(
                fechaDesdeISO(reserva.check_out)
            );
    }

    await go("checkOutReserva");
    renderCheckOutReserva();
    window.scrollTo(0, 0);
}

async function volverAReservaDesdeCheckOut() {
    if (detalleReservaActual) {
        await abrirDetalleReserva(
            detalleReservaActual
        );
        return;
    }

    await go("calendarioCasa");
    renderCalendarioCasa();
    window.scrollTo(0, 0);
}

function renderCheckOutReserva() {
    const contenedor =
        document.getElementById(
            "checkOutReservaContenido"
        );

    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (checkOutTareas.length === 0) {
        contenedor.textContent =
            "No hay tareas de check-out.";
        return;
    }

    const controladas =
        checkOutTareas.filter(
            tarea =>
                tarea.status !== "pendiente"
        ).length;

    const resumen =
        document.createElement("div");

    resumen.className = "card";
    resumen.style.cursor = "default";
    resumen.style.marginBottom = "18px";

    const tituloResumen =
        document.createElement("strong");

    tituloResumen.textContent = "Avance";

    const textoResumen =
        document.createElement("div");

    textoResumen.className = "sub";
    textoResumen.style.marginTop = "6px";
    textoResumen.textContent =
        controladas +
        " de " +
        checkOutTareas.length +
        " tareas controladas";

    resumen.appendChild(tituloResumen);
    resumen.appendChild(textoResumen);
    contenedor.appendChild(resumen);

    const categorias = [
        {
            desde: 1,
            hasta: 4,
            titulo: "Controles de salida"
        },
        {
            desde: 5,
            hasta: 7,
            titulo: "Cierre de la propiedad"
        },
        {
            desde: 8,
            hasta: 9,
            titulo: "Comunicación"
        }
    ];

    categorias.forEach(categoria => {
        const tareasCategoria =
            checkOutTareas.filter(
                tarea =>
                    tarea.sort_order >=
                        categoria.desde &&
                    tarea.sort_order <=
                        categoria.hasta
            );

        if (tareasCategoria.length === 0) {
            return;
        }

        const titulo =
            document.createElement("h3");

        titulo.textContent =
            categoria.titulo;
        titulo.style.color = "#0D2B45";
        titulo.style.marginTop = "24px";

        contenedor.appendChild(titulo);

        tareasCategoria.forEach(tarea => {
            contenedor.appendChild(
                crearTarjetaTareaCheckIn(
                    tarea,
                    checkOutPuedeEditar,
                    editarTituloTareaCheckOut
                )
            );
        });
    });

    if (checkOutPuedeEditar) {
        const guardar =
            document.createElement("button");

        guardar.type = "button";
        guardar.className = "btn";
        guardar.style.width = "100%";
        guardar.style.marginTop = "18px";
        guardar.textContent =
            "Guardar check-out";

        guardar.onclick =
            guardarCheckOutReserva;

        contenedor.appendChild(guardar);
    }
}

async function guardarCheckOutReserva() {
    if (
        !checkOutPuedeEditar ||
        !checkOutChecklistActual?.id ||
        checkOutTareas.length === 0
    ) {
        mostrarAvisoHM(
            "No pudimos identificar el check-out de esta reserva"
        );
        return;
    }

    const tareasParaGuardar =
        checkOutTareas.map(tarea => ({
            id: tarea.id,
            checklist_id:
                checkOutChecklistActual.id,
            task_code:
                tarea.task_code,
            title:
                tarea.title,
            responsible:
                tarea.responsible?.trim() ||
                null,
            status:
                tarea.status ||
                "pendiente",
            observations:
                tarea.observations?.trim() ||
                null,
            sort_order:
                tarea.sort_order
        }));

    const {
        data: tareasGuardadas,
        error: errorTareas
    } =
        await supabaseClient
            .from(
                "reservation_checklist_tasks"
            )
            .upsert(tareasParaGuardar)
            .select("id");

    if (
        errorTareas ||
        !tareasGuardadas ||
        tareasGuardadas.length !==
            tareasParaGuardar.length
    ) {
        console.error(
            "❌ Error guardando tareas de check-out:",
            errorTareas
        );

        mostrarAvisoHM(
            "No se pudo guardar el check-out"
        );
        return;
    }

    const controladas =
        checkOutTareas.filter(
            tarea =>
                tarea.status !== "pendiente"
        ).length;

    let estado = "pendiente";

    if (
        controladas > 0 &&
        controladas <
            checkOutTareas.length
    ) {
        estado = "en_proceso";
    }

    if (
        controladas ===
        checkOutTareas.length
    ) {
        estado = "completado";
    }

    const ahora =
        new Date().toISOString();

    const datosChecklist = {
        status: estado,
        updated_at: ahora,
        completed_at:
            estado === "completado"
                ? ahora
                : null
    };

    if (
        estado !== "pendiente" &&
        !checkOutChecklistActual.started_at
    ) {
        datosChecklist.started_at =
            ahora;
    }

    const {
        data: checklistGuardado,
        error: errorChecklist
    } =
        await supabaseClient
            .from(
                "reservation_checklists"
            )
            .update(datosChecklist)
            .eq(
                "id",
                checkOutChecklistActual.id
            )
            .select("id")
            .single();

    if (
        errorChecklist ||
        !checklistGuardado
    ) {
        console.error(
            "❌ Error guardando avance de check-out:",
            errorChecklist
        );

        mostrarAvisoHM(
            "Las tareas se guardaron, pero no se pudo actualizar el avance"
        );
        return;
    }

    await abrirCheckOutReserva(
        checkOutReservaActual
    );

    mostrarAvisoHM(
        "Check-out guardado correctamente"
    );
}

async function editarTituloTareaCheckOut(
    tarea
) {
    if (
        !checkOutPuedeEditar ||
        !tarea?.id
    ) {
        return;
    }

    const nuevoTitulo =
        await solicitarTextoHM(
            "Escribí el nuevo título de este control de salida.",
            "Editar tarea de check-out",
            "Título de la tarea",
            tarea.title
        );

    if (nuevoTitulo === null) {
        return;
    }

    const tituloLimpio =
        nuevoTitulo.trim();

    if (
        tituloLimpio.length < 2
    ) {
        mostrarAvisoHM(
            "Ingresá un título de al menos 2 caracteres"
        );
        return;
    }

    const aplicarFuturas =
        await confirmarAccionHM(
            "Elegí si el nuevo título corresponde solo a este alquiler o también a las próximas reservas de esta casa.",
            "Aplicar cambio",
            "ESTA CASA EN ADELANTE",
            "#6B7A5A",
            "SOLO ESTA RESERVA"
        );

    const { error } =
        await supabaseClient.rpc(
            "edit_reservation_task_title",
            {
                p_task_id:
                    tarea.id,
                p_new_title:
                    tituloLimpio,
                p_apply_future:
                    aplicarFuturas
            }
        );

    if (error) {
        console.error(
            "❌ Error editando título de check-out:",
            error
        );

        mostrarAvisoHM(
            "No se pudo actualizar el título"
        );
        return;
    }

    await abrirCheckOutReserva(
        checkOutReservaActual
    );

    mostrarAvisoHM(
        aplicarFuturas
            ? "Título actualizado para esta casa y sus próximas reservas"
            : "Título actualizado para esta reserva"
    );
}

async function abrirCheckInReserva(reserva) {
    if (!reserva || !reserva.id) {
        mostrarAvisoHM(
            "No pudimos identificar la reserva"
        );
        return;
    }

    checkInReservaActual = reserva;

    const { data: rolCheckIn } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    checkInPuedeEditar =
        ["admin", "colaborador"].includes(
            rolCheckIn
        );

    const {
        data: checklist,
        error: errorChecklist
    } =
        await supabaseClient
            .from("reservation_checklists")
            .select(`
                id,
                status,
                started_at,
                completed_at
            `)
            .eq("reservation_id", reserva.id)
            .eq("checklist_type", "check_in")
            .single();

    if (errorChecklist || !checklist) {
        console.error(
            "❌ Error cargando check-in:",
            errorChecklist
        );

        mostrarAvisoHM(
            "No se pudo cargar el check-in de esta reserva"
        );
        return;
    }

    const {
        data: tareas,
        error: errorTareas
    } =
        await supabaseClient
            .from("reservation_checklist_tasks")
            .select(`
                id,
                task_code,
                title,
                responsible,
                status,
                observations,
                verified_by,
                verified_at,
                task_date,
                photo_path,
                incident_id,
                sort_order
            `)
            .eq("checklist_id", checklist.id)
            .order("sort_order", {
                ascending: true
            });

    if (errorTareas) {
        console.error(
            "❌ Error cargando tareas de check-in:",
            errorTareas
        );

        mostrarAvisoHM(
            "No se pudieron cargar las tareas de check-in"
        );
        return;
    }

    checkInChecklistActual = checklist;
    checkInTareas = tareas || [];

    const detalle =
        Array.isArray(reserva.reservation_details)
            ? reserva.reservation_details[0]
            : reserva.reservation_details;

    const datos =
        document.getElementById(
            "checkInReservaDatos"
        );

    if (datos) {
        datos.textContent =
            (detalle?.tenant_name ||
                "Inquilino sin informar") +
            " · Ingreso: " +
            formatearFecha(
                fechaDesdeISO(reserva.check_in)
            );
    }

    await go("checkInReserva");
    renderCheckInReserva();
    window.scrollTo(0, 0);
}

async function volverAReservaDesdeCheckIn() {
    if (detalleReservaActual) {
        await abrirDetalleReserva(
            detalleReservaActual
        );
        return;
    }

    await go("calendarioCasa");
    renderCalendarioCasa();
    window.scrollTo(0, 0);
}

function renderCheckInReserva() {
    const contenedor =
        document.getElementById(
            "checkInReservaContenido"
        );

    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (checkInTareas.length === 0) {
        contenedor.textContent =
            "No hay tareas de check-in.";
        return;
    }

    const controladas =
        checkInTareas.filter(
            tarea =>
                tarea.status !== "pendiente"
        ).length;

    const resumen =
        document.createElement("div");

    resumen.className = "card";
    resumen.style.cursor = "default";
    resumen.style.marginBottom = "18px";

    const tituloResumen =
        document.createElement("strong");

    tituloResumen.textContent = "Avance";

    const textoResumen =
        document.createElement("div");

    textoResumen.className = "sub";
    textoResumen.style.marginTop = "6px";
    textoResumen.textContent =
        controladas +
        " de " +
        checkInTareas.length +
        " tareas controladas";

    resumen.appendChild(tituloResumen);
    resumen.appendChild(textoResumen);
    contenedor.appendChild(resumen);

    const categorias = [
        {
            desde: 1,
            hasta: 9,
            titulo: "Servicios y energía"
        },
        {
            desde: 10,
            hasta: 13,
            titulo: "Exterior, riego y pileta"
        },
        {
            desde: 14,
            hasta: 20,
            titulo: "Estado edilicio e interior"
        },
        {
            desde: 21,
            hasta: 22,
            titulo: "Conectividad y confort"
        },
        {
            desde: 23,
            hasta: 25,
            titulo: "Limpieza e inventario"
        },
        {
            desde: 26,
            hasta: 27,
            titulo: "Administrativo opcional"
        }
    ];

    categorias.forEach(categoria => {
        const tareasCategoria =
            checkInTareas.filter(
                tarea =>
                    tarea.sort_order >=
                        categoria.desde &&
                    tarea.sort_order <=
                        categoria.hasta
            );

        if (tareasCategoria.length === 0) {
            return;
        }

        const titulo =
            document.createElement("h3");

        titulo.textContent =
            categoria.titulo;
        titulo.style.color = "#0D2B45";
        titulo.style.marginTop = "24px";

        contenedor.appendChild(titulo);

        tareasCategoria.forEach(tarea => {
            contenedor.appendChild(
                crearTarjetaTareaCheckIn(
                    tarea
                )
            );
        });
    });

    if (checkInPuedeEditar) {
        const guardar =
            document.createElement("button");

        guardar.type = "button";
        guardar.className = "btn";
        guardar.style.width = "100%";
        guardar.style.marginTop = "18px";
        guardar.textContent =
            "Guardar check-in";

        guardar.onclick =
            guardarCheckInReserva;

        contenedor.appendChild(guardar);
    }
}

function crearTarjetaTareaCheckIn(
    tarea,
    puedeEditar = checkInPuedeEditar,
    editarTitulo = editarTituloTareaCheckIn
) {
    const tarjeta =
        document.createElement("div");

    tarjeta.className = "card";
    tarjeta.style.cursor = "default";
    tarjeta.style.marginBottom = "12px";

    const cabecera =
        document.createElement("div");

    cabecera.style.display = "flex";
    cabecera.style.alignItems =
        "flex-start";
    cabecera.style.justifyContent =
        "space-between";
    cabecera.style.gap = "12px";
    cabecera.style.marginBottom = "16px";

    const titulo =
        document.createElement("div");

    titulo.style.flex = "1";
    titulo.style.fontWeight = "700";
    titulo.style.color = "#0D2B45";
    titulo.textContent =
        tarea.sort_order +
        ". " +
        tarea.title;

    cabecera.appendChild(titulo);

    if (puedeEditar) {
        const lapiz =
            document.createElement("button");

        lapiz.type = "button";
        lapiz.title = "Editar título";
        lapiz.setAttribute(
            "aria-label",
            "Editar título"
        );

        lapiz.style.width = "36px";
        lapiz.style.height = "36px";
        lapiz.style.minWidth = "36px";
        lapiz.style.padding = "7px";
        lapiz.style.border =
            "1px solid #D7DDE2";
        lapiz.style.borderRadius = "9px";
        lapiz.style.background =
            "#FFFFFF";
        lapiz.style.color = "#0D2B45";
        lapiz.style.cursor = "pointer";
        lapiz.style.display = "flex";
        lapiz.style.alignItems = "center";
        lapiz.style.justifyContent =
            "center";

        lapiz.innerHTML = `
            <span class="cb-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M4 20H8L19 9L15 5L4 16V20Z"></path>
                    <path d="M13 7L17 11"></path>
                </svg>
            </span>
        `;

        lapiz.onclick = function() {
            editarTitulo(
    tarea
);
        };

        cabecera.appendChild(lapiz);
    }

    const etiquetaEstado =
        document.createElement("div");

    etiquetaEstado.textContent =
        "Estado";
    etiquetaEstado.style.fontWeight =
        "700";
    etiquetaEstado.style.color =
        "#0D2B45";
    etiquetaEstado.style.marginBottom =
        "8px";

    const grupoEstado =
        document.createElement("div");

    grupoEstado.style.display = "grid";
    grupoEstado.style.gridTemplateColumns =
        "repeat(2, minmax(0, 1fr))";
    grupoEstado.style.gap = "8px";
    grupoEstado.style.marginBottom =
        "18px";

    const opciones = [
        {
            valor: "pendiente",
            texto: "Pendiente",
            color: "#DCC9A6"
        },
        {
            valor: "si",
            texto: "Sí",
            color: "#6B7A5A"
        },
        {
            valor: "no",
            texto: "No",
            color: "#8B4B4B"
        },
        {
            valor: "no_aplica",
            texto: "No aplica",
            color: "#59636B"
        }
    ];

    const botones = [];

    const actualizarBotones =
        function() {
            botones.forEach(
                ({ boton, opcion }) => {
                    const activo =
                        tarea.status ===
                        opcion.valor;

                    boton.style.background =
                        activo
                            ? opcion.color
                            : "#FFFFFF";

                    boton.style.color =
                        activo &&
                        opcion.valor !==
                            "pendiente"
                            ? "#FFFFFF"
                            : "#0D2B45";

                    boton.style.borderColor =
                        activo
                            ? opcion.color
                            : "#D7DDE2";
                }
            );
        };

    opciones.forEach(opcion => {
        const boton =
            document.createElement("button");

        boton.type = "button";
        boton.textContent =
            opcion.texto;
        boton.style.padding =
            "10px 8px";
        boton.style.border =
            "1px solid";
        boton.style.borderRadius =
            "9px";
        boton.style.fontWeight =
            "700";
        boton.disabled =
    !puedeEditar;
boton.style.cursor =
    puedeEditar
        ? "pointer"
        : "default";

        boton.onclick = function() {
            tarea.status =
                opcion.valor;
            actualizarBotones();
        };

        botones.push({
            boton,
            opcion
        });

        grupoEstado.appendChild(
            boton
        );
    });

    actualizarBotones();

    const etiquetaResponsable =
        document.createElement("label");

    etiquetaResponsable.textContent =
        "Responsable";
    etiquetaResponsable.style.display =
        "block";
    etiquetaResponsable.style.fontWeight =
        "700";
    etiquetaResponsable.style.color =
        "#0D2B45";
    etiquetaResponsable.style.marginBottom =
        "8px";

    const responsable =
        document.createElement("input");

    responsable.type = "text";
    responsable.placeholder =
        "Nombre del responsable";
    responsable.value =
        tarea.responsible || "";
    responsable.disabled =
    !puedeEditar;
    responsable.style.width = "100%";
    responsable.style.boxSizing =
        "border-box";
    responsable.style.marginBottom =
        "18px";

    responsable.oninput = function() {
        tarea.responsible =
            responsable.value;
    };

    const etiquetaObservaciones =
        document.createElement("label");

    etiquetaObservaciones.textContent =
        "Observaciones";
    etiquetaObservaciones.style.display =
        "block";
    etiquetaObservaciones.style.fontWeight =
        "700";
    etiquetaObservaciones.style.color =
        "#0D2B45";
    etiquetaObservaciones.style.marginBottom =
        "8px";

    const observaciones =
        document.createElement("textarea");

    observaciones.placeholder =
        "Agregar observaciones";
    observaciones.value =
        tarea.observations || "";
    observaciones.disabled =
    !puedeEditar;
    observaciones.style.width =
        "100%";
    observaciones.style.boxSizing =
        "border-box";
    observaciones.style.minHeight =
        "90px";
    observaciones.style.resize =
        "vertical";

    observaciones.oninput =
        function() {
            tarea.observations =
                observaciones.value;
        };

    tarjeta.appendChild(cabecera);
    tarjeta.appendChild(
        etiquetaEstado
    );
    tarjeta.appendChild(
        grupoEstado
    );
    tarjeta.appendChild(
        etiquetaResponsable
    );
    tarjeta.appendChild(
        responsable
    );
    tarjeta.appendChild(
        etiquetaObservaciones
    );
    tarjeta.appendChild(
        observaciones
    );

    return tarjeta;
}

async function guardarCheckInReserva() {
    if (
        !checkInPuedeEditar ||
        !checkInChecklistActual?.id ||
        checkInTareas.length === 0
    ) {
        mostrarAvisoHM(
            "No pudimos identificar el check-in de esta reserva"
        );
        return;
    }

    const tareasParaGuardar =
        checkInTareas.map(tarea => ({
            id: tarea.id,
            checklist_id:
                checkInChecklistActual.id,
            task_code:
                tarea.task_code,
            title:
                tarea.title,
            responsible:
                tarea.responsible?.trim() ||
                null,
            status:
                tarea.status ||
                "pendiente",
            observations:
                tarea.observations?.trim() ||
                null,
            sort_order:
                tarea.sort_order
        }));

    const {
        data: tareasGuardadas,
        error: errorTareas
    } =
        await supabaseClient
            .from(
                "reservation_checklist_tasks"
            )
            .upsert(tareasParaGuardar)
            .select("id");

    if (
        errorTareas ||
        !tareasGuardadas ||
        tareasGuardadas.length !==
            tareasParaGuardar.length
    ) {
        console.error(
            "❌ Error guardando tareas de check-in:",
            errorTareas
        );

        mostrarAvisoHM(
            "No se pudo guardar el check-in"
        );
        return;
    }

    const controladas =
        checkInTareas.filter(
            tarea =>
                tarea.status !== "pendiente"
        ).length;

    let estado = "pendiente";

    if (
        controladas > 0 &&
        controladas <
            checkInTareas.length
    ) {
        estado = "en_proceso";
    }

    if (
        controladas ===
        checkInTareas.length
    ) {
        estado = "completado";
    }

    const ahora =
        new Date().toISOString();

    const datosChecklist = {
        status: estado,
        updated_at: ahora,
        completed_at:
            estado === "completado"
                ? ahora
                : null
    };

    if (
        estado !== "pendiente" &&
        !checkInChecklistActual.started_at
    ) {
        datosChecklist.started_at =
            ahora;
    }

    const {
        data: checklistGuardado,
        error: errorChecklist
    } =
        await supabaseClient
            .from(
                "reservation_checklists"
            )
            .update(datosChecklist)
            .eq(
                "id",
                checkInChecklistActual.id
            )
            .select("id")
            .single();

    if (
        errorChecklist ||
        !checklistGuardado
    ) {
        console.error(
            "❌ Error guardando avance de check-in:",
            errorChecklist
        );

        mostrarAvisoHM(
            "Las tareas se guardaron, pero no se pudo actualizar el avance"
        );
        return;
    }

    await abrirCheckInReserva(
        checkInReservaActual
    );

    mostrarAvisoHM(
        "Check-in guardado correctamente"
    );
}

async function editarTituloTareaCheckIn(
    tarea
) {
    if (
        !checkInPuedeEditar ||
        !tarea?.id
    ) {
        return;
    }

    const nuevoTitulo =
        await solicitarTextoHM(
            "Escribí el nuevo título de este control.",
            "Editar tarea de check-in",
            "Título de la tarea",
            tarea.title
        );

    if (nuevoTitulo === null) {
        return;
    }

    const tituloLimpio =
        nuevoTitulo.trim();

    if (
        tituloLimpio.length < 2
    ) {
        mostrarAvisoHM(
            "Ingresá un título de al menos 2 caracteres"
        );
        return;
    }

    const aplicarFuturas =
        await confirmarAccionHM(
            "Elegí si el nuevo título corresponde solo a este alquiler o también a las próximas reservas de esta casa.",
            "Aplicar cambio",
            "ESTA CASA EN ADELANTE",
            "#6B7A5A",
            "SOLO ESTA RESERVA"
        );

    const { error } =
        await supabaseClient.rpc(
            "edit_reservation_task_title",
            {
                p_task_id:
                    tarea.id,
                p_new_title:
                    tituloLimpio,
                p_apply_future:
                    aplicarFuturas
            }
        );

    if (error) {
        console.error(
            "❌ Error editando título de check-in:",
            error
        );

        mostrarAvisoHM(
            "No se pudo actualizar el título"
        );
        return;
    }

    await abrirCheckInReserva(
        checkInReservaActual
    );

    mostrarAvisoHM(
        aplicarFuturas
            ? "Título actualizado para esta casa y sus próximas reservas"
            : "Título actualizado para esta reserva"
    );
}

async function abrirPreparacionReserva(reserva) {
    if (!reserva || !reserva.id) {
        mostrarAvisoHM(
            "No pudimos identificar la reserva"
        );
        return;
    }

    preparacionReservaActual = reserva;

    const { data: rolPreparacion } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    preparacionPuedeEditar =
        ["admin", "colaborador"].includes(
            rolPreparacion
        );

    const {
        data: checklist,
        error: errorChecklist
    } =
        await supabaseClient
            .from("reservation_checklists")
            .select(`
    id,
    status,
    started_at,
    completed_at
`)
            .eq("reservation_id", reserva.id)
            .eq("checklist_type", "preparacion")
            .single();

    if (errorChecklist || !checklist) {
        console.error(
            "❌ Error cargando preparación:",
            errorChecklist
        );

        mostrarAvisoHM(
            "No se pudo cargar la preparación de esta reserva"
        );
        return;
    }

    const {
        data: tareas,
        error: errorTareas
    } =
        await supabaseClient
            .from("reservation_checklist_tasks")
            .select(`
                id,
                task_code,
                title,
                responsible,
                status,
                observations,
                verified_by,
                verified_at,
                task_date,
                photo_path,
                incident_id,
                sort_order
            `)
            .eq("checklist_id", checklist.id)
            .order("sort_order", {
                ascending: true
            });

    if (errorTareas) {
        console.error(
            "❌ Error cargando tareas de preparación:",
            errorTareas
        );

        mostrarAvisoHM(
            "No se pudieron cargar las tareas de preparación"
        );
        return;
    }

    preparacionChecklistActual = checklist;
    preparacionTareas = tareas || [];

    const detalle =
        Array.isArray(reserva.reservation_details)
            ? reserva.reservation_details[0]
            : reserva.reservation_details;

    const datos =
        document.getElementById(
            "preparacionReservaDatos"
        );

    if (datos) {
        const nombre =
            detalle?.tenant_name ||
            "Inquilino sin informar";

        datos.textContent =
            nombre +
            " · " +
            formatearFecha(
                fechaDesdeISO(reserva.check_in)
            ) +
            " al " +
            formatearFecha(
                fechaDesdeISO(reserva.check_out)
            );
    }

    await go("preparacionReserva");

    renderPreparacionReserva();

    window.scrollTo(0, 0);
}

async function volverAReservaDesdePreparacion() {
    if (detalleReservaActual) {
        await abrirDetalleReserva(
            detalleReservaActual
        );
        return;
    }

    await go("calendarioCasa");
    renderCalendarioCasa();
    window.scrollTo(0, 0);
}

function renderPreparacionReserva() {
    const contenedor =
        document.getElementById(
            "preparacionReservaContenido"
        );

    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (preparacionTareas.length === 0) {
        contenedor.textContent =
            "No hay tareas de preparación.";
        return;
    }

    const completadas =
        preparacionTareas.filter(
            tarea =>
                tarea.status !== "pendiente"
        ).length;

    const resumen =
        document.createElement("div");

    resumen.className = "card";
    resumen.style.cursor = "default";
    resumen.style.marginBottom = "18px";
    resumen.innerHTML = `
        <strong>Avance</strong>
        <div class="sub" style="margin-top:6px;">
            ${completadas} de
            ${preparacionTareas.length}
            tareas controladas
        </div>
    `;

    contenedor.appendChild(resumen);

    const categorias = [
        {
            desde: 1,
            hasta: 4,
            titulo: "Insumos de baño y cocina"
        },
        {
            desde: 5,
            hasta: 7,
            titulo: "Limpieza disponible en la casa"
        },
        {
            desde: 8,
            hasta: 8,
            titulo: "Exterior y recreación"
        },
        {
            desde: 9,
            hasta: 18,
            titulo: "Detalles de bienvenida"
        }
    ];

    categorias.forEach(categoria => {
        const tareasCategoria =
            preparacionTareas.filter(
                tarea =>
                    tarea.sort_order >=
                        categoria.desde &&
                    tarea.sort_order <=
                        categoria.hasta
            );

        if (tareasCategoria.length === 0) {
            return;
        }

        const titulo =
            document.createElement("h3");

        titulo.textContent =
            categoria.titulo;

        titulo.style.color = "#0D2B45";
        titulo.style.marginTop = "24px";

        contenedor.appendChild(titulo);

        tareasCategoria.forEach(tarea => {
            const tarjeta =
                document.createElement("div");

            tarjeta.className = "card";
            tarjeta.style.cursor = "default";
            tarjeta.style.marginBottom = "12px";

            const nombre =
                document.createElement("div");

            nombre.style.fontWeight = "700";
            nombre.style.color = "#0D2B45";
            nombre.style.marginBottom = "0";
nombre.style.flex = "1";
            nombre.textContent =
                tarea.sort_order +
                ". " +
                tarea.title;

                const cabeceraTarea =
    document.createElement("div");

cabeceraTarea.style.display = "flex";
cabeceraTarea.style.alignItems = "flex-start";
cabeceraTarea.style.justifyContent =
    "space-between";
cabeceraTarea.style.gap = "12px";
cabeceraTarea.style.marginBottom = "16px";

cabeceraTarea.appendChild(nombre);

if (preparacionPuedeEditar) {
    const editarTitulo =
        document.createElement("button");

    editarTitulo.type = "button";
    editarTitulo.title =
        "Editar título";
    editarTitulo.setAttribute(
        "aria-label",
        "Editar título"
    );

    editarTitulo.style.width = "36px";
    editarTitulo.style.height = "36px";
    editarTitulo.style.minWidth = "36px";
    editarTitulo.style.padding = "7px";
    editarTitulo.style.border =
        "1px solid #D7DDE2";
    editarTitulo.style.borderRadius =
        "9px";
    editarTitulo.style.background =
        "#FFFFFF";
    editarTitulo.style.color =
        "#0D2B45";
    editarTitulo.style.cursor =
        "pointer";
    editarTitulo.style.display = "flex";
    editarTitulo.style.alignItems =
        "center";
    editarTitulo.style.justifyContent =
        "center";

    editarTitulo.innerHTML = `
        <span class="cb-icon">
            <svg viewBox="0 0 24 24">
                <path d="M4 20H8L19 9L15 5L4 16V20Z"></path>
                <path d="M13 7L17 11"></path>
            </svg>
        </span>
    `;

    editarTitulo.onclick =
        function() {
            editarTituloTareaPreparacion(
                tarea
            );
        };

    cabeceraTarea.appendChild(
        editarTitulo
    );
}

            const etiquetaEstado =
    document.createElement("div");

etiquetaEstado.textContent = "Estado";
etiquetaEstado.style.fontWeight = "700";
etiquetaEstado.style.color = "#0D2B45";
etiquetaEstado.style.marginBottom = "8px";

const grupoEstado =
    document.createElement("div");

grupoEstado.style.display = "grid";
grupoEstado.style.gridTemplateColumns =
    "repeat(2, minmax(0, 1fr))";
grupoEstado.style.gap = "8px";
grupoEstado.style.marginBottom = "18px";

const opcionesEstado = [
    {
        valor: "pendiente",
        texto: "Pendiente",
        color: "#DCC9A6"
    },
    {
        valor: "si",
        texto: "Sí",
        color: "#6B7A5A"
    },
    {
        valor: "no",
        texto: "No",
        color: "#8B4B4B"
    },
    {
        valor: "no_aplica",
        texto: "No aplica",
        color: "#59636B"
    }
];

const botonesEstado = [];

const actualizarBotonesEstado =
    function() {
        botonesEstado.forEach(
            ({ boton, opcion }) => {
                const seleccionado =
                    tarea.status ===
                    opcion.valor;

                boton.style.background =
                    seleccionado
                        ? opcion.color
                        : "#FFFFFF";

                boton.style.color =
                    seleccionado
                        ? "#FFFFFF"
                        : "#0D2B45";

                boton.style.borderColor =
                    seleccionado
                        ? opcion.color
                        : "#D7DDE2";
            }
        );
    };

opcionesEstado.forEach(opcion => {
    const boton =
        document.createElement("button");

    boton.type = "button";
    boton.textContent = opcion.texto;
    boton.style.padding = "10px 8px";
    boton.style.border = "1px solid";
    boton.style.borderRadius = "9px";
    boton.style.fontWeight = "700";
    boton.style.cursor =
        preparacionPuedeEditar
            ? "pointer"
            : "default";

    boton.disabled =
        !preparacionPuedeEditar;

    boton.onclick = function() {
        tarea.status = opcion.valor;
        actualizarBotonesEstado();
    };

    botonesEstado.push({
        boton,
        opcion
    });

    grupoEstado.appendChild(boton);
});

actualizarBotonesEstado();

            const etiquetaResponsable =
                document.createElement("label");

            etiquetaResponsable.textContent =
    "Responsable";

etiquetaResponsable.style.display = "block";
etiquetaResponsable.style.fontWeight = "700";
etiquetaResponsable.style.color = "#0D2B45";
etiquetaResponsable.style.marginBottom = "8px";

            const responsable =
                document.createElement("input");

            responsable.type = "text";
            responsable.placeholder =
                "Nombre del responsable";
            responsable.value =
                tarea.responsible || "";
            responsable.disabled =
                !preparacionPuedeEditar;
                responsable.style.width = "100%";
responsable.style.boxSizing = "border-box";
responsable.style.marginBottom = "18px";

            responsable.oninput = function() {
                tarea.responsible =
                    responsable.value;
            };

            const etiquetaObservaciones =
                document.createElement("label");

            etiquetaObservaciones.textContent =
    "Observaciones";

etiquetaObservaciones.style.display = "block";
etiquetaObservaciones.style.fontWeight = "700";
etiquetaObservaciones.style.color = "#0D2B45";
etiquetaObservaciones.style.marginBottom = "8px";

            const observaciones =
                document.createElement("textarea");

            observaciones.placeholder =
                "Agregar observaciones";
            observaciones.value =
                tarea.observations || "";
            observaciones.disabled =
                !preparacionPuedeEditar;
                observaciones.style.width = "100%";
observaciones.style.boxSizing = "border-box";
observaciones.style.minHeight = "90px";
observaciones.style.resize = "vertical";

            observaciones.oninput =
                function() {
                    tarea.observations =
                        observaciones.value;
                };

            tarjeta.appendChild(
    cabeceraTarea
);
            tarjeta.appendChild(
    etiquetaEstado
);
tarjeta.appendChild(
    grupoEstado
);
            tarjeta.appendChild(
                etiquetaResponsable
            );
            tarjeta.appendChild(
                responsable
            );
            tarjeta.appendChild(
                etiquetaObservaciones
            );
            tarjeta.appendChild(
                observaciones
            );

            contenedor.appendChild(tarjeta);
        });
    });

    if (preparacionPuedeEditar) {
        const guardar =
            document.createElement("button");

        guardar.type = "button";
        guardar.className = "btn";
        guardar.style.width = "100%";
        guardar.style.marginTop = "18px";
        guardar.textContent =
            "Guardar preparación";

        guardar.onclick = function() {
            guardarPreparacionReserva();
        };

        contenedor.appendChild(guardar);
    }
}

async function guardarPreparacionReserva() {
    if (
        !preparacionChecklistActual ||
        !preparacionChecklistActual.id
    ) {
        mostrarAvisoHM(
            "No pudimos identificar el checklist de preparación"
        );
        return;
    }

    const tareasParaGuardar =
        preparacionTareas.map(
            tarea => ({
                id: tarea.id,
                checklist_id:
                    preparacionChecklistActual.id,
                task_code:
                    tarea.task_code,
                title:
                    tarea.title,
                responsible:
                    tarea.responsible?.trim() ||
                    null,
                status:
                    tarea.status ||
                    "pendiente",
                observations:
                    tarea.observations?.trim() ||
                    null,
                sort_order:
                    tarea.sort_order
            })
        );

    const {
        data: tareasGuardadas,
        error: errorTareas
    } =
        await supabaseClient
            .from(
                "reservation_checklist_tasks"
            )
            .upsert(tareasParaGuardar)
            .select("id");

    if (
        errorTareas ||
        !tareasGuardadas ||
        tareasGuardadas.length !==
            tareasParaGuardar.length
    ) {
        console.error(
            "❌ Error guardando preparación:",
            errorTareas
        );

        mostrarAvisoHM(
            "No se pudo guardar la preparación"
        );
        return;
    }

    const cantidadControladas =
        preparacionTareas.filter(
            tarea =>
                tarea.status !== "pendiente"
        ).length;

    let estadoChecklist = "pendiente";

    if (
        cantidadControladas > 0 &&
        cantidadControladas <
            preparacionTareas.length
    ) {
        estadoChecklist = "en_proceso";
    }

    if (
        cantidadControladas ===
        preparacionTareas.length
    ) {
        estadoChecklist = "completado";
    }

    const datosChecklist = {
        status: estadoChecklist,
        updated_at:
            new Date().toISOString()
    };

    if (
        estadoChecklist !== "pendiente" &&
        !preparacionChecklistActual.started_at
    ) {
        datosChecklist.started_at =
            new Date().toISOString();
    }

    datosChecklist.completed_at =
        estadoChecklist === "completado"
            ? new Date().toISOString()
            : null;

    const { error: errorChecklist } =
        await supabaseClient
            .from("reservation_checklists")
            .update(datosChecklist)
            .eq(
                "id",
                preparacionChecklistActual.id
            );

    if (errorChecklist) {
        console.error(
            "❌ Error actualizando estado de preparación:",
            errorChecklist
        );

        mostrarAvisoHM(
            "Las tareas se guardaron, pero no se pudo actualizar el avance"
        );
        return;
    }

    mostrarAvisoHM(
        "Preparación guardada correctamente"
    );

    await abrirPreparacionReserva(
        preparacionReservaActual
    );
}

async function editarTituloTareaPreparacion(
    tarea
) {
    if (
        !preparacionPuedeEditar ||
        !tarea ||
        !tarea.id
    ) {
        return;
    }

    const nuevoTitulo =
        await solicitarTextoHM(
    "Escribí el nuevo título de esta tarea.",
    "Editar tarea",
    "Título de la tarea",
    tarea.title
);

    if (nuevoTitulo === null) {
        return;
    }

    const tituloLimpio =
        nuevoTitulo.trim();

    if (tituloLimpio.length < 2) {
        mostrarAvisoHM(
            "Ingresá un título de al menos 2 caracteres"
        );
        return;
    }

    const aplicarFuturas =
        await confirmarAccionHM(
            "Elegí si el cambio corresponde solamente a esta reserva o también a las próximas reservas de esta casa.",
            "Aplicar cambio",
            "ESTA CASA EN ADELANTE",
            "#6B7A5A",
            "SOLO ESTA RESERVA"
        );

    const { error } =
        await supabaseClient.rpc(
            "edit_reservation_task_title",
            {
                p_task_id: tarea.id,
                p_new_title: tituloLimpio,
                p_apply_future:
                    aplicarFuturas
            }
        );

    if (error) {
        console.error(
            "❌ Error editando título de tarea:",
            error
        );

        mostrarAvisoHM(
            "No se pudo actualizar el título de la tarea"
        );
        return;
    }

    mostrarAvisoHM(
        aplicarFuturas
            ? "Título actualizado para esta casa y sus próximas reservas"
            : "Título actualizado para esta reserva"
    );

    await abrirPreparacionReserva(
        preparacionReservaActual
    );
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

    // Si estamos editando esta reserva,
    // no pintar sus fechas antiguas
    if (
        calendarioReservaEditando &&
        reserva.id === calendarioReservaEditando
    ) {
        return;
    }

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

        if (
    calendarioPuedeEditar &&
    !calendarioReservaViendo
) {
    celda.onclick = function() {
        seleccionarFechaCalendario(
            fecha
        );
    };
} else {
    celda.style.cursor = "default";
}

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

    const datosInquilino =
    document.createElement("div");

datosInquilino.className = "card";
datosInquilino.style.marginTop = "16px";
datosInquilino.style.cursor = "default";

datosInquilino.innerHTML = `
    <h3 style="
        margin-top:0;
        color:#0D2B45;
    ">
        Datos del Propietario / Inquilino
    </h3>

    <label for="calTenantName">
        Nombre y apellido
    </label>
    <input
        id="calTenantName"
        type="text"
        placeholder="Nombre completo"
    >

    <label for="calTenantEmail">
        Correo electrónico
    </label>
    <input
        id="calTenantEmail"
        type="email"
        placeholder="correo@ejemplo.com"
    >

    <label for="calTenantPhone">
        Celular
    </label>
    <input
        id="calTenantPhone"
        type="tel"
        placeholder="+54 9..."
    >

    <label for="calGuestCount">
        Cantidad de huéspedes
    </label>
    <input
        id="calGuestCount"
        type="number"
        min="1"
        placeholder="Cantidad"
    >


   <h3 style="
       margin-top:25px;
       margin-bottom:15px;
       color:#0D2B45;
   ">
       Datos económicos de la reserva
   </h3>

   <label for="calRentalAmount">
       Importe del alquiler
   </label>
   <input
       id="calRentalAmount"
       type="number"
       min="0"
       placeholder="$ Importe del alquiler"
   >

   <label for="calLongStayDiscount">
       Descuento por larga estadía (%)
   </label>
   <input
       id="calLongStayDiscount"
       type="number"
       min="0"
       max="100"
       step="0.1"
       placeholder="Ej: 3"
   >

   <label for="calRentalCommission">
       Comisión sobre alquiler
   </label>
   <select id="calRentalCommission">
       <option value="15">15%</option>
       <option value="17">17%</option>
       <option value="20">20%</option>
       <option value="25">25%</option>
   </select>

   <div style="
    margin:10px 0 18px;
    padding:12px;
    background:#F2F6F9;
    border-radius:10px;
">
    <div>
        Alquiler neto:
        <strong id="calRentalNet">$ 0</strong>
    </div>
    <div style="margin-top:5px;">
        Ganancia Experiencia Costa por alquiler:
        <strong id="calRentalProfit">$ 0</strong>
    </div>
</div>

   <label for="calCleaningAmount">
       Importe de limpieza
   </label>
   <input
       id="calCleaningAmount"
       type="number"
       min="0"
       placeholder="$ Importe de limpieza"
   >

   <label for="calCleaningCommission">
       Comisión sobre limpieza (%)
   </label>
   <input
       id="calCleaningCommission"
       type="number"
       min="0"
       max="100"
       step="0.1"
       placeholder="Ej: 20"
   >

   <div style="
    margin:10px 0 5px;
    padding:12px;
    background:#F2F6F9;
    border-radius:10px;
">
    Ganancia Experiencia Costa por limpieza:
    <strong id="calCleaningProfit">$ 0</strong>
</div>

`;

contenedor.appendChild(datosInquilino);

const campoNombre =
    document.getElementById("calTenantName");

const campoEmail =
    document.getElementById("calTenantEmail");

const campoTelefono =
    document.getElementById("calTenantPhone");

const campoHuespedes =
    document.getElementById("calGuestCount");

    const campoImporteAlquiler =
    document.getElementById("calRentalAmount");

const campoDescuentoEstadia =
    document.getElementById("calLongStayDiscount");

const campoComisionAlquiler =
    document.getElementById("calRentalCommission");

const campoImporteLimpieza =
    document.getElementById("calCleaningAmount");

const campoComisionLimpieza =
    document.getElementById("calCleaningCommission");

    const resultadoAlquilerNeto =
    document.getElementById("calRentalNet");

const resultadoGananciaAlquiler =
    document.getElementById("calRentalProfit");

const resultadoGananciaLimpieza =
    document.getElementById("calCleaningProfit");

function actualizarCalculosEconomicos() {
    const alquiler = Number(campoImporteAlquiler.value) || 0;
    const descuento = Number(campoDescuentoEstadia.value) || 0;
    const comisionAlquiler = Number(campoComisionAlquiler.value) || 0;
    const limpieza = Number(campoImporteLimpieza.value) || 0;
    const comisionLimpieza = Number(campoComisionLimpieza.value) || 0;

    const alquilerNeto =
        alquiler - (alquiler * descuento / 100);

    const gananciaAlquiler =
        alquilerNeto * comisionAlquiler / 100;

    const gananciaLimpieza =
        limpieza * comisionLimpieza / 100;

    resultadoAlquilerNeto.textContent =
        "$ " + alquilerNeto.toLocaleString("es-AR");

    resultadoGananciaAlquiler.textContent =
        "$ " + gananciaAlquiler.toLocaleString("es-AR");

    resultadoGananciaLimpieza.textContent =
        "$ " + gananciaLimpieza.toLocaleString("es-AR");
}

campoImporteAlquiler.addEventListener("input", actualizarCalculosEconomicos);
campoDescuentoEstadia.addEventListener("input", actualizarCalculosEconomicos);
campoComisionAlquiler.addEventListener("change", actualizarCalculosEconomicos);
campoImporteLimpieza.addEventListener("input", actualizarCalculosEconomicos);
campoComisionLimpieza.addEventListener("input", actualizarCalculosEconomicos);

actualizarCalculosEconomicos();

campoNombre.value =
    calendarioInquilinoNombre;

campoEmail.value =
    calendarioInquilinoEmail;

campoTelefono.value =
    calendarioInquilinoTelefono;

campoHuespedes.value =
    calendarioCantidadHuespedes;

    campoImporteAlquiler.value =
    calendarioImporteAlquiler;

campoDescuentoEstadia.value =
    calendarioDescuentoEstadia;

campoComisionAlquiler.value =
    calendarioComisionAlquiler;

campoImporteLimpieza.value =
    calendarioImporteLimpieza;

campoComisionLimpieza.value =
    calendarioComisionLimpieza;

actualizarCalculosEconomicos();

campoNombre.oninput = () => {
    calendarioInquilinoNombre =
        campoNombre.value;
};

campoEmail.oninput = () => {
    calendarioInquilinoEmail =
        campoEmail.value;
};

campoTelefono.oninput = () => {
    calendarioInquilinoTelefono =
        campoTelefono.value;
};

campoHuespedes.oninput = () => {
    calendarioCantidadHuespedes =
        campoHuespedes.value;
};

campoImporteAlquiler.oninput = () => {
    calendarioImporteAlquiler =
        campoImporteAlquiler.value;

    actualizarCalculosEconomicos();
};

campoDescuentoEstadia.oninput = () => {
    calendarioDescuentoEstadia =
        campoDescuentoEstadia.value;

    actualizarCalculosEconomicos();
};

campoComisionAlquiler.onchange = () => {
    calendarioComisionAlquiler =
        campoComisionAlquiler.value;

    actualizarCalculosEconomicos();
};

campoImporteLimpieza.oninput = () => {
    calendarioImporteLimpieza =
        campoImporteLimpieza.value;

    actualizarCalculosEconomicos();
};

campoComisionLimpieza.oninput = () => {
    calendarioComisionLimpieza =
        campoComisionLimpieza.value;

    actualizarCalculosEconomicos();
};

// ============================================
// RESERVAS EXISTENTES
// ============================================

if (calendarioReservas.length > 0) {

    const reservasGuardadas =
        document.createElement("div");

    reservasGuardadas.style.marginTop = "14px";
    reservasGuardadas.style.padding = "12px";
    reservasGuardadas.style.background = "#FFFFFF";
    reservasGuardadas.style.borderRadius = "10px";

    const tituloReservas =
        document.createElement("div");

    tituloReservas.innerHTML =
        "<strong>Reservas existentes</strong>";

    tituloReservas.style.marginBottom = "10px";

    reservasGuardadas.appendChild(
        tituloReservas
    );

    calendarioReservas.forEach(reserva => {

        const fila =
            document.createElement("div");

        fila.style.display = "flex";
        fila.style.alignItems = "center";
        fila.style.justifyContent = "space-between";
        fila.style.gap = "10px";
        fila.style.padding = "8px 0";
        fila.style.borderBottom =
            "1px solid #E7E1D6";

        const fechas =
            document.createElement("div");

        fechas.innerHTML =
            "<strong>Ingreso:</strong> " +
            formatearFecha(
                fechaDesdeISO(reserva.check_in)
            ) +
            "<br>" +
            "<strong>Egreso:</strong> " +
            formatearFecha(
                fechaDesdeISO(reserva.check_out)
            );

        fechas.style.fontSize = "13px";

const verReserva =
    document.createElement("button");

verReserva.innerText = "Ver";

verReserva.style.width = "auto";
verReserva.style.minHeight = "0";
verReserva.style.height = "30px";
verReserva.style.padding = "0 12px";
verReserva.style.border = "none";
verReserva.style.borderRadius = "7px";
verReserva.style.background = "#0D2B45";
verReserva.style.color = "white";
verReserva.style.fontSize = "12px";
verReserva.style.cursor = "pointer";

verReserva.onclick = function() {
    abrirDetalleReserva(reserva);
};

const editarReserva =
    document.createElement("button");

editarReserva.innerText = "Editar";

editarReserva.style.width = "auto";
editarReserva.style.minHeight = "0";
editarReserva.style.height = "30px";
editarReserva.style.padding = "0 12px";
editarReserva.style.border = "none";
editarReserva.style.borderRadius = "7px";
editarReserva.style.background = "#70805f";
editarReserva.style.color = "white";
editarReserva.style.fontSize = "12px";
editarReserva.style.cursor = "pointer";

editarReserva.onclick = function() {
    calendarioReservaViendo = null;
    calendarioReservaEditando = reserva.id;

    calendarioIngreso =
        fechaDesdeISO(reserva.check_in);

    calendarioEgreso =
        fechaDesdeISO(reserva.check_out);

    calendarioFechaActual =
        new Date(
            calendarioIngreso.getFullYear(),
            calendarioIngreso.getMonth(),
            1
        );

    const detalle =
        Array.isArray(reserva.reservation_details)
            ? reserva.reservation_details[0]
            : reserva.reservation_details;

    calendarioInquilinoNombre =
        detalle?.tenant_name || "";

    calendarioInquilinoEmail =
        detalle?.tenant_email || "";

    calendarioInquilinoTelefono =
        detalle?.tenant_phone || "";

    calendarioCantidadHuespedes =
        detalle?.guest_count || "";

        calendarioImporteAlquiler =
    detalle?.rental_amount ?? "";

calendarioDescuentoEstadia =
    detalle?.long_stay_discount ?? "";

calendarioComisionAlquiler =
    detalle?.rental_commission_pct ?? "15";

calendarioImporteLimpieza =
    detalle?.cleaning_amount ?? "";

calendarioComisionLimpieza =
    detalle?.cleaning_commission_pct ?? "";

    renderCalendarioCasa();

    document
        .getElementById("calTenantName")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
};

        const eliminarReserva =
            document.createElement("button");

        eliminarReserva.innerText =
            "Eliminar";

        eliminarReserva.style.width = "auto";
        eliminarReserva.style.minHeight = "0";
        eliminarReserva.style.height = "30px";
        eliminarReserva.style.padding = "0 12px";
        eliminarReserva.style.border = "none";
        eliminarReserva.style.borderRadius = "7px";
        eliminarReserva.style.background =
            "#8B4B4B";
        eliminarReserva.style.color = "white";
        eliminarReserva.style.fontSize = "12px";
        eliminarReserva.style.cursor = "pointer";

        eliminarReserva.onclick =
            async function() {

                const confirmar =
    await confirmarAccionHM(
        "Esta acción eliminará la reserva y todos los datos del inquilino asociados.",
        "Eliminar reserva"
    );

if (!confirmar) {
    return;
}

                const { error } =
                    await supabaseClient
                        .from("house_reservations")
                        .delete()
                        .eq("id", reserva.id);

                if (error) {

                    console.error(
                        "❌ Error eliminando reserva:",
                        error
                    );

                    mostrarAvisoHM(
    "No se pudo eliminar la reserva"
);

                    return;
                }

                await cargarReservasCasa(
    calendarioCasaActual.id ||
    calendarioCasaActual.house_id
);

calendarioReservaViendo = null;
calendarioReservaEditando = null;
calendarioIngreso = null;
calendarioEgreso = null;
calendarioInquilinoNombre = "";
calendarioInquilinoEmail = "";
calendarioInquilinoTelefono = "";
calendarioCantidadHuespedes = "";
calendarioImporteAlquiler = "";
calendarioDescuentoEstadia = "";
calendarioComisionAlquiler = "15";
calendarioImporteLimpieza = "";
calendarioComisionLimpieza = "";

renderCalendarioCasa();

mostrarAvisoHM(
    "Reserva y datos del inquilino eliminados correctamente"
);
            };

        fila.appendChild(fechas);

const botonesReserva =
    document.createElement("div");

botonesReserva.style.display = "flex";
botonesReserva.style.gap = "6px";
botonesReserva.style.flexWrap = "wrap";
botonesReserva.style.justifyContent = "flex-end";

botonesReserva.appendChild(
    verReserva
);

if (calendarioPuedeEditar) {
    botonesReserva.appendChild(
        editarReserva
    );

    botonesReserva.appendChild(
        eliminarReserva
    );
}

fila.appendChild(
    botonesReserva
);

        reservasGuardadas.appendChild(fila);
    });

    contenedor.appendChild(
        reservasGuardadas
    );
}

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

       cancelar.onclick = async function() {
    if (calendarioReservaViendo) {
        calendarioReservaViendo = null;
        calendarioReservaEditando = null;
        calendarioIngreso = null;
        calendarioEgreso = null;
        calendarioInquilinoNombre = "";
        calendarioInquilinoEmail = "";
        calendarioInquilinoTelefono = "";
        calendarioCantidadHuespedes = "";
        calendarioImporteAlquiler = "";
calendarioDescuentoEstadia = "";
calendarioComisionAlquiler = "15";
calendarioImporteLimpieza = "";
calendarioComisionLimpieza = "";

        renderCalendarioCasa();
        window.scrollTo(0, 0);
        return;
    }

    await render();
    await openHouse(current);
};

    const guardar =
        document.createElement("button");

    guardar.innerText =
    calendarioReservaEditando
        ? "Guardar cambios"
        : "Guardar reserva";

    guardar.style.flex = "1";
    guardar.style.padding = "12px";
    guardar.style.border = "none";
    guardar.style.borderRadius = "10px";
    guardar.style.background = "#0D2B45";
    guardar.style.color = "white";
    guardar.style.cursor = "pointer";
    guardar.style.fontWeight = "600";

if (
    !calendarioPuedeEditar ||
    calendarioReservaViendo
) {
    guardar.style.display = "none";

    cancelar.innerText =
        calendarioReservaViendo
            ? "Volver al calendario"
            : "Cerrar";
}

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

let consultaReservas =
    supabaseClient
        .from("house_reservations")
        .select("id, check_in, check_out")
        .eq("house_id", houseId);

if (calendarioReservaEditando) {

    consultaReservas =
        consultaReservas.neq(
            "id",
            calendarioReservaEditando
        );
}

const {
    data: reservasExistentes,
    error: errorReservas
} = await consultaReservas;

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

// Evitar doble clic al guardar
if (guardar.disabled) {
    return;
}

guardar.disabled = true;
guardar.style.opacity = "0.6";
guardar.style.cursor = "default";

mostrarLoader(
    calendarioReservaEditando
        ? "Actualizando reserva..."
        : "Guardando reserva..."
);

let resultadoReserva;

if (calendarioReservaEditando) {

    resultadoReserva =
        await supabaseClient
            .from("house_reservations")
            .update({
                check_in:
                    calendarioIngreso
                        .toISOString()
                        .split("T")[0],

                check_out:
                    calendarioEgreso
                        .toISOString()
                        .split("T")[0]
            })
            .eq(
                "id",
                calendarioReservaEditando
            )
            .select();

} else {

    resultadoReserva =
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
}

const {
    data,
    error
} = resultadoReserva;

if (error) {

    console.error(
        "❌ Error guardando reserva:",
        error
    );

ocultarLoader();

guardar.disabled = false;
guardar.style.opacity = "1";
guardar.style.cursor = "pointer";

    alert(
        "No pudimos guardar la reserva."
    );

    return;

}

const reservaGuardada =
    data && data.length > 0
        ? data[0]
        : null;

const reservationId =
    calendarioReservaEditando ||
    reservaGuardada?.id;

if (!reservationId) {
    ocultarLoader();

    guardar.disabled = false;
    guardar.style.opacity = "1";
    guardar.style.cursor = "pointer";

    mostrarAvisoHM(
        "La reserva se guardó, pero no pudimos identificarla para guardar los datos del inquilino"
    );

    return;
}

const {
    data: detalleGuardado,
    error: errorDetalle
} =
    await supabaseClient
        .from("reservation_details")
        .upsert(
            {
                reservation_id: reservationId,
                tenant_name:
                    calendarioInquilinoNombre.trim() || null,
                tenant_email:
                    calendarioInquilinoEmail.trim() || null,
                tenant_phone:
                    calendarioInquilinoTelefono.trim() || null,
                guest_count:
Number(calendarioCantidadHuespedes) || null,

rental_amount:
Number(campoImporteAlquiler.value) || null,

long_stay_discount:
Number(campoDescuentoEstadia.value) || 0,

rental_net:
(Number(campoImporteAlquiler.value) || 0) *
(1 - (Number(campoDescuentoEstadia.value) || 0) / 100),

rental_commission_pct:
Number(campoComisionAlquiler.value) || 0,

rental_profit:
((Number(campoImporteAlquiler.value) || 0) *
(1 - (Number(campoDescuentoEstadia.value) || 0) / 100)) *
((Number(campoComisionAlquiler.value) || 0) / 100),

cleaning_amount:
Number(campoImporteLimpieza.value) || null,

cleaning_commission_pct:
Number(campoComisionLimpieza.value) || 0,

cleaning_profit:
(Number(campoImporteLimpieza.value) || 0) *
((Number(campoComisionLimpieza.value) || 0) / 100)
            },
            {
                onConflict: "reservation_id"
            }
        )
        .select("reservation_id")
        .single();

if (errorDetalle || !detalleGuardado) {
    console.error(
        "❌ Error guardando datos del inquilino:",
        errorDetalle
    );

    ocultarLoader();

    guardar.disabled = false;
    guardar.style.opacity = "1";
    guardar.style.cursor = "pointer";

    mostrarAvisoHM(
        "La reserva se guardó, pero no pudimos guardar los datos del inquilino"
    );

    return;
}

ocultarLoader();

const reservaFueEditada =
    Boolean(calendarioReservaEditando);

calendarioReservaEditando = null;

await render();
await openHouse(current);

mostrarAvisoHM(
    reservaFueEditada
        ? "Reserva actualizada correctamente"
        : "Reserva guardada correctamente"
);

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

function formatearFechaCorta(fecha) {

    if (!fecha) return "-";

    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = String(fecha.getFullYear()).slice(-2);

    return `${dia}/${mes}/${anio}`;
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

    } else {

        // La casa no tiene checklist todavía
        checklist = 0;

    }
}

const estado =
    checklist === 0
        ? "Pendiente"
        : checklist === 100
            ? "Lista para entregar"
            : "Preparación";

    const estadoIcono =
        estado === "Pendiente" ? "●" :
        estado === "Preparación" ? "●" :
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

    let reservasCasa = [];

if (h.id) {

    const {
        data,
        error
    } = await supabaseClient
        .from("house_reservations")
        .select("check_in, check_out")
        .eq("house_id", h.id)
        .gte(
            "check_out",
            new Date()
                .toISOString()
                .split("T")[0]
        )
        .order(
            "check_in",
            { ascending: true }
        );

    if (error) {

        console.error(
            "❌ Error cargando reservas de la casa:",
            error
        );

    } else {

        reservasCasa = data || [];
    }
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

   document.getElementById("houseDetailRating").innerHTML =
    cbIcon("star") +
    `<span>${valoraciones[h.nombre]?.promedio ?? "-"}</span>`;

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

    botonEliminar.innerHTML = cbIcon("trash", "white");

    botonEliminar.onclick = async function(event) {

        event.stopPropagation();

        const nombreCasa =
            h.nombre ||
            h.name ||
            h.nombreCasa ||
            h.nombre_casa ||
            "esta propiedad";

        const confirmar =
    await confirmarAccionHM(
        "Esta acción quitará " +
            nombreCasa +
            " de las propiedades disponibles.",
        "Eliminar propiedad"
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

// Eliminarla también de la memoria local
houses = houses.filter(casa => casa.id !== h.id);

        current = null;

        render();

        go("home");
    };

    const {
        data: rolParaEliminarPropiedad
    } = await supabaseClient.rpc(
        "current_organization_role"
    );

    botonEliminar.style.setProperty(
        "display",
        rolParaEliminarPropiedad === "admin"
            ? "inline-flex"
            : "none",
        "important"
    );

document
    .querySelectorAll(
        "#btnEliminarPropiedad"
    )
    .forEach(button => button.remove());

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

botonValoracion.innerHTML =
    cbIcon("star", "white") +
    "<span>Valorar estadía</span>";

botonValoracion.onclick = function(event) {

    event.stopPropagation();

    const nombreCasa =
        h.nombre ||
        h.name ||
        h.nombreCasa ||
        h.nombre_casa ||
        "";

    const link =
    h.valoracion_url ||
    linksValoracion[nombreCasa];

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
modal.style.inset = "0";
modal.style.zIndex = "99999";
modal.style.background = "#F7F3EA";
modal.style.overflowY = "auto";
modal.style.boxSizing = "border-box";

const caja = document.createElement("div");

caja.style.width = "100%";
caja.style.maxWidth = "1100px";
caja.style.minHeight = "100vh";
caja.style.margin = "0 auto";
caja.style.padding = "24px";
caja.style.background = "#F7F3EA";
caja.style.boxSizing = "border-box";

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

await aplicarModulosOrganizacion();
const { data: rolPermisosCasa } =
    await supabaseClient.rpc(
        "current_organization_role"
    );

const botonEditarCasa =
    document.getElementById(
        "houseMenuEditHouse"
    );

if (botonEditarCasa) {
    botonEditarCasa.style.display =
        ["admin", "colaborador"].includes(
            rolPermisosCasa
        )
            ? ""
            : "none";
}

const botonEditarChecklist =
    document.getElementById(
        "houseMenuChecklistEditor"
    );

if (botonEditarChecklist) {
    botonEditarChecklist.style.display =
        ["admin", "colaborador"].includes(
            rolPermisosCasa
        )
            ? ""
            : "none";
}

const botonAgregarInventario =
    document.getElementById(
        "btnAgregarInventario"
    );

if (botonAgregarInventario) {
    botonAgregarInventario.style.display =
        ["admin", "colaborador"].includes(
            rolPermisosCasa
        )
            ? ""
            : "none";
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

async function openInfoGeneral(){

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

        document.getElementById('infoHabitacionesDetalle').value =
    h.habitaciones_detalle ?? '';

    document.getElementById('infoBanios').value =
        h.banios ?? '';

    document.getElementById('infoWifi').value =
        h.wifi ?? '';

    document.getElementById('infoAlarma').value =
        h.alarma ?? '';

        document.getElementById(
    "infoValoracionUrl"
).value = h.valoracion_url ?? "";

    document.getElementById('infoObservaciones').value =
    h.obs ?? '';

const {
    data: rolInfoGeneral
} = await supabaseClient.rpc(
    "current_organization_role"
);

const puedeEditarInfoGeneral =
    ["admin", "colaborador"].includes(
        rolInfoGeneral
    );

[
    "infoNombre",
    "infoDireccion",
    "infoPropietario",
    "infoTelefono",
    "infoCapacidad",
    "infoHabitaciones",
    "infoHabitacionesDetalle",
    "infoBanios",
    "infoWifi",
    "infoAlarma",
    "infoObservaciones"
].forEach(id => {
    const campo = document.getElementById(id);

    if (campo) {
        campo.readOnly = !puedeEditarInfoGeneral;
    }
});

const botonGuardarInfo =
    document.querySelector(
        '#infoGeneral .btn[onclick="guardarInfoGeneral()"]'
    );

if (botonGuardarInfo) {
    botonGuardarInfo.style.setProperty(
        "display",
        puedeEditarInfoGeneral ? "block" : "none",
        "important"
    );
}

go('infoGeneral');
}

async function guardarInfoGeneral() {

    const h = houses[current];

    if (!h) {
        console.error("❌ No se encontró la propiedad actual");
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

        h.habitaciones_detalle =
    document.getElementById("infoHabitacionesDetalle").value.trim();

    h.banios =
        document.getElementById("infoBanios").value;

    h.wifi =
        document.getElementById("infoWifi").value;

    h.alarma =
        document.getElementById("infoAlarma").value;

        h.valoracion_url =
    document.getElementById(
        "infoValoracionUrl"
    ).value.trim();

    h.obs =
        document.getElementById("infoObservaciones").value;


   mostrarLoader("Guardando casa...");

try {
    await saveHouseToSupabase(h);

    const savedHouseId = h.id;

    await render();

    const savedIndex =
        houses.findIndex(
            house => house.id === savedHouseId
        );

    if (savedIndex >= 0) {
        current = savedIndex;
    }

    await openHouse(current);

    go("infoGeneral");
} finally {
    ocultarLoader();
}
}

async function obtenerInventarioCasa(){

    const house = houses[current];

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

        return Array.isArray(data.data)
            ? data.data
            : [];
    }

// ============================================
// NO HAY INVENTARIO EN SUPABASE
// ============================================

const inventoryBase =
    await obtenerInventarioBaseOrganizacion();

const initialItems =
    inventoryBase.map(item => ({
        nombre: item,
        presente: true,
        control: "presente"
    }));

if (initialItems.length) {

    const saved =
        await guardarInventarioSupabase(
            initialItems
        );

    if (!saved) {
        return null;
    }
}

return initialItems;
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

    return true;
}

let inventarioPuedeEditar = false;
// ============================================
// ABRIR INVENTARIO
// ============================================

async function openInventario(){

    const { data: rolInventario } =
    await supabaseClient.rpc(
        "current_organization_role"
    );

inventarioPuedeEditar =
    ["admin", "colaborador"].includes(
        rolInventario
    );

const botonAgregarInventario =
    document.getElementById(
        "btnAgregarInventario"
    );

const botonControlarInventario =
    document.getElementById(
        "btnControlarInventario"
    );

if (botonAgregarInventario) {
    botonAgregarInventario.style.display =
        inventarioPuedeEditar
            ? ""
            : "none";
}

if (botonControlarInventario) {
    botonControlarInventario.style.display =
        inventarioPuedeEditar
            ? ""
            : "none";
}

    go('inventario');

    const lista =
        document.getElementById('listaInventario');

    lista.innerHTML = `
    <div class="card">
        <b>Cargando inventario...</b>
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
        <div style="
            display:flex;
            align-items:center;
            gap:8px;
        ">
            <span class="cb-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M4 7L12 3L20 7L12 11L4 7Z"></path>
                    <path d="M4 7V17L12 21L20 17V7"></path>
                    <path d="M12 11V21"></path>
                </svg>
            </span>
            <b>No hay elementos cargados</b>
        </div>

        <div class="sub" style="display:block;margin-top:6px;">
            ${
                inventarioPuedeEditar
                    ? "Todavía no cargaste el inventario de esta casa."
                    : "Esta casa todavía no tiene elementos registrados."
            }
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

                ${inventarioPuedeEditar ? `
    <button
        class="btn-eliminar-inventario"
        onclick="eliminarItemInventario(${index})"
    >
        Eliminar
    </button>
` : ""}

            </div>
        `;
    });
}


// ============================================
// NUEVO ITEM
// ============================================

async function nuevoItemInventario(){

    const nombre =
    await solicitarTextoHM(
        "Escribí el nombre del elemento que querés agregar.",
        "Agregar elemento",
        "Nombre del elemento"
    );

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

    const confirmar =
    await confirmarAccionHM(
        "Esta acción eliminará el elemento del inventario.",
        "Eliminar elemento"
    );

if (!confirmar) {
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

async function openDashboardMensual() {

    const house = houses[current];

    if (!house || !house.id) {
        console.error(
            "La casa no tiene UUID de Supabase"
        );
        return;
    }

    const selectorMes =
        document.getElementById(
            "estadoCuentaMes"
        );

    if (!selectorMes.value) {

        const hoy = new Date();

        const anio =
            hoy.getFullYear();

        const mes =
            String(
                hoy.getMonth() + 1
            ).padStart(2, "0");

        selectorMes.value =
            `${anio}-${mes}`;
    }

    selectorMes.onchange =
        cargarDashboardMensual;

    go("estadoCuenta");

    await cargarDashboardMensual();
}

function cambiarTabEstadoCuenta(tab) {

    const botonPropietario =
        document.getElementById("tabEstadoPropietario");

    const botonEC =
        document.getElementById("tabEstadoEC");

        const contenidoPropietario =
    document.getElementById("contenidoEstadoPropietario");

const contenidoEC =
    document.getElementById("contenidoEstadoEC");

    if (!botonPropietario || !botonEC) return;

    const propietarioActivo =
        tab === "propietario";

        if (contenidoPropietario) {
    contenidoPropietario.style.display =
        propietarioActivo ? "block" : "none";
}

if (contenidoEC) {
    contenidoEC.style.display =
        propietarioActivo ? "none" : "block";
}

    botonPropietario.style.background =
        propietarioActivo ? "#0D2B45" : "#FFFFFF";

    botonPropietario.style.color =
        propietarioActivo ? "#FFFFFF" : "#0D2B45";

    botonPropietario.style.border =
        "1px solid #0D2B45";

    botonEC.style.background =
        propietarioActivo ? "#FFFFFF" : "#0D2B45";

    botonEC.style.color =
        propietarioActivo ? "#0D2B45" : "#FFFFFF";

    botonEC.style.border =
        "1px solid #0D2B45";
}

async function cargarDashboardMensual() {

    const house = houses[current];

    const selectorMes =
        document.getElementById(
            "estadoCuentaMes"
        );

    const resumen =
        document.getElementById(
            "estadoCuentaResumen"
        );

    const detalle =
        document.getElementById(
            "estadoCuentaDetalle"
        );

    if (
        !house?.id ||
        !selectorMes?.value ||
        !resumen ||
        !detalle
    ) {
        return;
    }

    resumen.innerHTML =
        `<div class="card">Cargando estado de cuenta...</div>`;

    detalle.innerHTML = "";

    const fechaMes =
        `${selectorMes.value}-01`;

    const { data, error } =
        await supabaseClient
            .from(
                "house_monthly_cost_summary"
            )
            .select("*")
            .eq("house_id", house.id)
            .eq("month", fechaMes)
            .maybeSingle();

    if (error) {

        console.error(
            "Error cargando el estado de cuenta:",
            error
        );

        resumen.innerHTML = `
            <div class="card">
                No se pudo cargar el estado de cuenta.
            </div>
        `;

        return;
    }

    const datos = data || {};

    const moneda =
        datos.currency || "ARS";

    const formatoDinero =
        new Intl.NumberFormat(
            "es-AR",
            {
                style: "currency",
                currency: moneda
            }
        );

    resumen.innerHTML = `
    <div
        style="
            display:grid;
            grid-template-columns:
                repeat(auto-fit, minmax(180px, 1fr));
            gap:12px;
        "
    >
        <div class="card">
            <div class="sub">Reservas</div>
            <strong>
                ${Number(datos.reservation_count) || 0}
            </strong>
        </div>

        <div class="card">
            <div class="sub">Ingresos por alquiler</div>
            <strong>
                ${formatoDinero.format(
                    Number(datos.rental_net) || 0
                )}
            </strong>
        </div>

        <div class="card">
            <div class="sub">Limpieza</div>
            <strong>
                ${formatoDinero.format(
                    Number(datos.cleaning_cost) || 0
                )}
            </strong>
        </div>

        <div class="card">
            <div class="sub">Incidencias / mantenimiento</div>
            <strong>
                ${formatoDinero.format(
                    Number(datos.work_subtotal) || 0
                )}
            </strong>
        </div>
    </div>

    <div
        style="
            display:grid;
            grid-template-columns:
                repeat(auto-fit, minmax(260px, 1fr));
            gap:12px;
            margin-top:12px;
        "
    >
        <div class="card">
            <div class="sub">
                NETO PARA EL PROPIETARIO
            </div>

            <strong style="font-size:26px;">
                ${formatoDinero.format(
                    Number(datos.owner_net) || 0
                )}
            </strong>
        </div>

        <div class="card">
            <div class="sub">
                INGRESO EXPERIENCIA COSTA
            </div>

            <strong style="font-size:26px;">
                ${formatoDinero.format(
                    Number(datos.ec_income) || 0
                )}
            </strong>
        </div>
    </div>

    <div class="card" style="margin-top:12px;">
        <div>
            Comisión alquiler EC:
            <strong>
                ${formatoDinero.format(
                    Number(datos.rental_commission) || 0
                )}
            </strong>
        </div>

        <div>
            Comisión limpieza EC:
            <strong>
                ${formatoDinero.format(
                    Number(datos.cleaning_commission) || 0
                )}
            </strong>
        </div>

        <div>
            Comisión incidencias / mantenimiento EC:
            <strong>
                ${formatoDinero.format(
                    Number(datos.commission_subtotal) || 0
                )}
            </strong>
        </div>

        <div style="margin-top:8px;">
            Total de gastos/cargos al propietario:
            <strong>
                ${formatoDinero.format(
                    Number(datos.owner_expenses) || 0
                )}
            </strong>
        </div>
    </div>
`;

const resumenPropietario =
    document.getElementById(
        "estadoCuentaPropietarioResumen"
    );

if (resumenPropietario) {

    const ingresoAlquilerPropietario =
        (Number(datos.rental_net) || 0)
        - (Number(datos.rental_commission) || 0);

    const egresosAdministracion =
        (Number(datos.work_subtotal) || 0)
        + (Number(datos.commission_subtotal) || 0);

    const saldoMesPropietario =
        ingresoAlquilerPropietario
        - egresosAdministracion;

    resumenPropietario.innerHTML = `
        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(150px, 1fr));
                gap:12px;
            "
        >
            <div class="card">
                <div class="sub">
                    INGRESOS DEL MES
                </div>
                <strong style="font-size:22px;">
                    ${formatoDinero.format(
                        ingresoAlquilerPropietario
                    )}
                </strong>
            </div>

            <div class="card">
                <div class="sub">
                    EGRESOS DEL MES
                </div>
                <strong style="font-size:22px;">
                    ${formatoDinero.format(
                        egresosAdministracion
                    )}
                </strong>
            </div>

            <div class="card">
                <div class="sub">
                    SALDO DEL MES
                </div>
                <strong style="font-size:22px;">
                    ${formatoDinero.format(
                        saldoMesPropietario
                    )}
                </strong>
            </div>

            <div class="card">
                <div class="sub">
                    SALDO ACUMULADO
                </div>
                <strong style="font-size:22px;">
                    —
                </strong>
            </div>
        </div>
    `;
}

    await cargarDetalleEstadoCuenta(
        house.id,
        selectorMes.value,
        moneda
    );
}

async function cargarDetalleEstadoCuenta(
    houseId,
    mesSeleccionado,
    moneda
) {

    const contenedor =
        document.getElementById(
            "estadoCuentaDetalle"
        );

        const contenedorMovimientosPropietario =
    document.getElementById(
        "estadoCuentaPropietarioMovimientos"
    );

    if (!contenedor) return;

    const [anio, mes] =
        mesSeleccionado
            .split("-")
            .map(Number);

    const fechaInicio =
        `${anio}-${String(mes).padStart(2, "0")}-01`;

    const siguienteAnio =
        mes === 12
            ? anio + 1
            : anio;

    const siguienteMes =
        mes === 12
            ? 1
            : mes + 1;

    const fechaFin =
        `${siguienteAnio}-${String(siguienteMes).padStart(2, "0")}-01`;

        const contenedorReservas =
    document.getElementById("estadoCuentaReservas");

if (contenedorReservas) {

    const { data: reservas, error: errorReservas } =
        await supabaseClient
            .from("house_reservations")
            .select(`
                id,
                check_in,
                check_out
            `)
            .eq("house_id", houseId)
            .gte("check_in", fechaInicio)
            .lt("check_in", fechaFin)
            .order("check_in", {
                ascending: false
            });

    if (errorReservas) {

        console.error(
            "Error cargando reservas del estado de cuenta:",
            errorReservas
        );

        contenedorReservas.innerHTML = `
            <div class="card">
                No se pudo cargar el detalle de reservas.
            </div>
        `;

    } else if (!reservas?.length) {

        contenedorReservas.innerHTML = `
            <div class="card">
                No hay reservas registradas durante este mes.
            </div>
        `;

    } else {

        const idsReservas =
            reservas.map(reserva => reserva.id);

        const {
            data: detallesReservas,
            error: errorDetallesReservas
        } =
            await supabaseClient
                .from("reservation_details")
                .select(`
                    reservation_id,
                    tenant_name,
                    rental_amount,
                    long_stay_discount,
                    rental_net,
                    rental_commission_pct,
                    rental_profit,
                    cleaning_amount,
                    cleaning_commission_pct,
                    cleaning_profit
                `)
                .in("reservation_id", idsReservas);

        if (errorDetallesReservas) {

            console.error(
                "Error cargando importes de reservas:",
                errorDetallesReservas
            );

            contenedorReservas.innerHTML = `
                <div class="card">
                    No se pudieron cargar los importes de las reservas.
                </div>
            `;

        } else {

            const detallesPorReserva =
                new Map(
                    (detallesReservas || []).map(
                        detalle => [
                            detalle.reservation_id,
                            detalle
                        ]
                    )
                );

            const formatoDineroReservas =
                new Intl.NumberFormat(
                    "es-AR",
                    {
                        style: "currency",
                        currency: moneda || "ARS"
                    }
                );

if (contenedorMovimientosPropietario) {

    contenedorMovimientosPropietario.innerHTML =
        reservas.map(reserva => {

            const detalle =
                detallesPorReserva.get(reserva.id) || {};

            const alquilerNeto =
                Number(detalle.rental_net) || 0;

            const comisionAlquiler =
                Number(detalle.rental_profit) || 0;

            const ingresoPropietario =
                alquilerNeto - comisionAlquiler;

            const fecha =
                reserva.check_in
                    ? new Date(
                        `${reserva.check_in}T12:00:00`
                    ).toLocaleDateString("es-AR")
                    : "-";

            return `
                <div class="card">
                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            gap:12px;
                            align-items:center;
                        "
                    >
                        <div>
                            <div class="title">
                                Alquiler
                            </div>

                            <div class="sub">
                                ${detalle.tenant_name || "Huésped"}
                                · ${fecha}
                            </div>
                        </div>

                        <div style="text-align:right;">
                            <div class="sub">
                                INGRESO
                            </div>

                            <strong style="font-size:20px;">
                                ${formatoDineroReservas.format(
                                    ingresoPropietario
                                )}
                            </strong>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
}

            contenedorReservas.innerHTML =
                reservas.map(reserva => {

                    const detalle =
                        detallesPorReserva.get(reserva.id) || {};

                    const alquilerBruto =
                        Number(detalle.rental_amount) || 0;

                    const descuentoPct =
                        Number(detalle.long_stay_discount) || 0;

                    const alquilerNeto =
                        Number(detalle.rental_net) || 0;

                    const comisionAlquiler =
                        Number(detalle.rental_profit) || 0;

                    const limpieza =
                        Number(detalle.cleaning_amount) || 0;

                    const comisionLimpieza =
                        Number(detalle.cleaning_profit) || 0;

                    const totalHuesped =
                        alquilerNeto + limpieza;

                    const ingresoEC =
                        comisionAlquiler + comisionLimpieza;

                    const netoPropietario =
                        alquilerNeto
                        - comisionAlquiler
                        - limpieza
                        - comisionLimpieza;

                    const checkIn =
                        reserva.check_in
                            ? new Date(
                                `${reserva.check_in}T12:00:00`
                            ).toLocaleDateString("es-AR")
                            : "-";

                    const checkOut =
                        reserva.check_out
                            ? new Date(
                                `${reserva.check_out}T12:00:00`
                            ).toLocaleDateString("es-AR")
                            : "-";

                    return `
                        <div class="card">

                            <div class="title">
                                ${detalle.tenant_name || "Reserva"}
                            </div>

                            <div class="sub">
                                Estadía: ${checkIn} al ${checkOut}
                            </div>

                            <div class="sub" style="margin-top:8px;">
                                Alquiler bruto:
                                ${formatoDineroReservas.format(alquilerBruto)}
                            </div>

                            <div class="sub">
                                Descuento larga estadía
                                (${descuentoPct}%)
                            </div>

                            <div class="sub">
                                Alquiler neto:
                                ${formatoDineroReservas.format(alquilerNeto)}
                            </div>

                            <div class="sub">
                                Comisión alquiler EC
                                (${Number(detalle.rental_commission_pct) || 0}%):
                                ${formatoDineroReservas.format(comisionAlquiler)}
                            </div>

                            <div class="sub">
                                Limpieza:
                                ${formatoDineroReservas.format(limpieza)}
                            </div>

                            <div class="sub">
                                Comisión limpieza EC
                                (${Number(detalle.cleaning_commission_pct) || 0}%):
                                ${formatoDineroReservas.format(comisionLimpieza)}
                            </div>

                            <div style="margin-top:10px;">
                                Total cobrado al huésped:
                                <strong>
                                    ${formatoDineroReservas.format(totalHuesped)}
                                </strong>
                            </div>

                            <div style="margin-top:6px;">
                                Neto propietario de esta reserva:
                                <strong>
                                    ${formatoDineroReservas.format(netoPropietario)}
                                </strong>
                            </div>

                            <div style="margin-top:6px;">
                                Ingreso EC de esta reserva:
                                <strong>
                                    ${formatoDineroReservas.format(ingresoEC)}
                                </strong>
                            </div>

                        </div>
                    `;
                }).join("");
        }
    }
}

    const { data: incidencias, error } =
        await supabaseClient
            .from("house_incidencias")
            .select(`
                id,
                fecha,
                ambiente,
                descripcion,
                provider_name,
                work_cost,
                commission_percentage,
                commission_amount,
                total_cost,
                economic_status
            `)
            .eq("house_id", houseId)
            .gte("fecha", fechaInicio)
            .lt("fecha", fechaFin)
            .order("fecha", {
                ascending: false
            });

    if (error) {

        console.error(
            "Error cargando el detalle mensual:",
            error
        );

        contenedor.innerHTML = `
            <div class="card">
                No se pudo cargar el detalle.
            </div>
        `;

        return;
    }

    if (!incidencias?.length) {

        contenedor.innerHTML = `
            <div class="card">
                No hay incidencias registradas
                durante este mes.
            </div>
        `;

        return;
    }

    const formatoDinero =
        new Intl.NumberFormat(
            "es-AR",
            {
                style: "currency",
                currency: moneda || "ARS"
            }
        );

    const nombresEstado = {
        pendiente: "Pendiente",
        presupuestado: "Presupuestado",
        aprobado: "Aprobado",
        rechazado: "Rechazado",
        pagado: "Pagado"
    };

if (contenedorMovimientosPropietario) {

    const movimientosEgresos =
        incidencias.map(incidencia => {

            const total =
                Number(incidencia.total_cost) || 0;

            const fecha =
                incidencia.fecha
                    ? new Date(
                        `${incidencia.fecha}T12:00:00`
                    ).toLocaleDateString("es-AR")
                    : "Sin fecha";

            return `
                <div class="card">
                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            gap:12px;
                            align-items:center;
                        "
                    >
                        <div>
                            <div class="title">
                                ${incidencia.ambiente ||
                                  "Mantenimiento"}
                            </div>

                            <div class="sub">
                                ${incidencia.descripcion || ""}
                            </div>

                            <div class="sub">
                                ${fecha}
                            </div>
                        </div>

                        <div style="text-align:right;">
                            <div class="sub">
                                EGRESO
                            </div>

                            <strong style="font-size:20px;">
                                ${formatoDinero.format(total)}
                            </strong>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");

    contenedorMovimientosPropietario.innerHTML +=
        movimientosEgresos;
}

    contenedor.innerHTML =
        incidencias
            .map(incidencia => {

                const costo =
                    Number(
                        incidencia.work_cost
                    ) || 0;

                const comision =
                    Number(
                        incidencia.commission_amount
                    ) || 0;

                const total =
                    Number(
                        incidencia.total_cost
                    ) || 0;

                const estado =
                    nombresEstado[
                        incidencia.economic_status
                    ] || "Pendiente";

                const fecha =
                    incidencia.fecha
                        ? new Date(
                            `${incidencia.fecha}T12:00:00`
                        ).toLocaleDateString("es-AR")
                        : "Sin fecha";

                return `
                    <div class="card">
                        <div class="title">
                            ${incidencia.ambiente || "Incidencia"}
                        </div>

                        <div class="sub">
                            ${incidencia.descripcion || ""}
                        </div>

                        <div class="sub" style="margin-top:8px;">
                            Fecha: ${fecha}
                        </div>

                        <div class="sub">
                            Proveedor:
                            ${incidencia.provider_name ||
                              "Sin proveedor"}
                        </div>

                        <div class="sub">
                            Trabajo:
                            ${formatoDinero.format(costo)}
                        </div>

                        <div class="sub">
                            Comisión
                            (${Number(
                                incidencia.commission_percentage
                            ) || 0}%):
                            ${formatoDinero.format(comision)}
                        </div>

                        <div style="margin-top:6px;">
                            <strong>
                                Total:
                                ${formatoDinero.format(total)}
                            </strong>
                        </div>

                        <div class="sub" style="margin-top:6px;">
                            Estado:
                            <strong>${estado}</strong>
                        </div>
                    </div>
                `;
            })
            .join("");
}

async function openIncidencias(){

    const lista = document.getElementById('listaIncidencias');

    const formularioIncidencia =
    document.getElementById(
        "formIncidencia"
    );

if (formularioIncidencia) {
    formularioIncidencia.style.display =
        "none";
}

incidenciaEditandoId = null;

    const house = houses[current];

    const nombreCasaEstadoCuenta =
    document.getElementById("estadoCuentaCasaNombre");

if (nombreCasaEstadoCuenta) {
    nombreCasaEstadoCuenta.textContent =
        house?.nombre ||
        house?.name ||
        house?.nombreCasa ||
        "Casa";
}

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

const { data: rolIncidencias } =
    await supabaseClient.rpc(
        "current_organization_role"
    );

const puedeGestionarIncidencias =
    ["admin", "colaborador"].includes(
        rolIncidencias
    );

    const esPropietarioIncidencias =
    rolIncidencias === "propietario";

const botonNuevaIncidencia =
    document.getElementById(
        "btnNuevaIncidencia"
    );

if (botonNuevaIncidencia) {
    botonNuevaIncidencia.style.display =
        puedeGestionarIncidencias
            ? ""
            : "none";
}

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

    if (!incidencias || incidencias.length === 0) {

    lista.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-title">
                No hay incidencias
            </div>

            <div class="empty-state-text">
                Esta propiedad no tiene incidencias registradas.
            </div>
        </div>
    `;

    return;
}

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

            const formatoDineroIncidencia =
    new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: incidencia.currency || "ARS"
    });

const costoTrabajo =
    Number(incidencia.work_cost) || 0;

const montoComision =
    Number(incidencia.commission_amount) || 0;

const costoTotal =
    Number(incidencia.total_cost) || 0;

const estadoEconomicoTexto = {
    pendiente: "Pendiente",
    presupuestado: "Presupuestado",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    pagado: "Pagado"
}[incidencia.economic_status] || "Pendiente";

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

                    ${puedeGestionarIncidencias ? `
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
` : ""}

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

                <div
    style="
        margin-top:14px;
        padding:14px;
        border:1px solid #ddd;
        border-radius:10px;
    "
>
    <div>
        <strong>Información económica</strong>
    </div>

    <div class="sub" style="margin-top:8px;">
        Proveedor:
        ${incidencia.provider_name || "Sin proveedor asignado"}
    </div>

    ${incidencia.provider_contact ? `
        <div class="sub">
            Contacto: ${incidencia.provider_contact}
        </div>
    ` : ""}

    <div class="sub">
        Costo del trabajo:
        ${formatoDineroIncidencia.format(costoTrabajo)}
    </div>

    <div class="sub">
        Comisión (${Number(incidencia.commission_percentage) || 0}%):
        ${formatoDineroIncidencia.format(montoComision)}
    </div>

    <div style="margin-top:6px;">
        <strong>
            Total:
            ${formatoDineroIncidencia.format(costoTotal)}
        </strong>
    </div>

    <div class="sub" style="margin-top:8px;">
        Estado económico:
        <strong>${estadoEconomicoTexto}</strong>
    </div>
</div>

${esPropietarioIncidencias &&
  incidencia.economic_status === "presupuestado" ? `
    <div
        style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:10px;
            margin-top:12px;
        "
    >
        <button
            class="btn"
            onclick="decidirPresupuestoIncidencia('${incidencia.id}', 'aprobado')"
        >
            Aprobar
        </button>

        <button
            class="btn"
            onclick="decidirPresupuestoIncidencia('${incidencia.id}', 'rechazado')"
            style="background:#8b3a3a;"
        >
            Rechazar
        </button>
    </div>
` : ""}

${puedeGestionarIncidencias ? `
    <div
        class="btn"
        onclick="editarEconomiaIncidencia('${incidencia.id}')"
        style="margin-top:10px;"
    >
        Editar presupuesto
    </div>
` : ""}

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

               ${puedeGestionarIncidencias ? `
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
` : ""}

            </div>
        `;
    });

    go('incidencias');
}
 
async function decidirPresupuestoIncidencia(
    incidenciaId,
    decision
) {

    const esAprobacion =
        decision === "aprobado";

    let motivo = null;

    if (esAprobacion) {

        const confirmar =
    await confirmarAccionHM(
        "Confirmá que querés aprobar este presupuesto.",
        "Aprobar presupuesto",
        "APROBAR",
        "#6B7A5A"
    );

if (!confirmar) return;

    } else {

        motivo =
    await solicitarTextoHM(
        "Explicá brevemente por qué rechazás este presupuesto.",
        "Rechazar presupuesto",
        "Motivo del rechazo"
    );

        if (motivo === null) return;

        motivo = motivo.trim();

        if (!motivo) {
            alert(
                "Para rechazar el presupuesto debés indicar un motivo."
            );
            return;
        }
    }

    const { error } =
        await supabaseClient.rpc(
            "decide_incident_budget",
            {
                p_incident_id: Number(incidenciaId),
                p_decision: decision,
                p_reason: motivo
            }
        );

    if (error) {

        console.error(
            "Error registrando la decisión:",
            error
        );

        alert(
            "No se pudo registrar la decisión."
        );

        return;
    }

   mostrarAvisoHM(
    esAprobacion
        ? "Presupuesto aprobado correctamente"
        : "Presupuesto rechazado correctamente"
);

    await openIncidencias();
}

function confirmarAccionHM(
    mensaje,
    titulo = "Eliminar incidencia",
    textoAceptar = "ELIMINAR",
    colorAceptar = "#8B4B4B",
    textoCancelar = "CANCELAR"
) {
    return new Promise((resolve) => {
        const anterior =
            document.getElementById("modalConfirmacionHM");

        if (anterior) {
            anterior.remove();
        }

        const fondo = document.createElement("div");
        fondo.id = "modalConfirmacionHM";

        fondo.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(13, 43, 69, 0.48);
            box-sizing: border-box;
        `;

        fondo.innerHTML = `
            <div style="
                width: min(100%, 390px);
box-sizing: border-box;
padding: 32px 26px 26px;
background: #FFFFFF;
border-radius: 18px;
                box-shadow: 0 18px 50px rgba(13, 43, 69, 0.24);
                text-align: center;
                font-family: Montserrat, Arial, sans-serif;
            ">
                <div style="
                    width: 58px;
                    height: 58px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 18px;
                    border: 2px solid #8B4B4B;
                    border-radius: 50%;
                    color: #8B4B4B;
                    font-size: 30px;
                    font-weight: 700;
                ">!</div>

                <div style="
    margin-bottom: 10px;
    color: #0D2B45;
    font-size: 20px;
    font-weight: 700;
">
    ${titulo}
</div>

                <div style="
                    margin-bottom: 24px;
                    color: #59636B;
                    font-size: 15px;
                    line-height: 1.5;
                ">
                    ${mensaje}
                </div>

                <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                ">
                    <button
                        id="cancelarConfirmacionHM"
                        type="button"
                        style="
                            padding: 13px;
                            border: 1px solid #0D2B45;
                            border-radius: 10px;
                            background: #FFFFFF;
                            color: #0D2B45;
                            font-family: Montserrat, Arial, sans-serif;
                            font-weight: 700;
                            cursor: pointer;
                        "
                    >
                        ${textoCancelar}
                    </button>

                    <button
                        id="aceptarConfirmacionHM"
                        type="button"
                        style="
                            padding: 13px;
                            border: none;
                            border-radius: 10px;
                            background: ${colorAceptar};
color: #FFFFFF;
font-family: Montserrat, Arial, sans-serif;
                            font-weight: 700;
                            cursor: pointer;
                        "
                    >
                        ${textoAceptar}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(fondo);

        document
            .getElementById("cancelarConfirmacionHM")
            .onclick = () => {
                fondo.remove();
                resolve(false);
            };

        document
            .getElementById("aceptarConfirmacionHM")
            .onclick = () => {
                fondo.remove();
                resolve(true);
            };
    });
}

function solicitarTextoHM(
    mensaje,
    titulo = "Ingresar información",
    placeholder = "",
    valorInicial = ""
) {

    return new Promise((resolve) => {
        const anterior =
            document.getElementById("modalTextoHM");

        if (anterior) {
            anterior.remove();
        }

        const fondo =
            document.createElement("div");

        fondo.id = "modalTextoHM";

        fondo.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(13, 43, 69, 0.48);
            box-sizing: border-box;
        `;

        fondo.innerHTML = `
            <div style="
                width: min(100%, 390px);
                box-sizing: border-box;
                padding: 32px 26px 26px;
                background: #FFFFFF;
                border-radius: 18px;
                box-shadow: 0 18px 50px rgba(13, 43, 69, 0.24);
                text-align: center;
                font-family: Montserrat, Arial, sans-serif;
            ">
                <div style="
                    margin-bottom: 10px;
                    color: #0D2B45;
                    font-size: 20px;
                    font-weight: 700;
                ">
                    ${titulo}
                </div>

                <div style="
                    margin-bottom: 18px;
                    color: #59636B;
                    font-size: 15px;
                    line-height: 1.5;
                ">
                    ${mensaje}
                </div>

                <input
                    id="campoTextoHM"
                    type="text"
                    placeholder="${placeholder}"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        margin-bottom: 22px;
                        padding: 13px 14px;
                        border: 1px solid #D7DDE2;
                        border-radius: 10px;
                        background: #FFFFFF;
                        color: #0D2B45;
                        font-family: Montserrat, Arial, sans-serif;
                        font-size: 14px;
                        outline: none;
                    "
                >

                <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                ">
                    <button
                        id="cancelarTextoHM"
                        type="button"
                        style="
                            padding: 13px;
                            border: 1px solid #0D2B45;
                            border-radius: 10px;
                            background: #FFFFFF;
                            color: #0D2B45;
                            font-family: Montserrat, Arial, sans-serif;
                            font-weight: 700;
                            cursor: pointer;
                        "
                    >
                        CANCELAR
                    </button>

                    <button
                        id="aceptarTextoHM"
                        type="button"
                        style="
                            padding: 13px;
                            border: none;
                            border-radius: 10px;
                            background: #0D2B45;
                            color: #FFFFFF;
                            font-family: Montserrat, Arial, sans-serif;
                            font-weight: 700;
                            cursor: pointer;
                        "
                    >
                        ACEPTAR
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(fondo);

        const campo =
            document.getElementById("campoTextoHM");

        campo.value = valorInicial;
campo.select();

        const cancelar =
            document.getElementById("cancelarTextoHM");

        const aceptar =
            document.getElementById("aceptarTextoHM");

        const cerrar = (resultado) => {
            fondo.remove();
            resolve(resultado);
        };

        cancelar.onclick = () => {
            cerrar(null);
        };

        aceptar.onclick = () => {
            cerrar(campo.value);
        };

        campo.onkeydown = (event) => {
            if (event.key === "Enter") {
                aceptar.click();
            }

            if (event.key === "Escape") {
                cancelar.click();
            }
        };

        campo.focus();
    });
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

    openIncidencias();
}

    document.getElementById('formIncidencia').style.display='none';

    function actualizarTotalesIncidencia() {

    const costo =
        Number(document.getElementById("incCosto")?.value) || 0;

    const porcentaje =
        Number(document.getElementById("incComision")?.value) || 0;

    const comision =
        costo * porcentaje / 100;

    const total =
        costo + comision;

    const formatoDinero =
        new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS"
        });

    const costoVista =
        document.getElementById("incCostoVista");

    const comisionVista =
        document.getElementById("incComisionVista");

    const totalVista =
        document.getElementById("incTotalVista");

    if (costoVista) {
        costoVista.textContent =
            formatoDinero.format(costo);
    }

    if (comisionVista) {
        comisionVista.textContent =
            formatoDinero.format(comision);
    }

    if (totalVista) {
        totalVista.textContent =
            formatoDinero.format(total);
    }
}

document
    .getElementById("incCosto")
    ?.addEventListener(
        "input",
        actualizarTotalesIncidencia
    );

document
    .getElementById("incComision")
    ?.addEventListener(
        "input",
        actualizarTotalesIncidencia
    );

    let incidenciaEditandoId = null;

async function editarEconomiaIncidencia(id) {

    const { data: incidencia, error } =
        await supabaseClient
            .from("house_incidencias")
            .select("*")
            .eq("id", id)
            .single();

    if (error || !incidencia) {

        console.error(
            "Error cargando la incidencia:",
            error
        );

        alert("No se pudo abrir el presupuesto.");
        return;
    }

    incidenciaEditandoId = id;

    document.getElementById("incAmbiente").value =
        incidencia.ambiente || "";

    document.getElementById("incDescripcion").value =
        incidencia.descripcion || "";

    document.getElementById("incPrioridad").value =
        incidencia.prioridad || "Media";

    document.getElementById("incEstado").value =
        incidencia.estado || "Abierta";

    document.getElementById("incResponsable").value =
        incidencia.responsable || "";

    document.getElementById("incProveedor").value =
        incidencia.provider_name || "";

    document.getElementById("incProveedorContacto").value =
        incidencia.provider_contact || "";

    document.getElementById("incCosto").value =
        Number(incidencia.work_cost) || 0;

    document.getElementById("incComision").value =
        Number(incidencia.commission_percentage) || 0;

    document.getElementById("incEstadoEconomico").value =
        incidencia.economic_status || "pendiente";

    actualizarTotalesIncidencia();

    const formulario =
        document.getElementById("formIncidencia");

    formulario.style.display = "block";

    formulario.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function cancelarFormularioIncidencia() {

    const formulario =
        document.getElementById(
            "formIncidencia"
        );

    if (formulario) {
        formulario.style.display =
            "none";
    }

    incidenciaEditandoId = null;
        mantenimientoOrigenTaskId = null;

    const botonNueva =
        document.getElementById(
            "btnNuevaIncidencia"
        );

    if (botonNueva) {
        botonNueva.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

function nuevaIncidencia(){

    incidenciaEditandoId = null;
        mantenimientoOrigenTaskId = null;

    document.getElementById('formIncidencia').style.display='block';

    document.getElementById('incAmbiente').value='';
    document.getElementById('incDescripcion').value='';
    document.getElementById('incPrioridad').value='Media';
    document.getElementById('incEstado').value='Abierta';
    document.getElementById('incResponsable').value='';
    document.getElementById("incProveedor").value = "";
document.getElementById("incProveedorContacto").value = "";
document.getElementById("incCosto").value = "0";
document.getElementById("incComision").value = "0";
document.getElementById("incEstadoEconomico").value = "pendiente";

actualizarTotalesIncidencia();
}

function mostrarAvisoHM(mensaje) {
    const esError =
        /no se pudo|no pudimos|error|seleccioná|ingresá|debés|todavía no|no tenés|no encontramos/i
            .test(mensaje);

    const colorAviso =
        esError ? "#8B4B4B" : "#6B7A5A";

    const iconoAviso =
        esError ? "!" : "✓";

    const tituloAviso =
        esError
            ? "Atención"
            : "Operación realizada";

    const anterior = document.getElementById("modalAvisoHM");

    if (anterior) {
        anterior.remove();
    }

    const fondo = document.createElement("div");
    fondo.id = "modalAvisoHM";

    fondo.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(13, 43, 69, 0.48);
        box-sizing: border-box;
    `;

    fondo.innerHTML = `
        <div style="
            width: min(100%, 390px);
            box-sizing: border-box;
            padding: 32px 26px 26px;
            background: #FFFFFF;
            border-radius: 18px;
            box-shadow: 0 18px 50px rgba(13, 43, 69, 0.24);
            text-align: center;
            font-family: Montserrat, Arial, sans-serif;
        ">
            <div style="
                width: 58px;
                height: 58px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 18px;
                border: 2px solid ${colorAviso};
                border-radius: 50%;
                color: ${colorAviso};
                font-size: 30px;
                font-weight: 700;
            ">${iconoAviso}</div>

            <div style="
                margin-bottom: 10px;
                color: #0D2B45;
                font-size: 20px;
                font-weight: 700;
            ">
                ${tituloAviso}
            </div>

            <div style="
                margin-bottom: 24px;
                color: #59636B;
                font-size: 15px;
                line-height: 1.5;
            ">
                ${mensaje}
            </div>

            <button
                type="button"
                onclick="document.getElementById('modalAvisoHM').remove()"
                style="
                    width: 100%;
                    padding: 13px 18px;
                    border: none;
                    border-radius: 10px;
                    background: #0D2B45;
                    color: #FFFFFF;
                    font-family: Montserrat, Arial, sans-serif;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                "
            >
                ACEPTAR
            </button>
        </div>
    `;

    document.body.appendChild(fondo);
}

window.alert = function(mensaje) {
    mostrarAvisoHM(
        String(mensaje)
    );
};

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
    document.getElementById("incResponsable").value.trim(),

provider_name:
    document.getElementById("incProveedor").value.trim(),

provider_contact:
    document.getElementById("incProveedorContacto").value.trim(),

work_cost:
    Number(document.getElementById("incCosto").value) || 0,

commission_percentage:
    Number(document.getElementById("incComision").value) || 0,

currency:
    "ARS",

economic_status:
    document.getElementById("incEstadoEconomico").value,

fecha:
    new Date().toISOString().split("T")[0]
    };

    if (incidencia.economic_status === "presupuestado") {
    incidencia.budgeted_at =
        new Date().toISOString();
}

let resultadoIncidencia;

if (incidenciaEditandoId) {

    resultadoIncidencia =
        await supabaseClient
            .from("house_incidencias")
            .update(incidencia)
            .eq("id", incidenciaEditandoId)
            .select()
            .single();

} else if (mantenimientoOrigenTaskId) {

    resultadoIncidencia =
        await supabaseClient.rpc(
            "crear_incidencia_desde_mantenimiento",
            {
                p_task_id: mantenimientoOrigenTaskId,
                p_datos: incidencia
            }
        );

} else {

    resultadoIncidencia =
        await supabaseClient
            .from("house_incidencias")
            .insert(incidencia)
            .select()
            .single();
}

const { data, error } = resultadoIncidencia;

    if (error) {

        console.error(
            "❌ Error guardando incidencia en Supabase:",
            error
        );

                mostrarAvisoHM(
            "No se pudo guardar la incidencia. Revisá la consola."
        );

        return;
    }

    mostrarAvisoHM(
    incidenciaEditandoId
        ? "Incidencia actualizada correctamente"
        : "Incidencia guardada correctamente"
);

incidenciaEditandoId = null;
mantenimientoOrigenTaskId = null;

    document.getElementById('formIncidencia').style.display = 'none';

    await render();
await openIncidencias();
}

async function eliminarIncidencia(id){

    const confirmarEliminacion =
    await confirmarAccionHM(
        "Esta acción eliminará la incidencia definitivamente."
    );

if (!confirmarEliminacion) {
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

    await render();
await openIncidencias();
}

function editCurrent() {
    const h = houses[current];

    document.getElementById("name").value =
        h.nombre ?? h.name ?? h.nombreCasa ?? h.nombre_casa ?? "";

    document.getElementById("barrio").value =
        h.barrio ?? "";

    document.getElementById("lote").value =
        h.lote ?? "";

    document.getElementById("capacidad").value =
        h.capacidad ?? "";

    document.getElementById("wifi").value =
        h.wifi ?? "";

    document.getElementById("obs").value =
        h.obs ?? "";

    document.getElementById("situacion").value =
        h.situacion ?? "Disponible";

    go("edit");
}

async function saveCurrent() {

    const house = houses[current];

    house.nombre =
        document.getElementById("name").value;

    house.name = house.nombre;
    house.nombreCasa = house.nombre;
    house.nombre_casa = house.nombre;

    house.barrio =
        document.getElementById("barrio").value;

    house.lote =
        document.getElementById("lote").value;

    house.capacidad =
        document.getElementById("capacidad").value;

    house.wifi =
        document.getElementById("wifi").value;

    house.obs =
        document.getElementById("obs").value;

    house.situacion =
        document.getElementById("situacion").value;

    mostrarLoader("Guardando casa...");

try {
    await saveHouseToSupabase(house);

    const savedHouseId = house.id;

    const title = document.getElementById("title");
    if (title) {
        title.textContent = house.nombre;
    }

    await render();

    const savedIndex =
        houses.findIndex(
            item => item.id === savedHouseId
        );

    if (savedIndex >= 0) {
        current = savedIndex;
    }

    await openHouse(current);
} finally {
    ocultarLoader();
}
}
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
{title:"Control Final",items:["Fotos","Alarma","Internet","Casa lista"]},
{title:"Lavadero",items:["Lavarropas","Secarropas","Detergente","Piso"]}
];

function ordenAmbientesChecklist(lista) {
    const indices = lista.map((_, i) => i);
    return indices.filter(i => lista[i].title !== "Control Final")
        .concat(indices.filter(i => lista[i].title === "Control Final"));
}

function agregarLavaderoSiFalta(lista) {
    const copia = JSON.parse(JSON.stringify(lista));
    if (!copia.some(a => String(a.title || "").trim().toLowerCase() === "lavadero")) {
        copia.push({title:"Lavadero",items:["Lavarropas","Secarropas","Detergente","Piso"]});
    }
    return copia;
}

let checks = {};
actualizarEstadosTodasLasCasas();
render();

let paso = 0;
let observaciones = {};
let checklistPuedeEditar = false;

async function guardarChecklistSupabase() {

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

    const dataCasa = {};

    ensureChecklist().forEach((ambiente, i) => {

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

}

async function startPreparation(){

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }
    await cargarConfiguracionChecklistCasa();
    const { data: rolChecklist } =
    await supabaseClient.rpc(
        "current_organization_role"
    );

checklistPuedeEditar =
    ["admin", "colaborador"].includes(
        rolChecklist
    );

    const diagnostico = document.getElementById("diagnosticoChecklist");

if (diagnostico) {
    diagnostico.style.display = "block";
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

        } else {

    }

    if (diagnostico) {
        diagnostico.style.display = "none";
    }

    paso = 0;

    go('prep');

    renderPrep();

}

function renderPrep(){

const lista = ensureChecklist();
const ambienteIndex = ordenAmbientesChecklist(lista)[paso];
const env = lista[ambienteIndex];
const key = "c"+current+"_"+ambienteIndex;

const obsKey = "c" + current + "_" + ambienteIndex;

if(!checks[key]){
    checks[key] = new Array(env.items.length).fill(false);
}

prepTitle.innerHTML = env.title;

checklist.innerHTML = "";

env.items.forEach((c,i)=>{

    const marcado = checks[key][i] ? "checked" : "";

    const bloqueado =
    checklistPuedeEditar
        ? ""
        : "disabled";

    checklist.innerHTML += `
    <label class="chk">
       <input type="checkbox" ${marcado} ${bloqueado}
    
       onchange="
    
       checks['${key}'][${i}] = this.checked;
guardarChecklistSupabase();
actualizarEstadoCasa();
"
>
        <span>${c}</span>
    </label>`;
});

progressBar.style.width=((paso+1)/lista.length*100)+"%";

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
${bloqueado}
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

    ensureChecklist().forEach((ambiente, ambienteIndex) => {

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

    ensureChecklist().forEach((ambiente, i) => {

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

        houses[current].estado = "Preparación";

    } else {

        houses[current].estado = "Lista para entregar";

    }

}

function actualizarEstadosTodasLasCasas() {

    const checksActuales = checks || {};

    houses.forEach((house, houseIndex) => {

        let totalChecks = 0;
        let checksCompletados = 0;

        (checklistData["c" + houseIndex] || ambientes).forEach((ambiente, ambienteIndex) => {

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

            house.estado = "Preparación";

        } else {

            house.estado = "Lista para entregar";

        }

    });

}

async function volverDesdeChecklist() {
    actualizarEstadoCasa();

    if (checklistPuedeEditar) {
        await guardarChecklistSupabase();
    }

    await render();
    await openHouse(current);
}

function nextStep(){

    const obs = document.getElementById("obsPrep");

if (obs && checklistPuedeEditar) {
        const ambienteIndex = ordenAmbientesChecklist(ensureChecklist())[paso];
        observaciones["c" + current + "_" + ambienteIndex] = obs.value;

        guardarChecklistSupabase();
    }

    if (paso < ensureChecklist().length - 1) {

        paso++;
        renderPrep();

    } else {

        volverDesdeChecklist();
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

    if (data && Array.isArray(data.data)) {

        checklistData[key] = agregarLavaderoSiFalta(data.data);

        if (checklistData[key].length !== data.data.length) {
            await supabaseClient.from("house_checklist_config").upsert({
                house_id: house.id,
                data: checklistData[key],
                updated_at: new Date().toISOString()
            }, { onConflict: "house_id" });
        }

        return;
    }

    // ============================================
// SI NO EXISTE:
// USAR CONFIGURACIÓN ESTÁNDAR
// ============================================

    if (!checklistData[key]) {

    checklistData[key] =
        await obtenerChecklistBaseOrganizacion();

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

}


// ============================================
// CHECKLIST LOCAL — RESPALDO
// ============================================

function ensureChecklist(){

    const key = "c" + current;

    if(!checklistData[key]){

        checklistData[key] = agregarLavaderoSiFalta(ambientes);
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

    const lista = ensureChecklist();
    ordenAmbientesChecklist(lista).forEach(i => {
        const a = lista[i];

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

    if (data) {

        manualCasa =
            data.data &&
            typeof data.data === "object"
                ? data.data
                : {};

        return manualCasa;
    }

    manualCasa = {};

    return manualCasa;
}

async function guardarManual() {

    const house = houses[current];

    if (!house || !house.id) {
        console.error("❌ La casa no tiene UUID de Supabase");
        return;
    }

    const titulo =
        document.getElementById("manualTitulo");

    const texto =
        document.getElementById("manualTexto");

    if (!titulo || !texto) {
        console.error("❌ No se encontró el formulario del manual");
        return;
    }

    let seccion = "";

    const tituloTexto =
        titulo.innerText
            .toLowerCase()
            .trim();

    if (tituloTexto.includes("emergencias")) {
        seccion = "emergencias";
    } else if (tituloTexto.includes("accesos")) {
        seccion = "accesos";
    } else if (tituloTexto.includes("tecnologia")) {
        seccion = "tecnologia";
    } else if (tituloTexto.includes("exterior")) {
        seccion = "exterior";
    } else if (tituloTexto.includes("blancos")) {
        seccion = "blancos";
    } else if (tituloTexto.includes("proveedores")) {
        seccion = "proveedores";
    }

    if (!seccion) {
        console.error("❌ No se pudo identificar la sección del manual");
        return;
    }

    // Actualizamos el objeto local
    manualCasa[seccion] = texto.value;

    const { data: existente, error: errorBuscar } =
        await supabaseClient
            .from("house_manual")
            .select("id")
            .eq("house_id", house.id)
            .maybeSingle();

    if (errorBuscar) {
        console.error(
            "❌ Error buscando manual existente:",
            errorBuscar
        );
        return;
    }

    let errorGuardar;

    if (existente) {

        const { error } =
            await supabaseClient
                .from("house_manual")
                .update({
                    data: manualCasa,
                    updated_at: new Date().toISOString()
                })
                .eq("house_id", house.id);

        errorGuardar = error;

    } else {

        const { error } =
            await supabaseClient
                .from("house_manual")
                .insert({
                    house_id: house.id,
                    data: manualCasa
                });

        errorGuardar = error;
    }

    if (errorGuardar) {
        console.error(
            "❌ Error guardando manual:",
            errorGuardar
        );
        return;
    }

    await abrirManualCasa();
}

// ============================================
// ABRIR UNA SECCIÓN DEL MANUAL
// ============================================

async function abrirManual(tipo){

    manualActual = tipo;

    document.getElementById(
        "manualTitulo"
    ).innerText =
        tipo.charAt(0).toUpperCase() +
        tipo.slice(1);

    const textoManual =
        document.getElementById(
            "manualTexto"
        );

    textoManual.value =
        manualCasa[tipo] || "";

    const { data: rolManual } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    const puedeEditarManual =
        ["admin", "colaborador"].includes(
            rolManual
        );

    textoManual.readOnly =
        !puedeEditarManual;

    const botonGuardarManual =
        document.getElementById(
            "btnGuardarManual"
        );

    if (botonGuardarManual) {
        botonGuardarManual.style.display =
            puedeEditarManual
                ? ""
                : "none";
    }

    go("manualEdit");
}


// ============================================
// ABRIR MANUAL COMPLETO DE LA CASA
// ============================================

async function abrirManualCasa(){

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

// ============================================
// ACTIVIDAD RECIENTE
// ============================================

async function cargarActividadReciente() {

    const { data, error } = await supabaseClient
        .from("audit_logs")
        .select(`
            id,
            created_at,
            action,
            entity_type,
            entity_id,
            details,
            house_id,
            user_id
        `)
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("❌ Error cargando actividad:", error);
        return [];
    }

    return data || [];
}

async function cargarHistorialActividad(pagina = 0) {

    const porPagina = 50;

    const desde = pagina * porPagina;
    const hasta = desde + porPagina - 1;

    const { data, error } = await supabaseClient
        .from("audit_logs")
        .select(`
            id,
            created_at,
            action,
            entity_type,
            entity_id,
            details,
            house_id,
            user_id
        `)
        .order("created_at", { ascending: false })
        .range(desde, hasta);

    if (error) {
        console.error(
            "❌ Error cargando historial:",
            error
        );
        return [];
    }

    return data || [];
}

async function mostrarDashboardActividad() {

const contenido =
    document.getElementById("activityDashboardContent");

if (!contenido) {
    console.error("❌ No existe activityDashboardContent");
    return;
}

const actividad =
    await cargarActividadReciente();

        const { data: perfiles, error: errorPerfiles } =
    await supabaseClient
        .from("profiles")
        .select("id, nombre");

if (errorPerfiles) {
    console.error(
        "❌ Error cargando perfiles para actividad:",
        errorPerfiles
    );
}

const nombresUsuarios = {};

(perfiles || []).forEach(perfil => {
    nombresUsuarios[perfil.id] =
        perfil.nombre || "Usuario";
});

    if (!actividad.length) {
        contenido.innerHTML =
            "No hay actividad reciente.";
        return;
    }

    const nombresCasas = {};

houses.forEach(house => {
    if (house.id) {
        nombresCasas[house.id] =
            house.nombre || "Propiedad";
    }
});

const nombresAccion = {
    insert: "Agregado",
    update: "Actualizado",
    delete: "Eliminado"
};

const nombresTipo = {
    propiedad: "Propiedad",
    incidencia: "Incidencia",
    checklist: "Checklist",
    reserva: "Reserva",
    inventario: "Inventario",
    manual: "Manual",
    foto: "Foto"
};

contenido.innerHTML = actividad
    .slice(0, 10)
    .map(item => {

        const casa =
            nombresCasas[item.house_id] ||
            "Propiedad";

        const tipo =
            nombresTipo[item.entity_type] ||
            item.entity_type;

        const accion =
            nombresAccion[item.action] ||
            item.action;

            const usuario =
        nombresUsuarios[item.user_id] ||
        "Usuario";

        const fecha =
            new Date(item.created_at)
                .toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                });

     return `
    <div class="activity-item">
        <strong>${casa}</strong>
        · ${tipo} ${accion.toLowerCase()}
        · ${usuario}
        · ${fecha}
    </div>
`;
    })
    .join("");

contenido.innerHTML += `
    <div class="activity-history-link">
        <button onclick="abrirHistorialActividad()">
            Ver historial completo
        </button>
    </div>
`;

window.abrirHistorialActividad = async function(pagina = 0) {

    const contenedor =
        document.getElementById("activityHistoryContent");

    if (!contenedor) return;

    go("activityHistory");

    contenedor.innerHTML =
        "Cargando historial...";

    const actividad =
        await cargarHistorialActividad(pagina);

    if (!actividad.length) {
        contenedor.innerHTML =
            "No hay actividad registrada.";
        return;
    }

    // ============================================
    // CASAS
    // ============================================

    const nombresCasas = {};

    houses.forEach(house => {
        if (house.id) {
            nombresCasas[house.id] =
                house.nombre || "Propiedad";
        }
    });

    // ============================================
    // USUARIOS
    // ============================================

    const { data: perfiles } =
        await supabaseClient
            .from("profiles")
            .select("id, nombre");

    const nombresUsuarios = {};

    (perfiles || []).forEach(perfil => {
        nombresUsuarios[perfil.id] =
            perfil.nombre || "Usuario";
    });

    // ============================================
    // NOMBRES LEGIBLES
    // ============================================

    const nombresAccion = {
        insert: "Agregado",
        update: "Actualizado",
        delete: "Eliminado"
    };

    const nombresTipo = {
        propiedad: "Propiedad",
        incidencia: "Incidencia",
        checklist: "Checklist",
        reserva: "Reserva",
        inventario: "Inventario",
        manual: "Manual",
        foto: "Foto"
    };

    // ============================================
    // FILTROS
    // ============================================

    const filtroCasa =
        document.getElementById("activityFilterHouse");

    const filtroUsuario =
        document.getElementById("activityFilterUser");

    const filtroTipo =
        document.getElementById("activityFilterType");

        const filtroFecha =
    document.getElementById("activityFilterDate");

    // Cargar casas en el filtro
    if (filtroCasa) {

        filtroCasa.innerHTML =
            `<option value="">Todas las casas</option>`;

        houses
            .filter(h => h.id && h.eliminada !== true)
            .sort((a, b) =>
                (a.nombre || "").localeCompare(b.nombre || "")
            )
            .forEach(house => {

                filtroCasa.innerHTML += `
                    <option value="${house.id}">
                        ${house.nombre}
                    </option>
                `;
            });
    }


    // Cargar usuarios en el filtro
    if (filtroUsuario) {

        filtroUsuario.innerHTML =
            `<option value="">Todos los usuarios</option>`;

        (perfiles || [])
            .sort((a, b) =>
                (a.nombre || "").localeCompare(b.nombre || "")
            )
            .forEach(perfil => {

                filtroUsuario.innerHTML += `
                    <option value="${perfil.id}">
                        ${perfil.nombre}
                    </option>
                `;
            });
    }

    // ============================================
    // MOSTRAR HISTORIAL
    // ============================================

    function renderHistorial() {

        const casaSeleccionada =
            filtroCasa?.value || "";

        const usuarioSeleccionado =
            filtroUsuario?.value || "";

        const tipoSeleccionado =
            filtroTipo?.value || "";

            const fechaSeleccionada =
    filtroFecha?.value || "";

        const filtrados =
            actividad.filter(item => {

                const coincideCasa =
                    !casaSeleccionada ||
                    item.house_id === casaSeleccionada;

                const coincideUsuario =
                    !usuarioSeleccionado ||
                    item.user_id === usuarioSeleccionado;

                const coincideTipo =
                    !tipoSeleccionado ||
                    item.entity_type === tipoSeleccionado;

                    let coincideFecha = true;

if (fechaSeleccionada) {

    const fechaItem = new Date(item.created_at);
    const ahora = new Date();

    if (fechaSeleccionada === "today") {

        coincideFecha =
            fechaItem.toDateString() ===
            ahora.toDateString();

    } else {

        const dias =
            Number(fechaSeleccionada);

        const limite =
            new Date();

        limite.setDate(
            limite.getDate() - dias
        );

        coincideFecha =
            fechaItem >= limite;
    }
}

             return (
    coincideCasa &&
    coincideUsuario &&
    coincideTipo &&
    coincideFecha
);
            });


        if (!filtrados.length) {

            contenedor.innerHTML =
                `<div class="activity-history-item">
                    No hay movimientos para estos filtros.
                </div>`;

            return;
        }


        contenedor.innerHTML =
            filtrados
                .map(item => {

                    const casa =
                        nombresCasas[item.house_id] ||
                        "Propiedad";

                    const tipo =
                        nombresTipo[item.entity_type] ||
                        item.entity_type;

                    const accion =
                        nombresAccion[item.action] ||
                        item.action;

                    const usuario =
                        nombresUsuarios[item.user_id] ||
                        "Usuario";

                    const fecha =
                        new Date(item.created_at)
                            .toLocaleString("es-AR");

                    return `
                        <div class="activity-history-item">
                            <strong>${casa}</strong>
                            · ${tipo} ${accion.toLowerCase()}
                            · ${usuario}
                            · ${fecha}
                        </div>
                    `;
                })
                .join("");
    }


    // ============================================
    // EVENTOS DE LOS FILTROS
    // ============================================

    if (filtroCasa) {
        filtroCasa.onchange = renderHistorial;
    }

    if (filtroUsuario) {
        filtroUsuario.onchange = renderHistorial;
    }

    if (filtroTipo) {
        filtroTipo.onchange = renderHistorial;
    }

    if (filtroFecha) {
    filtroFecha.onchange = renderHistorial;
}

    // Primera carga
    renderHistorial();

   // ============================================
// PAGINACIÓN
// ============================================

const botonAnterior =
    document.getElementById("activityPrevBtn");

const botonSiguiente =
    document.getElementById("activityNextBtn");

const infoPagina =
    document.getElementById("activityPageInfo");

if (infoPagina) {
    infoPagina.textContent =
        `Página ${pagina + 1}`;
}

if (botonAnterior) {

    botonAnterior.disabled =
        pagina === 0;

    botonAnterior.onclick = function() {

        if (pagina > 0) {
            abrirHistorialActividad(pagina - 1);
        }
    };
}

if (botonSiguiente) {

    botonSiguiente.disabled =
        actividad.length < 50;

    botonSiguiente.onclick = function() {

        abrirHistorialActividad(pagina + 1);
    };
}

};
}

async function cargarNotificaciones() {

    const { data, error } = await supabaseClient
        .from("notifications")
        .select(`
            id,
            created_at,
            house_id,
            type,
            title,
            message,
            read,
            read_at,
            entity_type,
            entity_id
        `)
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error(
            "❌ Error cargando notificaciones:",
            error
        );
        return [];
    }

    const limiteLeidas = new Date();
limiteLeidas.setDate(limiteLeidas.getDate() - 7);

return (data || []).filter(n => {

    // Las no leídas siempre se muestran
    if (!n.read) return true;

    // Las leídas se muestran durante 7 días
    if (!n.read_at) return false;

    return new Date(n.read_at) >= limiteLeidas;
});
}

async function mostrarNotificaciones() {

    const contenedor =
        document.getElementById("notificationsContent");

    const badge =
        document.getElementById("notificationsBadge");

    if (!contenedor || !badge) return;

    const notificaciones =
        await cargarNotificaciones();

    const noLeidas =
        notificaciones.filter(n => !n.read);

    badge.textContent =
        noLeidas.length > 0
            ? noLeidas.length
            : "";

    contenedor.innerHTML =
        notificaciones.length
            ? notificaciones
                .slice(0, 10)
                .map(n => `
    <div
        class="notification-item ${n.read ? "read" : "unread"}"
        onclick="abrirNotificacion('${n.id}', '${n.house_id || ""}', '${n.entity_type || ""}')"
    >
        <strong>${n.title}</strong>
        <span>${n.message || ""}</span>
    </div>
`)
                .join("")
            : "No hay notificaciones.";
}

// ============================================
// ABRIR / CERRAR NOTIFICACIONES
// ============================================

async function abrirNotificaciones() {

    const contenido =
        document.getElementById("notificationsContent");

    if (!contenido) return;

    if (contenido.style.display === "block") {
        contenido.style.display = "none";
        return;
    }

    contenido.style.display = "block";

    await mostrarNotificaciones();
}

// ============================================
// MARCAR NOTIFICACIÓN COMO LEÍDA
// ============================================

async function procesarDestinoNotificacionPendiente() {

    const url =
        new URL(window.location.href);

    const notificationId =
        url.searchParams.get(
            "notification"
        );

    const houseId =
        url.searchParams.get("house");

    const entityType =
        url.searchParams.get("entity");

    if (!houseId) {
        return;
    }

    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );

    if (notificationId) {
        await marcarNotificacionLeida(
            notificationId
        );
    }

    const houseIndex =
        houses.findIndex(
            house => house.id === houseId
        );

    if (houseIndex === -1) {

        alert(
            "La propiedad relacionada ya no está disponible."
        );

        return;
    }

    await openHouse(houseIndex);

    if (
    entityType === "incidencia" ||
    entityType === "house_incidencia"
) {
        await openIncidencias();
        return;
    }

    if (entityType === "checklist") {
        await startPreparation();
    }
}

window.abrirNotificacion = async function(
    id,
    houseId,
    entityType
) {

    await marcarNotificacionLeida(id);

    const panel =
        document.getElementById(
            "notificationsContent"
        );

    if (panel) {
        panel.style.display = "none";
    }

    let houseIndex =
        houses.findIndex(
            house => house.id === houseId
        );

    if (houseIndex === -1) {

        await cargarCasasDesdeSupabase();

        houseIndex =
            houses.findIndex(
                house => house.id === houseId
            );
    }

    if (houseIndex === -1) {

        alert(
            "La propiedad relacionada ya no está disponible."
        );

        return;
    }

    await openHouse(houseIndex);

    if (
    entityType === "incidencia" ||
    entityType === "house_incidencia"
) {
        await openIncidencias();
        return;
    }

    if (entityType === "checklist") {
        await startPreparation();
    }
};

window.marcarNotificacionLeida = async function(id) {

    const { error } = await supabaseClient
        .from("notifications")
        .update({
            read: true,
            read_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        console.error(
            "❌ Error marcando notificación como leída:",
            error
        );
        return;
    }

    // Actualiza panel + contador
    await mostrarNotificaciones();
};

// ============================================
// CERRAR NOTIFICACIONES AL HACER CLIC AFUERA
// ============================================

document.addEventListener("click", function(event) {

    const boton =
        document.getElementById("notificationsButton");

    const panel =
        document.getElementById("notificationsContent");

    if (!boton || !panel) return;

    const clicDentroBoton =
        boton.contains(event.target);

    const clicDentroPanel =
        panel.contains(event.target);

    if (
        !clicDentroBoton &&
        !clicDentroPanel
    ) {
        panel.style.display = "none";
    }
});

// ============================================
// SUSCRIPCIÓN A NOTIFICACIONES PUSH
// ============================================

function convertirVapidKey(base64String) {

    const padding =
        "=".repeat((4 - base64String.length % 4) % 4);

    const base64 =
        (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from(
        [...rawData].map(char => char.charCodeAt(0))
    );
}

const VAPID_PUBLIC_KEY = "BC_TH6w5DO2yxHs_j9GFys5347KX4pRKFaZcTjXg_uznFVSPy358glap8MaWU2RIgNuEMlzMbPKF30babJcYyGo";
window.activarNotificacionesPush = async function() {

    try {

        if (!("serviceWorker" in navigator)) {
            console.error("Service Worker no disponible.");
            return;
        }

        if (!("PushManager" in window)) {
            console.error("Push notifications no disponibles.");
            return;
        }

        const permiso =
            await Notification.requestPermission();

        if (permiso !== "granted") {
            console.log("Permiso de notificaciones no concedido.");
            return;
        }

// Esperar al Service Worker activo
const registration =
    await navigator.serviceWorker.ready;

// Buscar si este dispositivo ya está suscripto
let subscription =
    await registration.pushManager.getSubscription();

// Si todavía no está suscripto, crear suscripción
if (!subscription) {

    subscription =
        await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
                convertirVapidKey(VAPID_PUBLIC_KEY)
        });
}

// Usuario actualmente logueado
const {
    data: { user }
} = await supabaseClient.auth.getUser();

if (!user) {
    console.error("❌ No hay usuario autenticado.");
    return;
}

// Organización actual
const { data: organizationId, error: organizationError } =
    await supabaseClient.rpc(
        "current_organization_id"
    );

if (organizationError || !organizationId) {
    console.error(
        "❌ No se pudo obtener la organización:",
        organizationError
    );
    return;
}

// Convertir suscripción a objeto normal
const pushData = subscription.toJSON();

// Guardarla en Supabase
const {
    data: subscriptionSaved,
    error: saveError
} = await supabaseClient.rpc(
    "register_push_subscription",
    {
        p_endpoint:
            pushData.endpoint,
        p_p256dh:
            pushData.keys.p256dh,
        p_auth:
            pushData.keys.auth
    }
);

if (saveError || !subscriptionSaved) {

    console.error(
        "❌ Error guardando suscripción push:",
        saveError
    );

    return;
}

    } catch (error) {

        console.error(
            "❌ Error activando notificaciones push:",
            error
        );
    }
};

// ============================================
// CONFIGURACIÓN DE LA ORGANIZACIÓN
// ============================================

let organizationSettingsCurrent = {};

async function abrirConfiguracionOrganizacion() {

    const {
        data: rolActual,
        error: rolError
    } = await supabaseClient.rpc(
        "current_organization_role"
    );

    if (
        rolError ||
        rolActual !== "admin"
    ) {
        alert(
            "No tenés permiso para acceder a esta configuración."
        );
        return;
    }

    go("configuracionOrganizacion");

    await cargarConfiguracionOrganizacion();
}


async function cargarConfiguracionOrganizacion() {

    const {
        data: organizationId,
        error: organizationIdError
    } = await supabaseClient.rpc(
        "current_organization_id"
    );

    if (
        organizationIdError ||
        !organizationId
    ) {
        console.error(
            "Error obteniendo organización:",
            organizationIdError
        );

        alert(
            "No se pudo obtener la organización."
        );
        return;
    }

    const {
        data: organization,
        error
    } = await supabaseClient
        .from("organizations")
        .select(
            "id, nombre, logo_url, configuracion"
        )
        .eq("id", organizationId)
        .single();

    if (error || !organization) {
        console.error(
            "Error cargando configuración:",
            error
        );

        alert(
            "No se pudo cargar la configuración."
        );
        return;
    }

    organizationSettingsCurrent =
        organization.configuracion || {};

    const modules =
        organizationSettingsCurrent.modulos || {};

    document.getElementById(
        "organizationSettingsName"
    ).value = organization.nombre || "";

    document.getElementById(
        "organizationSettingsLogo"
    ).value = organization.logo_url || "";

    document.getElementById(
        "organizationModuleChecklist"
    ).checked = modules.checklist !== false;

    document.getElementById(
        "organizationModuleInventory"
    ).checked = modules.inventario !== false;

    document.getElementById(
        "organizationModuleRatings"
    ).checked = modules.valoraciones !== false;

    document.getElementById(
        "organizationModuleNotifications"
    ).checked = modules.notificaciones !== false;

    const checklistBase = agregarLavaderoSiFalta(
    Array.isArray(
        organizationSettingsCurrent.checklist_base
    ) &&
    organizationSettingsCurrent.checklist_base.length
        ? organizationSettingsCurrent.checklist_base
        : ambientes);

    const checklistBaseOrdenado = ordenAmbientesChecklist(checklistBase)
        .map(i => checklistBase[i]);

document.getElementById(
    "organizationChecklistBase"
).value = checklistBaseOrdenado
    .map(environment => {

        const title =
            String(
                environment.title || ""
            ).trim();

        const items =
            Array.isArray(environment.items)
                ? environment.items
                : [];

        return (
            title +
            ": " +
            items.join(", ")
        );
    })
    .join("\n");

const inventoryBase =
    Array.isArray(
        organizationSettingsCurrent.inventario_base
    )
        ? organizationSettingsCurrent.inventario_base
        : [];

document.getElementById(
    "organizationInventoryBase"
).value = inventoryBase.join("\n");
}


async function guardarConfiguracionOrganizacion() {

    const saveButton =
        document.getElementById(
            "organizationSettingsSave"
        );

    const organizationName =
        document.getElementById(
            "organizationSettingsName"
        ).value.trim();

    const logoUrl =
        document.getElementById(
            "organizationSettingsLogo"
        ).value.trim();

        const checklistBaseText =
    document.getElementById(
        "organizationChecklistBase"
    ).value;

const checklistBase =
    checklistBaseText
        .split(/\r?\n/)
        .map(line => {

            const separatorPosition =
                line.indexOf(":");

            if (separatorPosition <= 0) {
                return null;
            }

            const title =
                line
                    .slice(
                        0,
                        separatorPosition
                    )
                    .trim();

            const items =
                line
                    .slice(
                        separatorPosition + 1
                    )
                    .split(",")
                    .map(item => item.trim())
                    .filter(Boolean);

            if (
                !title ||
                !items.length
            ) {
                return null;
            }

            return {
                title,
                items
            };
        })
        .filter(Boolean);

const inventoryBase =
    [
        ...new Set(
            document.getElementById(
                "organizationInventoryBase"
            )
                .value
                .split(/\r?\n/)
                .map(item => item.trim())
                .filter(Boolean)
        )
    ];

if (!checklistBase.length) {
    alert(
        "La plantilla de checklist debe tener al menos un ambiente válido."
    );
    return;
}

    if (organizationName.length < 3) {
        alert(
            "Ingresá el nombre de la organización."
        );
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Guardando...";

    try {

        const {
            data: organizationId,
            error: organizationIdError
        } = await supabaseClient.rpc(
            "current_organization_id"
        );

        if (
            organizationIdError ||
            !organizationId
        ) {
            throw (
                organizationIdError ||
                new Error(
                    "No se encontró la organización."
                )
            );
        }

        const currentModules =
            organizationSettingsCurrent.modulos || {};

        const newSettings = {
    ...organizationSettingsCurrent,

    checklist_base: checklistBase,
    inventario_base: inventoryBase,

    modulos: {

                ...currentModules,

                checklist:
                    document.getElementById(
                        "organizationModuleChecklist"
                    ).checked,

                inventario:
                    document.getElementById(
                        "organizationModuleInventory"
                    ).checked,

                valoraciones:
                    document.getElementById(
                        "organizationModuleRatings"
                    ).checked,

                notificaciones:
                    document.getElementById(
                        "organizationModuleNotifications"
                    ).checked
            }
        };

        const {
            error
        } = await supabaseClient
            .from("organizations")
            .update({
                nombre: organizationName,
                logo_url: logoUrl || null,
                configuracion: newSettings,
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", organizationId);

        if (error) {
            throw error;
        }

        organizationSettingsCurrent =
    newSettings;

const organizationHeaderLogo =
    document.getElementById(
        "organizationHeaderLogo"
    );

if (organizationHeaderLogo) {
    organizationHeaderLogo.src =
        logoUrl ||
        "./logo-house-management.png";
}

alert(
    "Configuración guardada correctamente."
);

    } catch (error) {

        console.error(
            "Error guardando configuración:",
            error
        );

        alert(
            "No se pudo guardar la configuración."
        );

    } finally {

        saveButton.disabled = false;
        saveButton.textContent =
            "Guardar configuración";
    }
}

async function aplicarModulosOrganizacion() {

    const {
        data: organizationId,
        error: organizationIdError
    } = await supabaseClient.rpc(
        "current_organization_id"
    );

    if (
        organizationIdError ||
        !organizationId
    ) {
        console.error(
            "Error obteniendo organización para módulos:",
            organizationIdError
        );
        return;
    }

    const {
        data: organization,
        error
    } = await supabaseClient
        .from("organizations")
        .select("configuracion, logo_url")
        .eq("id", organizationId)
        .single();

    if (error) {
        console.error(
            "Error cargando módulos:",
            error
        );
        return;
    }

    const modules =
        organization?.configuracion?.modulos || {};

        const organizationHeaderLogo =
    document.getElementById(
        "organizationHeaderLogo"
    );

if (organizationHeaderLogo) {

    organizationHeaderLogo.onerror =
        function() {
            this.onerror = null;
            this.src =
                "./logo-house-management.png";
        };

    organizationHeaderLogo.src =
        organization?.logo_url ||
        "./logo-house-management.png";
}

    const checklistEnabled =
        modules.checklist !== false;

    const inventoryEnabled =
        modules.inventario !== false;

    const ratingsEnabled =
        modules.valoraciones !== false;

        const notificationsEnabled =
    modules.notificaciones !== false;

    const checklistButton =
        document.getElementById(
            "houseMenuChecklist"
        );

    const checklistEditorButton =
        document.getElementById(
            "houseMenuChecklistEditor"
        );

    const inventoryButton =
        document.getElementById(
            "houseMenuInventory"
        );

    const ratingsButton =
        document.getElementById(
            "btnValoracionPropiedad"
        );
        const notificationsButton =
    document.getElementById(
        "notificationsButton"
    );

    if (checklistButton) {
        checklistButton.style.display =
            checklistEnabled ? "" : "none";
    }

    if (checklistEditorButton) {
        checklistEditorButton.style.display =
            checklistEnabled ? "" : "none";
    }

    if (inventoryButton) {
        inventoryButton.style.display =
            inventoryEnabled ? "" : "none";
    }

    if (ratingsButton) {

    if (ratingsEnabled) {
        ratingsButton.style.setProperty(
            "display",
            "flex",
            "important"
        );
    } else {
        ratingsButton.remove();
    }
}

    if (notificationsButton) {
    notificationsButton.style.display =
        notificationsEnabled ? "" : "none";
}
}

async function obtenerChecklistBaseOrganizacion() {

    const {
        data: organizationId,
        error: organizationIdError
    } = await supabaseClient.rpc(
        "current_organization_id"
    );

    if (
        organizationIdError ||
        !organizationId
    ) {
        return agregarLavaderoSiFalta(ambientes);
    }

    const {
        data: organization,
        error
    } = await supabaseClient
        .from("organizations")
        .select("configuracion")
        .eq("id", organizationId)
        .single();

    if (error) {
        console.error(
            "Error cargando checklist base:",
            error
        );

        return agregarLavaderoSiFalta(ambientes);
    }

    const checklistBase =
        organization?.configuracion
            ?.checklist_base;

    if (
        !Array.isArray(checklistBase) ||
        !checklistBase.length
    ) {
        return agregarLavaderoSiFalta(ambientes);
    }

    return agregarLavaderoSiFalta(checklistBase);
}

async function obtenerInventarioBaseOrganizacion() {

    const {
        data: organizationId,
        error: organizationIdError
    } = await supabaseClient.rpc(
        "current_organization_id"
    );

    if (
        organizationIdError ||
        !organizationId
    ) {
        return [];
    }

    const {
        data: organization,
        error
    } = await supabaseClient
        .from("organizations")
        .select("configuracion")
        .eq("id", organizationId)
        .single();

    if (error) {
        console.error(
            "Error cargando inventario base:",
            error
        );
        return [];
    }

    const inventoryBase =
        organization?.configuracion
            ?.inventario_base;

    return Array.isArray(inventoryBase)
        ? inventoryBase
        : [];
}

let mantenimientoOrigenTaskId = null;

async function abrirIncidenciaDesdeMantenimiento(control, plan) {
    await openIncidencias();
    nuevaIncidencia();

    mantenimientoOrigenTaskId = control.id;

    const descripcion =
        "Mantenimiento periódico: " + plan.title +
        (control.observations
            ? "\nObservación: " + control.observations
            : "");

    document.getElementById("incDescripcion").value =
        descripcion;

    document.getElementById("incResponsable").value =
        control.responsible || "";

    const campoCostoIncidencia =
        document.getElementById("incCosto");

    const campoComisionIncidencia =
        document.getElementById("incComision");

    if (campoCostoIncidencia) {
        campoCostoIncidencia.value =
            Number(control.work_amount || 0);
    }

    if (campoComisionIncidencia) {
        campoComisionIncidencia.value =
            Number(control.commission_pct || 0);
    }

    // Actualiza automáticamente costo, comisión y total
    if (campoCostoIncidencia) {
        campoCostoIncidencia.dispatchEvent(
            new Event("input", { bubbles: true })
        );
    }

    if (campoComisionIncidencia) {
        campoComisionIncidencia.dispatchEvent(
            new Event("input", { bubbles: true })
        );
    }

    document.getElementById("formIncidencia").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function abrirMantenimientoCasa() {
    const casa = houses[current];
    const contenido = document.getElementById("mantenimientoCasaContenido");
    const nombre = document.getElementById("mantenimientoCasaNombre");

    if (!casa?.id || !contenido || !nombre) {
        mostrarAvisoHM("No se pudo abrir el mantenimiento de esta casa.");
        return;
    }

    nombre.textContent =
        casa.nombre || casa.name || casa.nombreCasa || casa.nombre_casa || "";

    await go("mantenimientoCasa");
    contenido.textContent = "Cargando mantenimiento...";

    const { data: planes, error } = await supabaseClient
        .from("house_maintenance_plans")
        .select("id, template_code, title, description, frequency_type, interval_value, next_due_date, active")
        .eq("house_id", casa.id)
        .eq("active", true)
        .order("template_code", { ascending: true });

    if (error) {
        console.error("Error cargando mantenimiento:", error);
        contenido.textContent =
            "No se pudo cargar el mantenimiento de esta casa.";
        return;
    }

    if (!planes?.length) {
    contenido.replaceChildren();

    const aviso = document.createElement("div");
    aviso.className = "card";

    const texto = document.createElement("div");
    texto.textContent =
        "Esta casa todavía no tiene mantenimiento periódico cargado.";

    aviso.appendChild(texto);

    const { data: rol, error: errorRol } =
        await supabaseClient.rpc("current_organization_role");

    if (!errorRol && ["admin", "colaborador"].includes(rol)) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn";
        boton.textContent = "Crear mantenimiento de esta casa";
        boton.style.marginTop = "14px";
        boton.onclick = crearPlantillaMantenimientoCasa;

        aviso.appendChild(boton);
    }

    contenido.appendChild(aviso);
    return;
}

const { data: historialMantenimiento, error: errorHistorial } =
    await supabaseClient
        .from("house_maintenance_tasks")
        .select(
    "id, plan_id, scheduled_date, responsible, status, observations, verified_at, incident_id, photo_path, work_amount, commission_pct, commission_amount, total_amount"
)
        .in("plan_id", planes.map(plan => plan.id))
        .order("scheduled_date", { ascending: false });

if (errorHistorial) {
    console.error(
        "Error cargando historial de mantenimiento:",
        errorHistorial
    );
    contenido.textContent =
        "No se pudo cargar el historial de mantenimiento.";
    return;
}

    contenido.replaceChildren();

    const { data: rolMantenimiento, error: errorRolMantenimiento } =
    await supabaseClient.rpc("current_organization_role");

if (errorRolMantenimiento) {
    console.error(
        "Error verificando permisos de mantenimiento:",
        errorRolMantenimiento
    );
}

const puedeEditarMantenimiento =
    !errorRolMantenimiento &&
    ["admin", "colaborador"].includes(rolMantenimiento);

    const grupos = [
    "Pretemporada / anual",
    "Jardín y exterior",
    "Blanquería y textiles"
];

grupos.forEach(grupo => {
    const tareasDelGrupo = planes.filter(
        plan => plan.description === grupo
    );

    if (!tareasDelGrupo.length) return;

    const tituloGrupo = document.createElement("h3");
    tituloGrupo.textContent = grupo;
    contenido.appendChild(tituloGrupo);

    tareasDelGrupo.forEach(plan => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "card";

        const titulo = document.createElement("strong");
        titulo.textContent = plan.title;

        const fecha = document.createElement("div");
        fecha.className = "sub";
        fecha.style.marginTop = "8px";
        fecha.textContent = plan.next_due_date
            ? "Próximo control: " +
              plan.next_due_date.split("-").reverse().join("/")
            : "Próximo control: sin programar";

        tarjeta.appendChild(titulo);
        if (puedeEditarMantenimiento) {
    tarjeta.style.position = "relative";
    titulo.style.display = "block";
    titulo.style.paddingRight = "48px";

    const lapiz = document.createElement("button");
    lapiz.type = "button";
    lapiz.title = "Editar título";
    lapiz.setAttribute("aria-label", "Editar título");

    lapiz.style.position = "absolute";
    lapiz.style.top = "16px";
    lapiz.style.right = "16px";
    lapiz.style.width = "36px";
    lapiz.style.height = "36px";
    lapiz.style.minWidth = "36px";
    lapiz.style.padding = "7px";
    lapiz.style.border = "1px solid #D7DDE2";
    lapiz.style.borderRadius = "9px";
    lapiz.style.background = "#FFFFFF";
    lapiz.style.color = "#0D2B45";
    lapiz.style.cursor = "pointer";
    lapiz.style.display = "flex";
    lapiz.style.alignItems = "center";
    lapiz.style.justifyContent = "center";

    lapiz.innerHTML = `
        <span class="cb-icon">
            <svg viewBox="0 0 24 24">
                <path d="M4 20H8L19 9L15 5L4 16V20Z"></path>
                <path d="M13 7L17 11"></path>
            </svg>
        </span>
    `;

    lapiz.onclick = () => editarTituloMantenimiento(plan);

    tarjeta.appendChild(lapiz);
}
        tarjeta.appendChild(fecha);
        const controlesDelPlan = (historialMantenimiento || [])
    .filter(control => control.plan_id === plan.id);

if (controlesDelPlan.length) {
    const nombresEstado = {
        realizado: "Realizado",
        problema: "Con problema",
        no_aplica: "No aplica"
    };

    const ultimo = controlesDelPlan[0];

    const ultimoEstado = document.createElement("div");
    ultimoEstado.className = "sub";
    ultimoEstado.style.marginTop = "6px";
    ultimoEstado.style.color =
        ultimo.status === "problema" ? "#8B4B4B" : "#556B4F";
    ultimoEstado.textContent =
        "Último control: " +
        (nombresEstado[ultimo.status] || ultimo.status);

    tarjeta.appendChild(ultimoEstado);

    const historial = document.createElement("details");
    historial.style.marginTop = "12px";

    const encabezado = document.createElement("summary");
    encabezado.textContent =
        "Ver historial (" + controlesDelPlan.length + ")";
    encabezado.style.cursor = "pointer";
    encabezado.style.color = "#0D2B45";
    encabezado.style.fontWeight = "600";

    historial.appendChild(encabezado);

    controlesDelPlan.forEach(control => {
        const fila = document.createElement("div");
        fila.style.padding = "10px 0";
        fila.style.borderBottom = "1px solid #E5E0D7";

        const fechaControl =
            control.scheduled_date.split("-").reverse().join("/");

        fila.textContent =
            fechaControl + " · " +
            (nombresEstado[control.status] || control.status) +
            " · " +
            (control.responsible || "Sin responsable");

        if (control.observations) {
            const nota = document.createElement("div");
            nota.className = "sub";
            nota.textContent = control.observations;
            fila.appendChild(nota);
        }

        if (
    control.work_amount !== null &&
    control.work_amount !== undefined
) {
    const economico = document.createElement("div");
    economico.className = "sub";
    economico.style.marginTop = "6px";

    economico.innerHTML =
        "Costo: <strong>$ " +
        Number(control.work_amount).toLocaleString("es-AR") +
        "</strong>" +
        " · Comisión EC (" +
        Number(control.commission_pct || 0) +
        "%): <strong>$ " +
        Number(control.commission_amount || 0).toLocaleString("es-AR") +
        "</strong>" +
        " · Total: <strong>$ " +
        Number(control.total_amount || 0).toLocaleString("es-AR") +
        "</strong>";

    fila.appendChild(economico);
}

if (puedeEditarMantenimiento) {
    const accionesControl = document.createElement("div");
    accionesControl.style.display = "flex";
    accionesControl.style.gap = "8px";
    accionesControl.style.marginTop = "10px";

    const botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.className = "btn";
    botonEditar.textContent = "Editar";
    botonEditar.style.width = "auto";

    botonEditar.onclick = () => {
        editarControlMantenimiento(control, plan);
    };

    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className = "btn";
    botonEliminar.textContent = "Eliminar";
    botonEliminar.style.width = "auto";
    botonEliminar.style.background = "#8B4B4B";

    botonEliminar.onclick = async () => {
        const confirmado = await confirmarAccionHM(
            "Se eliminará este control de mantenimiento y sus importes dejarán de formar parte del estado de cuenta.",
            "Eliminar control",
            "ELIMINAR",
            "#8B4B4B"
        );

        if (!confirmado) return;

        mostrarLoader("Eliminando control...");

        try {
            const { error } = await supabaseClient
                .from("house_maintenance_tasks")
                .delete()
                .eq("id", control.id);

            if (error) {
                console.error(
                    "Error eliminando control:",
                    error
                );

                mostrarAvisoHM(
                    "No se pudo eliminar el control."
                );
                return;
            }

            mostrarAvisoHM(
                "Control eliminado correctamente."
            );

            await abrirMantenimientoCasa();

        } catch (error) {
            console.error(
                "Error eliminando control:",
                error
            );

            mostrarAvisoHM(
                "No se pudo eliminar el control."
            );
        } finally {
            ocultarLoader();
        }
    };

    accionesControl.appendChild(botonEditar);
    accionesControl.appendChild(botonEliminar);

    fila.appendChild(accionesControl);
}

        if (
            puedeEditarMantenimiento &&
            control.status === "problema" &&
            !control.incident_id
        ) {
            const botonIncidencia = document.createElement("button");
            botonIncidencia.type = "button";
            botonIncidencia.className = "btn";
            botonIncidencia.textContent = "Crear incidencia";
            botonIncidencia.style.marginTop = "10px";
            botonIncidencia.onclick = () =>
                abrirIncidenciaDesdeMantenimiento(control, plan);
            fila.appendChild(botonIncidencia);
        }

        historial.appendChild(fila);
    });

    tarjeta.appendChild(historial);
}
        if (puedeEditarMantenimiento) {
    const etiqueta = document.createElement("label");
    etiqueta.textContent = "Programar próximo control";
    etiqueta.style.display = "block";
    etiqueta.style.marginTop = "14px";

    const fechaInput = document.createElement("input");
    fechaInput.type = "date";
    fechaInput.value = plan.next_due_date || "";
    fechaInput.style.width = "100%";
    fechaInput.style.boxSizing = "border-box";

    const guardarFecha = document.createElement("button");
    guardarFecha.type = "button";
    guardarFecha.className = "btn";
    guardarFecha.textContent = "Guardar programación";
    guardarFecha.style.marginTop = "10px";

    guardarFecha.onclick = async () => {
        const intervalo = Number(intervaloInput.value);

if (
    frecuenciaInput.value !== "personalizado" &&
    (!Number.isInteger(intervalo) || intervalo < 1)
) {
    mostrarAvisoHM("Ingresá un intervalo válido.");
    return;
}
        guardarFecha.disabled = true;
        mostrarLoader("Guardando fecha...");

        try {
            const { error } = await supabaseClient
                .from("house_maintenance_plans")
                .update({
    next_due_date: fechaInput.value || null,
    frequency_type: frecuenciaInput.value,
    interval_value:
        frecuenciaInput.value === "personalizado"
            ? 1
            : intervalo
})
                .eq("id", plan.id)
                .eq("house_id", casa.id)
                .select("id")
                .single();

            if (error) {
                console.error("Error guardando fecha:", error);
                mostrarAvisoHM("No se pudo guardar la fecha.");
                return;
            }

            mostrarAvisoHM("Programación de mantenimiento guardada.");
            await abrirMantenimientoCasa();

        } catch (error) {
            console.error("Error guardando fecha:", error);
            mostrarAvisoHM("No se pudo guardar la fecha.");
        } finally {
            guardarFecha.disabled = false;
            ocultarLoader();
        }
    };

    tarjeta.appendChild(etiqueta);
    tarjeta.appendChild(fechaInput);
    const frecuenciaLabel = document.createElement("label");
frecuenciaLabel.textContent = "Frecuencia";
frecuenciaLabel.style.display = "block";
frecuenciaLabel.style.marginTop = "12px";

const frecuenciaInput = document.createElement("select");
frecuenciaInput.style.width = "100%";

[
    ["personalizado", "Manual"],
    ["dias", "Cada cierta cantidad de días"],
    ["semanas", "Cada cierta cantidad de semanas"],
    ["meses", "Cada cierta cantidad de meses"],
    ["anual", "Cada cierta cantidad de años"]
].forEach(([valor, texto]) => {
    frecuenciaInput.add(new Option(texto, valor));
});

frecuenciaInput.value = plan.frequency_type || "personalizado";

const intervaloLabel = document.createElement("label");
intervaloLabel.textContent = "Repetir cada";
intervaloLabel.style.display = "block";
intervaloLabel.style.marginTop = "12px";

const intervaloInput = document.createElement("input");
intervaloInput.type = "number";
intervaloInput.min = "1";
intervaloInput.step = "1";
intervaloInput.value = plan.interval_value || 1;
intervaloInput.style.width = "100%";
intervaloInput.style.boxSizing = "border-box";

function actualizarIntervalo() {
    const esManual = frecuenciaInput.value === "personalizado";
    intervaloLabel.style.display = esManual ? "none" : "block";
    intervaloInput.style.display = esManual ? "none" : "block";
}

frecuenciaInput.onchange = actualizarIntervalo;
actualizarIntervalo();

tarjeta.appendChild(frecuenciaLabel);
tarjeta.appendChild(frecuenciaInput);
tarjeta.appendChild(intervaloLabel);
tarjeta.appendChild(intervaloInput);
    tarjeta.appendChild(guardarFecha);
}

if (puedeEditarMantenimiento && plan.next_due_date) {
    const botonRegistrar = document.createElement("button");
    botonRegistrar.type = "button";
    botonRegistrar.className = "btn";
    botonRegistrar.textContent = "Registrar control";
    botonRegistrar.style.marginTop = "10px";

    botonRegistrar.onclick = () => {
        abrirRegistroMantenimiento(plan);
    };

    tarjeta.appendChild(botonRegistrar);
}

        contenido.appendChild(tarjeta);
    });
});
}

async function crearPlantillaMantenimientoCasa() {
    const casa = houses[current];

    if (!casa?.id) {
        mostrarAvisoHM("No se pudo identificar la casa.");
        return;
    }

    const { data: rol, error: errorRol } =
        await supabaseClient.rpc("current_organization_role");

    if (errorRol || !["admin", "colaborador"].includes(rol)) {
        mostrarAvisoHM("No tenés permiso para crear mantenimiento.");
        return;
    }

    const { data: existentes, error: errorExistentes } =
        await supabaseClient
            .from("house_maintenance_plans")
            .select("template_code")
            .eq("house_id", casa.id)
            .not("template_code", "is", null);

    if (errorExistentes) {
        console.error("Error verificando plantilla:", errorExistentes);
        mostrarAvisoHM("No se pudo verificar el mantenimiento existente.");
        return;
    }

    if (existentes?.length) {
        mostrarAvisoHM("Esta casa ya tiene la plantilla de mantenimiento.");
        return;
    }

    const confirmado = await confirmarAccionHM(
        "Se crearán 10 controles de mantenimiento solo para esta casa. Podrás configurar sus fechas después.",
        "Crear mantenimiento periódico",
        "CREAR",
        "#0D2B45"
    );

    if (!confirmado) return;

    const tareas = [
        ["mp_01", "Fumigación (planificar con aprobación del propietario y bloquear fechas)", "Pretemporada / anual"],
        ["mp_02", "Control de pozos (recomendado una vez al año antes de temporada)", "Pretemporada / anual"],
        ["mp_03", "Limpieza de filtros de aire acondicionado (antes de temporada)", "Pretemporada / anual"],
        ["mp_04", "Matafuegos: control de vencimiento y carga", "Pretemporada / anual"],
        ["mp_05", "Control de plantas, canteros, yuyos, pasto y hormigas (coordinar con jardinero vía propietario)", "Jardín y exterior"],
        ["mp_06", "Telas de araña (indicar atención especial al personal de limpieza)", "Jardín y exterior"],
        ["mp_07", "Blanquería: verificar disponibilidad de juegos dobles", "Blanquería y textiles"],
        ["mp_08", "Fundas de sillones dobles (para rotar mientras se lava)", "Blanquería y textiles"],
        ["mp_09", "Acolchados: evaluar estado e informar al propietario antes de renovar (costo elevado)", "Blanquería y textiles"],
        ["mp_10", "Cortinados: controlar estado e informar antes de tomar decisión", "Blanquería y textiles"]
    ];

    const planes = tareas.map(([template_code, title, description]) => ({
        house_id: casa.id,
        template_code,
        title,
        description,
        frequency_type: "personalizado",
        interval_value: 1,
        next_due_date: null
    }));

    mostrarLoader("Creando mantenimiento...");

    try {
        const { error } = await supabaseClient
            .from("house_maintenance_plans")
            .insert(planes);

        if (error) {
            console.error("Error creando mantenimiento:", error);
            mostrarAvisoHM("No se pudo crear el mantenimiento.");
            return;
        }

        mostrarAvisoHM("Mantenimiento creado para esta casa.");
        await abrirMantenimientoCasa();

    } finally {
        ocultarLoader();
    }
}

let mantenimientoPlanEnRegistro = null;
let mantenimientoControlEnEdicion = null;

function abrirRegistroMantenimiento(plan) {
    if (!plan?.id || !plan.next_due_date) {
        mostrarAvisoHM(
            "Programá la próxima fecha antes de registrar este control."
        );
        return;
    }

    const modal =
        document.getElementById("modalRegistroMantenimiento");

    if (!modal) return;

    mantenimientoPlanEnRegistro = plan;

    mantenimientoControlEnEdicion = null;

const botonGuardar =
    document.getElementById("btnGuardarRegistroMantenimiento");

if (botonGuardar) {
    botonGuardar.textContent = "Guardar control";
}

    document.getElementById("registroMantenimientoTitulo")
        .textContent = plan.title;

    document.getElementById("registroMantenimientoEstado")
        .value = "realizado";

    document.getElementById("registroMantenimientoResponsable")
        .value = "";

    document.getElementById("registroMantenimientoObservaciones")
        .value = "";

        const campoCosto =
    document.getElementById("registroMantenimientoCosto");

const campoComision =
    document.getElementById("registroMantenimientoComision");

const resultadoComision =
    document.getElementById("registroMantenimientoComisionImporte");

const resultadoTotal =
    document.getElementById("registroMantenimientoTotal");

campoCosto.value = "";
campoComision.value = "";

function actualizarCalculoMantenimiento() {
    const costo =
        Number(campoCosto.value) || 0;

    const porcentaje =
        Number(campoComision.value) || 0;

    const comision =
        costo * porcentaje / 100;

    const total =
        costo + comision;

    resultadoComision.textContent =
        "$ " + comision.toLocaleString("es-AR");

    resultadoTotal.textContent =
        "$ " + total.toLocaleString("es-AR");
}

campoCosto.oninput =
    actualizarCalculoMantenimiento;

campoComision.oninput =
    actualizarCalculoMantenimiento;

actualizarCalculoMantenimiento();

    modal.style.display = "flex";
}

function editarControlMantenimiento(control, plan) {
    if (!control?.id || !plan?.id) {
        mostrarAvisoHM("No se pudo identificar el control.");
        return;
    }

    const modal =
        document.getElementById("modalRegistroMantenimiento");

    if (!modal) return;

    mantenimientoPlanEnRegistro = plan;
    mantenimientoControlEnEdicion = control;

    document.getElementById("registroMantenimientoTitulo")
        .textContent = "Editar · " + plan.title;

    document.getElementById("registroMantenimientoEstado")
        .value = control.status || "realizado";

    document.getElementById("registroMantenimientoResponsable")
        .value = control.responsible || "";

    document.getElementById("registroMantenimientoObservaciones")
        .value = control.observations || "";

    const campoCosto =
        document.getElementById("registroMantenimientoCosto");

    const campoComision =
        document.getElementById("registroMantenimientoComision");

    const resultadoComision =
        document.getElementById("registroMantenimientoComisionImporte");

    const resultadoTotal =
        document.getElementById("registroMantenimientoTotal");

    campoCosto.value =
        control.work_amount ?? "";

    campoComision.value =
        control.commission_pct ?? "";

    function actualizarCalculo() {
        const costo =
            Number(campoCosto.value) || 0;

        const porcentaje =
            Number(campoComision.value) || 0;

        const comision =
            costo * porcentaje / 100;

        const total =
            costo + comision;

        resultadoComision.textContent =
            "$ " + comision.toLocaleString("es-AR");

        resultadoTotal.textContent =
            "$ " + total.toLocaleString("es-AR");
    }

    campoCosto.oninput = actualizarCalculo;
    campoComision.oninput = actualizarCalculo;

    actualizarCalculo();

    document.getElementById(
        "btnGuardarRegistroMantenimiento"
    ).textContent = "Guardar cambios";

    modal.style.display = "flex";
}

function cerrarRegistroMantenimiento() {
    const modal =
        document.getElementById("modalRegistroMantenimiento");

    if (modal) modal.style.display = "none";

    mantenimientoPlanEnRegistro = null;

    mantenimientoControlEnEdicion = null;

const boton =
    document.getElementById("btnGuardarRegistroMantenimiento");

if (boton) {
    boton.textContent = "Guardar control";
}
}

async function guardarRegistroMantenimiento() {
    const plan = mantenimientoPlanEnRegistro;
    const boton =
        document.getElementById("btnGuardarRegistroMantenimiento");

    if (!plan?.id || !boton || boton.disabled) return;

    const estado =
        document.getElementById("registroMantenimientoEstado").value;

    const responsable =
        document.getElementById("registroMantenimientoResponsable")
            .value.trim();

    const observaciones =
        document.getElementById("registroMantenimientoObservaciones")
            .value.trim();

            const costo =
    Number(
        document.getElementById("registroMantenimientoCosto").value
    ) || 0;

const porcentajeComision =
    Number(
        document.getElementById("registroMantenimientoComision").value
    ) || 0;

const importeComision =
    costo * porcentajeComision / 100;

const totalMantenimiento =
    costo + importeComision;

    if (!responsable) {
        mostrarAvisoHM("Ingresá el responsable del control.");
        return;
    }

    if (estado === "problema" && !observaciones) {
        mostrarAvisoHM("Ingresá qué problema se encontró.");
        return;
    }

    boton.disabled = true;
    mostrarLoader("Registrando control...");

    try {
    let error = null;

    const costo =
        Number(
            document.getElementById(
                "registroMantenimientoCosto"
            ).value
        ) || 0;

    const porcentaje =
        Number(
            document.getElementById(
                "registroMantenimientoComision"
            ).value
        ) || 0;

    const comision =
        costo * porcentaje / 100;

    const total =
        costo + comision;

    if (mantenimientoControlEnEdicion) {

        const resultado =
            await supabaseClient
                .from("house_maintenance_tasks")
                .update({
                    status: estado,
                    responsible: responsable,
                    observations: observaciones || null,
                    work_amount: costo,
                    commission_pct: porcentaje,
                    commission_amount: comision,
                    total_amount: total
                })
                .eq(
                    "id",
                    mantenimientoControlEnEdicion.id
                );

        error = resultado.error;

    } else {

        const resultado =
            await supabaseClient.rpc(
                "registrar_mantenimiento",
                {
                    p_plan_id: plan.id,
                    p_status: estado,
                    p_responsible: responsable,
                    p_observations:
                        observaciones || null,
                    p_work_amount: costo,
                    p_commission_pct: porcentaje
                }
            );

        error = resultado.error;
    }

if (error) {
    console.error(
        "Error registrando mantenimiento:",
        error
    );

    mostrarAvisoHM(
        "No se pudo registrar el control. Revisá la fecha y volvé a intentarlo."
    );

    return;
}

        cerrarRegistroMantenimiento();

        mostrarAvisoHM(
            estado === "problema"
                ? "Control registrado con un problema."
                : "Control de mantenimiento registrado."
        );

        await abrirMantenimientoCasa();

    } catch (error) {
        console.error("Error registrando mantenimiento:", error);
        mostrarAvisoHM("No se pudo registrar el control.");
    } finally {
        boton.disabled = false;
        ocultarLoader();
    }
}

async function editarTituloMantenimiento(plan) {
    const casa = houses[current];

    if (!casa?.id || !plan?.id) return;

    const { data: rol, error: errorRol } =
        await supabaseClient.rpc("current_organization_role");

    if (errorRol || !["admin", "colaborador"].includes(rol)) {
        mostrarAvisoHM("No tenés permiso para editar mantenimiento.");
        return;
    }

    const nuevoTitulo = await solicitarTextoHM(
        "Escribí el nuevo título de este control para esta casa.",
        "Editar tarea de mantenimiento",
        "Título de la tarea",
        plan.title
    );

    if (nuevoTitulo === null) return;

    const tituloLimpio = nuevoTitulo.trim();

    if (tituloLimpio.length < 2) {
        mostrarAvisoHM("Ingresá un título de al menos 2 caracteres.");
        return;
    }

    const { error } = await supabaseClient
        .from("house_maintenance_plans")
        .update({ title: tituloLimpio })
        .eq("id", plan.id)
        .eq("house_id", casa.id)
        .select("id")
        .single();

    if (error) {
        console.error("Error editando título de mantenimiento:", error);
        mostrarAvisoHM("No se pudo editar el título.");
        return;
    }

    mostrarAvisoHM("Título de mantenimiento actualizado.");
    await abrirMantenimientoCasa();
}

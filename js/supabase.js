const SUPABASE_URL = 'https://fkihyzhwmannrcpsdcek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LKF1TtYSGomvU6Fi20YqhQ_YZoJy7VN';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

function recuperarPassword() {

    const modal =
        document.getElementById("modalRecuperarPassword");

    const email =
        document.getElementById("recuperarPasswordEmail");

    if (!modal) return;

    if (email) {
        email.value = "";
    }

    modal.style.display = "flex";

    setTimeout(() => {
        email?.focus();
    }, 50);
}


function cerrarRecuperarPassword() {

    const modal =
        document.getElementById("modalRecuperarPassword");

    if (modal) {
        modal.style.display = "none";
    }
}


async function enviarRecuperacionPassword() {

    const input =
        document.getElementById("recuperarPasswordEmail");

    const email =
        input?.value.trim();

    if (!email) {
        alert("Ingresá tu email.");
        input?.focus();
        return;
    }

    const { error } =
        await supabaseClient.auth.resetPasswordForEmail(
            email,
            {
                redirectTo:
                    window.location.origin +
                    window.location.pathname
            }
        );

    if (error) {

        console.error(
            "❌ Error enviando recuperación:",
            error
        );

        alert(
            "No se pudo enviar el email de recuperación."
        );

        return;
    }

    cerrarRecuperarPassword();

    alert(
        "Te enviamos un email para recuperar tu contraseña."
    );
}

async function abrirUsuarios() {

    const { data: rolActual, error: rolError } =
        await supabaseClient.rpc(
            "current_organization_role"
        );

    if (rolError) {
        console.error(
            "❌ Error verificando acceso a Usuarios:",
            rolError
        );
        return;
    }

    if (rolActual !== "admin") {
        alert("No tenés permisos para administrar usuarios.");
        return;
    }

    go("usuarios");

    const contenedor =
        document.getElementById("usuariosContent");

    if (!contenedor) {
        console.error("❌ No existe usuariosContent");
        return;
    }

    contenedor.innerHTML = "Cargando usuarios...";

    // Obtener usuario logueado
    const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

    if (userError || !userData?.user) {
        console.error(
            "❌ No se pudo obtener el usuario actual:",
            userError
        );
        return;
    }

    // Obtener organización activa
    const { data: perfil, error: perfilError } =
        await supabaseClient
            .from("profiles")
            .select("active_organization_id")
            .eq("id", userData.user.id)
            .single();

    if (perfilError || !perfil?.active_organization_id) {
        console.error(
            "❌ No se pudo obtener la organización:",
            perfilError
        );

        contenedor.innerHTML =
            "No se pudo determinar la organización.";

        return;
    }

    // Obtener miembros de esa organización
    const { data: miembros, error: miembrosError } =
        await supabaseClient
            .from("organization_members")
            .select(`
                user_id,
                rol,
                activo
            `)
            .eq(
                "organization_id",
                perfil.active_organization_id
            )
            .order("created_at", { ascending: true });

    if (miembrosError) {
        console.error(
            "❌ Error cargando usuarios:",
            miembrosError
        );

        contenedor.innerHTML =
            "No se pudieron cargar los usuarios.";

        return;
    }

    // Obtener perfiles
    const idsUsuarios =
        miembros.map(miembro => miembro.user_id);

    const { data: perfiles, error: perfilesError } =
        await supabaseClient
            .from("profiles")
            .select("id, nombre")
            .in("id", idsUsuarios);

    if (perfilesError) {
        console.error(
            "❌ Error cargando perfiles:",
            perfilesError
        );

        contenedor.innerHTML =
            "No se pudieron cargar los perfiles.";

        return;
    }

    contenedor.innerHTML = "";

if (!miembros || miembros.length === 0) {

    contenedor.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-title">
                No hay usuarios
            </div>

            <div class="empty-state-text">
                Todavía no hay usuarios registrados en esta organización.
            </div>
        </div>
    `;

    return;
}

    miembros.forEach(miembro => {

        const perfilUsuario =
            perfiles.find(
                p => p.id === miembro.user_id
            );

        const tarjeta =
            document.createElement("div");

        tarjeta.className = "usuario-card";

      tarjeta.innerHTML = `
    <div class="usuario-card-nombre">
        ${perfilUsuario?.nombre || "Usuario"}
    </div>

    <div class="usuario-card-info">
        <strong>Rol:</strong> ${miembro.rol}
    </div>

    <div class="usuario-card-info">
        <strong>Estado:</strong>
        <span class="${miembro.activo ? "usuario-activo" : "usuario-inactivo"}">
            ${miembro.activo ? "Activo" : "Inactivo"}
        </span>
    </div>

    <button
        type="button"
        class="usuario-edit-btn"
        onclick="editarUsuario('${miembro.user_id}')">
        Editar
    </button>
`;

        contenedor.appendChild(tarjeta);
    });
}

let creandoUsuario = false;

function nuevoUsuario() {

    const modal =
        document.getElementById("modalNuevoUsuario");

    const email =
        document.getElementById("nuevoUsuarioEmail");

    const nombre =
        document.getElementById("nuevoUsuarioNombre");

    const rol =
        document.getElementById("nuevoUsuarioRol");

    const errorTexto =
        document.getElementById("nuevoUsuarioError");

    if (!modal) return;

    if (email) email.value = "";
    if (nombre) nombre.value = "";
    if (rol) rol.value = "colaborador";

    if (errorTexto) {
        errorTexto.textContent = "";
        errorTexto.style.display = "none";
    }

    modal.style.display = "flex";

    setTimeout(() => {
        email?.focus();
    }, 50);
}


function cerrarNuevoUsuario() {

    const modal =
        document.getElementById("modalNuevoUsuario");

    if (modal) {
        modal.style.display = "none";
    }
}

async function enviarNuevoUsuario() {

    if (creandoUsuario) return;

    const emailInput =
        document.getElementById("nuevoUsuarioEmail");

    const nombreInput =
        document.getElementById("nuevoUsuarioNombre");

    const rolInput =
        document.getElementById("nuevoUsuarioRol");

    const errorTexto =
        document.getElementById("nuevoUsuarioError");

    const boton =
        document.getElementById("btnCrearNuevoUsuario");

    const email =
        emailInput?.value.trim() || "";

    const nombre =
        nombreInput?.value.trim() || "";

    const rol =
        rolInput?.value || "";

    function mostrarError(mensaje) {
        if (!errorTexto) return;

        errorTexto.textContent = mensaje;
        errorTexto.style.display = "block";
    }

    if (!email) {
        mostrarError("Ingresá el email del usuario.");
        emailInput?.focus();
        return;
    }

    if (!nombre) {
        mostrarError("Ingresá el nombre del usuario.");
        nombreInput?.focus();
        return;
    }

    if (
        !["admin", "supervisor", "colaborador"]
            .includes(rol)
    ) {
        mostrarError("Seleccioná un rol válido.");
        return;
    }

    if (errorTexto) {
        errorTexto.textContent = "";
        errorTexto.style.display = "none";
    }

    creandoUsuario = true;

    if (boton) {
        boton.disabled = true;
        boton.style.opacity = "0.6";
    }

    const { data, error } =
        await supabaseClient.functions.invoke(
            "invite-user",
            {
                body: {
                    email,
                    nombre,
                    rol
                }
            }
        );

    if (error || data?.error) {

        creandoUsuario = false;

        if (boton) {
            boton.disabled = false;
            boton.style.opacity = "1";
        }

        console.error(
            "❌ Error invitando usuario:",
            error || data?.error
        );

        mostrarError(
            "No se pudo enviar la invitación. Verificá los datos del usuario e intentá nuevamente."
        );

        return;
    }

    creandoUsuario = false;

    if (boton) {
        boton.disabled = false;
        boton.style.opacity = "1";
    }

    cerrarNuevoUsuario();

    alert("Invitación enviada correctamente.");

    await abrirUsuarios();
}


async function editarUsuario(userId) {

    const { data: miembro, error } =
        await supabaseClient
            .from("organization_members")
            .select("user_id, rol, activo")
            .eq("user_id", userId)
            .single();

    if (error || !miembro) {

        console.error(
            "❌ Error obteniendo usuario:",
            error
        );

        alert("No se pudo abrir el usuario.");
        return;
    }

    const boton =
        document.querySelector(
            `.usuario-edit-btn[onclick="editarUsuario('${userId}')"]`
        );

    if (!boton) return;

    const tarjeta =
        boton.closest(".usuario-card");

    if (!tarjeta) return;

    if (tarjeta.querySelector(".usuario-editor")) {
        return;
    }

    boton.style.display = "none";

    const { data: asignaciones, error: errorAsignaciones } =
        await supabaseClient
            .from("house_users")
            .select("house_id")
            .eq("user_id", userId);

    if (errorAsignaciones) {

        console.error(
            "❌ Error cargando propiedades del usuario:",
            errorAsignaciones
        );

        boton.style.display = "";
        alert("No se pudieron cargar las propiedades.");
        return;
    }

    const casasAsignadas =
        new Set(
            (asignaciones || []).map(
                item => item.house_id
            )
        );

    const listaPropiedades =
        houses.map(house => {

            const checked =
                casasAsignadas.has(house.id)
                    ? "checked"
                    : "";

            return `
                <label class="usuario-propiedad-item">
                    <input
                        type="checkbox"
                        class="usuario-propiedad-check"
                        value="${house.id}"
                        ${checked}
                    >
                    <span>${house.nombre || "Propiedad"}</span>
                </label>
            `;
        }).join("");

    const editor =
        document.createElement("div");

    editor.className = "usuario-editor";

    editor.innerHTML = `
        <div class="usuario-editor-campo">
            <label>Rol</label>

            <select
                id="usuarioRol-${userId}"
                onchange="actualizarEditorPropiedades('${userId}')"
            >
                <option value="admin"
                    ${miembro.rol === "admin" ? "selected" : ""}>
                    Admin
                </option>

                <option value="supervisor"
                    ${miembro.rol === "supervisor" ? "selected" : ""}>
                    Supervisor
                </option>

                <option value="colaborador"
                    ${miembro.rol === "colaborador" ? "selected" : ""}>
                    Colaborador
                </option>
            </select>
        </div>

        <div class="usuario-editor-campo">
            <label>Estado</label>

            <select id="usuarioEstado-${userId}">
                <option value="activo"
                    ${miembro.activo ? "selected" : ""}>
                    Activo
                </option>

                <option value="inactivo"
                    ${!miembro.activo ? "selected" : ""}>
                    Inactivo
                </option>
            </select>
        </div>

        <div
            id="usuarioPropiedades-${userId}"
            class="usuario-propiedades"
        >
            ${
                miembro.rol === "admin"
                    ? `
                        <div class="usuario-admin-todas">
                            Administrador · Acceso a todas las propiedades
                        </div>
                    `
                    : `
                        <div class="usuario-propiedades-titulo">
                            Propiedades asignadas
                        </div>

                        <div class="usuario-propiedades-lista">
                            ${listaPropiedades}
                        </div>
                    `
            }
        </div>

        <div class="usuario-editor-acciones">

            <button
                type="button"
                class="usuario-guardar-btn"
                onclick="guardarEdicionUsuario('${userId}')">
                Guardar
            </button>

            <button
                type="button"
                class="usuario-cancelar-btn"
                onclick="cancelarEdicionUsuario('${userId}')">
                Cancelar
            </button>

        </div>
    `;

    tarjeta.appendChild(editor);
}

function actualizarEditorPropiedades(userId) {

    const rol =
        document.getElementById(
            `usuarioRol-${userId}`
        )?.value;

    const contenedor =
        document.getElementById(
            `usuarioPropiedades-${userId}`
        );

    if (!contenedor) return;

    if (rol === "admin") {
        contenedor.style.display = "none";
    } else {
        contenedor.style.display = "block";
    }
}

async function guardarEdicionUsuario(userId) {

    const rol =
        document.getElementById(
            `usuarioRol-${userId}`
        )?.value;

    const estado =
        document.getElementById(
            `usuarioEstado-${userId}`
        )?.value;

    if (!rol || !estado) {
        alert("No se pudo leer la información del usuario.");
        return;
    }

    // ============================================
    // 1. GUARDAR ROL Y ESTADO
    // ============================================

    const { error: errorUsuario } =
        await supabaseClient
            .from("organization_members")
            .update({
                rol: rol,
                activo: estado === "activo"
            })
            .eq("user_id", userId);

    if (errorUsuario) {
        console.error(
            "❌ Error actualizando usuario:",
            errorUsuario
        );

        alert("No se pudo actualizar el usuario.");
        return;
    }

    // ============================================
    // 2. ADMIN = ACCESO A TODAS LAS CASAS
    // ============================================

    if (rol === "admin") {

        const { error: errorBorrar } =
            await supabaseClient
                .from("house_users")
                .delete()
                .eq("user_id", userId);

        if (errorBorrar) {
            console.error(
                "❌ Error limpiando asignaciones:",
                errorBorrar
            );

            alert(
                "El rol se guardó, pero hubo un problema con las propiedades."
            );
            return;
        }

    } else {

        // ============================================
        // 3. LEER CASAS MARCADAS
        // ============================================

        const editor =
            document.getElementById(
                `usuarioPropiedades-${userId}`
            );

        const checks =
            editor
                ? editor.querySelectorAll(
                    ".usuario-propiedad-check:checked"
                )
                : [];

        const houseIds =
            Array.from(checks)
                .map(check => check.value);

        // Borramos las asignaciones anteriores
        const { error: errorBorrar } =
            await supabaseClient
                .from("house_users")
                .delete()
                .eq("user_id", userId);

        if (errorBorrar) {
            console.error(
                "❌ Error borrando asignaciones anteriores:",
                errorBorrar
            );

            alert(
                "No se pudieron actualizar las propiedades."
            );
            return;
        }

        // Creamos las nuevas asignaciones
        if (houseIds.length > 0) {

            const nuevasAsignaciones =
    houseIds.map(houseId => ({
        house_id: houseId,
        user_id: userId,
        rol: rol
    }));

            const { error: errorInsertar } =
                await supabaseClient
                    .from("house_users")
                    .insert(nuevasAsignaciones);

            if (errorInsertar) {
                console.error(
                    "❌ Error guardando propiedades:",
                    errorInsertar
                );

                alert(
                    "No se pudieron guardar las propiedades."
                );
                return;
            }
        }
    }

    alert("Usuario actualizado correctamente.");

    await abrirUsuarios();
}

function cancelarEdicionUsuario(userId) {

    const boton =
        document.querySelector(
            `.usuario-edit-btn[onclick="editarUsuario('${userId}')"]`
        );

    const tarjeta =
        boton?.closest(".usuario-card");

    const editor =
        tarjeta?.querySelector(".usuario-editor");

    if (editor) {
        editor.remove();
    }

    if (boton) {
        boton.style.display = "";
    }
}

function cancelarEdicionUsuario(userId) {

    const boton =
        document.querySelector(
            `.usuario-edit-btn[onclick="editarUsuario('${userId}')"]`
        );

    if (!boton) return;

    const tarjeta =
        boton.closest(".usuario-card");

    if (!tarjeta) return;

    const editor =
        tarjeta.querySelector(".usuario-editor");

    if (editor) {
        editor.remove();
    }

    boton.style.display = "";
}

async function detectarRecuperacionPassword() {

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            if (
                event !== "PASSWORD_RECOVERY" &&
                event !== "SIGNED_IN"
            ) {
                return;
            }

            const url =
                new URL(window.location.href);

            const esInvitacion =
                url.hash.includes("type=invite") ||
                url.searchParams.get("type") === "invite";

            const esRecuperacion =
                event === "PASSWORD_RECOVERY";

            if (!esInvitacion && !esRecuperacion) {
                return;
            }

            const modal =
                document.getElementById(
                    "modalNuevaPassword"
                );

            const inputNueva =
                document.getElementById(
                    "nuevaPassword"
                );

            const inputRepetir =
                document.getElementById(
                    "repetirNuevaPassword"
                );

            const errorTexto =
                document.getElementById(
                    "nuevaPasswordError"
                );

            if (!modal) return;

            if (inputNueva) {
                inputNueva.value = "";
            }

            if (inputRepetir) {
                inputRepetir.value = "";
            }

            if (errorTexto) {
                errorTexto.textContent = "";
                errorTexto.style.display = "none";
            }

            modal.style.display = "flex";

            setTimeout(() => {
                inputNueva?.focus();
            }, 50);
        }
    );
}

detectarRecuperacionPassword();

async function guardarNuevaPassword() {

    const modal =
        document.getElementById("modalNuevaPassword");

    const inputNueva =
        document.getElementById("nuevaPassword");

    const inputRepetir =
        document.getElementById("repetirNuevaPassword");

    const errorTexto =
        document.getElementById("nuevaPasswordError");

    const nuevaPassword =
        inputNueva?.value || "";

    const repetirPassword =
        inputRepetir?.value || "";

    function mostrarError(mensaje) {

        if (!errorTexto) return;

        errorTexto.textContent = mensaje;
        errorTexto.style.display = "block";
    }

    if (nuevaPassword.length < 8) {

        mostrarError(
            "La contraseña debe tener al menos 8 caracteres."
        );

        inputNueva?.focus();
        return;
    }

    if (nuevaPassword !== repetirPassword) {

        mostrarError(
            "Las contraseñas no coinciden."
        );

        inputRepetir?.focus();
        return;
    }

    if (errorTexto) {
        errorTexto.style.display = "none";
    }

    const boton =
        modal?.querySelector(".hm-modal-actions button");

    if (boton?.disabled) return;

    if (boton) {
        boton.disabled = true;
        boton.style.opacity = "0.6";
    }

    const { error } =
        await supabaseClient.auth.updateUser({
            password: nuevaPassword
        });

    if (error) {

        console.error(
            "❌ Error creando contraseña:",
            error
        );

        mostrarError(
            "No se pudo guardar la contraseña. Intentá nuevamente."
        );

        if (boton) {
            boton.disabled = false;
            boton.style.opacity = "1";
        }

        return;
    }

    if (modal) {
        modal.style.display = "none";
    }

    alert(
        "Contraseña creada correctamente."
    );

    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );
}

window.guardarNuevaPassword = guardarNuevaPassword;

let resolverLogin = null;
let loginEnProceso = false;

function probarLogin() {

    return new Promise((resolve) => {

        resolverLogin = resolve;

        const modal =
            document.getElementById("modalLogin");

        const email =
            document.getElementById("loginEmail");

        const password =
            document.getElementById("loginPassword");

        const errorTexto =
            document.getElementById("loginError");

        if (!modal) {
            resolverLogin = null;
            resolve(false);
            return;
        }

        if (email) email.value = "";
        if (password) password.value = "";

        if (errorTexto) {
            errorTexto.textContent = "";
            errorTexto.style.display = "none";
        }

        modal.style.display = "flex";

        setTimeout(() => {
            email?.focus();
        }, 50);
    });
}


function cerrarLogin() {

    if (loginEnProceso) return;

    const modal =
        document.getElementById("modalLogin");

    if (modal) {
        modal.style.display = "none";
    }

    if (resolverLogin) {
        resolverLogin(false);
        resolverLogin = null;
    }
}


async function enviarLogin() {

    if (loginEnProceso) return;

    const modal =
        document.getElementById("modalLogin");

    const emailInput =
        document.getElementById("loginEmail");

    const passwordInput =
        document.getElementById("loginPassword");

    const errorTexto =
        document.getElementById("loginError");

    const boton =
        document.getElementById("btnLogin");

    const email =
        emailInput?.value.trim() || "";

    const password =
        passwordInput?.value || "";

    function mostrarError(mensaje) {

        if (!errorTexto) return;

        errorTexto.textContent = mensaje;
        errorTexto.style.display = "block";
    }

    if (!email) {
        mostrarError("Ingresá tu email.");
        emailInput?.focus();
        return;
    }

    if (!password) {
        mostrarError("Ingresá tu contraseña.");
        passwordInput?.focus();
        return;
    }

    if (errorTexto) {
        errorTexto.style.display = "none";
    }

    loginEnProceso = true;

    if (boton) {
        boton.disabled = true;
        boton.style.opacity = "0.6";
    }

    window.usuarioAutenticado = false;

    const { error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {

        loginEnProceso = false;

        if (boton) {
            boton.disabled = false;
            boton.style.opacity = "1";
        }

        mostrarError(
            "Email o contraseña incorrectos."
        );

        passwordInput?.focus();
        return;
    }

    window.usuarioAutenticado = true;

    if (typeof activarNotificacionesPush === "function") {
        try {
            await activarNotificacionesPush();
        } catch (error) {
            console.error(
                "❌ No se pudieron activar las notificaciones push:",
                error
            );
        }
    }

    loginEnProceso = false;

    if (boton) {
        boton.disabled = false;
        boton.style.opacity = "1";
    }

    if (modal) {
        modal.style.display = "none";
    }

    if (resolverLogin) {
        resolverLogin(true);
        resolverLogin = null;
    }
}

window.cerrarLogin = cerrarLogin;
window.enviarLogin = enviarLogin;
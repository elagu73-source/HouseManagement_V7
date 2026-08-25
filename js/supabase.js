const SUPABASE_URL = 'https://fkihyzhwmannrcpsdcek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LKF1TtYSGomvU6Fi20YqhQ_YZoJy7VN';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

function pedirPassword() {
    return new Promise((resolve) => {

        const overlay = document.createElement("div");

        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.45)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "99999";

        const box = document.createElement("div");

        box.style.background = "#FFFFFF";
        box.style.padding = "24px";
        box.style.borderRadius = "14px";
        box.style.width = "min(360px, 85vw)";
        box.style.boxSizing = "border-box";

        const title = document.createElement("div");
        title.textContent = "Contraseña";
        title.style.fontSize = "18px";
        title.style.fontWeight = "600";
        title.style.marginBottom = "12px";
        title.style.color = "#0D2B45";

        const input = document.createElement("input");

        input.type = "password";
        input.autocomplete = "current-password";
        input.style.width = "100%";
        input.style.boxSizing = "border-box";
        input.style.padding = "12px";
        input.style.border = "1px solid #D8D8D2";
        input.style.borderRadius = "8px";
        input.style.fontSize = "16px";

        const button = document.createElement("button");

        button.textContent = "Aceptar";
        button.style.marginTop = "14px";
        button.style.width = "100%";
        button.style.padding = "11px";
        button.style.border = "none";
        button.style.borderRadius = "8px";
        button.style.background = "#0D2B45";
        button.style.color = "#FFFFFF";
        button.style.fontWeight = "600";

        button.onclick = () => {
            const value = input.value;
            overlay.remove();
            resolve(value);
        };

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                button.click();
            }
        });

        box.appendChild(title);
        box.appendChild(input);
        box.appendChild(button);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        input.focus();
    });
}

async function recuperarPassword() {

    const email = prompt("Ingresá tu email:");

    if (!email) {
        return;
    }

    const { error } =
        await supabaseClient.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: window.location.origin + window.location.pathname
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

    // Propiedades actualmente asignadas
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

            if (event !== "PASSWORD_RECOVERY") {
                return;
            }

            const nuevaPassword = prompt(
                "Ingresá tu nueva contraseña:"
            );

            if (!nuevaPassword) {
                return;
            }

            if (nuevaPassword.length < 8) {
                alert(
                    "La contraseña debe tener al menos 8 caracteres."
                );
                return;
            }

            const repetirPassword = prompt(
                "Repetí tu nueva contraseña:"
            );

            if (nuevaPassword !== repetirPassword) {
                alert(
                    "Las contraseñas no coinciden."
                );
                return;
            }

            const { error } =
                await supabaseClient.auth.updateUser({
                    password: nuevaPassword
                });

            if (error) {
                console.error(
                    "❌ Error cambiando contraseña:",
                    error
                );

                alert(
                    "No se pudo cambiar la contraseña."
                );

                return;
            }

            alert(
                "Contraseña actualizada correctamente. Ya podés ingresar con tu nueva contraseña."
            );

            await supabaseClient.auth.signOut();

            window.location.href =
                window.location.origin +
                window.location.pathname;
        }
    );
}

detectarRecuperacionPassword();

window.recuperarPassword = recuperarPassword;

async function probarLogin() {

    window.usuarioAutenticado = false;

    console.log(
        "🔴 LOGIN INICIADO - AUTENTICADO:",
        window.usuarioAutenticado
    );

    const email = prompt('Email de prueba:');

    if (!email) {
        return false;
    }

 const password = await pedirPassword();

if (!password) {
    return false;
}

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    console.log('RESULTADO LOGIN:', { data, error });

    if (error) {

        alert('Usuario o contraseña incorrectos.');

        return false;
    }

window.usuarioAutenticado = true;

console.log(
    "🟢 LOGIN CORRECTO - AUTENTICADO:",
    window.usuarioAutenticado
);

// Activar notificaciones push en este dispositivo
if (typeof activarNotificacionesPush === "function") {
    try {
        await activarNotificacionesPush();
    } catch (error) {
        console.error("❌ No se pudieron activar las notificaciones push:", error);
    }
}

return true;
}
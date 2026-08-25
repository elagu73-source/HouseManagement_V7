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
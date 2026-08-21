const SUPABASE_URL = 'https://fkihyzhwmannrcpsdcek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LKF1TtYSGomvU6Fi20YqhQ_YZoJy7VN';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

async function probarLogin() {

    alert("ESTOY EJECUTANDO EL SUPABASE.JS NUEVO");

    window.usuarioAutenticado = false;

    console.log(
        "🔴 LOGIN INICIADO - AUTENTICADO:",
        window.usuarioAutenticado
    );

    const email = prompt('Email de prueba:');

    if (!email) {
        return false;
    }

    const password = prompt('Contraseña de prueba:');

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

    return true;
}
const SUPABASE_URL = 'https://fkihyzhwmannrcpsdcek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LKF1TtYSGomvU6Fi20YqhQ_YZoJy7VN';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

async function probarLogin() {
    const email = prompt('Email de prueba:');
    const password = prompt('Contraseña de prueba:');

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    console.log('RESULTADO LOGIN:', { data, error });
}

probarLogin().then(() => {
    supabaseClient
        .from('profiles')
        .select('id, nombre, rol')
        .limit(1)
        .then(({ data, error }) => {
            console.log('PERFIL SUPABASE:', { data, error });
        });
});
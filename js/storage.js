const KEY = 'cb_house_data';

function loadData() {
    let d = localStorage.getItem(KEY);

    if (d) {
        let a = JSON.parse(d);

        a = a.map((h, i) => ({
            ...h,
            nombre: h.nombre || h.name || h.nombreCasa || h.nombre_casa || ('Casa ' + (i + 1)),
            lote: h.lote || '101',
            situacion: h.situacion || 'Disponible'
        }));

        localStorage.setItem(KEY, JSON.stringify(a));
        return a;
    }

    let a = [];

    for (let i = 1; i <= 18; i++) {
        a.push({
            nombre: 'Casa ' + i,
            barrio: 'Golf',
            capacidad: '8 huéspedes',
            wifi: 'Costa123',
            obs: '',
            estado: 'Pendiente',
            situacion: 'Disponible',
            ingreso: '15/12',
            rating: '4.9',
            lote: '101'
        });
    }

    localStorage.setItem(KEY, JSON.stringify(a));

    return a;
}

function saveData(d) {
    localStorage.setItem(KEY, JSON.stringify(d));
}

async function saveHouseToSupabase(house) {
    try {
        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            console.error('❌ No hay usuario autenticado:', userError);
            return;
        }

        const userId = userData.user.id;

        // Si la casa todavía no tiene ID, le generamos uno
        if (!house.id) {
            house.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
});

            const { error: houseError } = await supabaseClient
                .from('houses')
                .insert({
                    id: house.id,
                    nombre: house.nombre || '',
                    barrio: house.barrio || '',
                    lote: house.lote || '',
                    capacidad: parseInt(house.capacidad) || 0,
                    wifi: house.wifi || '',
                    situacion: house.situacion || 'Disponible',
                    observaciones: house.obs || house.observaciones || '',
                    estado: house.estado || 'Pendiente',
                    ingreso: house.ingreso || '',
                    rating: house.rating || ''
                });

            if (houseError) {
                console.error('❌ Error guardando casa:', houseError);
                return;
            }

            const { error: relationError } = await supabaseClient
                .from('house_users')
                .insert({
                    house_id: house.id,
                    user_id: userId
                });

            if (relationError) {
                console.error('❌ Error vinculando casa al usuario:', relationError);
                return;
            }

            console.log('✅ CASA CREADA EN SUPABASE:', house.id);

        } else {

            const { error: houseError } = await supabaseClient
                .from('houses')
                .update({
                    nombre: house.nombre || '',
                    barrio: house.barrio || '',
                    lote: house.lote || '',
                    capacidad: parseInt(house.capacidad) || 0,
                    wifi: house.wifi || '',
                    situacion: house.situacion || 'Disponible',
                    observaciones: house.obs || house.observaciones || '',
                    estado: house.estado || 'Pendiente',
                    ingreso: house.ingreso || '',
                    rating: house.rating || ''
                })
                .eq('id', house.id);

            if (houseError) {
                console.error('❌ Error actualizando casa:', houseError);
                return;
            }

            console.log('✅ CASA ACTUALIZADA EN SUPABASE:', house.id);
        }

    } catch (error) {
        console.error('❌ Error inesperado:', error);
    }
}
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
            house.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
                /[xy]/g,
                function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x'
                        ? r
                        : (r & 0x3 | 0x8);

                    return v.toString(16);
                }
            );

            const { error: houseError } =
                await supabaseClient
                    .from('houses')
                    .insert({
                        id: house.id,
                        nombre: house.nombre || '',
                        barrio: house.barrio || '',
                        lote: house.lote || '',
                        capacidad: parseInt(house.capacidad) || 0,

                        direccion: house.direccion || '',
                        propietario: house.propietario || '',
                        telefono: house.telefono || '',
                        habitaciones: parseInt(house.habitaciones) || 0,
                        banios: parseInt(house.banios) || 0,

                        wifi: house.wifi || '',
                        alarma: house.alarma || '',

                        situacion: house.situacion || 'Disponible',
                        observaciones:
                            house.obs ||
                            house.observaciones ||
                            '',
                        estado: house.estado || 'Pendiente',
                        ingreso: house.ingreso || '',
                        rating: house.rating || '',
valoracion_url:
    house.valoracion_url || null
                    });

            if (houseError) {
                console.error(
                    '❌ Error guardando casa:',
                    houseError
                );
                return;
            }

            const { error: relationError } =
                await supabaseClient
                    .from('house_users')
                    .insert({
                        house_id: house.id,
                        user_id: userId
                    });

            if (relationError) {
                console.error(
                    '❌ Error vinculando casa al usuario:',
                    relationError
                );
                return;
            }

        } else {

            const { error: houseError } =
                await supabaseClient
                    .from('houses')
                    .update({
                        nombre: house.nombre || '',
                        barrio: house.barrio || '',
                        lote: house.lote || '',
                        capacidad: parseInt(house.capacidad) || 0,

                        direccion: house.direccion || '',
                        propietario: house.propietario || '',
                        telefono: house.telefono || '',
                        habitaciones: parseInt(house.habitaciones) || 0,
                        banios: parseInt(house.banios) || 0,

                        wifi: house.wifi || '',
                        alarma: house.alarma || '',

                        situacion:
                            house.situacion ||
                            'Disponible',
                        observaciones:
                            house.obs ||
                            house.observaciones ||
                            '',
                        estado:
                            house.estado ||
                            'Pendiente',
                        ingreso: house.ingreso || '',
                        rating: house.rating || '',
valoracion_url:
    house.valoracion_url || null
                    })
                    .eq('id', house.id);

            if (houseError) {
                console.error(
                    '❌ Error actualizando casa:',
                    houseError
                );
                return;
            }

        }

    } catch (error) {
        console.error(
            '❌ Error inesperado:',
            error
        );
    }
}
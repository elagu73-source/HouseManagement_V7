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
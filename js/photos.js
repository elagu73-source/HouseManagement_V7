alert("photos.js cargado");

const PHOTO_DB = "houseManagementDB";
const PHOTO_VERSION = 1;

let photoDB = null;

function initPhotoDB() {

    const request = indexedDB.open(PHOTO_DB, PHOTO_VERSION);

    request.onupgradeneeded = function(event){

        photoDB = event.target.result;

        if(!photoDB.objectStoreNames.contains("photos")){

            photoDB.createObjectStore("photos",{
                keyPath:"id",
                autoIncrement:true
            });

        }

    };

    request.onsuccess = function(event){

        photoDB = event.target.result;

        console.log("✅ Base de datos de fotos lista");

    };

    request.onerror = function(){

        console.error("❌ Error al abrir IndexedDB");

    };

}

function savePhoto(file, houseId, ambiente) {

    const transaction = photoDB.transaction(["photos"], "readwrite");
    const store = transaction.objectStore("photos");

    const photo = {
        houseId: houseId,
        ambiente: ambiente,
        nombre: file.name,
        tipo: file.type,
        fecha: new Date().toISOString(),
        archivo: file
    };

    const request = store.add(photo);

    request.onsuccess = function() {
        console.log("✅ Foto guardada correctamente");
    };

    request.onerror = function() {
        console.error("❌ Error al guardar la foto");
    };
}

function getPhotos(houseId, ambiente) {

    const transaction = photoDB.transaction(["photos"], "readonly");
    const store = transaction.objectStore("photos");

    const request = store.getAll();

    request.onsuccess = function() {

        const fotos = request.result.filter(photo =>
            photo.houseId === houseId &&
            photo.ambiente === ambiente
        );

        console.log("📸 Fotos encontradas:", fotos);
        console.log("Cantidad:", fotos.length);
    };

    request.onerror = function() {
        console.error("❌ Error al leer las fotos");
    };
}

window.obtenerPrimeraFoto = function(houseId, callback) {
   
    if (!photoDB) {
    setTimeout(() => obtenerPrimeraFoto(houseId, callback), 300);
    return;
}

    const transaction = photoDB.transaction(["photos"], "readonly");
    const store = transaction.objectStore("photos");
    const request = store.getAll();

    request.onsuccess = function() {

        const fotos = request.result.filter(
            foto => foto.houseId === houseId
        );

        if (fotos.length === 0) {
            callback(null);
            return;
        }

        const url = URL.createObjectURL(fotos[0].archivo);

        callback(url);
    };

    request.onerror = function() {
        callback(null);
    };

};

function showPhotoTest(houseId, ambiente) {

    const transaction = photoDB.transaction(["photos"], "readonly");
    const store = transaction.objectStore("photos");

    const request = store.getAll();

    request.onsuccess = function() {

        const fotos = request.result.filter(photo =>
            photo.houseId === houseId &&
            photo.ambiente === ambiente
        );

        if (fotos.length === 0) {
            console.log("❌ No hay fotos");
            return;
        }

        const foto = fotos[0];

        const url = URL.createObjectURL(foto.archivo);

        console.log("🖼️ URL de la foto:", url);

        window.open(url, "_blank");
    };

    request.onerror = function() {
        console.error("❌ Error al mostrar la foto");
    };
}

function mostrarFotos(houseId) {

    const container = document.getElementById("photosContainer");

    if (!container) return;

    const transaction = photoDB.transaction(["photos"], "readonly");
    const store = transaction.objectStore("photos");
    const request = store.getAll();

    request.onsuccess = function () {

        const fotos = request.result.filter(
            foto => foto.houseId === houseId
        );

        container.innerHTML = "";

        if (fotos.length === 0) {
            container.innerText = "No hay fotos.";
            return;
        }

        // La galería general deja de ser una grilla.
        // Cada ambiente tendrá su propia grilla.
        container.style.display = "block";

        // Agrupar fotos por ambiente
        const grupos = {};

        fotos.forEach(foto => {

            if (!grupos[foto.ambiente]) {
                grupos[foto.ambiente] = [];
            }

            grupos[foto.ambiente].push(foto);

        });

        // Crear cada ambiente
const ordenAmbientes = [
    "fachada",
    "living",
    "comedor",
    "cocina",
    "dormitorios",
    "baños",
    "exterior",
    "mantenimiento",
    "otros"
];

const ambientesOrdenados = Object.keys(grupos).sort((a, b) => {

    const posicionA = ordenAmbientes.indexOf(a.toLowerCase());
    const posicionB = ordenAmbientes.indexOf(b.toLowerCase());

    const ordenA = posicionA === -1 ? 999 : posicionA;
    const ordenB = posicionB === -1 ? 999 : posicionB;

    return ordenA - ordenB;

});

ambientesOrdenados.forEach(ambiente => {
            const grupo = document.createElement("div");

            grupo.style.width = "100%";
            grupo.style.marginBottom = "25px";

            const titulo = document.createElement("div");

            titulo.innerHTML =
    '<span class="cb-icon">' +
        '<svg viewBox="0 0 24 24">' +
            '<path d="M3 6H9L11 8H21V19H3Z"></path>' +
        '</svg>' +
    '</span> ' +
    ambiente.charAt(0).toUpperCase() + ambiente.slice(1);

            titulo.style.fontWeight = "bold";
            titulo.style.fontSize = "18px";
            titulo.style.marginBottom = "10px";

            grupo.appendChild(titulo);

            // Grilla de 3 fotos
            const grid = document.createElement("div");

            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(3, 1fr)";
            grid.style.gap = "15px";

            grupos[ambiente].forEach(foto => {

                const div = document.createElement("div");

                div.style.minWidth = "0";

                const img = document.createElement("img");

                img.src = URL.createObjectURL(foto.archivo);

                img.style.width = "100%";
                img.style.height = "120px";
                img.style.objectFit = "cover";
                img.style.borderRadius = "10px";
                img.style.cursor = "pointer";
                img.style.display = "block";

                // Abrir visor
                img.onclick = function(event){

                    event.stopPropagation();

                    const viewer =
                        document.getElementById("photoViewer");

                    const viewerImg =
                        document.getElementById("photoViewerImg");

                    viewerImg.src = img.src;
                    viewer.style.display = "flex";

                };

                div.appendChild(img);

                // Botón eliminar
                const botonEliminar =
                    document.createElement("div");

                botonEliminar.className = "btn";
                botonEliminar.innerHTML = `
    <span class="cb-icon white">
        <svg viewBox="0 0 24 24">
            <path d="M4 7H20"></path>
            <path d="M9 7V5H15V7"></path>
            <path d="M7 7L8 20H16L17 7"></path>
            <path d="M10 11V17"></path>
            <path d="M14 11V17"></path>
        </svg>
    </span>
    Eliminar
`;

                botonEliminar.onclick = function(){

                    if(confirm("¿Querés eliminar esta foto?")){

                        deletePhoto(foto.id);

                    }

                };

                div.appendChild(botonEliminar);

                grid.appendChild(div);

            });

            grupo.appendChild(grid);

            container.appendChild(grupo);

        });

    };
}

function deletePhoto(id) {

    const transaction = photoDB.transaction(["photos"], "readwrite");
    const store = transaction.objectStore("photos");

    const request = store.delete(id);

    request.onsuccess = function() {

        console.log("🗑️ Foto eliminada correctamente");

        mostrarFotos(current);

    };

    request.onerror = function() {

        console.error("❌ Error al eliminar la foto");

    };
}

function cerrarVisorFoto(){

    const viewer = document.getElementById("photoViewer");

    viewer.style.display = "none";

}
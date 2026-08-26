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

async function comprimirImagen(file) {

    // Si no es una imagen, devolver el archivo original
    if (!file || !file.type.startsWith("image/")) {
        return file;
    }

    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1920;
    const QUALITY = 0.82;

    const bitmap = await createImageBitmap(file);

    let width = bitmap.width;
    let height = bitmap.height;

    // Mantener proporciones
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {

        const ratio = Math.min(
            MAX_WIDTH / width,
            MAX_HEIGHT / height
        );

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
        bitmap,
        0,
        0,
        width,
        height
    );

    const blob = await new Promise(resolve => {

        canvas.toBlob(
            resolve,
            "image/jpeg",
            QUALITY
        );

    });

    bitmap.close();

    if (!blob) {
        return file;
    }

    return new File(
        [blob],
        file.name.replace(/\.[^.]+$/, "") + ".jpg",
        {
            type: "image/jpeg",
            lastModified: Date.now()
        }
    );
}

async function savePhotoToSupabase(file, houseId, ambiente) {

    try {

// Comprimir imagen antes de subirla
const archivoOriginal = file;
file = await comprimirImagen(file);

console.log(
    "📸 COMPRESIÓN:",
    Math.round(archivoOriginal.size / 1024) + " KB →",
    Math.round(file.size / 1024) + " KB"
);

        // Obtener usuario autenticado
        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            console.error("❌ No hay usuario autenticado:", userError);
            return false;
        }

        const userId = userData.user.id;

        // Si recibimos el índice de la casa, obtener su UUID real
        
// Obtener el UUID real de la casa
let houseUuid = houseId;

// Si recibimos el índice de la casa
if (typeof houseId === "number") {

    const house = houses[houseId];

    if (!house) {
        console.error("❌ No existe la casa:", houseId);
        return false;
    }

    // Si la casa ya tiene UUID, usarlo
    if (house.id) {

        houseUuid = house.id;

    } else {

    // La casa todavía no tiene ID en Supabase.
    console.log(
        "🏠 La casa no tiene UUID. Creándola en Supabase..."
    );

    await saveHouseToSupabase(house);

    // Después de guardar debería tener su UUID
    houseUuid = house.id;

}
}

if (!houseUuid) {

    console.error(
        "❌ No se pudo obtener el ID de Supabase de la casa"
    );

    return false;
}

console.log(
    "✅ UUID DE CASA PARA LA FOTO:",
    houseUuid
);

// Nombre único para la foto
const nombreSeguro = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

const nombreArchivo =
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2) +
    "-" +
    nombreSeguro;

        // Ruta dentro del bucket
        const storagePath =
            userId + "/" +
            houseUuid + "/" +
            ambiente + "/" +
            nombreArchivo;

        // 1. Subir archivo a Storage

        console.log("📁 STORAGE PATH:", storagePath);
console.log("📄 NOMBRE ARCHIVO:", file.name);
console.log("🏠 HOUSE UUID:", houseUuid);

        const { error: uploadError } =
            await supabaseClient.storage
                .from("house-photos")
                .upload(storagePath, file);

        if (uploadError) {
            console.error("❌ Error subiendo foto a Storage:", uploadError);
            return false;
        }

        // 2. Registrar la foto en la tabla
        const { error: insertError } =
            await supabaseClient
                .from("house_photos")
                .insert({
                    house_id: houseUuid,
                    user_id: userId,
                    ambiente: ambiente,
                    nombre: file.name,
                    storage_path: storagePath
                });

        if (insertError) {

            console.error(
                "❌ Error registrando foto en house_photos:",
                insertError
            );

            // Si falló la base, eliminamos el archivo que acabamos de subir
            await supabaseClient.storage
                .from("house-photos")
                .remove([storagePath]);

            return false;
        }

        console.log("✅ FOTO GUARDADA EN SUPABASE:", storagePath);

        return true;

    } catch (error) {

        console.error("❌ Error inesperado guardando foto:", error);

        return false;
    }
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

window.obtenerPrimeraFoto = async function(houseId, callback) {

    try {

        let houseUuid = houseId;

        // Si recibimos el índice de la casa,
        // obtener el UUID real
        if (typeof houseId === "number") {

            const house = houses[houseId];

            if (!house || !house.id) {
                callback(null);
                return;
            }

            houseUuid = house.id;
        }

        const { data: fotos, error } =
            await supabaseClient
                .from("house_photos")
                .select("*")
               .eq("house_id", houseUuid)
.order("created_at", { ascending: false })
.limit(1);

        if (error) {

            console.error(
                "❌ Error obteniendo foto principal:",
                error
            );

            callback(null);
            return;
        }

        if (!fotos || fotos.length === 0) {

            callback(null);
            return;
        }

        const { data: urlData, error: urlError } =
            await supabaseClient.storage
                .from("house-photos")
                .createSignedUrl(
                    fotos[0].storage_path,
                    3600
                );

        if (urlError) {

            console.error(
                "❌ Error creando URL de foto principal:",
                urlError
            );

            callback(null);
            return;
        }

        callback(urlData.signedUrl);

    } catch (error) {

        console.error(
            "❌ Error obteniendo foto principal:",
            error
        );

        callback(null);
    }

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

async function mostrarFotos(houseId) {

    const container = document.getElementById("photosContainer");

    if (!container) return;
    
    const { data: rolActual, error: rolError } =
    await supabaseClient.rpc("current_organization_role");

if (rolError) {
    console.error(
        "❌ Error obteniendo rol actual:",
        rolError
    );
}

    // Obtener UUID real de la casa
    let houseUuid = houseId;

    if (typeof houseId === "number") {

        const house = houses[houseId];

        if (!house || !house.id) {
            console.error("❌ La casa no tiene UUID de Supabase");
            container.innerText = "No se pudo identificar la casa.";
            return;
        }

        houseUuid = house.id;
    }

    console.log("🔎 Buscando fotos de casa:", houseUuid);

    // Buscar fotos en Supabase
    const { data: fotos, error } = await supabaseClient
        .from("house_photos")
        .select("*")
        .eq("house_id", houseUuid)
        .order("created_at", { ascending: true });

    if (error) {

        console.error(
            "❌ Error buscando fotos en Supabase:",
            error
        );

        container.innerText = "No se pudieron cargar las fotos.";
        return;
    }

    container.innerHTML = "";

    if (!fotos || fotos.length === 0) {

        console.log(
            "ℹ️ No hay fotos en Supabase para esta casa."
        );

        container.innerHTML = `
    <div class="empty-state">
        <div class="empty-state-title">
            No hay fotos
        </div>

        <div class="empty-state-text">
            Esta propiedad todavía no tiene fotos cargadas.
        </div>
    </div>
`;
        return;
    }

    console.log(
        "📸 FOTOS ENCONTRADAS:",
        fotos
    );

    container.style.display = "block";

    // Agrupar por ambiente
    const grupos = {};

    fotos.forEach(foto => {

        if (!grupos[foto.ambiente]) {
            grupos[foto.ambiente] = [];
        }

        grupos[foto.ambiente].push(foto);

    });

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

    const ambientesOrdenados =
        Object.keys(grupos).sort((a, b) => {

            const posicionA =
                ordenAmbientes.indexOf(a.toLowerCase());

            const posicionB =
                ordenAmbientes.indexOf(b.toLowerCase());

            const ordenA =
                posicionA === -1 ? 999 : posicionA;

            const ordenB =
                posicionB === -1 ? 999 : posicionB;

            return ordenA - ordenB;
        });

    for (const ambiente of ambientesOrdenados) {

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
            ambiente.charAt(0).toUpperCase() +
            ambiente.slice(1);

        titulo.style.fontWeight = "bold";
        titulo.style.fontSize = "18px";
        titulo.style.marginBottom = "10px";

        grupo.appendChild(titulo);

        const grid = document.createElement("div");

        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(3, 1fr)";
        grid.style.gap = "15px";

        for (const foto of grupos[ambiente]) {

            const div = document.createElement("div");

            div.style.minWidth = "0";

            // Obtener URL temporal de Supabase Storage
            const { data: urlData, error: urlError } =
                await supabaseClient.storage
                    .from("house-photos")
                    .createSignedUrl(
                        foto.storage_path,
                        3600
                    );

            if (urlError) {

                console.error(
                    "❌ Error obteniendo URL de foto:",
                    urlError
                );

                continue;
            }

            const img = document.createElement("img");

            img.src = urlData.signedUrl;

            img.style.width = "100%";
            img.style.height = "120px";
            img.style.objectFit = "cover";
            img.style.borderRadius = "10px";
            img.style.cursor = "pointer";
            img.style.display = "block";

            // Abrir visor
            img.onclick = function(event) {

                event.stopPropagation();

                const viewer =
                    document.getElementById("photoViewer");

                const viewerImg =
                    document.getElementById("photoViewerImg");

                if (viewerImg) {
                    viewerImg.src = img.src;
                }

                if (viewer) {
                    viewer.style.display = "flex";
                }

            };

            div.appendChild(img);

           // Botón eliminar SOLO para admin y supervisor
if (
    rolActual === "admin" ||
    rolActual === "supervisor"
) {

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

    botonEliminar.onclick = function() {

        if (confirm("¿Querés eliminar esta foto?")) {
            deletePhoto(foto);
        }

    };

    div.appendChild(botonEliminar);
}

            grid.appendChild(div);
        }

        grupo.appendChild(grid);

        container.appendChild(grupo);
    }
}

async function deletePhoto(foto) {

    try {

        console.log("🗑️ Eliminando foto:", foto);

        // 1. Eliminar archivo de Storage
        const { error: storageError } =
            await supabaseClient.storage
                .from("house-photos")
                .remove([
                    foto.storage_path
                ]);

        if (storageError) {

            console.error(
                "❌ Error eliminando archivo de Storage:",
                storageError
            );

            return;
        }

        // 2. Eliminar registro de la tabla
        const { error: databaseError } =
            await supabaseClient
                .from("house_photos")
                .delete()
                .eq("id", foto.id);

        if (databaseError) {

            console.error(
                "❌ Error eliminando registro de house_photos:",
                databaseError
            );

            return;
        }

        console.log(
            "🗑️ FOTO ELIMINADA CORRECTAMENTE DE SUPABASE"
        );

        // 3. Actualizar galería
        mostrarFotos(current);

    } catch (error) {

        console.error(
            "❌ Error inesperado eliminando foto:",
            error
        );

    }

}

function cerrarVisorFoto(){

    const viewer = document.getElementById("photoViewer");

    viewer.style.display = "none";

}
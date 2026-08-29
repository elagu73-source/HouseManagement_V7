# House Management — wrapper Android

Este proyecto abre exclusivamente la PWA publicada en:

`https://elagu73-source.github.io/HouseManagement_V7/`

## Configuración Android

- `compileSdk 35`
- `targetSdk 35`
- `minSdk 23`
- Android Gradle Plugin 8.7.3
- Gradle 8.9 y Java 17 en la compilación automática

No contiene ni modifica la lógica web, el diseño, Supabase o los datos.

## Compilar en Android Studio

Abrir esta carpeta como proyecto, instalar Android SDK 35 cuando Android Studio lo solicite y seleccionar **Build > Build APK(s)**.

El APK de prueba se genera en `app/build/outputs/apk/debug/app-debug.apk`.

## Compilar con GitHub Actions

Copiar esta carpeta dentro del repositorio con el nombre `android-wrapper` y copiar `build-apk.yml` a `.github/workflows/build-apk.yml`. Luego ejecutar la acción **Build Android APK** y descargar el artefacto `house-management-api35-apk`.

## Prueba

1. Desinstalar cualquier versión anterior de House Management si Android informa conflicto de firma.
2. Copiar `app-debug.apk` al teléfono y abrirlo.
3. Autorizar la instalación desde el navegador o gestor de archivos usado.
4. Confirmar que ya no aparece el aviso de app creada para una versión antigua.
5. Abrir la app, recorrer propiedades y probar volver atrás y abrir enlaces externos.

El APK de prueba usa la firma de depuración. Para publicar en Google Play debe generarse un AAB firmado con una clave de producción conservada de forma segura.

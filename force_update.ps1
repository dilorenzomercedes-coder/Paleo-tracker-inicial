# Script para forzar actualización completa del APK
# Este script asegura que todos los archivos se copien correctamente

Write-Host "=== Actualización Forzada de APK ===" -ForegroundColor Green
Write-Host ""

# 1. Limpiar carpeta www
Write-Host "1. Limpiando carpeta www..." -ForegroundColor Yellow
if (Test-Path "www") {
    Remove-Item -Path "www\*" -Recurse -Force
    Write-Host "   ✓ Carpeta www limpiada" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path "www" -Force | Out-Null
    Write-Host "   ✓ Carpeta www creada" -ForegroundColor Green
}

# 2. Copiar index.html
Write-Host "2. Copiando index.html..." -ForegroundColor Yellow
Copy-Item -Path "index.html" -Destination "www\index.html" -Force
Write-Host "   ✓ index.html copiado" -ForegroundColor Green

# 3. Copiar carpeta js completa
Write-Host "3. Copiando carpeta js..." -ForegroundColor Yellow
if (!(Test-Path "www\js")) {
    New-Item -ItemType Directory -Path "www\js" -Force | Out-Null
}
Copy-Item -Path "js\*" -Destination "www\js\" -Force
Write-Host "   ✓ Archivos JS copiados" -ForegroundColor Green

# 4. Copiar carpeta css
Write-Host "4. Copiando carpeta css..." -ForegroundColor Yellow
if (!(Test-Path "www\css")) {
    New-Item -ItemType Directory -Path "www\css" -Force | Out-Null
}
Copy-Item -Path "css\*" -Destination "www\css\" -Force
Write-Host "   ✓ Archivos CSS copiados" -ForegroundColor Green

# 5. Copiar carpeta public si existe
if (Test-Path "public") {
    Write-Host "5. Copiando carpeta public..." -ForegroundColor Yellow
    if (!(Test-Path "www\public")) {
        New-Item -ItemType Directory -Path "www\public" -Force | Out-Null
    }
    Copy-Item -Path "public\*" -Destination "www\public\" -Recurse -Force
    Write-Host "   ✓ Archivos public copiados" -ForegroundColor Green
}

# 6. Verificar archivos copiados
Write-Host ""
Write-Host "6. Verificando archivos copiados..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem -Path "www\js" -Filter "*.js"
Write-Host "   Archivos JS en www:" -ForegroundColor Cyan
foreach ($file in $jsFiles) {
    $size = [math]::Round($file.Length / 1KB, 2)
    Write-Host "   - $($file.Name) ($size KB)" -ForegroundColor White
}

# 7. Sincronizar con Capacitor
Write-Host ""
Write-Host "7. Sincronizando con Capacitor..." -ForegroundColor Yellow
cmd /c "npx cap sync android"
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Sincronización exitosa" -ForegroundColor Green
} else {
    Write-Host "   ✗ Error en sincronización" -ForegroundColor Red
    exit 1
}

# 8. Limpiar build de Android
Write-Host ""
Write-Host "8. Limpiando build de Android..." -ForegroundColor Yellow
if (Test-Path "android\app\build") {
    Remove-Item -Path "android\app\build" -Recurse -Force
    Write-Host "   ✓ Build de Android limpiado" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Actualización Completada ===" -ForegroundColor Green
Write-Host ""
Write-Host "SIGUIENTES PASOS:" -ForegroundColor Cyan
Write-Host "1. Abre Android Studio" -ForegroundColor White
Write-Host "2. Ve a: Build > Clean Project" -ForegroundColor White
Write-Host "3. Espera a que termine" -ForegroundColor White
Write-Host "4. Ve a: Build > Build Bundle(s) / APK(s) > Build APK(s)" -ForegroundColor White
Write-Host "5. Instala el nuevo APK en tu dispositivo" -ForegroundColor White
Write-Host ""

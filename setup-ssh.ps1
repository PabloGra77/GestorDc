# setup-ssh.ps1
# Ejecutar UNA SOLA VEZ para instalar la clave SSH en Hostinger.
# Después de esto, deploy.ps1 funciona sin contraseña.

$ErrorActionPreference = "Stop"
$RepoRoot  = $PSScriptRoot
$KeyPath   = "$RepoRoot\deploy-key"
$SSH_HOST  = "187.124.72.3"
$SSH_PORT  = "65002"
$SSH_USER  = "u315763484_LqhlHlMdz"

# ── 1. Generar clave SSH si no existe ─────────────────────────────────────────
if (Test-Path $KeyPath) {
    Write-Host "Clave SSH ya existe: $KeyPath" -ForegroundColor Yellow
} else {
    Write-Host "Generando clave SSH ed25519 sin passphrase..." -ForegroundColor Cyan
    # PowerShell descarta "" al pasar a externos; usamos cmd.exe para preservar el argumento vacío
    cmd /c "ssh-keygen -t ed25519 -f `"$KeyPath`" -N `"`""
    if ($LASTEXITCODE -ne 0) { Write-Error "Error generando clave SSH"; exit 1 }
    Write-Host "Clave generada correctamente." -ForegroundColor Green
}

$pubKey = (Get-Content "$KeyPath.pub").Trim()
Write-Host "`nClave pública:`n$pubKey`n" -ForegroundColor DarkCyan

# ── 2. Instalar clave en Hostinger ────────────────────────────────────────────
Write-Host "Instalando clave en el servidor..." -ForegroundColor Cyan
Write-Host "Se pedirá la contraseña de Hostinger (solo esta vez):`n" -ForegroundColor Yellow

$remoteCmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'OK: clave instalada'"
& ssh -p $SSH_PORT -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" $remoteCmd

if ($LASTEXITCODE -ne 0) {
    Write-Error "No se pudo instalar la clave. Verifica la contraseña y vuelve a intentarlo."
    exit 1
}

# ── 3. Verificar que la autenticación por clave funciona ──────────────────────
Write-Host "`nVerificando autenticación por clave..." -ForegroundColor Cyan
$verify = & ssh -p $SSH_PORT -i "$KeyPath" -o StrictHostKeyChecking=accept-new -o BatchMode=yes "${SSH_USER}@${SSH_HOST}" "echo OK"
if ($verify -eq "OK") {
    Write-Host "Autenticación por clave funcionando correctamente." -ForegroundColor Green
    Write-Host "`nYa puedes usar deploy.ps1 sin contraseña." -ForegroundColor Green
} else {
    Write-Warning "La clave se instaló pero la verificación falló. Revisar manualmente."
}

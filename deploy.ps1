# deploy.ps1 - Uso: .\deploy.ps1 -Mensaje "descripcion del cambio"
param(
    [Parameter(Mandatory=$true)]
    [string]$Mensaje
)

$ErrorActionPreference = "Stop"
$RepoRoot    = $PSScriptRoot
$SSH_HOST    = "187.124.72.3"
$SSH_PORT    = "65002"
$SSH_USER    = "u315763484_LqhlHlMdz"
$SSH_KEY     = "$RepoRoot\deploy-key"
$REMOTE_ROOT = "/home/u315763484/websites/LqhlHlMdz/public_html"

if (-not (Test-Path $SSH_KEY)) { Write-Error "Clave SSH no encontrada. Ejecuta setup-ssh.ps1 primero."; exit 1 }

$testAuth = & ssh -p $SSH_PORT -i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 "${SSH_USER}@${SSH_HOST}" "echo OK" 2>&1
if ($testAuth -ne "OK") { Write-Error "SSH key auth fallo. Verifica la clave en el panel de Hostinger."; exit 1 }

$SCP_OPTS = @("-P", $SSH_PORT, "-i", $SSH_KEY, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes")
$SSH_OPTS = @("-p", $SSH_PORT, "-i", $SSH_KEY, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes")

function SSH-Run([string]$Cmd) {
    & ssh @SSH_OPTS "${SSH_USER}@${SSH_HOST}" $Cmd
    if ($LASTEXITCODE -ne 0) { throw "SSH error: $Cmd" }
}

function SCP-Put([string]$Local, [string]$RemoteRel) {
    & scp @SCP_OPTS "$Local" "${SSH_USER}@${SSH_HOST}:${REMOTE_ROOT}/$RemoteRel"
    if ($LASTEXITCODE -ne 0) { throw "SCP error: $Local" }
}

$changed = @(git -C "$RepoRoot" status --porcelain | ForEach-Object { $_.Substring(3).Trim() })
$frontendChanged = @($changed | Where-Object { $_ -match "^apps/web/" })
$backendChanged  = @($changed | Where-Object { $_ -match "^hostinger/public_html/" })

Write-Host ""
Write-Host "=== DEPLOY ===" -ForegroundColor Cyan
Write-Host "Frontend: $($frontendChanged.Count) archivo(s)" -ForegroundColor Yellow
Write-Host "Backend:  $($backendChanged.Count) archivo(s)" -ForegroundColor Yellow
Write-Host "Commit:   $Mensaje" -ForegroundColor Yellow
Write-Host ""

$step = 1

if ($frontendChanged.Count -gt 0) {
    Write-Host "[$step] Build frontend..." -ForegroundColor Cyan
    Push-Location "$RepoRoot\apps\web"
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build fallo" }
    } finally { Pop-Location }
    Write-Host "Build OK" -ForegroundColor Green
    $step++

    Write-Host "[$step] Subiendo frontend..." -ForegroundColor Cyan
    $distPath = "$RepoRoot\apps\web\dist"

    foreach ($rootFile in @("index.html", "sw.js", "manifest.webmanifest")) {
        $f = "$distPath\$rootFile"
        if (Test-Path $f) { Write-Host "  $rootFile"; SCP-Put $f $rootFile }
    }

    Write-Host "  Limpiando assets viejos..."
    SSH-Run "find $REMOTE_ROOT/assets -maxdepth 1 \( -name 'index-*.js' -o -name 'index-*.css' -o -name 'index.es-*.js' -o -name 'purify.es-*.js' -o -name 'html2canvas.esm-*.js' \) -delete 2>/dev/null; true"

    Write-Host "  Subiendo assets nuevos..."
    Get-ChildItem "$distPath\assets" | ForEach-Object {
        Write-Host "  assets/$($_.Name)"
        SCP-Put $_.FullName "assets/$($_.Name)"
    }

    Write-Host "Frontend subido OK" -ForegroundColor Green
    $step++
}

if ($backendChanged.Count -gt 0) {
    Write-Host "[$step] Subiendo backend PHP..." -ForegroundColor Cyan

    foreach ($relPath in $backendChanged) {
        $localFile = "$RepoRoot\$($relPath.Replace('/', '\'))"
        if (-not (Test-Path $localFile)) { Write-Host "  [SKIP] $relPath" -ForegroundColor DarkYellow; continue }

        $remotePart = $relPath -replace "^hostinger/public_html/", ""
        $parts = $remotePart -split "/"
        if ($parts.Count -gt 1) {
            $remoteDir = ($parts[0..($parts.Count - 2)]) -join "/"
            SSH-Run "mkdir -p $REMOTE_ROOT/$remoteDir"
        }

        Write-Host "  $remotePart"
        SCP-Put $localFile $remotePart

        if ($relPath -match "\.php$") {
            $phpOut = & ssh @SSH_OPTS "${SSH_USER}@${SSH_HOST}" "php -l $REMOTE_ROOT/$remotePart 2>&1"
            if ($LASTEXITCODE -ne 0) { Write-Warning "PHP syntax error en $remotePart"; Write-Warning $phpOut }
            else { Write-Host "  PHP OK" -ForegroundColor DarkGreen }
        }
    }

    Write-Host "Backend subido OK" -ForegroundColor Green
    $step++
}

Write-Host "[$step] Git commit + push..." -ForegroundColor Cyan
git -C "$RepoRoot" add -A
$gitStatus = git -C "$RepoRoot" status --porcelain
if (-not $gitStatus) {
    Write-Host "  Nada nuevo para commitear." -ForegroundColor DarkYellow
} else {
    git -C "$RepoRoot" commit -m $Mensaje
    if ($LASTEXITCODE -ne 0) { throw "git commit fallo" }
}
git -C "$RepoRoot" push origin main
if ($LASTEXITCODE -ne 0) { throw "git push fallo" }

Write-Host "Push a GitHub OK" -ForegroundColor Green
Write-Host ""
Write-Host "=== DEPLOY COMPLETO ===" -ForegroundColor Green
Write-Host ""
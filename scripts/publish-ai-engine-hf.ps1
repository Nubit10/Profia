# Publica el AI Engine en un Space de Hugging Face (Docker, plan gratuito). Ver docs/deploy/README.md.
# Solo sube lo que necesita la imagen: el código del motor, sus prompts y el catálogo oficial (público).
# Nada de apps/web ni secretos: las claves se configuran en el Space, como "Secrets".
#
# Uso, desde la raíz del repositorio:
#   powershell -ExecutionPolicy Bypass -File scripts/publish-ai-engine-hf.ps1 -Space <usuario>/<space>
# La primera vez, git pide usuario y contraseña: la contraseña es un token de Hugging Face con permiso "Write".

param(
    [Parameter(Mandatory = $true)][string]$Space
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$work = Join-Path $root ".deploy\hf-space"

if (-not (Test-Path (Join-Path $work ".git"))) {
    New-Item -ItemType Directory -Force (Split-Path $work) | Out-Null
    git clone "https://huggingface.co/spaces/$Space" $work
    if ($LASTEXITCODE -ne 0) { throw "No se pudo clonar el Space $Space. ¿Existe y es de tipo Docker?" }
}

# Se reemplaza todo el contenido del Space (menos .git) por la versión actual del motor.
Get-ChildItem $work -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force

$copies = @(
    @("apps\ai-engine\Dockerfile", "Dockerfile"),
    @("apps\ai-engine\pyproject.toml", "apps\ai-engine\pyproject.toml"),
    @("apps\ai-engine\uv.lock", "apps\ai-engine\uv.lock"),
    @("apps\ai-engine\app", "apps\ai-engine\app"),
    @("apps\ai-engine\prompts", "apps\ai-engine\prompts"),
    @("apps\web\curriculum\men", "apps\web\curriculum\men")
)
foreach ($pair in $copies) {
    $target = Join-Path $work $pair[1]
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item -Recurse -Force (Join-Path $root $pair[0]) $target
}
Get-ChildItem $work -Recurse -Force -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# Hugging Face lee la configuración del Space de este README.
$readme = @"
---
title: Profe AI Engine
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 8100
pinned: false
---

AI Engine de Profe (servicio interno). Todas las rutas, salvo /health, exigen el token de servicio.
"@
# UTF-8 sin BOM: con BOM, Hugging Face no reconoce el encabezado YAML.
[IO.File]::WriteAllText((Join-Path $work "README.md"), $readme, (New-Object Text.UTF8Encoding $false))

Push-Location $work
try {
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "El Space ya tiene la versión actual: no hay nada que publicar."
        return
    }
    git commit -m "Publicar AI Engine $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git push
    if ($LASTEXITCODE -ne 0) { throw "git push falló." }
    Write-Host "Publicado. Hugging Face construye la imagen: sigue el avance en https://huggingface.co/spaces/$Space"
} finally {
    Pop-Location
}

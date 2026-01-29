# AlloLib Studio Desktop - Setup Script (Windows)
# This script sets up the development environment for building the desktop app

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AlloLib Studio Desktop Setup         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $DesktopDir

Write-Host "Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js
Write-Host "1. Node.js" -ForegroundColor White
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "   ERROR: Node.js is not installed" -ForegroundColor Red
    Write-Host "   Please install Node.js 18+ from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
} else {
    $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($major -lt 18) {
        Write-Host "   WARNING: Node.js $nodeVersion is older than recommended (18+)" -ForegroundColor Yellow
    } else {
        Write-Host "   OK: Node.js $nodeVersion" -ForegroundColor Green
    }
}

# Check Git
Write-Host "2. Git" -ForegroundColor White
$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    Write-Host "   WARNING: Git is not installed (optional but recommended)" -ForegroundColor Yellow
} else {
    Write-Host "   OK: $gitVersion" -ForegroundColor Green
}

# Check Python (needed for some native modules)
Write-Host "3. Python" -ForegroundColor White
$pythonVersion = python --version 2>$null
if (-not $pythonVersion) {
    $pythonVersion = python3 --version 2>$null
}
if (-not $pythonVersion) {
    Write-Host "   WARNING: Python not found (may be needed for native modules)" -ForegroundColor Yellow
} else {
    Write-Host "   OK: $pythonVersion" -ForegroundColor Green
}

# Check Visual Studio Build Tools
Write-Host "4. Visual Studio Build Tools" -ForegroundColor White
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -property installationPath 2>$null
    if ($vsPath) {
        Write-Host "   OK: Visual Studio found at $vsPath" -ForegroundColor Green
    } else {
        Write-Host "   WARNING: Visual Studio Build Tools not found" -ForegroundColor Yellow
        Write-Host "   Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Yellow
    }
} else {
    Write-Host "   WARNING: Cannot detect Visual Studio" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Write-Host ""

# Install root dependencies
Write-Host "Installing root project dependencies..." -ForegroundColor Cyan
Set-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install root dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "  Done!" -ForegroundColor Green

# Install desktop dependencies
Write-Host "Installing desktop app dependencies..." -ForegroundColor Cyan
Set-Location $DesktopDir
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install desktop dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "  Done!" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!                       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Build the app:    .\scripts\build-local.ps1" -ForegroundColor White
Write-Host "  2. Run in dev mode:  npm run dev (in desktop folder)" -ForegroundColor White
Write-Host "  3. Package for distribution: .\scripts\build-local.ps1 -Target all" -ForegroundColor White
Write-Host ""

Set-Location $ProjectRoot

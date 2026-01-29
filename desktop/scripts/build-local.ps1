# AlloLib Studio Desktop - Local Build Script (Windows)
# This script builds the desktop application locally

param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$PackageOnly,
    [string]$Target = "dir"  # dir, nsis, zip
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AlloLib Studio Desktop Build Script  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $DesktopDir

Write-Host "Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host "Desktop Dir: $DesktopDir" -ForegroundColor Gray
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed. Please install Node.js 18 or later." -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

# Check npm
$npmVersion = npm --version 2>$null
Write-Host "  npm: $npmVersion" -ForegroundColor Green
Write-Host ""

# Install root dependencies
if (-not $PackageOnly) {
    Write-Host "Installing root dependencies..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    npm ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "  Done!" -ForegroundColor Green
    Write-Host ""
}

# Build frontend
if (-not $SkipFrontend -and -not $PackageOnly) {
    Write-Host "Building frontend..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    npm run build:frontend
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "  Done!" -ForegroundColor Green
    Write-Host ""
}

# Build backend
if (-not $SkipBackend -and -not $PackageOnly) {
    Write-Host "Building backend..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    npm run build:backend
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "  Done!" -ForegroundColor Green
    Write-Host ""
}

# Install desktop dependencies
Write-Host "Installing desktop dependencies..." -ForegroundColor Yellow
Set-Location $DesktopDir
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  Done!" -ForegroundColor Green
Write-Host ""

# Build desktop TypeScript
Write-Host "Building desktop TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  Done!" -ForegroundColor Green
Write-Host ""

# Package application
Write-Host "Packaging application (target: $Target)..." -ForegroundColor Yellow

switch ($Target) {
    "dir" {
        npm run pack
    }
    "nsis" {
        npx electron-builder --win nsis
    }
    "zip" {
        npx electron-builder --win zip
    }
    "all" {
        npm run dist:win
    }
    default {
        npm run pack
    }
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build Complete!                       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output directory: $DesktopDir\release" -ForegroundColor Cyan
Write-Host ""

# List output files
if (Test-Path "$DesktopDir\release") {
    Write-Host "Build artifacts:" -ForegroundColor Yellow
    Get-ChildItem "$DesktopDir\release" -File | ForEach-Object {
        $size = "{0:N2} MB" -f ($_.Length / 1MB)
        Write-Host "  $($_.Name) ($size)" -ForegroundColor Gray
    }
}

Set-Location $ProjectRoot

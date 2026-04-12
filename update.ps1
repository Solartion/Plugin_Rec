param(
    [string]$PluginDir = "$PSScriptRoot",
    [string]$RepoOwner = "Solartion",
    [string]$RepoName = "Plugin_Rec",
    [string]$VersionFile = "version.txt",
    [string]$LogFile = "update.log",
    [string]$BackupDir = "backups"
)

function Write-Log {
    param([string]$msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] $msg"
    Add-Content -Path (Join-Path $PluginDir $LogFile) -Value $logMsg
    Write-Host $logMsg -ForegroundColor Cyan
}

Write-Log "--- Update check started ---"

# Ensure version file exists
$versionPath = Join-Path $PluginDir $VersionFile
if (-not (Test-Path $versionPath)) {
    Set-Content -Path $versionPath -Value "v1.0"
    Write-Log "Created missing version.txt with default v1.0"
}
$localVersion = Get-Content -Path $versionPath -Raw
Write-Log "Local version: $localVersion"

# Get latest commit SHA from GitHub API
$apiUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/commits/main"
try {
    $response = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -Headers @{"User-Agent"="PowerShell"}
    $remoteSha = $response.sha
    Write-Log "Remote SHA: $remoteSha"
} catch {
    Write-Log "Failed to query GitHub API: $_"
    exit 2
}

if ($localVersion -eq $remoteSha) {
    Write-Log "Plugin is up to date."
    # Remove flag if exists
    $flagPath = Join-Path $PluginDir "update_available.txt"
    if (Test-Path $flagPath) { Remove-Item $flagPath -Force }
    exit 1
}

# Update available – create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path $PluginDir $BackupDir
if (-not (Test-Path $backupPath)) { New-Item -ItemType Directory -Path $backupPath | Out-Null }
$backupFile = Join-Path $backupPath "backup_$timestamp.zip"
$tempBackup = Join-Path $env:TEMP "backup_$timestamp.zip"

# If an old temp file exists, remove it
if (Test-Path $tempBackup) { Remove-Item $tempBackup -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($PluginDir, $tempBackup)
Move-Item -Path $tempBackup -Destination $backupFile -Force
Write-Log "Created backup at $backupFile"

# Download latest zip
$zipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/main.zip"
$tempZip = Join-Path $env:TEMP "plugin_update_$timestamp.zip"
try {
    Write-Log "Downloading update... (GitHub doesn't provide file size, so percentage is unknown)"
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
    $ProgressPreference = 'Continue'
    Write-Log "Downloaded zip to $tempZip"
} catch {
    Write-Log "Failed to download zip: $_"
    exit 2
}

# Extract to temp folder
$tempExtract = Join-Path $env:TEMP "plugin_update_$timestamp"
Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
Write-Log "Extracted zip to $tempExtract"

# Determine extracted root folder (it contains RepoName-main)
$extractedRoot = Get-ChildItem -Path $tempExtract | Where-Object { $_.PSIsContainer } | Select-Object -First 1
if (-not $extractedRoot) {
    Write-Log "Extraction failed: no folder found"
    exit 2
}

# Copy files over, excluding .git and version.txt
Get-ChildItem -Path $extractedRoot.FullName -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($extractedRoot.FullName.Length).TrimStart('\\')
    $dest = Join-Path $PluginDir $relative
    if ($_.PSIsContainer) {
        if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
    } else {
        if ($relative -ieq $VersionFile) { return }
        Copy-Item -Path $_.FullName -Destination $dest -Force
    }
}
Write-Log "Copied new files to plugin directory"

# Update version file with new SHA
Set-Content -Path $versionPath -Value $remoteSha
Write-Log "Updated version.txt to $remoteSha"

# Write flag file to indicate update is available (UI can read)
$flagPath = Join-Path $PluginDir "update_available.txt"
Set-Content -Path $flagPath -Value "true"
Write-Log "Created update_available.txt flag"

Write-Log "--- Update completed successfully ---"
exit 0

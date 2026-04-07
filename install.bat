@echo off
setlocal EnableDelayedExpansion
title Timelapse Rec - Installer
echo.
echo  ============================================
echo    Timelapse Rec - Full Installer
echo  ============================================
echo.

:: ---- Step 1: Debug mode registry ----
echo  [1/4] Setting CEP debug mode in registry...
reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo         Done!
echo.

:: ---- Step 2: Download FFmpeg ----
set "FFMPEG_DIR=%~dp0TimelapseRec\tools"
set "FFMPEG_EXE=%FFMPEG_DIR%\ffmpeg.exe"

if exist "%FFMPEG_EXE%" (
    echo  [2/4] FFmpeg already installed, skipping download.
    goto :install_ext
)

echo  [2/4] Downloading FFmpeg...
echo.

if not exist "%FFMPEG_DIR%" mkdir "%FFMPEG_DIR%"

set "FFMPEG_URL=https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
set "FFMPEG_ZIP=%TEMP%\ffmpeg_download.zip"
set "FFMPEG_EXTRACT=%TEMP%\ffmpeg_extract"

:: Delete old temp files
if exist "%FFMPEG_ZIP%" del /f /q "%FFMPEG_ZIP%"
if exist "%FFMPEG_EXTRACT%" rmdir /s /q "%FFMPEG_EXTRACT%"

:: Download using curl (built into Windows 10+, shows progress bar)
echo         Downloading from gyan.dev...
echo.
curl.exe -L --progress-bar -o "%FFMPEG_ZIP%" "%FFMPEG_URL%"

if not exist "%FFMPEG_ZIP%" (
    echo.
    echo  ERROR: Download failed.
    echo  Download manually: %FFMPEG_URL%
    echo  Extract ffmpeg.exe to: %FFMPEG_DIR%
    goto :install_ext
)

:: Verify ZIP size > 10MB
for %%A in ("%FFMPEG_ZIP%") do set ZIPSIZE=%%~zA
if !ZIPSIZE! LSS 10000000 (
    echo.
    echo  ERROR: Downloaded file too small - likely corrupted.
    del /f /q "%FFMPEG_ZIP%" >nul 2>&1
    goto :install_ext
)

echo.
echo         Download complete! Size: !ZIPSIZE! bytes

:: Extract
echo         Extracting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%FFMPEG_ZIP%' -DestinationPath '%FFMPEG_EXTRACT%' -Force"

if %errorlevel% neq 0 (
    echo  ERROR: Extraction failed.
    del /f /q "%FFMPEG_ZIP%" >nul 2>&1
    goto :install_ext
)

:: Find and copy ffmpeg.exe
echo         Locating ffmpeg.exe...
set "FOUND="
for /r "%FFMPEG_EXTRACT%" %%F in (ffmpeg.exe) do (
    if not defined FOUND set "FOUND=%%F"
)

if not defined FOUND (
    echo  ERROR: ffmpeg.exe not found in archive!
    goto :cleanup_temp
)

copy /y "!FOUND!" "%FFMPEG_EXE%" >nul

:: Also copy ffprobe
for /r "%FFMPEG_EXTRACT%" %%F in (ffprobe.exe) do (
    copy /y "%%F" "%FFMPEG_DIR%\ffprobe.exe" >nul 2>&1
    goto :done_probe
)
:done_probe

:: Verify ffmpeg works
"%FFMPEG_EXE%" -version >nul 2>&1
if %errorlevel% equ 0 (
    echo         FFmpeg installed successfully!
) else (
    echo  WARNING: ffmpeg.exe copied but may not work.
)

:cleanup_temp
echo         Cleaning up...
del /f /q "%FFMPEG_ZIP%" >nul 2>&1
rmdir /s /q "%FFMPEG_EXTRACT%" >nul 2>&1

:install_ext
echo.

:: ---- Step 3: Install extension ----
set "EXT_DIR=%APPDATA%\Adobe\CEP\extensions"
set "PLUGIN_DIR=%~dp0TimelapseRec"

echo  [3/4] Installing extension...

if not exist "%EXT_DIR%" mkdir "%EXT_DIR%"

if exist "%EXT_DIR%\TimelapseRec" (
    rmdir /s /q "%EXT_DIR%\TimelapseRec" >nul 2>&1
    rd "%EXT_DIR%\TimelapseRec" >nul 2>&1
)

mklink /J "%EXT_DIR%\TimelapseRec" "%PLUGIN_DIR%" >nul 2>&1
if %errorlevel% equ 0 (
    echo         Symlink created!
) else (
    xcopy "%PLUGIN_DIR%" "%EXT_DIR%\TimelapseRec\" /E /I /Y >nul
    echo         Files copied!
)

echo.

:: ---- Step 4: Verify ----
echo  [4/4] Verification...

if exist "%FFMPEG_EXE%" (
    "%FFMPEG_EXE%" -version >nul 2>&1
    if !errorlevel! equ 0 (
        echo         FFmpeg:    OK
    ) else (
        echo         FFmpeg:    BROKEN
    )
) else (
    echo         FFmpeg:    NOT FOUND
    echo                    Download: https://www.gyan.dev/ffmpeg/builds/
    echo                    Place ffmpeg.exe into: %FFMPEG_DIR%
)

if exist "%EXT_DIR%\TimelapseRec\CSXS\manifest.xml" (
    echo         Extension: OK
) else (
    echo         Extension: ERROR
)

echo.
echo  ============================================
echo    Installation complete!
echo.
echo    1. Restart Photoshop
echo    2. Window ^> Extensions ^> Timelapse Rec
echo  ============================================
echo.
pause

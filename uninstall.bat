@echo off
setlocal EnableDelayedExpansion
title Timelapse Rec - Uninstaller
echo.
echo  ============================================
echo    Timelapse Rec - Uninstaller
echo  ============================================
echo.

set "EXT_DIR=%APPDATA%\Adobe\CEP\extensions"
set "EXT_PATH=%EXT_DIR%\TimelapseRec"

:: ---- Check if extension is installed ----
if not exist "%EXT_PATH%" (
    echo  Extension is not installed. Nothing to remove.
    echo.
    pause
    exit /b 0
)

echo  Extension found at:
echo    %EXT_PATH%
echo.

:: ---- Confirm removal ----
set /p CONFIRM="  Are you sure you want to uninstall? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo  Uninstall cancelled.
    echo.
    pause
    exit /b 0
)

echo.

:: ---- Step 1: Remove extension ----
echo  [1/2] Removing extension...

:: Check if it's a symlink (junction)
fsutil reparsepoint query "%EXT_PATH%" >nul 2>&1
if %errorlevel% equ 0 (
    :: It's a junction/symlink - just remove the link, not the source
    rmdir "%EXT_PATH%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo         Symlink removed!
    ) else (
        echo         ERROR: Could not remove symlink.
        echo         Try running as Administrator.
    )
) else (
    :: It's a real copy - delete everything
    rmdir /s /q "%EXT_PATH%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo         Extension files removed!
    ) else (
        echo         ERROR: Could not remove extension folder.
        echo         Try closing Photoshop first and running as Administrator.
    )
)

:: ---- Step 2: Verify ----
echo.
echo  [2/2] Verification...

if not exist "%EXT_PATH%" (
    echo         Extension: REMOVED
) else (
    echo         Extension: STILL PRESENT (manual removal needed)
    echo         Path: %EXT_PATH%
)

echo.
echo  ============================================
echo    Uninstall complete!
echo.
echo    Please restart Photoshop for changes
echo    to take effect.
echo.
echo    NOTE: Your recordings and source files
echo    are NOT deleted. Only the Photoshop
echo    extension link was removed.
echo  ============================================
echo.
pause

@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set NODE_OPTIONS=--enable-source-maps
title TikTok Uploader Pro - MMO Edition
color 0A

cd /d "%~dp0"

echo ===========================================================
echo        TIKTOK UPLOADER PRO (MMO AUTOMATION ENGINE)         
echo ===========================================================
echo.

:: 1. Thu lay PATH moi nhat tu Registry
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%b"
if defined SYS_PATH if defined USR_PATH set "PATH=%USR_PATH%;%SYS_PATH%;%PATH%"

:: 2. Kiem tra xem lenh node da co trong PATH chua
where node >nul 2>nul
if %errorlevel% equ 0 goto :has_node

:: 3. Kiem tra theo duong dan NVM (Node Version Manager)
if defined NVM_SYMLINK (
    if exist "%NVM_SYMLINK%\node.exe" (
        set "PATH=%NVM_SYMLINK%;%PATH%"
        goto :has_node
    )
)

if exist "C:\nvm4w\nodejs\node.exe" (
    set "PATH=C:\nvm4w\nodejs;%PATH%"
    goto :has_node
)

:: 4. Kiem tra cac phien ban Node trong NVM (uu tien Node 24)
if defined NVM_HOME (
    for /d %%d in ("%NVM_HOME%\v24*") do (
        if exist "%%d\node.exe" (
            set "PATH=%%d;%PATH%"
            goto :has_node
        )
    )
    for /f "delims=" %%d in ('dir /b /ad /o-n "%NVM_HOME%\v*" 2^>nul') do (
        if exist "%NVM_HOME%\%%d\node.exe" (
            set "PATH=%NVM_HOME%\%%d;%PATH%"
            goto :has_node
        )
    )
)

if exist "%LocalAppData%\nvm" (
    for /d %%d in ("%LocalAppData%\nvm\v24*") do (
        if exist "%%d\node.exe" (
            set "PATH=%%d;%PATH%"
            goto :has_node
        )
    )
    for /f "delims=" %%d in ('dir /b /ad /o-n "%LocalAppData%\nvm\v*" 2^>nul') do (
        if exist "%LocalAppData%\nvm\%%d\node.exe" (
            set "PATH=%LocalAppData%\nvm\%%d;%PATH%"
            goto :has_node
        )
    )
)

if exist "%AppData%\nvm" (
    for /d %%d in ("%AppData%\nvm\v24*") do (
        if exist "%%d\node.exe" (
            set "PATH=%%d;%PATH%"
            goto :has_node
        )
    )
    for /f "delims=" %%d in ('dir /b /ad /o-n "%AppData%\nvm\v*" 2^>nul') do (
        if exist "%AppData%\nvm\%%d\node.exe" (
            set "PATH=%AppData%\nvm\%%d;%PATH%"
            goto :has_node
        )
    )
)

:: 5. Kiem tra duong dan cai dat mac dinh tren Windows
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto :has_node
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    goto :has_node
)
if exist "%LocalAppData%\Programs\node\node.exe" (
    set "PATH=%LocalAppData%\Programs\node;%PATH%"
    goto :has_node
)

:: 6. Thu kich hoat qua lenh nvm
where nvm >nul 2>nul
if %errorlevel% equ 0 (
    echo [THONG BAO] Dang kich hoat Node.js qua NVM...
    call nvm use 24 >nul 2>nul
    where node >nul 2>nul
    if %errorlevel% equ 0 goto :has_node
    call nvm use lts >nul 2>nul
    where node >nul 2>nul
    if %errorlevel% equ 0 goto :has_node
)

:: 7. Khong tim thay Node.js
color 0C
echo [LOI] May tinh cua ban chua cai dat Node.js hoac chua duoc kich hoat qua NVM!
echo.
echo Neu da cai NVM tren may, vui long mo Terminal go: nvm use 24
echo Neu chua co Node.js, tai ban LTS tai: https://nodejs.org/
echo Sau do mo lai file Chay-App-Windows.bat nay.
echo.
pause
exit /b 1

:has_node
if exist "%AppData%\npm" (
    set "PATH=%PATH%;%AppData%\npm"
)

node scripts/runner.js %*
if %errorlevel% neq 0 (
    echo.
    echo ===========================================================
    echo [THONG BAO] Ung dung da dung voi ma loi: %errorlevel%
    echo ===========================================================
    pause
)

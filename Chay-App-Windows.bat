@echo off
title TikTok Uploader Pro - MMO Edition
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ===========================================================
    echo        TIKTOK UPLOADER PRO (MMO AUTOMATION ENGINE)         
    echo ===========================================================
    echo.
    echo [LOI] May tinh cua ban chua cai dat Node.js!
    echo.
    echo Vui long tai va cai dat Node.js (LTS): https://nodejs.org/
    echo Sau do mo lai file Chay-App-Windows.bat nay.
    echo.
    pause
    exit /b 1
)

node scripts/runner.js %*
if %errorlevel% neq 0 (
    echo.
    echo ===========================================================
    echo [THONG BAO] Ung dung da dung.
    echo ===========================================================
    pause
)

@echo off
title Iniciar MySQL - Algarrobo Connect
echo ========================================================
echo   Iniciando servicio de MySQL / MariaDB en Windows...
echo ========================================================
echo.

sc query MySQL >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Servicio MySQL detectado. Iniciando...
    net start MySQL
    goto :fin
)

sc query MariaDB >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Servicio MariaDB detectado. Iniciando...
    net start MariaDB
    goto :fin
)

sc query wampmysqld64 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Servicio WampServer MySQL detectado. Iniciando...
    net start wampmysqld64
    goto :fin
)

if exist "C:\xampp\mysql_start.bat" (
    echo [OK] XAMPP detectado. Iniciando MySQL...
    start "" "C:\xampp\mysql_start.bat"
    goto :fin
)

echo [INFO] No se detecto un servicio automatico de MySQL registrado en Windows.
echo        Si utilizas XAMPP, abre el "XAMPP Control Panel" y haz clic en "Start" en el modulo MySQL.
echo        Si tienes MySQL Workbench o instalacion manual, asegurate de que el puerto 3306 este activo.
echo.

:fin
echo Verificando conexion con test-db.js...
node test-db.js
pause

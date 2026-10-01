@echo off

title REACH AND TEACH - ADMIN ACCOUNT SETUP

echo ========================================
echo   REACH AND TEACH ADMIN ACCOUNT SETUP
echo ========================================
echo.

cd /d "%~dp0"

echo Creating default Admin account...
echo.

node create-default-admin.js

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ADMIN ACCOUNT SETUP FAILED
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ADMIN ACCOUNT READY
echo ========================================
echo.
echo Email:    admin@reachandteach.com
echo Password: Admin123!
echo Username: admin
echo.
echo You can now log in at:
echo http://localhost:3000/admin/
echo.
pause
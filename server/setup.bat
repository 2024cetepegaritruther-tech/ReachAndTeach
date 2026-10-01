@echo off

echo ========================================
echo   REACH AND TEACH SERVER SETUP
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Node.js...
node --version

if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed.
    echo Please install Node.js first.
    pause
    exit /b 1
)

echo.
echo Installing server dependencies...
call npm.cmd install

if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo Starting Reach and Teach server...
echo.

call npm.cmd start

pause
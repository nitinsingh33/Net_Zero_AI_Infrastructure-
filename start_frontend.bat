@echo off
echo ============================================
echo   CarbonGate - Net-Zero AI Gateway
echo   Starting Frontend (React + Vite)
echo ============================================
echo.

cd /d "%~dp0client"

echo [1/2] Checking Node.js...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

echo.
echo [2/2] Starting CarbonGate frontend on http://localhost:5173
echo       Press Ctrl+C to stop
echo.
npm run dev
pause

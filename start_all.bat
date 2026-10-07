@echo off
echo ============================================
echo   CarbonGate - Full Stack Startup
echo   Starting BOTH backend and frontend
echo ============================================
echo.
echo Starting Backend (port 8000)...
start "CarbonGate Backend" cmd /k "cd /d %~dp0server && python main.py"

timeout /t 3 /nobreak > nul

echo Starting Frontend (port 5173)...
start "CarbonGate Frontend" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ============================================
echo   CarbonGate is starting!
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Both windows will open automatically.
echo ============================================
pause

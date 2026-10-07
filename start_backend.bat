@echo off
echo ============================================
echo   CarbonGate - Net-Zero AI Gateway
echo   Starting Backend (FastAPI + Python)
echo ============================================
echo.

cd /d "%~dp0server"

echo [1/3] Checking Python...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.11+
    pause
    exit /b 1
)

echo.
echo [2/3] Installing/checking dependencies...
pip install fastapi "uvicorn[standard]" pydantic chromadb ollama httpx numpy scikit-learn python-dotenv aiofiles -q

echo.
echo [3/3] Starting CarbonGate backend on http://localhost:8000
echo       API docs: http://localhost:8000/docs
echo       Press Ctrl+C to stop
echo.
python main.py
pause

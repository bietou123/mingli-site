@echo off
rem ============================================
rem Xuanjige launcher (Windows)
rem Opens on http://127.0.0.1:8090
rem ============================================
cd /d "%~dp0backend"

where python >nul 2>nul
if errorlevel 1 (
  echo [error] python not found. Install Python 3.10+ first.
  pause
  exit /b 1
)

python -m pip show fastapi uvicorn >nul 2>nul
if errorlevel 1 (
  echo [first run] installing fastapi / uvicorn ...
  python -m pip install -r requirements.txt
)

echo.
echo Xuanjige is starting at http://127.0.0.1:8090
echo Press Ctrl+C to stop.
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8090
pause

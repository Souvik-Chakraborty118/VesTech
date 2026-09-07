@echo off
echo =========================================
echo   Starting BinGo AI Backend (FastAPI)
echo =========================================
call .venv\Scripts\activate.bat
cd backend_python
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
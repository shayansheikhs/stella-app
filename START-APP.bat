@echo off
title Stella + AI Connect Server
cd /d "%~dp0"

echo.
echo  ========================================
echo   Stella App - Local Server
echo  ========================================
echo.
echo  Chat:      http://localhost:8080/
echo  Teaching:  http://localhost:8080/teaching/
echo  Admin:     http://localhost:8080/admin.html
echo.
echo  Band karne ke liye: is window mein Ctrl+C dabao
echo  ========================================
echo.

start "" "http://localhost:8080/home.html"
timeout /t 2 /nobreak >nul

where python >nul 2>&1
if %errorlevel%==0 (
    python -m http.server 8080
    goto end
)

where py >nul 2>&1
if %errorlevel%==0 (
    py -m http.server 8080
    goto end
)

echo ERROR: Python nahi mila. Python install karein ya Cursor se help lein.
pause

:end

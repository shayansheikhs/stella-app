@echo off
title Phone se kaise use karein
cd /d "%~dp0"

echo.
echo  ========================================
echo   Phone se App kaise kholein
echo  ========================================
echo.
echo  STEP 1: Pehle START-APP.bat chalao (server on ho)
echo.
echo  STEP 2: PC aur Phone SAME WiFi par hon
echo.
echo  STEP 3: Neeche wala link phone browser mein likho:
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo    http://%%b:8080/teaching/
        echo    http://%%b:8080/
        echo    http://%%b:8080/admin.html
    )
)

echo.
echo  NOTE: PC band = app band. Internet par 24/7 ke liye
echo        HOSTING-GUIDE.txt parho (GitHub Pages - free)
echo  ========================================
echo.
pause

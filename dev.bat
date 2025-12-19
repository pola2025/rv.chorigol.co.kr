@echo off
echo ========================================
echo   초호펜션 관리 시스템 - 개발 서버 시작
echo ========================================
echo.

REM 프로세스 정리
echo [1/3] 기존 프로세스 정리 중...
taskkill /F /IM node.exe >nul 2>&1

REM 캐시 정리
echo [2/3] 캐시 정리 중...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"

REM 개발 서버 시작
echo [3/3] 개발 서버 시작 중...
echo.
echo 접속 주소: http://localhost:5173
echo 종료하려면 Ctrl+C를 누르세요.
echo.
npm run dev

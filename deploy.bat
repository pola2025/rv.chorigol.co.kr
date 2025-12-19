@echo off
echo ========================================
echo 초호펜션 관리시스템 배포 시작
echo ========================================
echo.

echo [1/3] 빌드 시작...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 빌드 실패
    pause
    exit /b %errorlevel%
)
echo ✅ 빌드 완료
echo.

echo [2/3] Firebase 배포 시작...
call firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo ❌ 배포 실패
    pause
    exit /b %errorlevel%
)
echo ✅ 배포 완료
echo.

echo ========================================
echo 🎉 배포가 성공적으로 완료되었습니다!
echo ========================================
echo.
echo 📌 접속 URL: https://choho-pension.web.app
echo.
pause
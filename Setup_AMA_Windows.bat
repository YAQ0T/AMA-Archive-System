@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

set "BACKEND_DIR=%APP_DIR%\backend\Archiev-Back"
set "FRONTEND_DIR=%APP_DIR%\frontend\achive-front"
set "RUNTIME_DIR=%APP_DIR%\.runtime"
set "LOG_DIR=%RUNTIME_DIR%\logs"
set "PID_DIR=%RUNTIME_DIR%\pids"
set "MONGO_DATA_DIR=%USERPROFILE%\data\db"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%PID_DIR%" mkdir "%PID_DIR%"
if not exist "%MONGO_DATA_DIR%" mkdir "%MONGO_DATA_DIR%"

where node >nul 2>&1
if errorlevel 1 (
  echo Missing required dependency: Node.js
  echo Install Node.js LTS from https://nodejs.org/
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Missing required dependency: npm
  echo Reinstall Node.js LTS from https://nodejs.org/
  goto :fail
)

echo Installing backend dependencies...
pushd "%BACKEND_DIR%"
call npm install
if errorlevel 1 (
  popd
  goto :fail
)

if not exist ".env" (
  > ".env" (
    echo PORT=4000
    echo MONGO_URI=mongodb://127.0.0.1:27017/ama-archive
    echo UPLOAD_DIR=uploads
  )
  echo Created backend .env with local defaults.
)

popd

echo Installing frontend dependencies...
pushd "%FRONTEND_DIR%"
call npm install
if errorlevel 1 (
  popd
  goto :fail
)

echo Building frontend for production...
call npm run build
if errorlevel 1 (
  popd
  goto :fail
)

popd

echo.
echo Setup completed successfully.
echo Next: double-click Start_AMA_Windows.bat
pause
exit /b 0

:fail
echo.
echo Setup failed. Check errors above and run again.
pause
exit /b 1

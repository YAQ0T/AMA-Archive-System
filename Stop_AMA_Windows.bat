@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

set "PID_DIR=%APP_DIR%\.runtime\pids"
set "BACKEND_PID_FILE=%PID_DIR%\backend.pid"
set "MONGO_PID_FILE=%PID_DIR%\mongod.pid"

call :stop_pid_file "%BACKEND_PID_FILE%" "backend"
call :stop_pid_file "%MONGO_PID_FILE%" "mongodb"

echo AMA Archive stop script completed.
pause
exit /b 0

:stop_pid_file
set "PID_FILE=%~1"
set "LABEL=%~2"

if not exist "%PID_FILE%" exit /b 0

set "PID_VALUE="
for /f "usebackq delims=" %%P in ("%PID_FILE%") do set "PID_VALUE=%%P"

if "%PID_VALUE%"=="" (
  del /q "%PID_FILE%" >nul 2>&1
  exit /b 0
)

call :is_pid_running %PID_VALUE%
if not errorlevel 1 (
  echo Stopping %LABEL% ^(PID %PID_VALUE%^)...
  taskkill /PID %PID_VALUE% /T >nul 2>&1
  if errorlevel 1 taskkill /PID %PID_VALUE% /T /F >nul 2>&1
)

del /q "%PID_FILE%" >nul 2>&1
exit /b 0

:is_pid_running
tasklist /FI "PID eq %~1" | findstr /I /C:"%~1" >nul 2>&1
exit /b %errorlevel%

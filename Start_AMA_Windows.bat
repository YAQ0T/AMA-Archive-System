@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

set "BACKEND_DIR=%APP_DIR%\backend\Archiev-Back"
set "FRONTEND_DIR=%APP_DIR%\frontend\achive-front"
set "RUNTIME_DIR=%APP_DIR%\.runtime"
set "LOG_DIR=%RUNTIME_DIR%\logs"
set "PID_DIR=%RUNTIME_DIR%\pids"
set "BACKEND_ENV=%BACKEND_DIR%\.env"
set "DEFAULT_LOCAL_MONGO_DBPATH=%USERPROFILE%\data\db"

if "%AMA_MONGO_DBPATH%"=="" (
  set "MONGO_DATA_DIR=%DEFAULT_LOCAL_MONGO_DBPATH%"
) else (
  set "MONGO_DATA_DIR=%AMA_MONGO_DBPATH%"
)

set "BACKEND_PORT=4000"
set "MONGO_PORT=27017"
set "APP_URL=http://localhost:%BACKEND_PORT%"
set "FRONTEND_DIST_DIR=%FRONTEND_DIR%\dist"
set "BACKEND_OUT_LOG=%LOG_DIR%\backend.out.log"
set "BACKEND_ERR_LOG=%LOG_DIR%\backend.err.log"
set "MONGO_LOG=%LOG_DIR%\mongod.log"
set "BACKEND_PID_FILE=%PID_DIR%\backend.pid"
set "MONGO_PID_FILE=%PID_DIR%\mongod.pid"

set "PS=powershell -NoProfile -ExecutionPolicy Bypass"

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

if not exist "%BACKEND_DIR%\node_modules" (
  echo Backend dependencies not found. Installing...
  pushd "%BACKEND_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    goto :fail
  )
  popd
)

call :ensure_backend_env
call :read_mongo_uri
call :ensure_frontend_build
if errorlevel 1 goto :fail

if "%NEEDS_LOCAL_MONGO%"=="1" (
  call :start_mongodb
  if errorlevel 1 goto :fail
) else (
  echo Using external MongoDB from MONGO_URI. Skipping local MongoDB startup.
)

call :start_backend
if errorlevel 1 goto :fail

set "AMA_HEALTH_URL=%APP_URL%/api/health"
set "AMA_HEALTH_RETRIES=45"
%PS% -Command "$ok=$false; $url=$env:AMA_HEALTH_URL; $tries=[int]$env:AMA_HEALTH_RETRIES; for($i=0;$i -lt $tries;$i++){ try { $null = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5; $ok=$true; break } catch { Start-Sleep -Seconds 1 } }; if($ok){ exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Backend failed to start. Last backend stdout log lines:
  %PS% -Command "if(Test-Path $env:BACKEND_OUT_LOG){ Get-Content -Tail 40 $env:BACKEND_OUT_LOG }"
  echo.
  echo Last backend stderr log lines:
  %PS% -Command "if(Test-Path $env:BACKEND_ERR_LOG){ Get-Content -Tail 40 $env:BACKEND_ERR_LOG }"
  goto :fail
)

echo AMA Archive is ready at %APP_URL%
if "%AMA_NO_OPEN%"=="1" (
  echo Browser auto-open skipped ^(AMA_NO_OPEN=1^).
) else (
  start "" "%APP_URL%"
)

exit /b 0

:ensure_backend_env
if not exist "%BACKEND_ENV%" (
  > "%BACKEND_ENV%" (
    echo PORT=4000
    echo MONGO_URI=mongodb://127.0.0.1:27017/ama-archive
    echo UPLOAD_DIR=uploads
  )
  echo Created backend .env with local defaults.
)
exit /b 0

:read_mongo_uri
set "MONGO_URI_VALUE="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /I "MONGO_URI=" "%BACKEND_ENV%"`) do (
  set "MONGO_URI_VALUE=%%B"
)

set "NEEDS_LOCAL_MONGO=1"
if not "%MONGO_URI_VALUE%"=="" (
  echo %MONGO_URI_VALUE% | findstr /I "localhost 127.0.0.1" >nul
  if errorlevel 1 set "NEEDS_LOCAL_MONGO=0"
)
exit /b 0

:ensure_frontend_build
if exist "%FRONTEND_DIST_DIR%\index.html" exit /b 0

echo Frontend build not found. Building now...
pushd "%FRONTEND_DIR%"
if not exist "%FRONTEND_DIR%\node_modules" (
  call npm install
  if errorlevel 1 (
    popd
    exit /b 1
  )
)
call npm run build
if errorlevel 1 (
  popd
  exit /b 1
)
popd
exit /b 0

:start_mongodb
netstat -ano | findstr /R /C:":%MONGO_PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo MongoDB is already running on port %MONGO_PORT%.
  exit /b 0
)

where mongod >nul 2>&1
if errorlevel 1 (
  echo Missing required dependency: mongod
  echo Install MongoDB Community Server from https://www.mongodb.com/try/download/community
  exit /b 1
)

echo Starting MongoDB using dbpath: %MONGO_DATA_DIR%
if not exist "%MONGO_DATA_DIR%" mkdir "%MONGO_DATA_DIR%"

set "AMA_MONGO_DATA_DIR=%MONGO_DATA_DIR%"
set "AMA_MONGO_LOG=%MONGO_LOG%"
set "AMA_MONGO_PORT=%MONGO_PORT%"
set "AMA_MONGO_PID_FILE=%MONGO_PID_FILE%"

%PS% -Command "$p = Start-Process -FilePath 'mongod' -ArgumentList '--dbpath',$env:AMA_MONGO_DATA_DIR,'--logpath',$env:AMA_MONGO_LOG,'--logappend','--bind_ip','127.0.0.1','--port',$env:AMA_MONGO_PORT -WindowStyle Hidden -PassThru; Set-Content -Path $env:AMA_MONGO_PID_FILE -Value $p.Id"

timeout /t 2 /nobreak >nul

netstat -ano | findstr /R /C:":%MONGO_PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo MongoDB started.
  exit /b 0
)

findstr /I /C:"Permission denied" "%MONGO_LOG%" >nul 2>&1
if not errorlevel 1 (
  echo MongoDB failed due to file permissions in %MONGO_DATA_DIR%.
  echo Run this once in Command Prompt as Administrator:
  echo   icacls "%MONGO_DATA_DIR%" /grant "%USERNAME%":F /T
  echo Then run Start_AMA_Windows.bat again.
  exit /b 1
)

echo Could not start MongoDB automatically.
echo Check mongod installation and try again.
exit /b 1

:start_backend
if exist "%BACKEND_PID_FILE%" (
  set "BACKEND_PID="
  for /f "usebackq delims=" %%P in ("%BACKEND_PID_FILE%") do set "BACKEND_PID=%%P"
  if not "!BACKEND_PID!"=="" (
    tasklist /FI "PID eq !BACKEND_PID!" | findstr /I /C:"!BACKEND_PID!" >nul 2>&1
    if not errorlevel 1 (
      echo Backend already running ^(PID !BACKEND_PID!^).
      exit /b 0
    )
  )
  del /q "%BACKEND_PID_FILE%" >nul 2>&1
)

netstat -ano | findstr /R /C:":%BACKEND_PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo Backend already listening on port %BACKEND_PORT%.
  exit /b 0
)

echo Starting backend...
set "AMA_BACKEND_DIR=%BACKEND_DIR%"
set "AMA_BACKEND_OUT_LOG=%BACKEND_OUT_LOG%"
set "AMA_BACKEND_ERR_LOG=%BACKEND_ERR_LOG%"
set "AMA_BACKEND_PID_FILE=%BACKEND_PID_FILE%"
set "AMA_FRONTEND_DIST_DIR=%FRONTEND_DIST_DIR%"

%PS% -Command "$env:NODE_ENV='production'; $env:FRONTEND_DIST_DIR=$env:AMA_FRONTEND_DIST_DIR; $p = Start-Process -FilePath 'node' -ArgumentList 'index.js' -WorkingDirectory $env:AMA_BACKEND_DIR -RedirectStandardOutput $env:AMA_BACKEND_OUT_LOG -RedirectStandardError $env:AMA_BACKEND_ERR_LOG -WindowStyle Hidden -PassThru; Set-Content -Path $env:AMA_BACKEND_PID_FILE -Value $p.Id"

if errorlevel 1 exit /b 1
exit /b 0

:fail
echo.
echo Startup failed. Fix errors above, then run again.
pause
exit /b 1

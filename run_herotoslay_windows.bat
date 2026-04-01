@echo off
setlocal EnableExtensions

set "REPO_URL=https://github.com/Ruy41321/HeroToSlay_WebTableSimulator.git"
set "REPO_DIR=HeroToSlay_WebTableSimulator"
set "COMPOSE_FILE=HtS_Docker/docker-compose.yml"
set "NODE_IMAGE=node:20-alpine"
set "NO_PULL=0"
set "NO_WAIT=0"
set "TARGET_BRANCH="
set "COMPOSE_STANDALONE=0"

:parse_args
if "%~1"=="" goto args_done

if /I "%~1"=="--no-pull" (
  set "NO_PULL=1"
  shift
  goto parse_args
)

if /I "%~1"=="--branch" (
  if "%~2"=="" call :fatal "Missing value for --branch"
  set "TARGET_BRANCH=%~2"
  shift
  shift
  goto parse_args
)

if /I "%~1"=="--repo-dir" (
  if "%~2"=="" call :fatal "Missing value for --repo-dir"
  set "REPO_DIR=%~2"
  shift
  shift
  goto parse_args
)

if /I "%~1"=="--repo-url" (
  if "%~2"=="" call :fatal "Missing value for --repo-url"
  set "REPO_URL=%~2"
  shift
  shift
  goto parse_args
)

if /I "%~1"=="--no-wait" (
  set "NO_WAIT=1"
  shift
  goto parse_args
)

if /I "%~1"=="--help" goto show_help
if /I "%~1"=="-h" goto show_help

call :fatal "Unknown option: %~1"

:args_done
echo [1/4] Checking prerequisites...

where docker >nul 2>nul
if errorlevel 1 call :fatal "'docker' not found. Please install it and try again."

where docker-compose >nul 2>nul
if not errorlevel 1 (
  echo [OK] Found docker-compose ^(standalone^).
  set "COMPOSE_STANDALONE=1"
) else (
  docker compose version >nul 2>nul
  if errorlevel 1 (
    call :fatal "Neither 'docker-compose' nor 'docker compose' is available."
  )
  echo [OK] Found docker compose ^(plugin^).
)

where git >nul 2>nul
if errorlevel 1 (
  set "HAS_GIT=0"
) else (
  set "HAS_GIT=1"
)

echo [2/4] Downloading/updating repository...
if exist "%REPO_DIR%\" (
  echo [INFO] Directory '%REPO_DIR%' already exists.

  if "%HAS_GIT%"=="1" (
    if exist "%REPO_DIR%\.git\" (
      if "%NO_PULL%"=="0" (
        if not "%TARGET_BRANCH%"=="" (
          echo [INFO] Updating branch '%TARGET_BRANCH%'...
          git -C "%REPO_DIR%" fetch origin && git -C "%REPO_DIR%" checkout "%TARGET_BRANCH%" && git -C "%REPO_DIR%" pull --ff-only origin "%TARGET_BRANCH%"
          if errorlevel 1 call :warn "Branch update failed. Continuing startup anyway."
        ) else (
          echo [INFO] Running git pull to update repository...
          git -C "%REPO_DIR%" pull --ff-only
          if errorlevel 1 call :warn "git pull failed. Continuing startup anyway."
        )
      ) else (
        echo [INFO] Existing repository: update disabled ^(--no-pull^).
      )
    ) else (
      call :warn "Directory exists but has no .git folder. Skipping update."
    )
  ) else (
    call :warn "git is not installed: cannot run git pull for updates. Continuing startup anyway."
    if not "%TARGET_BRANCH%"=="" (
      call :warn "Requested branch '%TARGET_BRANCH%' but git is unavailable: using local files as-is."
    )
  )
) else (
  if not "%HAS_GIT%"=="1" call :fatal "git is not installed and directory '%REPO_DIR%' is missing: cannot clone repository."

  echo [INFO] Cloning repository...
  if not "%TARGET_BRANCH%"=="" (
    git clone --branch "%TARGET_BRANCH%" --single-branch "%REPO_URL%" "%REPO_DIR%"
  ) else (
    git clone "%REPO_URL%" "%REPO_DIR%"
  )

  if errorlevel 1 call :fatal "git clone failed."
)

echo [3/4] Starting project...
pushd "%REPO_DIR%" >nul 2>nul
if errorlevel 1 call :fatal "Cannot access repository directory '%REPO_DIR%'."

docker run --rm -v "%CD%:/workspace" -w /workspace/Srcs %NODE_IMAGE% node indexer.js
if errorlevel 1 (
  popd
  call :fatal "Index generation failed. Be sure to have imported the card assets as specified in the README."
)

call :run_compose stop simulator >nul 2>nul
if errorlevel 1 call :warn "Could not stop simulator (it may not be running). Continuing."

call :run_compose --profile test down --remove-orphans
if errorlevel 1 goto compose_failed

call :run_compose build simulator
if errorlevel 1 goto compose_failed

call :run_compose --profile test build test
if errorlevel 1 goto compose_failed

call :run_compose up -d simulator
if errorlevel 1 goto compose_failed

set "SERVICES_TMP=%TEMP%\hts_running_services_%RANDOM%.txt"
call :run_compose ps --services --status running > "%SERVICES_TMP%"
if errorlevel 1 (
  del /q "%SERVICES_TMP%" >nul 2>nul
  popd
  call :fatal "Unable to verify running services."
)

findstr /I /R "^simulator$" "%SERVICES_TMP%" >nul
del /q "%SERVICES_TMP%" >nul 2>nul
if errorlevel 1 (
  popd
  call :fatal "Startup completed but 'simulator' is not running. Check docker logs."
)

popd

echo [4/4] Done.
echo The server is available at 'localhost:80'.

if "%NO_WAIT%"=="0" (
  set /p "_PRESS=Press ENTER to close..."
)

exit /b 0

:compose_failed
popd
call :fatal "Docker compose command failed. Check output above."

:show_help
echo Usage: %~nx0 [options]
echo.
echo Options:
echo   --no-pull            If repo exists, skip git pull
echo   --branch ^<name^>      Branch to clone/update
echo   --repo-dir ^<dir^>     Local repository directory (default: %REPO_DIR%)
echo   --repo-url ^<url^>     Repository URL to clone (default: %REPO_URL%)
echo   --no-wait            Do not wait for ENTER before exiting
echo   -h, --help           Show this help
exit /b 0

:run_compose
if "%COMPOSE_STANDALONE%"=="1" (
  docker-compose -f "%COMPOSE_FILE%" %*
) else (
  docker compose -f "%COMPOSE_FILE%" %*
)
exit /b %errorlevel%

:warn
echo [WARNING] %~1
exit /b 0

:fatal
echo [ERROR] %~1
echo.
echo Press any key to close...
pause >nul
goto __script_exit_error

:__script_exit_error
exit /b 1

@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ─────────────────────────────────────────────────────────────────────────────
:: J.A.R.V.I.S. — Playwright Automation Intelligence  •  Windows Setup & Launcher
:: Supports: Windows 10 1903+ / Windows 11
:: Requires: Node.js >=20  (auto-detected, install prompted if missing)
:: ─────────────────────────────────────────────────────────────────────────────

:: Enable ANSI / VT100 colour in this console session
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1

:: Build ESC character for ANSI sequences
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_CYAN=%ESC%[96m"
set "C_BCYAN=%ESC%[1;96m"
set "C_GREEN=%ESC%[92m"
set "C_YELLOW=%ESC%[93m"
set "C_RED=%ESC%[91m"
set "C_WHITE=%ESC%[1;37m"
set "C_DIM=%ESC%[2m"
set "C_BOLD=%ESC%[1m"
set "C_RST=%ESC%[0m"

:: ─── Project root = folder containing this .bat ───────────────────────────────
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

:: ─────────────────────────────────────────────────────────────────────────────
:: ENTRY POINT
:: ─────────────────────────────────────────────────────────────────────────────
call :check_first_run
call :main_loop
goto :eof

:: ═════════════════════════════════════════════════════════════════════════════
:check_first_run
:: ═════════════════════════════════════════════════════════════════════════════
    if not exist "node_modules\" (
        call :banner
        echo  %C_YELLOW%First run detected — running setup wizard...%C_RST%
        echo.
        call :do_setup
    )
    goto :eof

:: ═════════════════════════════════════════════════════════════════════════════
:main_loop
:: ═════════════════════════════════════════════════════════════════════════════
:loop_top
    call :banner
    call :show_menu
    echo.
    set "choice="
    set /p "choice=  %C_BCYAN%JARVIS %C_RST%Enter option: "
    echo.
    call :dispatch "!choice!"
    goto loop_top

:: ═════════════════════════════════════════════════════════════════════════════
:banner
:: ═════════════════════════════════════════════════════════════════════════════
    cls
    for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
    if not defined NODE_VER set "NODE_VER=NOT FOUND"
    echo.
    echo  %C_BCYAN%╔═══════════════════════════════════════════════════════════════╗%C_RST%
    echo  %C_BCYAN%║                                                               ║%C_RST%
    echo  %C_BCYAN%║   ░░░  J.A.R.V.I.S.  AUTOMATION  INTELLIGENCE  v2.0  ░░░    ║%C_RST%
    echo  %C_BCYAN%║         Just A Rather Very Intelligent System                 ║%C_RST%
    echo  %C_BCYAN%║                                                               ║%C_RST%
    echo  %C_BCYAN%║   Playwright  ·  TypeScript  ·  Allure  ·  Grafana           ║%C_RST%
    echo  %C_BCYAN%║   Docker  ·  GitHub Actions  ·  GenAI v5  ·  AI Ops          ║%C_RST%
    echo  %C_BCYAN%║                                                               ║%C_RST%
    echo  %C_BCYAN%╚═══════════════════════════════════════════════════════════════╝%C_RST%
    echo.
    echo  %C_DIM%Dir: %PROJECT_DIR%  ^|  Node: %NODE_VER%%C_RST%
    echo.
    goto :eof

:: ═════════════════════════════════════════════════════════════════════════════
:show_menu
:: ═════════════════════════════════════════════════════════════════════════════
    echo  %C_WHITE%── SETUP ────────────────────────────────────────────────────────%C_RST%
    echo  %C_CYAN%[1]%C_RST%  Install / Update all dependencies
    echo  %C_CYAN%[2]%C_RST%  Install Playwright browsers  %C_DIM%(chromium + firefox + webkit + edge)%C_RST%
    echo  %C_CYAN%[3]%C_RST%  Setup .env file  %C_DIM%(copy from .env.example)%C_RST%
    echo.
    echo  %C_WHITE%── TEST EXECUTION ───────────────────────────────────────────────%C_RST%
    echo  %C_CYAN%[4]%C_RST%  Run ALL tests  %C_DIM%(ui + api + hybrid — headless)%C_RST%
    echo  %C_CYAN%[5]%C_RST%  Run UI tests only  %C_DIM%(Chrome headless)%C_RST%
    echo  %C_CYAN%[6]%C_RST%  Run UI tests headed  %C_DIM%(watch browser)%C_RST%
    echo  %C_CYAN%[7]%C_RST%  Run API tests only
    echo  %C_CYAN%[8]%C_RST%  Run Hybrid tests only
    echo  %C_CYAN%[9]%C_RST%  Run in debug mode  %C_DIM%(step-through)%C_RST%
    echo.
    echo  %C_WHITE%── BROWSER MATRIX ───────────────────────────────────────────────%C_RST%
    echo  %C_CYAN%[10]%C_RST% Run UI – Chrome (Chromium)
    echo  %C_CYAN%[11]%C_RST% Run UI – Firefox
    echo  %C_CYAN%[12]%C_RST% Run UI – Safari (WebKit)
    echo  %C_CYAN%[13]%C_RST% Run UI – Microsoft Edge
    echo  %C_CYAN%[14]%C_RST% Run UI – All browsers  %C_DIM%(matrix)%C_RST%
    echo.
    echo  %C_WHITE%── REPORTS ──────────────────────────────────────────────────────%C_RST%
    echo  %C_CYAN%[15]%C_RST% Open Playwright HTML report
    echo  %C_CYAN%[16]%C_RST% Generate Allure report
    echo  %C_CYAN%[17]%C_RST% Serve Allure report  %C_DIM%(live, opens browser)%C_RST%
    echo  %C_CYAN%[18]%C_RST% Open JARVIS dashboard  %C_DIM%(http://localhost:9090)%C_RST%
    echo.
    echo  %C_WHITE%── GEN AI SUPERPOWERS ───────────────────────────────────────────%C_RST%
    echo  %C_CYAN%[20]%C_RST% Run AI demo tests  %C_DIM%(self-heal + visual + data)%C_RST%
    echo  %C_CYAN%[21]%C_RST% Generate spec from user story
    echo  %C_CYAN%[22]%C_RST% Generate spec from natural language
    echo  %C_CYAN%[23]%C_RST% Generate AI test data  %C_DIM%(user / product / searchTerms)%C_RST%
    echo  %C_CYAN%[24]%C_RST% Capture visual baselines
    echo  %C_CYAN%[25]%C_RST% AI Test Recorder  %C_DIM%(browser actions → spec)%C_RST%
    echo  %C_CYAN%[26]%C_RST% Start AI Ops Dashboard  %C_DIM%(http://localhost:9093)%C_RST%
    echo.
    echo  %C_WHITE%── UTILITIES ────────────────────────────────────────────────────%C_RST%
    echo  %C_CYAN%[30]%C_RST% TypeScript type-check
    echo  %C_CYAN%[31]%C_RST% Clean all artifacts  %C_DIM%(reports, logs, results)%C_RST%
    echo  %C_CYAN%[32]%C_RST% Check prerequisites
    echo.
    echo  %C_CYAN%[0]%C_RST%  Exit
    goto :eof

:: ═════════════════════════════════════════════════════════════════════════════
:dispatch
:: ═════════════════════════════════════════════════════════════════════════════
    set "opt=%~1"

    if "%opt%"=="0"  goto :exit_jarvis
    if "%opt%"=="1"  call :opt_npm_install        & goto :pause_continue
    if "%opt%"=="2"  call :opt_pw_browsers         & goto :pause_continue
    if "%opt%"=="3"  call :opt_setup_env           & goto :pause_continue
    if "%opt%"=="4"  call :opt_test_all            & goto :pause_continue
    if "%opt%"=="5"  call :opt_test_ui             & goto :pause_continue
    if "%opt%"=="6"  call :opt_test_ui_headed      & goto :pause_continue
    if "%opt%"=="7"  call :opt_test_api            & goto :pause_continue
    if "%opt%"=="8"  call :opt_test_hybrid         & goto :pause_continue
    if "%opt%"=="9"  call :opt_test_debug          & goto :pause_continue
    if "%opt%"=="10" call :opt_test_chrome         & goto :pause_continue
    if "%opt%"=="11" call :opt_test_firefox        & goto :pause_continue
    if "%opt%"=="12" call :opt_test_webkit         & goto :pause_continue
    if "%opt%"=="13" call :opt_test_edge           & goto :pause_continue
    if "%opt%"=="14" call :opt_test_browsers       & goto :pause_continue
    if "%opt%"=="15" call :opt_report_pw           & goto :pause_continue
    if "%opt%"=="16" call :opt_allure_gen          & goto :pause_continue
    if "%opt%"=="17" call :opt_allure_serve        & goto :pause_continue
    if "%opt%"=="18" call :opt_jarvis_dash         & goto :pause_continue
    if "%opt%"=="20" call :opt_ai_tests            & goto :pause_continue
    if "%opt%"=="21" call :opt_ai_gen_story        & goto :pause_continue
    if "%opt%"=="22" call :opt_ai_gen_nl           & goto :pause_continue
    if "%opt%"=="23" call :opt_ai_gen_data         & goto :pause_continue
    if "%opt%"=="24" call :opt_ai_baselines        & goto :pause_continue
    if "%opt%"=="25" call :opt_ai_recorder        & goto :pause_continue
    if "%opt%"=="26" call :opt_ai_ops              & goto :pause_continue
    if "%opt%"=="30" call :opt_typecheck           & goto :pause_continue
    if "%opt%"=="31" call :opt_clean               & goto :pause_continue
    if "%opt%"=="32" call :check_prereqs_verbose   & goto :pause_continue

    echo  %C_YELLOW%[!]  Unknown option: %opt%%C_RST%
    timeout /t 1 >nul
    goto :eof

:pause_continue
    echo.
    echo  %C_DIM%Press any key to return to menu...%C_RST%
    pause >nul
    goto :eof

:: ─────────────────────────────────────────────────────────────────────────────
:: SETUP OPTIONS
:: ─────────────────────────────────────────────────────────────────────────────

:do_setup
    call :check_node
    call :opt_npm_install
    call :opt_setup_env
    echo.
    echo  %C_GREEN%[✔]  Setup complete! Installing Playwright browsers...%C_RST%
    echo.
    call :opt_pw_browsers
    echo.
    echo  %C_BCYAN%[✔]  JARVIS is ready. Press any key to launch the menu.%C_RST%
    pause >nul
    goto :eof

:check_node
    echo  %C_CYAN%[i]%C_RST%  Checking Node.js...
    node --version >nul 2>&1
    if errorlevel 1 (
        echo  %C_YELLOW%[!]  Node.js not found. Attempting install via winget...%C_RST%
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        if errorlevel 1 (
            echo  %C_RED%[✘]  winget install failed.%C_RST%
            echo  %C_YELLOW%     Please install Node.js ^>=20 manually:%C_RST%
            echo  %C_CYAN%     https://nodejs.org/en/download%C_RST%
            echo.
            pause
            exit /b 1
        )
        :: Refresh PATH so node is available in this session
        for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%b"
        for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=!PATH!;%%b"
    )
    for /f "tokens=*" %%v in ('node -v') do echo  %C_GREEN%[✔]%C_RST%  Node.js %%v found
    goto :eof

:check_java
    java --version >nul 2>&1
    if errorlevel 1 (
        echo  %C_YELLOW%[!]  Java not found — Allure requires Java 8+.%C_RST%
        echo  %C_YELLOW%     Install: https://adoptium.net  or  winget install EclipseAdoptium.Temurin.21.JDK%C_RST%
        exit /b 1
    )
    goto :eof

:opt_npm_install
    echo  %C_CYAN%[i]%C_RST%  Installing npm dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo  %C_RED%[✘]  npm install failed.%C_RST%
        exit /b 1
    )
    echo.
    echo  %C_GREEN%[✔]%C_RST%  Dependencies installed.
    goto :eof

:opt_pw_browsers
    echo  %C_CYAN%[i]%C_RST%  Installing Playwright browsers + OS dependencies...
    echo.
    call npx playwright install --with-deps
    if errorlevel 1 (
        echo  %C_YELLOW%[!]%C_RST%  Browser install returned non-zero. If browsers are already present this is fine.
    ) else (
        echo  %C_GREEN%[✔]%C_RST%  Playwright browsers ready.
    )
    goto :eof

:opt_setup_env
    if exist ".env" (
        echo  %C_DIM%[i]  .env already exists — skipping copy.%C_RST%
        goto :eof
    )
    if not exist ".env.example" (
        echo  %C_YELLOW%[!]  .env.example not found — cannot create .env.%C_RST%
        goto :eof
    )
    copy ".env.example" ".env" >nul
    echo  %C_GREEN%[✔]%C_RST%  .env created from .env.example
    echo.
    echo  %C_YELLOW%     ACTION REQUIRED — open .env and fill in:%C_RST%
    echo  %C_YELLOW%     • ANTHROPIC_API_KEY   (for Claude AI features)%C_RST%
    echo  %C_YELLOW%     • LANGCHAIN_API_KEY   (for LangSmith tracing — free at smith.langchain.com)%C_RST%
    echo  %C_YELLOW%     • ADMIN_SECRET        (AI Ops dashboard password)%C_RST%
    echo.
    set /p "openv=  Open .env in Notepad now? [Y/n]: "
    if /i not "!openv!"=="n" notepad ".env"
    goto :eof

:check_prereqs_verbose
    echo  %C_BCYAN%── Prerequisite Check ──────────────────────────────────────────%C_RST%
    echo.
    call :_check_tool "node"    "Node.js"    "https://nodejs.org/en/download"
    call :_check_tool "npm"     "npm"        "(bundled with Node.js)"
    call :_check_tool "npx"     "npx"        "(bundled with Node.js)"
    call :_check_tool "java"    "Java"       "https://adoptium.net"
    call :_check_tool "allure"  "Allure CLI" "npm install -g allure-commandline"
    call :_check_tool "docker"  "Docker"     "https://www.docker.com/products/docker-desktop"
    call :_check_tool "ollama"  "Ollama"     "https://ollama.com/download"
    goto :eof

:_check_tool
    %~1 --version >nul 2>&1
    if errorlevel 1 (
        echo  %C_RED%[✘]%C_RST%  %-12s not found  — install: %~3
    ) else (
        for /f "tokens=*" %%v in ('%~1 --version 2^>nul') do (
            echo  %C_GREEN%[✔]%C_RST%  %~2: %%v
            goto :_check_done_%~1
        )
        :_check_done_%~1
    )
    goto :eof

:: ─────────────────────────────────────────────────────────────────────────────
:: TEST EXECUTION
:: ─────────────────────────────────────────────────────────────────────────────

:opt_test_all
    echo  %C_CYAN%[i]%C_RST%  Running ALL tests (ui + api + hybrid)...
    echo.
    call npx playwright test
    goto :eof

:opt_test_ui
    echo  %C_CYAN%[i]%C_RST%  Running UI tests (Chrome headless)...
    echo.
    call npx playwright test --project=ui
    goto :eof

:opt_test_ui_headed
    echo  %C_CYAN%[i]%C_RST%  Running UI tests headed (watch browser)...
    echo.
    call npx playwright test --headed --project=ui
    goto :eof

:opt_test_api
    echo  %C_CYAN%[i]%C_RST%  Running API tests...
    echo.
    call npx playwright test --project=api
    goto :eof

:opt_test_hybrid
    echo  %C_CYAN%[i]%C_RST%  Running Hybrid tests...
    echo.
    call npx playwright test --project=hybrid
    goto :eof

:opt_test_debug
    echo  %C_CYAN%[i]%C_RST%  Launching Playwright Inspector (debug mode)...
    echo.
    call npx playwright test --debug
    goto :eof

:: ─── Browser Matrix ───────────────────────────────────────────────────────────

:opt_test_chrome
    echo  %C_CYAN%[i]%C_RST%  Running UI tests — Chrome (Chromium)...
    echo.
    call npx playwright test --project=ui
    goto :eof

:opt_test_firefox
    echo  %C_CYAN%[i]%C_RST%  Running UI tests — Firefox...
    echo.
    call npx playwright test --project=ui-firefox
    goto :eof

:opt_test_webkit
    echo  %C_CYAN%[i]%C_RST%  Running UI tests — Safari (WebKit)...
    echo.
    call npx playwright test --project=ui-webkit
    goto :eof

:opt_test_edge
    echo  %C_CYAN%[i]%C_RST%  Running UI tests — Microsoft Edge...
    echo.
    call npx playwright test --project=ui-edge
    goto :eof

:opt_test_browsers
    echo  %C_CYAN%[i]%C_RST%  Running UI tests — ALL browsers (matrix)...
    echo.
    call npx playwright test --project=ui --project=ui-firefox --project=ui-webkit --project=ui-edge
    goto :eof

:: ─────────────────────────────────────────────────────────────────────────────
:: REPORTS
:: ─────────────────────────────────────────────────────────────────────────────

:opt_report_pw
    echo  %C_CYAN%[i]%C_RST%  Opening Playwright HTML report...
    echo.
    call npx playwright show-report dashboard\playwright\report
    goto :eof

:opt_allure_gen
    call :check_java
    if errorlevel 1 goto :eof
    echo  %C_CYAN%[i]%C_RST%  Generating Allure report...
    echo.
    call npx allure generate dashboard\allure\results --clean -o dashboard\allure\report
    echo.
    echo  %C_GREEN%[✔]%C_RST%  Allure report generated at dashboard\allure\report
    echo  %C_DIM%     Run option 17 to open it in a browser.%C_RST%
    goto :eof

:opt_allure_serve
    call :check_java
    if errorlevel 1 goto :eof
    echo  %C_CYAN%[i]%C_RST%  Starting Allure server...
    echo.
    call npx allure serve dashboard\allure\results
    goto :eof

:opt_jarvis_dash
    echo  %C_CYAN%[i]%C_RST%  Starting JARVIS Dashboard...
    start "" "http://localhost:9090"
    start "JARVIS Dashboard" cmd /k "node dashboard\jarvis\server.js"
    echo  %C_GREEN%[✔]%C_RST%  JARVIS Dashboard started → http://localhost:9090
    goto :eof

:: ─────────────────────────────────────────────────────────────────────────────
:: GEN AI
:: ─────────────────────────────────────────────────────────────────────────────

:opt_ai_tests
    echo  %C_CYAN%[i]%C_RST%  Running AI demo tests (self-heal + visual + data)...
    echo  %C_DIM%     Workers=1 required for AI features (sequential LLM calls)%C_RST%
    echo.
    call npx playwright test --project=ai --workers=1
    goto :eof

:opt_ai_gen_story
    echo  %C_BCYAN%── GenAI: Generate Spec from User Story ────────────────────────%C_RST%
    echo.
    set "story="
    set /p "story=  Enter user story (Enter for default): "
    if "!story!"=="" set "story=As a user I want to search for products and add them to the cart"
    set "outfile="
    set /p "outfile=  Output file path (Enter to print only): "
    echo.
    if "!outfile!"=="" (
        call npx tsx core\scripts\generate-tests.ts --story "!story!"
    ) else (
        call npx tsx core\scripts\generate-tests.ts --story "!story!" --output "!outfile!"
    )
    goto :eof

:opt_ai_gen_nl
    echo  %C_BCYAN%── GenAI: Generate Spec from Natural Language ────────────────%C_RST%
    echo.
    set "nl="
    set /p "nl=  Enter instruction (e.g. 'test checkout flow'): "
    if "!nl!"=="" set "nl=test the product search and filter functionality"
    set "outfile="
    set /p "outfile=  Output file path (Enter to print only): "
    echo.
    if "!outfile!"=="" (
        call npx tsx core\scripts\generate-tests.ts --nl "!nl!"
    ) else (
        call npx tsx core\scripts\generate-tests.ts --nl "!nl!" --output "!outfile!"
    )
    goto :eof

:opt_ai_gen_data
    echo  %C_BCYAN%── GenAI: Generate Test Data ────────────────────────────────%C_RST%
    echo.
    set "dtype="
    set /p "dtype=  Type — user / product / searchTerms [user]: "
    if "!dtype!"=="" set "dtype=user"
    set "cnt="
    set /p "cnt=  Count [1]: "
    if "!cnt!"=="" set "cnt=1"
    set "outfile="
    set /p "outfile=  Output file path (Enter to print only): "
    echo.
    if "!outfile!"=="" (
        call npx tsx core\scripts\generate-test-data.ts --type "!dtype!" --count "!cnt!"
    ) else (
        call npx tsx core\scripts\generate-test-data.ts --type "!dtype!" --count "!cnt!" --output "!outfile!"
    )
    goto :eof

:opt_ai_baselines
    echo  %C_CYAN%[i]%C_RST%  Capturing visual baselines...
    echo.
    call npx playwright test --project=ai --grep baseline --workers=1
    goto :eof

:opt_ai_recorder
    echo  %C_BCYAN%── AI Test Recorder ────────────────────────────────────────%C_RST%
    echo.
    set "recurl="
    set /p "recurl=  Starting URL (Enter for default site): "
    set "recout="
    set /p "recout=  Output spec path (Enter to print only): "
    echo.
    echo  %C_CYAN%[i]%C_RST%  Browser will open. Perform your test steps, then press Ctrl+C to stop recording.
    echo.
    if "!recout!"=="" (
        if "!recurl!"=="" (
            call npx tsx core\scripts\record-test.ts
        ) else (
            call npx tsx core\scripts\record-test.ts --url "!recurl!"
        )
    ) else (
        if "!recurl!"=="" (
            call npx tsx core\scripts\record-test.ts --output "!recout!"
        ) else (
            call npx tsx core\scripts\record-test.ts --url "!recurl!" --output "!recout!"
        )
    )
    goto :eof

:opt_ai_ops
    echo  %C_BCYAN%── AI Ops Dashboard ────────────────────────────────────────%C_RST%
    echo.
    echo  %C_GREEN%[✔]%C_RST%  Starting AI Ops server → http://localhost:9093
    echo  %C_DIM%     Admin password: changeme  (set ADMIN_SECRET in .env to change)%C_RST%
    echo  %C_DIM%     Press Ctrl+C to stop.%C_RST%
    echo.
    start "" "http://localhost:9093"
    call npx tsx dashboard\ai-ops\server.ts
    goto :eof

:: ─────────────────────────────────────────────────────────────────────────────
:: UTILITIES
:: ─────────────────────────────────────────────────────────────────────────────

:opt_typecheck
    echo  %C_CYAN%[i]%C_RST%  Running TypeScript type check...
    echo.
    call npx tsc --noEmit
    if errorlevel 1 (
        echo  %C_RED%[✘]%C_RST%  Type errors found. Fix them before running tests.
    ) else (
        echo  %C_GREEN%[✔]%C_RST%  No type errors.
    )
    goto :eof

:opt_clean
    echo  %C_YELLOW%[!]  This will delete all reports, logs, and test artifacts.%C_RST%
    set /p "confirm=  Confirm? [y/N]: "
    if /i not "!confirm!"=="y" (
        echo  %C_DIM%[i]  Skipped.%C_RST%
        goto :eof
    )
    echo.
    if exist "dashboard\allure\results"      rmdir /s /q "dashboard\allure\results"
    if exist "dashboard\allure\report"       rmdir /s /q "dashboard\allure\report"
    if exist "dashboard\playwright\report"   rmdir /s /q "dashboard\playwright\report"
    if exist "dashboard\playwright\test-results" rmdir /s /q "dashboard\playwright\test-results"
    if exist "logs"                          rmdir /s /q "logs"
    echo  %C_GREEN%[✔]%C_RST%  Artifacts cleaned.
    goto :eof

:exit_jarvis
    echo.
    echo  %C_BCYAN%  JARVIS offline. Stay sharp.%C_RST%
    echo.
    exit /b 0

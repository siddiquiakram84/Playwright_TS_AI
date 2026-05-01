#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# J.A.R.V.I.S. — Playwright Automation Intelligence CLI v2.0
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; BCYAN='\033[1;36m'; ORANGE='\033[0;33m'
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
WHITE='\033[1;37m'; DIM='\033[2m'; BOLD='\033[1m'; RESET='\033[0m'

# ─── Spinner ──────────────────────────────────────────────────────────────────
spin() {
  local pid=$1 msg=$2
  local frames=('⣾' '⣽' '⣻' '⢿' '⡿' '⣟' '⣯' '⣷')
  while kill -0 "$pid" 2>/dev/null; do
    for f in "${frames[@]}"; do
      printf "\r  ${CYAN}${f}${RESET}  %s " "$msg"
      sleep 0.1
    done
  done
  printf "\r  ${GREEN}✔${RESET}  %-50s\n" "$msg"
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "  ${CYAN}ℹ${RESET}  $*"; }
success() { echo -e "  ${GREEN}✔${RESET}  $*"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "  ${RED}✘${RESET}  $*" >&2; }
section() { echo -e "\n  ${BCYAN}── $* ──${RESET}\n"; }
divider() { echo -e "  ${DIM}$(printf '─%.0s' {1..60})${RESET}"; }

# ─── WSL2 detection ───────────────────────────────────────────────────────────
is_wsl2() { grep -qi microsoft /proc/version 2>/dev/null; }

# ─── Prerequisite check ───────────────────────────────────────────────────────
check_prereqs() {
  local missing=0
  for cmd in node npm; do
    if ! command -v "$cmd" &>/dev/null; then
      error "Required tool not found: ${BOLD}${cmd}${RESET}"
      missing=$(( missing + 1 ))
    fi
  done
  [[ $missing -gt 0 ]] && { error "Install missing tools and retry."; exit 1; }
  # Docker is optional — only needed for Docker-related options
  if ! command -v docker &>/dev/null; then
    warn "Docker not found — Docker options (12–18) will not work."
  fi
}

# ─── JARVIS Banner ────────────────────────────────────────────────────────────
banner() {
  clear
  echo -e "${BCYAN}"
  echo '  ╔═══════════════════════════════════════════════════════════════╗'
  echo '  ║                                                               ║'
  echo '  ║    ░░░  J.A.R.V.I.S.  AUTOMATION  INTELLIGENCE  v2.0  ░░░   ║'
  echo '  ║          Just A Rather Very Intelligent System                ║'
  echo '  ║                                                               ║'
  echo '  ║    Playwright  ·  TypeScript  ·  Allure  ·  Grafana          ║'
  echo '  ║    InfluxDB  ·  Docker  ·  GitHub Actions  ·  GenAI v5      ║'
  echo '  ║                                                               ║'
  echo '  ╚═══════════════════════════════════════════════════════════════╝'
  echo -e "${RESET}"
  echo -e "  ${DIM}Session: $(date '+%Y-%m-%d %H:%M:%S')  │  Node: $(node -v)  │  Dir: $(pwd)${RESET}"
  echo ""
}

# ─── Menu ─────────────────────────────────────────────────────────────────────
show_menu() {
  echo -e "  ${WHITE}${BOLD}── TEST EXECUTION ───────────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[1]${RESET}  Install / Update dependencies"
  echo -e "  ${CYAN}[2]${RESET}  Run ALL tests (ui + api + hybrid)   ${DIM}[prompts headed/headless]${RESET}"
  echo -e "  ${CYAN}[3]${RESET}  Run UI tests only                   ${DIM}[Chrome · prompts headed/headless]${RESET}"
  echo -e "  ${CYAN}[4]${RESET}  Run API tests only                  ${DIM}(always headless)${RESET}"
  echo -e "  ${CYAN}[5]${RESET}  Run Hybrid tests only               ${DIM}[prompts headed/headless]${RESET}"
  echo -e "  ${CYAN}[6]${RESET}  Run UI tests – always headed        ${DIM}(watch browser, no prompt)${RESET}"
  echo -e "  ${CYAN}[7]${RESET}  Run in debug mode                   ${DIM}(step-through, always headed)${RESET}"
  echo ""
  echo -e "  ${WHITE}${BOLD}── BROWSER MATRIX ───────────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[25]${RESET} Run UI tests on Chrome     ${DIM}(Chromium · prompts headed/headless)${RESET}"
  echo -e "  ${CYAN}[26]${RESET} Run UI tests on Firefox    ${DIM}(Gecko · prompts headed/headless)${RESET}"
  echo -e "  ${CYAN}[27]${RESET} Run UI tests on Safari     ${DIM}(WebKit · prompts headed/headless)${RESET}"
  echo -e "  ${CYAN}[28]${RESET} Run UI tests on Edge       ${DIM}(Edge channel · prompts headed/headless)${RESET}"
  echo -e "  ${CYAN}[29]${RESET} Run UI tests – all browsers ${DIM}(matrix · prompts headed/headless)${RESET}"
  echo ""
  echo -e "  ${WHITE}${BOLD}── REPORTING ────────────────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[8]${RESET}  Generate Allure report"
  echo -e "  ${CYAN}[9]${RESET}  Serve Allure report         ${DIM}(opens browser)${RESET}"
  echo -e "  ${CYAN}[10]${RESET} Open Playwright HTML report"
  echo -e "  ${CYAN}[11]${RESET} Push metrics to InfluxDB    ${DIM}(requires monitoring stack)${RESET}"
  echo ""
  echo -e "  ${WHITE}${BOLD}── DOCKER ───────────────────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[12]${RESET} Docker: Build image"
  echo -e "  ${CYAN}[13]${RESET} Docker: Run ALL tests"
  echo -e "  ${CYAN}[14]${RESET} Docker: Run UI tests"
  echo -e "  ${CYAN}[15]${RESET} Docker: Run API tests"
  echo -e "  ${CYAN}[16]${RESET} Docker: Run Hybrid tests"
  echo -e "  ${CYAN}[17]${RESET} Docker: Start monitoring stack ${DIM}(Grafana+InfluxDB+Allure+JARVIS)${RESET}"
  echo -e "  ${CYAN}[18]${RESET} Docker: Stop all services"
  echo ""
  echo -e "  ${WHITE}${BOLD}── DASHBOARDS ───────────────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[19]${RESET} Open JARVIS dashboard       ${DIM}→ http://localhost:9090${RESET}"
  echo -e "  ${CYAN}[20]${RESET} Open Grafana dashboard      ${DIM}→ http://localhost:3000${RESET}"
  echo -e "  ${CYAN}[21]${RESET} Open Allure server          ${DIM}→ http://localhost:5050${RESET}"
  echo -e "  ${CYAN}[22]${RESET} Open InfluxDB UI            ${DIM}→ http://localhost:8086${RESET}"
  echo ""
  echo -e "  ${WHITE}${BOLD}── UTILITIES ────────────────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[23]${RESET} TypeScript type check"
  echo -e "  ${CYAN}[24]${RESET} Clean all artifacts         ${DIM}(allure-results, reports, logs)${RESET}"
  echo ""
  echo -e "  ${WHITE}${BOLD}── GenAI SUPERPOWERS ✦ ──────────────────────────────────────────${RESET}"
  echo -e "  ${CYAN}[30]${RESET} Run AI demo tests           ${DIM}(self-healing · visual · data)${RESET}"
  echo -e "  ${CYAN}[31]${RESET} Generate tests from user story ${DIM}(multi-agent pipeline)${RESET}"
  echo -e "  ${CYAN}[32]${RESET} Generate tests from natural language ${DIM}(\"test the checkout flow\")${RESET}"
  echo -e "  ${CYAN}[33]${RESET} Generate AI test data       ${DIM}(users · products · search terms)${RESET}"
  echo -e "  ${CYAN}[34]${RESET} Capture visual baselines    ${DIM}(establishes regression reference)${RESET}"
  echo -e "  ${CYAN}[35]${RESET} 🎬 Real-time Test Recorder  ${DIM}(record actions → AI generates spec)${RESET}"
  echo -e "  ${CYAN}[36]${RESET} 🤖 Start AI Ops Dashboard   ${DIM}(live LLM feed · admin → :9094)${RESET}"
  echo ""
  echo -e "  ${RED}[0]${RESET}  Exit"
  divider
  echo -ne "\n  ${BCYAN}»${RESET} Choose option: "
}

# ─── Open URL helper ──────────────────────────────────────────────────────────
open_url() {
  local url=$1
  if command -v xdg-open &>/dev/null; then
    xdg-open "$url" &>/dev/null &
  elif command -v open &>/dev/null; then
    open "$url"
  else
    info "Open manually: ${CYAN}${url}${RESET}"
  fi
}

# ─── Run command with spinner ─────────────────────────────────────────────────
# IMPORTANT: use `"$@" || exit_code=$?` — never `"$@"` alone with `set -e`,
# otherwise any non-zero exit (e.g. failed tests) terminates the whole script
# before post-run actions (dashboard launch) can execute.
run_cmd() {
  local label=$1; shift
  echo ""
  info "Starting: ${BOLD}${label}${RESET}"
  divider
  local exit_code=0
  "$@" || exit_code=$?
  divider
  if [[ $exit_code -eq 0 ]]; then
    success "${label} ${GREEN}completed successfully${RESET}"
  else
    error "${label} ${RED}failed (exit ${exit_code}) — check report for details${RESET}"
  fi
  echo ""
  read -rp "  Press [Enter] to continue..."
}

# ─── Docker guard ─────────────────────────────────────────────────────────────
require_docker() {
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed or not in PATH."
    echo ""
    read -rp "  Press [Enter] to continue..."
    return 1
  fi
  return 0
}

# ─── Browser install guard ────────────────────────────────────────────────────
# 1. Checks that the browser binary directory exists in the Playwright cache.
# 2. Validates host system library dependencies by running `npx playwright install`
#    (which is a no-op when already installed but still validates libs).
require_browser() {
  local browser=$1

  # WSL2 + WebKit: provide targeted guidance before binary/lib checks
  if [[ "$browser" == "webkit" ]] && is_wsl2; then
    echo ""
    info "${BOLD}WSL2 detected — WebKit (Safari) notes:${RESET}"
    info "  • Headless mode works after installing system deps (see fix below)"
    info "  • Headed mode requires a display server:"
    info "    - Windows 11 with WSLg: works out-of-the-box"
    info "    - Windows 10: install VcXsrv or X410, then: ${CYAN}export DISPLAY=:0${RESET}"
    if [[ -z "${DISPLAY:-}" ]]; then
      warn "  DISPLAY is not set — webkit will be forced headless on WSL2"
    fi
    echo ""
  fi

  # Step 1 — binary downloaded?
  if ! ls "$HOME/.cache/ms-playwright/" 2>/dev/null | grep -qi "^${browser}"; then
    warn "Browser ${BOLD}${browser}${RESET} binary is not downloaded."
    echo ""
    echo -ne "  ${YELLOW}?${RESET}  Install it now? (runs: sudo npx playwright install ${browser} --with-deps) [Y/n]: "
    local _ans
    read -r _ans </dev/tty
    if [[ "${_ans,,}" != "n" ]]; then
      echo ""
      info "Installing ${BOLD}${browser}${RESET} — this may take a few minutes..."
      divider
      if sudo npx playwright install "${browser}" --with-deps; then
        success "Browser ${BOLD}${browser}${RESET} installed successfully."
      else
        error "Installation failed. Try manually:"
        echo -e "  ${BOLD}${CYAN}sudo npx playwright install ${browser} --with-deps${RESET}"
        echo ""
        read -rp "  Press [Enter] to continue..."
        return 1
      fi
    else
      echo ""
      read -rp "  Press [Enter] to continue..."
      return 1
    fi
  fi

  # Step 2 — system libraries present?
  local dep_check
  dep_check=$(npx playwright install "${browser}" 2>&1 || true)
  if echo "$dep_check" | grep -qi "missing libraries"; then
    error "Browser ${BOLD}${browser}${RESET} is installed but system libraries are missing."
    echo ""
    local missing_libs
    missing_libs=$(echo "$dep_check" | grep -E "^\s+lib" | sed 's/^[[:space:]]*//')
    while IFS= read -r lib; do
      warn "  Missing: ${RED}${lib}${RESET}"
    done <<< "$missing_libs"
    echo ""
    echo -ne "  ${YELLOW}?${RESET}  Fix system deps now? (runs: sudo npx playwright install-deps ${browser}) [Y/n]: "
    local _depsans
    read -r _depsans </dev/tty
    if [[ "${_depsans,,}" != "n" ]]; then
      echo ""
      sudo env "PATH=$PATH" npx playwright install-deps "${browser}" \
        && success "System deps installed." \
        || { error "Dep install failed — try manually."; read -rp "  Press [Enter]..."; return 1; }
      if [[ "$browser" == "webkit" ]] && is_wsl2; then
        info "WSL2 extra webkit libs: sudo apt-get install -y libwoff1 libopus0 libwebp-dev"
      fi
    else
      read -rp "  Press [Enter] to continue..."
      return 1
    fi
  fi

  return 0
}

# ─── Headed / headless prompt ─────────────────────────────────────────────────
# Prompts the user for headed mode; echoes --headed or empty string.
ask_headed_flag() {
  echo -ne "  ${YELLOW}?${RESET}  Run headed (show browser window)? [y/N]: " >/dev/tty
  local _mode
  read -r _mode </dev/tty
  [[ "${_mode,,}" == "y" ]] && echo "--headed" || echo ""
}

# ─── Serve a static directory on a given port via Python HTTP server ──────────
# Kills any process already on that port, then starts a new server in the background.
serve_static() {
  local port=$1 dir=$2
  # Kill anything already on this port
  pkill -f "python3.*http.server.*${port}" 2>/dev/null || true
  sleep 0.2
  python3 -m http.server "$port" --directory "$dir" \
    >/tmp/serve-"${port}".log 2>&1 &
  disown $!
}

# ─── Post-run dashboard launcher ──────────────────────────────────────────────
# Called after every browser test run.
# Ensures JARVIS is up, generates Allure report, serves all three over HTTP,
# then opens them in the browser automatically.
post_run_dashboards() {
  echo ""
  section "Launching dashboards"

  # ── 0. Auto-push metrics to InfluxDB if monitoring stack is running ──────────
  if curl -sf http://localhost:8086/ping >/dev/null 2>&1; then
    info "InfluxDB detected — pushing test metrics..."
    npm run metrics:push >/tmp/metrics-push.log 2>&1 \
      && success "Metrics pushed to InfluxDB  →  ${CYAN}http://localhost:3000${RESET}" \
      || warn "Metrics push failed — check ${BOLD}/tmp/metrics-push.log${RESET}"
  fi

  # ── 1. (Re)start JARVIS on :9090 with explicit absolute paths ────────────
  # Always kill and restart so a stale server from a previous session
  # (with wrong cwd) never silently serves no-data.
  pkill -f "node.*dashboard/jarvis/server.js" 2>/dev/null || true
  sleep 0.3
  local proj_root
  proj_root="$(pwd)"
  RESULTS_FILE="${proj_root}/dashboard/playwright/test-results/results.json" \
  HISTORY_FILE="${proj_root}/dashboard/jarvis/metrics-history.json" \
  nohup node dashboard/jarvis/server.js >/tmp/jarvis.log 2>&1 &
  disown $!
  local tries=0
  until curl -sf http://localhost:9090/health >/dev/null 2>&1 || [[ $tries -ge 20 ]]; do
    sleep 0.3
    tries=$(( tries + 1 ))
  done
  if curl -sf http://localhost:9090/api/results >/dev/null 2>&1; then
    success "JARVIS fed  →  ${CYAN}http://localhost:9090${RESET}"
  else
    warn "JARVIS unreachable — see /tmp/jarvis.log"
  fi

  # ── 2. Serve Playwright HTML report on :9091 ──────────────────────────────
  local pw_report="dashboard/playwright/report"
  if [[ -f "${pw_report}/index.html" ]]; then
    serve_static 9091 "$pw_report"
    success "Playwright Report  →  ${CYAN}http://localhost:9091${RESET}"
  else
    warn "No Playwright report found — skipped"
  fi

  # ── 3. Generate Allure report, then serve on :9092 ────────────────────────
  # allure-playwright v3 uses resultsDir; fall back to root allure-results/
  # for any results generated before that fix was applied.
  local allure_src="dashboard/allure/results"
  local allure_out="dashboard/allure/report"
  if compgen -G "${allure_src}/*.json" >/dev/null 2>&1; then
    : # primary path has results — use as-is
  elif compgen -G "allure-results/*.json" >/dev/null 2>&1; then
    warn "Allure results found at ${BOLD}allure-results/${RESET} (old location) — moving to ${allure_src}/"
    mkdir -p "$allure_src"
    mv allure-results/* "$allure_src/" 2>/dev/null || true
    rmdir allure-results 2>/dev/null || true
  fi
  if compgen -G "${allure_src}/*.json" >/dev/null 2>&1; then
    info "Generating Allure report..."
    allure generate "$allure_src" --clean -o "$allure_out" >/dev/null 2>&1 \
      && success "Allure report generated" \
      || warn "allure CLI not found — run: npm install -g allure-commandline"
  fi
  if [[ -f "${allure_out}/index.html" ]]; then
    serve_static 9092 "$allure_out"
    success "Allure Report      →  ${CYAN}http://localhost:9092${RESET}"
  else
    warn "No Allure report found — run tests first or install: npm install -g allure-commandline"
  fi

  # ── 4. Open all available dashboards in the browser ───────────────────────
  sleep 0.5   # give python servers a moment to bind
  echo ""
  info "Opening in browser..."
  open_url "http://localhost:9090"
  [[ -f "${pw_report}/index.html" ]]  && open_url "http://localhost:9091"
  [[ -f "${allure_out}/index.html" ]] && open_url "http://localhost:9092"

  echo ""
  echo -e "  ${GREEN}●${RESET}  JARVIS Dashboard   ${CYAN}http://localhost:9090${RESET}"
  echo -e "  ${GREEN}●${RESET}  Playwright Report  ${CYAN}http://localhost:9091${RESET}"
  echo -e "  ${GREEN}●${RESET}  Allure Report      ${CYAN}http://localhost:9092${RESET}"
  echo ""
  read -rp "  Press [Enter] to continue..."
}

# ─── Browser test runner (with headed prompt + auto dashboards) ───────────────
run_browser_cmd() {
  local label=$1; shift
  local headed
  headed=$(ask_headed_flag)
  # shellcheck disable=SC2086
  run_cmd "$label${headed:+ (headed)}" npx playwright test "$@" $headed
  post_run_dashboards
}

# ─── Main loop ────────────────────────────────────────────────────────────────
main() {
  check_prereqs
  while true; do
    banner
    show_menu
    read -r choice
    echo ""

    case "$choice" in
      1)
        run_cmd "Install dependencies" \
          bash -c "npm ci && npx playwright install --with-deps"
        ;;
      2)
        run_browser_cmd "Run ALL tests"
        ;;
      3)
        run_browser_cmd "Run UI tests (Chrome)" --project=ui
        ;;
      4)
        run_cmd "Run API tests" npx playwright test --project=api
        post_run_dashboards
        ;;
      5)
        run_browser_cmd "Run Hybrid tests" --project=hybrid
        ;;
      6)
        run_cmd "Run UI tests (headed)" npx playwright test --project=ui --headed
        ;;
      7)
        info "Launching debug mode (opens browser DevTools)..."
        npx playwright test --debug
        ;;
      8)
        run_cmd "Generate Allure report" \
          bash -c "allure generate dashboard/allure/results --clean -o dashboard/allure/report && echo 'Report at: dashboard/allure/report/index.html'"
        ;;
      9)
        info "Serving Allure report at ${CYAN}http://localhost:5252${RESET} — press Ctrl+C to stop"
        allure serve dashboard/allure/results
        ;;
      10)
        run_cmd "Open Playwright HTML report" npx playwright show-report
        ;;
      11)
        run_cmd "Push metrics to InfluxDB" npm run metrics:push
        ;;
      12)
        require_docker || continue
        run_cmd "Docker: Build image" docker compose build playwright
        ;;
      13)
        require_docker || continue
        run_cmd "Docker: Run ALL tests" \
          docker compose --profile tests run --rm playwright
        ;;
      14)
        require_docker || continue
        run_cmd "Docker: Run UI tests" \
          docker compose --profile ui run --rm playwright-ui
        ;;
      15)
        require_docker || continue
        run_cmd "Docker: Run API tests" \
          docker compose --profile api run --rm playwright-api
        ;;
      16)
        require_docker || continue
        run_cmd "Docker: Run Hybrid tests" \
          docker compose --profile hybrid run --rm playwright-hybrid
        ;;
      17)
        require_docker || continue
        section "Starting monitoring stack"
        docker compose --profile monitoring up -d
        echo ""
        success "Services started:"
        echo -e "  ${GREEN}●${RESET}  JARVIS Dashboard  ${CYAN}http://localhost:9090${RESET}"
        echo -e "  ${GREEN}●${RESET}  Grafana           ${CYAN}http://localhost:3000${RESET}  ${DIM}(admin/admin)${RESET}"
        echo -e "  ${GREEN}●${RESET}  InfluxDB          ${CYAN}http://localhost:8086${RESET}  ${DIM}(admin/adminpassword)${RESET}"
        echo -e "  ${GREEN}●${RESET}  Allure            ${CYAN}http://localhost:5050${RESET}"
        echo ""
        read -rp "  Press [Enter] to continue..."
        ;;
      18)
        require_docker || continue
        run_cmd "Docker: Stop all services" docker compose down
        ;;
      19)
        info "Opening JARVIS Dashboard..."
        open_url "http://localhost:9090"
        info "If not running: ${CYAN}npm run dashboard${RESET} or ${CYAN}docker compose --profile monitoring up jarvis -d${RESET}"
        sleep 2
        ;;
      20)
        info "Opening Grafana..."
        open_url "http://localhost:3000"
        warn "Credentials: ${BOLD}admin / admin${RESET}"
        sleep 2
        ;;
      21)
        info "Opening Allure server..."
        open_url "http://localhost:5050"
        sleep 2
        ;;
      22)
        info "Opening InfluxDB UI..."
        open_url "http://localhost:8086"
        warn "Credentials: ${BOLD}admin / adminpassword${RESET}"
        sleep 2
        ;;
      23)
        run_cmd "TypeScript type check" npm run type-check
        ;;
      24)
        echo -ne "  ${YELLOW}⚠${RESET}  This will delete all artifacts. Confirm? [y/N]: "
        read -r confirm
        if [[ "${confirm,,}" == "y" ]]; then
          run_cmd "Clean artifacts" \
            bash -c "rm -rf dashboard/allure/results dashboard/allure/report dashboard/playwright/report dashboard/playwright/test-results logs && echo 'All clean.'"
        else
          info "Skipped."
          sleep 1
        fi
        ;;

      # ── Browser Matrix ──────────────────────────────────────────────────────
      25)
        require_browser chromium || continue
        run_browser_cmd "Run UI tests – Chrome (Chromium)" --project=ui
        ;;
      26)
        require_browser firefox || continue
        run_browser_cmd "Run UI tests – Firefox" --project=ui-firefox
        ;;
      27)
        require_browser webkit || continue
        run_browser_cmd "Run UI tests – Safari (WebKit)" --project=ui-webkit
        ;;
      28)
        require_browser msedge || continue
        run_browser_cmd "Run UI tests – Edge" --project=ui-edge
        ;;
      29)
        run_browser_cmd "Run UI tests – all browsers" \
          --project=ui --project=ui-firefox --project=ui-webkit --project=ui-edge
        ;;

      # ── GenAI Superpowers ────────────────────────────────────────────────────
      30)
        run_browser_cmd "GenAI: Run AI demo tests" --project=ai
        ;;
      31)
        echo -ne "  ${YELLOW}?${RESET}  Enter user story (or press Enter for default): "
        read -r _story </dev/tty
        [[ -z "$_story" ]] && _story="As a user I want to search for products and add them to the cart"
        echo -ne "  ${YELLOW}?${RESET}  Output file path (or press Enter to print only): "
        read -r _out </dev/tty
        if [[ -n "$_out" ]]; then
          run_cmd "GenAI: Generate spec from user story" \
            npx tsx core/scripts/generate-tests.ts --story "$_story" --output "$_out"
        else
          run_cmd "GenAI: Generate spec from user story" \
            npx tsx core/scripts/generate-tests.ts --story "$_story"
        fi
        ;;
      32)
        echo -ne "  ${YELLOW}?${RESET}  Enter instruction (e.g. 'test the checkout flow'): "
        read -r _nl </dev/tty
        [[ -z "$_nl" ]] && _nl="test the product search and filter functionality"
        echo -ne "  ${YELLOW}?${RESET}  Output file path (or press Enter to print only): "
        read -r _out </dev/tty
        if [[ -n "$_out" ]]; then
          run_cmd "GenAI: Generate spec from natural language" \
            npx tsx core/scripts/generate-tests.ts --nl "$_nl" --output "$_out"
        else
          run_cmd "GenAI: Generate spec from natural language" \
            npx tsx core/scripts/generate-tests.ts --nl "$_nl"
        fi
        ;;
      33)
        echo -ne "  ${YELLOW}?${RESET}  Data type — user / product / searchTerms [user]: "
        read -r _dtype </dev/tty
        [[ -z "$_dtype" ]] && _dtype="user"
        echo -ne "  ${YELLOW}?${RESET}  Count [1]: "
        read -r _count </dev/tty
        [[ -z "$_count" ]] && _count="1"
        echo -ne "  ${YELLOW}?${RESET}  Output file (or press Enter to print): "
        read -r _out </dev/tty
        if [[ -n "$_out" ]]; then
          run_cmd "GenAI: Generate test data (${_dtype} × ${_count})" \
            npx tsx core/scripts/generate-test-data.ts --type "$_dtype" --count "$_count" --output "$_out"
        else
          run_cmd "GenAI: Generate test data (${_dtype} × ${_count})" \
            npx tsx core/scripts/generate-test-data.ts --type "$_dtype" --count "$_count"
        fi
        ;;
      34)
        info "Capturing visual baselines — navigating to key pages and storing reference screenshots"
        run_browser_cmd "GenAI: Capture visual baselines" \
          --project=ai -g "baseline"
        ;;
      35)
        echo -ne "  ${YELLOW}?${RESET}  Starting URL (Enter for default site): "
        read -r _recurl </dev/tty
        echo -ne "  ${YELLOW}?${RESET}  Output spec path (Enter to print only): "
        read -r _recout </dev/tty
        echo ""
        section "AI Test Recorder"
        info "Browser will open. Perform your test steps, then press ${BOLD}Enter${RESET} in this terminal."
        echo ""
        if [[ -n "$_recout" ]]; then
          npx tsx core/scripts/record-test.ts \
            ${_recurl:+--url "$_recurl"} \
            --output "$_recout"
        else
          npx tsx core/scripts/record-test.ts \
            ${_recurl:+--url "$_recurl"}
        fi
        echo ""
        read -rp "  Press [Enter] to continue..."
        ;;
      36)
        section "AI Ops Dashboard"
        info "Starting AI Ops Dashboard (Next.js) on ${CYAN}http://localhost:9094${RESET}"
        info "Set ${BOLD}AI_PROVIDER=anthropic${RESET} + ${BOLD}ANTHROPIC_API_KEY${RESET} in .env to use Claude"
        info "Press Ctrl+C to stop."
        echo ""
        sleep 1
        open_url "http://localhost:9094/ai-ops" &
        cd dashboard-next && npm run dev
        ;;

      0)
        echo -e "\n  ${BCYAN}JARVIS offline. Stay sharp.${RESET}\n"
        exit 0
        ;;
      *)
        warn "Invalid option: ${choice}"
        sleep 1
        ;;
    esac
  done
}

main "$@"

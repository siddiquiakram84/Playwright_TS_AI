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

# ─── Prerequisite check ───────────────────────────────────────────────────────
check_prereqs() {
  local missing=0
  for cmd in node npm docker; do
    if ! command -v "$cmd" &>/dev/null; then
      error "Required tool not found: ${BOLD}${cmd}${RESET}"
      ((missing++))
    fi
  done
  [[ $missing -gt 0 ]] && { error "Install missing tools and retry."; exit 1; }
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
  echo '  ║    InfluxDB  ·  Docker  ·  GitHub Actions                    ║'
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
  echo -e "  ${CYAN}[2]${RESET}  Run ALL tests (ui + api + hybrid)"
  echo -e "  ${CYAN}[3]${RESET}  Run UI tests only           ${DIM}(Chromium)${RESET}"
  echo -e "  ${CYAN}[4]${RESET}  Run API tests only          ${DIM}(headless)${RESET}"
  echo -e "  ${CYAN}[5]${RESET}  Run Hybrid tests only"
  echo -e "  ${CYAN}[6]${RESET}  Run UI tests – headed mode  ${DIM}(watch browser)${RESET}"
  echo -e "  ${CYAN}[7]${RESET}  Run in debug mode           ${DIM}(step-through)${RESET}"
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
run_cmd() {
  local label=$1; shift
  echo ""
  info "Starting: ${BOLD}${label}${RESET}"
  divider
  "$@"
  local exit_code=$?
  divider
  if [[ $exit_code -eq 0 ]]; then
    success "${label} ${GREEN}completed successfully${RESET}"
  else
    error "${label} ${RED}failed (exit $exit_code)${RESET}"
  fi
  echo ""
  read -rp "  Press [Enter] to continue..."
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
          bash -c "npm ci && npx playwright install chromium --with-deps"
        ;;
      2)
        run_cmd "Run ALL tests" npx playwright test
        ;;
      3)
        run_cmd "Run UI tests" npx playwright test --project=ui
        ;;
      4)
        run_cmd "Run API tests" npx playwright test --project=api
        ;;
      5)
        run_cmd "Run Hybrid tests" npx playwright test --project=hybrid
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
          bash -c "allure generate allure-results --clean -o allure-report && echo 'Report at: allure-report/index.html'"
        ;;
      9)
        info "Serving Allure report at ${CYAN}http://localhost:5252${RESET} — press Ctrl+C to stop"
        allure serve allure-results
        ;;
      10)
        run_cmd "Open Playwright HTML report" npx playwright show-report
        ;;
      11)
        run_cmd "Push metrics to InfluxDB" npm run metrics:push
        ;;
      12)
        run_cmd "Docker: Build image" docker compose build playwright
        ;;
      13)
        run_cmd "Docker: Run ALL tests" \
          docker compose --profile tests run --rm playwright
        ;;
      14)
        run_cmd "Docker: Run UI tests" \
          docker compose --profile ui run --rm playwright-ui
        ;;
      15)
        run_cmd "Docker: Run API tests" \
          docker compose --profile api run --rm playwright-api
        ;;
      16)
        run_cmd "Docker: Run Hybrid tests" \
          docker compose --profile hybrid run --rm playwright-hybrid
        ;;
      17)
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
        run_cmd "Docker: Stop all services" docker compose down
        ;;
      19)
        info "Opening JARVIS Dashboard..."
        open_url "http://localhost:9090"
        info "If not running: ${CYAN}node dashboard/server.js${RESET} or ${CYAN}docker compose --profile monitoring up jarvis -d${RESET}"
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
            bash -c "rm -rf allure-results allure-report playwright-report test-results logs && echo 'All clean.'"
        else
          info "Skipped."
          sleep 1
        fi
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

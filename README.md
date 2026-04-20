# Playwright TS AI — Enterprise E2E Automation Framework

[![CI](https://github.com/siddiquiakram84/Playwright_TS_AI/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/playwright-ts-ai/actions/workflows/ci.yml)
[![Playwright](https://img.shields.io/badge/Playwright-1.49.0-45ba4b?logo=playwright)](https://playwright.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com)
[![Allure](https://img.shields.io/badge/Allure-3.0-orange)](https://allurereport.org)
[![Grafana](https://img.shields.io/badge/Grafana-JARVIS_Dashboard-F46800?logo=grafana)](http://localhost:3000)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> **Production-grade, distributed E2E automation framework** combining UI automation (Playwright), REST API testing, hybrid test orchestration, Allure reporting, a JARVIS-style live dashboard, Grafana metrics, and full CI/CD pipeline.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Interactive CLI (run.sh)](#interactive-cli)
- [Docker Execution](#docker-execution)
- [Reporting](#reporting)
- [JARVIS Dashboard](#jarvis-dashboard)
- [Grafana Metrics Dashboard](#grafana-metrics-dashboard)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
- [Design Decisions](#design-decisions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                   DISTRIBUTED TEST ARCHITECTURE                      │
│                                                                      │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐  │
│  │   UI Automation       │     │        API Automation             │  │
│  │   automationexercise  │     │        fakestoreapi.com           │  │
│  │                       │     │                                   │  │
│  │  Playwright + POM     │     │  BaseApiClient + Resource Clients │  │
│  │  Pages / Fixtures     │     │  Types / AJV Schema Validation    │  │
│  └──────────┬───────────┘     └──────────────┬────────────────────┘  │
│             │                                │                        │
│             └───────────────┬────────────────┘                       │
│                             │                                        │
│                    ┌────────▼────────┐                               │
│                    │  HYBRID TESTS   │  API setup → UI assertion      │
│                    └────────┬────────┘                               │
│                             │                                        │
│          ┌──────────────────▼──────────────────────────┐            │
│          │              REPORTING STACK                  │            │
│          │                                               │            │
│          │  Allure ─── HTML Report ─── Playwright JSON  │            │
│          │     │                            │            │            │
│          │  InfluxDB ──────────── Grafana   │            │            │
│          │                          │       │            │            │
│          │                    JARVIS Dashboard            │            │
│          └───────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI Automation | Playwright 1.49 + TypeScript 5.6 | Browser E2E testing |
| API Automation | Playwright APIRequestContext | REST API testing |
| Schema Validation | AJV 8 + ajv-formats | JSON schema contracts |
| Logging | Winston | Structured logging |
| Reporting | Allure 3 + HTML | Test reports |
| Metrics | InfluxDB 2.7 | Time-series test data |
| Dashboard | Grafana 10 | JARVIS live metrics |
| Custom UI | Node.js + Canvas API | Animated JARVIS dashboard |
| CI/CD | GitHub Actions | Automated pipeline |
| Containerization | Docker + Compose | Portable execution |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20.0.0 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10.0.0 | Bundled with Node |
| Docker | ≥ 24.0 | [docker.com](https://docker.com) |
| Docker Compose | ≥ 2.20 | Bundled with Docker Desktop |
| Allure CLI | ≥ 2.30 | `npm i -g allure-commandline` |

---

## Quick Start

```bash
# 1. Clone and enter the project
git clone https://github.com/your-org/playwright-ts-ai.git
cd playwright-ts-ai

# 2. Install Node dependencies
npm install

# 3. Install Playwright browsers (Chromium only for speed)
npx playwright install chromium --with-deps

# 4. Copy and configure environment
cp .env.example .env

# 5. Run all tests
npm test

# 6. Open Allure report
npm run allure:serve
```

Or use the interactive CLI:
```bash
chmod +x run.sh && ./run.sh
```

---

## Project Structure

```
playwright-ts-ai/
│
├── .github/
│   └── workflows/
│       └── ci.yml                   ← GitHub Actions pipeline
│
├── api/                             ← API automation layer
│   ├── clients/
│   │   ├── BaseApiClient.ts         ← HTTP engine: auth, logging, error handling
│   │   ├── AuthApiClient.ts         ← POST /auth/login, token management
│   │   ├── ProductsApiClient.ts     ← CRUD /products
│   │   ├── UsersApiClient.ts        ← CRUD /users
│   │   ├── CartsApiClient.ts        ← CRUD /carts
│   │   └── index.ts                 ← Barrel export
│   ├── schemas/
│   │   ├── product.schema.ts        ← AJV schema for Product
│   │   ├── user.schema.ts           ← AJV schema for User
│   │   └── cart.schema.ts           ← AJV schema for Cart
│   └── types/
│       ├── product.types.ts         ← Product, CreateProductPayload
│       ├── user.types.ts            ← User, CreateUserPayload
│       ├── cart.types.ts            ← Cart, CreateCartPayload
│       ├── auth.types.ts            ← LoginPayload, LoginResponse
│       └── index.ts                 ← Barrel export
│
├── pages/                           ← Page Object Model layer
│   ├── BasePage.ts                  ← navigate, assertVisible, helpers
│   ├── HomePage.ts                  ← Nav, login state, logout
│   ├── LoginPage.ts                 ← Login form, signup form
│   ├── SignupPage.ts                ← Full account registration form
│   ├── ProductsPage.ts              ← Listing, search, add to cart
│   ├── ProductDetailPage.ts         ← Product info, quantity, add to cart
│   ├── CartPage.ts                  ← Cart items, remove, checkout
│   ├── CheckoutPage.ts              ← Address, payment, order confirmation
│   └── index.ts                     ← Barrel export
│
├── fixtures/                        ← Playwright fixture DI layer
│   ├── pageFixtures.ts              ← test.extend with all page objects
│   ├── apiFixtures.ts               ← test.extend with all API clients
│   └── index.ts                     ← mergeTests() — combined fixture
│
├── tests/                           ← Test specifications
│   ├── ui/
│   │   ├── auth/
│   │   │   ├── login.spec.ts        ← Valid login, invalid scenarios (data-driven)
│   │   │   └── signup.spec.ts       ← New user registration, duplicate email
│   │   ├── products/
│   │   │   ├── productListing.spec.ts  ← Listing, detail, add to cart
│   │   │   └── productSearch.spec.ts   ← Parameterized keyword search
│   │   └── cart/
│   │       └── cart.spec.ts         ← Guest + auth cart, checkout E2E
│   ├── api/
│   │   ├── products.api.spec.ts     ← Full CRUD + schema validation
│   │   ├── users.api.spec.ts        ← Full CRUD + email format validation
│   │   ├── carts.api.spec.ts        ← Full CRUD + product quantity validation
│   │   └── auth.api.spec.ts         ← JWT token + authenticated requests
│   └── hybrid/
│       └── cart.hybrid.spec.ts      ← API arrange → UI assert patterns
│
├── utils/                           ← Shared utilities
│   ├── envConfig.ts                 ← Type-safe env, fail-fast validation
│   ├── logger.ts                    ← Winston: console + file transports
│   ├── helpers.ts                   ← randomEmail, randomString, waitForCondition
│   ├── schemaValidator.ts           ← AJV wrapper with compiled schema cache
│   └── metricsReporter.ts           ← InfluxDB test metrics writer
│
├── test-data/                       ← External test data (JSON)
│   ├── users.json                   ← Login scenarios, new user data, API user
│   ├── products.json                ← Search keywords, categories, create payload
│   └── carts.json                   ← Cart payloads, payment data
│
├── scripts/
│   └── push-metrics.ts              ← CLI: parse results → push to InfluxDB
│
├── grafana/                         ← Grafana auto-provisioning
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── influxdb.yml         ← InfluxDB datasource config
│   │   └── dashboards/
│   │       └── dashboards.yml       ← Dashboard folder config
│   └── dashboards/
│       └── playwright-jarvis.json   ← Full JARVIS Grafana dashboard
│
├── dashboard/                       ← Custom animated JARVIS dashboard
│   ├── server.js                    ← Node.js HTTP server + results API
│   └── index.html                   ← Full JARVIS animated interface
│
├── playwright.config.ts             ← Multi-project config (ui|api|hybrid)
├── tsconfig.json                    ← TypeScript config with path aliases
├── package.json                     ← Scripts, dependencies
├── .env                             ← Local environment (git-ignored)
├── .env.example                     ← Environment template
├── .gitignore
├── Dockerfile                       ← Container image definition
├── docker-compose.yml               ← Full stack: tests + monitoring
└── run.sh                           ← Interactive JARVIS CLI menu
```

---

## Running Tests

### Local Execution

```bash
# All tests (all projects)
npm test

# By project
npm run test:ui          # Chrome UI tests
npm run test:api         # API tests (no browser)
npm run test:hybrid      # Hybrid (API + UI)

# Headed mode (watch browser)
npm run test:headed

# Debug mode (step through)
npm run test:debug

# Specific file
npx playwright test tests/ui/auth/login.spec.ts

# Specific test by title
npx playwright test -g "should login successfully"

# With tags (requires Playwright 1.49+)
npx playwright test --grep @smoke
```

### Type Check

```bash
npm run type-check
```

---

## Interactive CLI

`run.sh` provides a full interactive menu for all framework operations:

```bash
chmod +x run.sh
./run.sh
```

```
  ╔═══════════════════════════════════════════════════════════╗
  ║   J.A.R.V.I.S. AUTOMATION INTELLIGENCE v2.0              ║
  ║   Playwright · TypeScript · Allure · Grafana · Docker     ║
  ╚═══════════════════════════════════════════════════════════╝

  ── TEST EXECUTION ──────────────────────────────────────────
  [1]  Install / Update dependencies
  [2]  Run ALL tests
  [3]  Run UI tests only
  [4]  Run API tests only
  [5]  Run Hybrid tests only
  [6]  Run UI tests (headed mode)
  [7]  Run tests in debug mode

  ── REPORTING ───────────────────────────────────────────────
  [8]  Generate Allure report
  [9]  Serve Allure report (browser)
  [10] Open Playwright HTML report
  [11] Push metrics to InfluxDB

  ── DOCKER ──────────────────────────────────────────────────
  [12] Docker: Build image
  [13] Docker: Run all tests
  [14] Docker: Run UI tests
  [15] Docker: Run API tests
  [16] Docker: Start monitoring stack (Grafana + InfluxDB + Allure + JARVIS)
  [17] Docker: Stop all services

  ── DASHBOARDS ──────────────────────────────────────────────
  [18] Open JARVIS dashboard   → http://localhost:9090
  [19] Open Grafana dashboard  → http://localhost:3000
  [20] Open Allure service     → http://localhost:5050

  ── UTILITIES ───────────────────────────────────────────────
  [21] TypeScript type check
  [22] Clean all artifacts
  [0]  Exit
```

---

## Docker Execution

### Build and Run Tests

```bash
# Build the image
docker compose build playwright

# Run all tests
docker compose run --rm playwright

# Run specific project
docker compose run --rm playwright-api
docker compose run --rm playwright-ui
docker compose run --rm playwright-hybrid
```

### Start Full Monitoring Stack

```bash
# Starts: InfluxDB + Grafana + Allure + JARVIS Dashboard
docker compose --profile monitoring up -d

# Services:
#   JARVIS Dashboard  → http://localhost:9090
#   Grafana           → http://localhost:3000  (admin/admin)
#   InfluxDB          → http://localhost:8086  (admin/adminpassword)
#   Allure            → http://localhost:5050
```

### Run Tests + Push Metrics in One Command

```bash
docker compose run --rm playwright && npm run metrics:push
```

---

## Reporting

### Allure Report

```bash
# Generate after test run
npm run allure:generate

# Open in browser
npm run allure:open

# Live server (auto-refresh)
npm run allure:serve
```

### Playwright HTML Report

```bash
npm run report
```

Reports include: screenshots on failure, video traces, test steps, request/response logs.

---

## JARVIS Dashboard

A custom animated Iron Man HUD-style dashboard built with vanilla JS and Canvas API.

```bash
# Start the server
node dashboard/server.js

# Open browser
open http://localhost:9090
```

**Features:**
- Arc reactor with pulsing heartbeat animation
- Real-time pass rate circular gauge
- Project breakdown bars (UI / API / Hybrid)
- EKG-style heartbeat canvas (pulse speed reflects test health)
- Scrolling particle background
- Hexagonal HUD grid overlay
- Live test trend chart
- Recent failures + slowest tests panels
- Auto-refresh every 10 seconds

---

## Grafana Metrics Dashboard

Professional time-series metrics dashboard powered by InfluxDB + Grafana.

```bash
# Start the monitoring stack
docker compose --profile monitoring up -d

# Open Grafana
open http://localhost:3000  # admin / admin
```

**Dashboard panels:**
- Pass Rate gauge (threshold coloring: red/orange/green)
- Total / Passed / Failed / Skipped KPI stats
- 7-day test trend (time series with fill)
- Project distribution (pie chart)
- Duration distribution by project (bar chart)
- Failure rate trend (time series)
- Recent test runs table
- Top failing tests table

### Push Metrics After a Run

```bash
# Requires monitoring stack running
npm run metrics:push
```

---

## CI/CD Pipeline

GitHub Actions workflow at `.github/workflows/ci.yml`:

```
Push / PR
    │
    ├──► API Tests Job    (no browser, fast)
    │
    ├──► UI Tests Job     (Chromium, parallel)
    │
    └──► Hybrid Tests Job (depends on API + UI)
              │
              └──► Allure Report Job
                        │
                        └──► Deploy to GitHub Pages (main branch only)
```

**Configuration:**
- Retries: 2 on CI, 0 locally
- Workers: 4 on CI
- Artifacts retained: 14 days (reports), 30 days (allure)
- Secrets required: `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`

---

## Environment Configuration

Copy `.env.example` to `.env` and set values:

| Variable | Default | Description |
|---|---|---|
| `ENV` | `test` | Environment name: `dev` / `test` / `prod` |
| `UI_BASE_URL` | `https://automationexercise.com` | UI application base URL |
| `API_BASE_URL` | `https://fakestoreapi.com` | API base URL |
| `TEST_USER_EMAIL` | — | Login credentials for UI tests |
| `TEST_USER_PASSWORD` | — | Login credentials for UI tests |
| `DEFAULT_TIMEOUT` | `30000` | Global timeout (ms) |
| `API_TIMEOUT` | `15000` | API request timeout (ms) |
| `ALLURE_RESULTS_DIR` | `allure-results` | Allure output directory |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB endpoint |
| `INFLUXDB_TOKEN` | `mytoken` | InfluxDB auth token |
| `INFLUXDB_ORG` | `playwright` | InfluxDB organisation |
| `INFLUXDB_BUCKET` | `testresults` | InfluxDB bucket |

---

## Design Decisions

| Decision | Rationale |
|---|---|
| `BaseApiClient` as HTTP engine | Centralises auth, logging, retry logic — resource clients stay thin |
| `mergeTests()` in fixtures | Hybrid specs get both page objects and API clients from one import |
| AJV cached validators | Compiled once per schema, reused across all test cases — no per-call overhead |
| YAML anchors in docker-compose | Replaces deprecated `extends` keyword — DRY service definitions |
| JSON reporter + JARVIS dashboard | Self-hosted live dashboard without external SaaS dependency |
| InfluxDB + Grafana | Industry-standard time-series stack for long-term trend analysis |
| Separate CI jobs per project | API tests run without browser install (faster); hybrid gates on both |

---

## License

MIT © 2024 — Built for enterprise-grade automation benchmarks.

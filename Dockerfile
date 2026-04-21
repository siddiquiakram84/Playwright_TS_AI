FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Install Node dependencies only — browsers are pre-installed in the base image
# (mcr.microsoft.com/playwright already ships Chromium, Firefox, WebKit, Edge)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy framework source (.dockerignore excludes node_modules, reports, artifacts)
COPY . .

# Ensure output directories exist with correct permissions
# These dirs are volume-mounted at runtime; pre-creating them prevents Docker
# from recreating them as root-owned on first run, which would block writes.
RUN mkdir -p dashboard/allure/results dashboard/allure/report \
              dashboard/playwright/report dashboard/playwright/test-results \
              dashboard/jarvis logs \
    && chmod -R 777 dashboard logs

ENV NODE_ENV=test \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Default: run all tests. Override via docker compose command:
ENTRYPOINT ["npx", "playwright", "test"]
CMD []

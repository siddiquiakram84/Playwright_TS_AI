FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Install only Chromium browser + system deps
RUN npx playwright install chromium --with-deps

# Copy framework source
COPY . .

# Ensure output directories exist with correct permissions
RUN mkdir -p allure-results playwright-report test-results logs \
    && chmod -R 777 allure-results playwright-report test-results logs

ENV NODE_ENV=test \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Default: run all tests. Override via docker compose command:
ENTRYPOINT ["npx", "playwright", "test"]
CMD []

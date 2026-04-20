FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Install all browsers + system deps (required for multi-browser matrix runs)
RUN npx playwright install --with-deps

# Copy framework source
COPY . .

# Ensure output directories exist with correct permissions
RUN mkdir -p dashboard/allure/results dashboard/allure/report \
              dashboard/playwright/report dashboard/playwright/test-results logs \
    && chmod -R 777 dashboard/allure dashboard/playwright logs

ENV NODE_ENV=test \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Default: run all tests. Override via docker compose command:
ENTRYPOINT ["npx", "playwright", "test"]
CMD []

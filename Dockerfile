FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

RUN npm ci

# Copy framework source
COPY . .

# Default command — override via docker run or docker-compose
CMD ["npx", "playwright", "test"]

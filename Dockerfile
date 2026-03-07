# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy source code
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application (SSR mode)
RUN pnpm -F @typewords/nuxt build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built output from builder
COPY --from=builder /app/apps/nuxt/.output /app/.output

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "/app/.output/server/index.mjs"]

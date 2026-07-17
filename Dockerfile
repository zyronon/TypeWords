# Build stage
FROM node:24-alpine AS builder

# Install pnpm and git
RUN apk add --no-cache git && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy source code
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm run docker-build

# Production stage
FROM nginx:alpine

# Copy built application from builder
COPY --from=builder /app/apps/nuxt/.output/public /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start the application
CMD ["nginx", "-g", "daemon off;"]

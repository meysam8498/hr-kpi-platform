FROM node:20-alpine AS base

LABEL org.opencontainers.image.title="HR KPI Platform — Frontend"
LABEL org.opencontainers.image.description="Next.js dashboard for the HR KPI management system (Persian UI, dark/light themes)"
LABEL org.opencontainers.image.authors="Meysam Ijadi <ijadi8498@gmail.com>"
LABEL org.opencontainers.image.source="https://github.com/meysam8498/hr-kpi-platform"
LABEL org.opencontainers.image.documentation="https://github.com/meysam8498/hr-kpi-platform#readme"
LABEL org.opencontainers.image.licenses="MIT"

# Install dependencies only
FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Bake the API upstream at build time (standalone serializes next.config).
# Default to the docker-compose service name; local dev overrides this.
ARG API_UPSTREAM=http://backend:8000
ENV API_UPSTREAM=$API_UPSTREAM
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
